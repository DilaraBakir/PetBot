# PetBot 🐾

An AI-powered pet care assistant with vision understanding, multilingual support, real-time streaming, and an intelligent feedback system. Built with React and the Groq API.

![PetBot](https://img.shields.io/badge/AI-Groq%20LLaMA-7c3aed) ![React](https://img.shields.io/badge/Frontend-React-61dafb) ![Vision](https://img.shields.io/badge/Vision-LLaMA%204-orange)

## Features

**Core AI**
- Real-time streaming responses (word by word, like ChatGPT)
- Automatic language detection — responds in Turkish or English based on user input
- Conversation memory with auto-summarization for long chats
- Image upload with animal breed identification (vision-language model)
- Automatic image labeling (species, breed, color, environment, behavior)

**Feedback & Analytics**
- Thumbs up/down feedback on every response
- Confidence scoring — the model rates its own response accuracy (1–10) with reasoning
- Sentiment analysis on negative feedback — automatically classifies why a response was unhelpful (too vague, off-topic, inaccurate, too long, missing medical context)
- Live feedback stats dashboard in the sidebar (total responses, satisfaction rate)

**User Experience**
- Persistent chat history with sidebar navigation
- Auto-named conversations based on first message
- Follow-up question suggestions after each response
- Suggested starter questions on first open
- AI-powered Pet Care Challenge quiz game with scoring and streak system
- Mobile responsive design
- EN / TR language toggle in the quiz game

## Tech Stack

- **Frontend:** React (Create React App)
- **AI Models:** LLaMA 3.3 70B (chat), LLaMA 4 Scout 17B (vision)
- **API:** Groq Cloud API
- **Storage:** localStorage (chat history, confidence scores, image labels)

## Getting Started

**1. Clone the repository**
```bash
git clone https://github.com/DilaraBakir/PetBot.git
cd PetBot
npm install
```

**2. Create a `.env` file in the project root**
```
REACT_APP_GROQ_API_KEY=your_groq_api_key_here
```

Get a free API key at [console.groq.com](https://console.groq.com)

**3. Start the app**
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
  App.js        — Main chat interface, state management
  openai.js     — Groq API calls (chat, vision, follow-ups, confidence, sentiment, summarization)
  Game.js       — AI-powered Pet Care Challenge quiz game
  App.css       — Global styles
```

## Research Connections

This project explores several active areas in AI research:

- **NLP / Generative AI** — Multilingual LLM deployment, language detection, context window management via summarization
- **Vision-Language Models** — Grounding visual input (animal photos) with language output (breed identification, care tips)
- **Reinforcement Learning from Human Feedback** — User thumbs up/down as a reward signal; confidence scoring as a self-evaluation mechanism
- **Sentiment Analysis** — Automated classification of negative feedback into failure modes (off-topic, too vague, inaccurate, etc.)

## About

Built by [Dilara Bakır](https://dilarabakir.vercel.app) as part of an MSc application portfolio.
