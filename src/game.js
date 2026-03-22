import { useState } from 'react';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.REACT_APP_GROQ_API_KEY,
  dangerouslyAllowBrowser: true
});

const ANIMALS = ['🐶 dog', '🐱 cat', '🐦 bird', '🐰 rabbit', '🐹 hamster', '🐠 fish', '🦜 parrot', '🐢 turtle'];

const LEVELS = {
  en: [
    { name: 'Beginner', min: 0, max: 3, color: '#86efac', emoji: '🌱' },
    { name: 'Intermediate', min: 4, max: 7, color: '#fde68a', emoji: '⭐' },
    { name: 'Expert', min: 8, max: 999, color: '#c4b5fd', emoji: '🏆' },
  ],
  tr: [
    { name: 'Başlangıç', min: 0, max: 3, color: '#86efac', emoji: '🌱' },
    { name: 'Orta', min: 4, max: 7, color: '#fde68a', emoji: '⭐' },
    { name: 'Uzman', min: 8, max: 999, color: '#c4b5fd', emoji: '🏆' },
  ]
};

function getLevel(score, lang) {
  return LEVELS[lang].find(l => score >= l.min && score <= l.max) || LEVELS[lang][0];
}

export default function Game({ onClose }) {
  const [phase, setPhase] = useState('intro');
  const [scenario, setScenario] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [score, setScore] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState(0);
  const [lang, setLang] = useState('en');

  const t = {
    subtitle: lang === 'tr' ? 'Yapay zeka destekli bakım senaryoları' : 'AI-powered pet care scenarios',
    description: lang === 'tr'
      ? 'Yapay zeka her turda benzersiz bir evcil hayvan senaryosu üretir. Doğru kararı ver, puan kazan ve seviye atla!'
      : 'The AI generates a unique pet care scenario every round. Make the right decision, earn points, and level up!',
    pts: lang === 'tr' ? 'puan' : 'pts',
    start: lang === 'tr' ? 'Başla 🚀' : 'Start 🚀',
    generating: lang === 'tr' ? 'Yapay zeka senaryo üretiyor...' : 'AI is generating a scenario...',
    correct: lang === 'tr' ? '✅ Doğru! ' : '✅ Correct! ',
    wrong: lang === 'tr' ? '❌ Yanlış. ' : '❌ Wrong. ',
    streak: lang === 'tr' ? 'seri!' : 'streak!',
    next: lang === 'tr' ? 'Sonraki Soru →' : 'Next Question →',
    exit: lang === 'tr' ? '✕ Çıkış' : '✕ Exit',
  };

  const generateScenario = async () => {
    setLoading(true);
    setSelected(null);
    setResult(null);
    setPhase('playing');

    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];

    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'system',
          content: `You are the AI engine of a pet care quiz game.
          Generate a scenario in ${lang === 'tr' ? 'Turkish' : 'English'}.
          Respond ONLY in this exact JSON format, nothing else:
          {
            "animal": "animal emoji and name",
            "scenario": "an interesting and realistic 2-3 sentence situation",
            "question": "${lang === 'tr' ? 'Ne yapmalısın?' : 'What should you do?'}",
            "options": ["option A", "option B", "option C"],
            "correct": 0,
            "explanation": "Why this answer is correct, 2 sentence explanation"
          }
          The correct field is the index of the correct option (0, 1, or 2).
          Make the options clearly different from each other.
          The correct answer should be at a different index each time.
          IMPORTANT: The ENTIRE response including scenario, question, options and explanation must be in ${lang === 'tr' ? 'Turkish' : 'English'}.`
        }, {
          role: 'user',
          content: `Generate a pet care scenario about a ${animal}.`
        }],
        max_tokens: 400,
        temperature: 0.9,
      });

      const text = res.choices[0].message.content;
      const clean = text.replace(/```json|```/g, '').trim();
      const data = JSON.parse(clean);
      setScenario(data);
    } catch (err) {
      console.error(err);
      setScenario(lang === 'tr' ? {
        animal: '🐱 kedi',
        scenario: 'Kediniz 2 gündür su içmiyor ve normalden sessiz davranıyor.',
        question: 'Ne yapmalısın?',
        options: ['Veterinere götür', 'Bekle geçer', 'Farklı su kabı dene'],
        correct: 0,
        explanation: 'Su içmemek dehidrasyona yol açabilir. Veteriner kontrolü şart.'
      } : {
        animal: '🐱 cat',
        scenario: "Your cat hasn't been drinking water for 2 days and is quieter than usual.",
        question: 'What should you do?',
        options: ['Take to the vet immediately', 'Wait and see', 'Try a different water bowl'],
        correct: 0,
        explanation: 'Not drinking water can lead to dehydration quickly. A vet check is essential.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (index) => {
    if (selected !== null) return;
    setSelected(index);
    setQuestionCount(q => q + 1);

    const isCorrect = index === scenario.correct;
    setResult(isCorrect);

    if (isCorrect) {
      setScore(s => s + 1);
      setStreak(s => s + 1);
    } else {
      setStreak(0);
    }
  };

  const level = getLevel(score, lang);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#0f172a',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      animation: 'fadeIn 0.2s ease'
    }}>

      {/* Header */}
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #1e293b',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '22px' }}>🎮</span>
          <div>
            <p style={{ margin: 0, color: '#fff', fontWeight: '600', fontSize: '15px' }}>Pet Care Challenge</p>
            <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>{t.subtitle}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {questionCount > 0 && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {streak >= 2 && (
                <div style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#c4b5fd' }}>
                  🔥 {streak} {t.streak}
                </div>
              )}
              <div style={{ background: '#1e293b', borderRadius: '20px', padding: '4px 14px', fontSize: '13px', color: level.color, fontWeight: '600' }}>
                {level.emoji} {score}/{questionCount}
              </div>
              <div style={{ background: '#1e293b', borderRadius: '20px', padding: '4px 14px', fontSize: '12px', color: level.color }}>
                {level.name}
              </div>
            </div>
          )}
          <button onClick={onClose} style={{
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: '8px', padding: '6px 14px',
            color: '#94a3b8', cursor: 'pointer', fontSize: '13px'
          }}>{t.exit}</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>

        {phase === 'intro' && (
          <div style={{ textAlign: 'center', maxWidth: '480px' }}>
            <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🐾</div>
            <h2 style={{ color: '#fff', fontWeight: '600', fontSize: '24px', margin: '0 0 0.75rem' }}>
              Pet Care Challenge
            </h2>
            <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.7', margin: '0 0 2rem' }}>
              {t.description}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '2rem' }}>
              {LEVELS[lang].map(l => (
                <div key={l.name} style={{ background: '#1e293b', borderRadius: '12px', padding: '0.75rem 1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>{l.emoji}</div>
                  <div style={{ color: l.color, fontSize: '12px', fontWeight: '500' }}>{l.name}</div>
                  <div style={{ color: '#475569', fontSize: '11px' }}>{l.min === 8 ? '8+' : `${l.min}–${l.max}`} {t.pts}</div>
                </div>
              ))}
            </div>

            {/* Language selector */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '1rem' }}>
              <button onClick={() => setLang('en')}
                style={{
                  padding: '8px 20px', borderRadius: '20px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: '500', border: '1px solid',
                  background: lang === 'en' ? '#7c3aed' : 'transparent',
                  borderColor: lang === 'en' ? '#7c3aed' : '#334155',
                  color: lang === 'en' ? '#fff' : '#64748b'
                }}>🇬🇧 English</button>
              <button onClick={() => setLang('tr')}
                style={{
                  padding: '8px 20px', borderRadius: '20px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: '500', border: '1px solid',
                  background: lang === 'tr' ? '#7c3aed' : 'transparent',
                  borderColor: lang === 'tr' ? '#7c3aed' : '#334155',
                  color: lang === 'tr' ? '#fff' : '#64748b'
                }}>🇹🇷 Türkçe</button>
            </div>

            <button onClick={generateScenario} style={{
              background: '#7c3aed', border: 'none', borderRadius: '12px',
              padding: '12px 32px', color: '#fff', cursor: 'pointer',
              fontSize: '15px', fontWeight: '600'
            }}>{t.start}</button>
          </div>
        )}

        {phase === 'playing' && loading && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem', animation: 'pulse 1s infinite' }}>🐾</div>
            <p style={{ color: '#64748b', fontSize: '15px' }}>{t.generating}</p>
          </div>
        )}

        {phase === 'playing' && !loading && scenario && (
          <div style={{ maxWidth: '560px', width: '100%', animation: 'slideUp 0.3s ease' }}>

            {/* Scenario card */}
            <div style={{
              background: '#1e293b', borderRadius: '16px',
              padding: '1.5rem', marginBottom: '1.5rem',
              border: '1px solid #334155'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '0.75rem' }}>
                {scenario.animal?.split(' ')[0]}
              </div>
              <p style={{ color: '#e2e8f0', fontSize: '15px', lineHeight: '1.7', margin: '0 0 1rem' }}>
                {scenario.scenario}
              </p>
              <p style={{ color: '#7c3aed', fontSize: '14px', fontWeight: '600', margin: 0 }}>
                ❓ {scenario.question}
              </p>
            </div>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
              {scenario.options?.map((option, i) => {
                let bg = '#1e293b';
                let border = '#334155';
                let color = '#e2e8f0';

                if (selected !== null) {
                  if (i === scenario.correct) { bg = '#14532d'; border = '#16a34a'; color = '#86efac'; }
                  else if (i === selected && selected !== scenario.correct) { bg = '#450a0a'; border = '#dc2626'; color = '#fca5a5'; }
                }

                return (
                  <button key={i} onClick={() => handleSelect(i)}
                    disabled={selected !== null}
                    style={{
                      background: bg, border: `1px solid ${border}`,
                      borderRadius: '12px', padding: '1rem 1.25rem',
                      color, cursor: selected !== null ? 'default' : 'pointer',
                      fontSize: '14px', textAlign: 'left',
                      transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '10px'
                    }}>
                    <span style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: '#0f172a', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '12px', flexShrink: 0, color: '#64748b'
                    }}>
                      {['A', 'B', 'C'][i]}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>

            {/* Result */}
            {result !== null && (
              <div style={{
                background: result ? '#14532d22' : '#450a0a22',
                border: `1px solid ${result ? '#16a34a44' : '#dc262644'}`,
                borderRadius: '12px', padding: '1rem 1.25rem',
                marginBottom: '1.5rem', animation: 'slideUp 0.2s ease'
              }}>
                <p style={{ color: result ? '#86efac' : '#fca5a5', fontWeight: '600', margin: '0 0 6px', fontSize: '14px' }}>
                  {result ? t.correct : t.wrong}{streak >= 3 && result ? `🔥 ${streak} ${t.streak}` : ''}
                </p>
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: '1.6' }}>
                  {scenario.explanation}
                </p>
              </div>
            )}

            {result !== null && (
              <button onClick={generateScenario} style={{
                width: '100%', background: '#7c3aed', border: 'none',
                borderRadius: '12px', padding: '12px',
                color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600'
              }}>{t.next}</button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
      `}</style>
    </div>
  );
}