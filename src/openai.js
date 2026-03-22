import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.REACT_APP_GROQ_API_KEY,
    dangerouslyAllowBrowser: true
});

export async function summarizeConversation(messages) {
    const res = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
            {
                role: "system",
                content: "Summarize the following pet-related conversation in 3-4 sentences. Keep the key facts about the pet (name, breed, health issues, etc). Be concise."
            },
            {
                role: "user",
                content: messages.map(m => `${m.role}: ${m.content}`).join('\n')
            }
        ],
        max_tokens: 200,
    });
    return res.choices[0].message.content;
}

export async function sendMsgToOpenAI(messages, imageBase64 = null, onChunk = null, summary = null) {
    if (!Array.isArray(messages)) messages = [];

    const systemPrompt = {
        role: "system",
        content: `You are PetBot, a friendly AI assistant specialized in pets and animal adoption.
    - Answer questions about breeds, care, training, health, and adoption
    - Always respond in the language the user used in their MOST RECENT message, regardless of previous conversation language
    - If the most recent message is in Turkish, respond entirely in Turkish
    - If the most recent message is in English, respond entirely in English
    - Never mix languages mid-response under any circumstances
    - If an image is provided, analyze the animal in it and provide breed info and care tips
    - When analyzing an image, use the language of the most recent text message in the conversation
    - Be concise and direct. Avoid unnecessary repetition or padding.
    - Only provide long responses when the question genuinely requires detailed explanation (e.g. step-by-step care guides).
    - For simple yes/no questions or basic facts, keep responses under 3 sentences.
    - If the question is not about pets or animals, politely redirect: "I'm specialized in pet care! Did you mean to ask about water safety for your pet?"
    - Never answer general human health, food safety, or non-pet questions
    - Never use bold headers or numbered lists unless absolutely necessary. Write in natural prose instead.
    ${summary ? `\n- Previous conversation summary: ${summary}` : ''}`
    };

    const cleanHistory = messages
        .filter(m => m && m.role && m.content && m.content.trim() !== '')
        .map(m => ({ role: m.role, content: m.content }));

    let lastMessage;

    if (imageBase64) {
        lastMessage = {
            role: "user",
            content: [
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
                { type: "text", text: cleanHistory.length > 0 ? cleanHistory[cleanHistory.length - 1].content : "What animal is this? Please respond in the same language as the conversation." }
            ]
        };
        cleanHistory.pop();
    } else {
        lastMessage = cleanHistory.pop();
    }

    if (imageBase64) {
        const res = await groq.chat.completions.create({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [systemPrompt, ...cleanHistory, lastMessage],
            max_tokens: 700,
            temperature: 0.7,
        });
        return res.choices[0].message.content;
    }

    const stream = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [systemPrompt, ...cleanHistory, lastMessage],
        max_tokens: 700,
        temperature: 0.7,
        stream: true,
    });

    let full = '';
    for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
            full += text;
            if (onChunk) onChunk(full);
            await new Promise(resolve => setTimeout(resolve, 20));
        }
    }
    return full;
}

export async function generateFollowUps(botResponse) {
    // detect language from bot response itself
    const detectedLang = /[çğışöüÇĞİŞÖÜ]/.test(botResponse) ? 'tr' : 'en';

    const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
            role: 'system',
            content: `You are a pet care assistant. Based on the response below, generate exactly 3 short follow-up questions a user might want to ask next.
      IMPORTANT: All questions must be strictly about pets, animals, or pet care. Never suggest questions about general topics like water safety, human health, or anything unrelated to pets.
      Respond ONLY in this exact JSON format, nothing else: {"questions": ["question 1", "question 2", "question 3"]}
      Language: ${detectedLang === 'tr' ? 'Turkish' : 'English'}
      Keep each question under 8 words. Make them specific and useful.`
        }, {
            role: 'user',
            content: botResponse
        }],
        max_tokens: 150,
        temperature: 0.8,
    });

    const text = res.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    return data.questions;
}

export async function scoreConfidence(botResponse, userMessage = '') {
    const detectedLang = /[çğışöüÇĞİŞÖÜ]/.test(botResponse + userMessage) ? 'tr' : 'en';

    const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
            role: 'system',
            content: `You are evaluating the quality of a pet care AI response.
      The conversation is in ${detectedLang === 'tr' ? 'Turkish' : 'English'}.
      Rate the confidence and accuracy of the response on a scale of 1-10.
      Consider whether the response actually answers the question asked.
      Respond ONLY in this exact JSON format, nothing else:
      {"score": 8, "reason": "one short sentence why"}
      Write the reason in ${detectedLang === 'tr' ? 'Turkish' : 'English'}.
      Be honest — if the response is vague or uncertain, give a low score.`
        }, {
            role: 'user',
            content: `User asked: "${userMessage}"\nBot responded: "${botResponse}"\nRate this response.`
        }],
        max_tokens: 80,
        temperature: 0.3,
    });

    const text = res.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
}

export async function analyzeFeedback(userMessage, botResponse) {
    const detectedLang = /[çğışöüÇĞİŞÖÜ]/.test(botResponse + userMessage) ? 'tr' : 'en';

    const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
            role: 'system',
            content: `You are analyzing why a pet care AI response received negative feedback.
      The conversation is in ${detectedLang === 'tr' ? 'Turkish' : 'English'}.
      You will be given both the user's question AND the bot's response.
      Classify the issue into ONE of these categories:
      - "too_vague": response lacks specific details
      - "off_topic": response did not address the user's actual question
      - "inaccurate": response contains potentially wrong information
      - "too_long": response is unnecessarily long
      - "missing_medical": health question was not handled carefully enough
      Be very conservative in your classification. Most responses are fine — only flag a genuine problem.
      - "too_vague": ONLY if the response gives no useful details at all
      - "off_topic": ONLY if the response completely ignores the question
      - "inaccurate": ONLY if you can identify a specific factual error
      - "too_long": ONLY if the response is clearly padded with repetition
      - "missing_medical": ONLY if a health emergency was not taken seriously
      If the response is reasonable and helpful, do not flag it harshly.
      Respond ONLY in this exact JSON format:
      {"category": "too_vague", "label": "${detectedLang === 'tr' ? 'Çok belirsiz' : 'Too vague'}", "suggestion": "one short sentence in ${detectedLang === 'tr' ? 'Turkish' : 'English'}"}`
        }, {
            role: 'user',
            content: `User asked: "${userMessage}"\n\nBot responded: "${botResponse}"\n\nWhy did this receive negative feedback?`
        }],
        max_tokens: 100,
        temperature: 0.3,
    });

    const text = res.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
}

export async function extractImageLabels(imageBase64) {
    const res = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{
            role: "user",
            content: [
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
                {
                    type: "text", text: `Look at this image and extract labels. Respond ONLY in this exact JSON format, nothing else:
        {"labels": ["label1", "label2", "label3", "label4", "label5"]}
        Include: animal species, breed if visible, color, size, environment, mood/behavior.
        Keep each label 1-2 words max. Maximum 6 labels.`
                }
            ]
        }],
        max_tokens: 100,
        temperature: 0.3,
    });

    const text = res.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    return data.labels;
}