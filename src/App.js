import Game from './game';
import { useEffect, useRef, useState } from 'react';
import { sendMsgToOpenAI, summarizeConversation, generateFollowUps, scoreConfidence, analyzeFeedback, extractImageLabels } from './openai';
import './App.css';

const CHATS_KEY = 'petbot_chats';
const ACTIVE_KEY = 'petbot_active';
const isMobile = () => window.innerWidth < 768;

function newChatObj() {
  const id = Date.now().toString();
  return {
    id,
    title: 'New chat',
    messages: [{
      id: 1, isBot: true,
      text: "Hi! I'm PetBot 🐾 Ask me anything about pets — breeds, care, adoption, training. You can also upload a photo of an animal and I'll identify it!\n\nMerhaba! Türkçe de konuşabiliriz.",
      feedback: null
    }]
  };
}

function Message({ msg, onFeedback, confidence, analysis, labels }) {
  const isBot = msg.isBot;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isBot ? 'flex-start' : 'flex-end',
      marginBottom: '1.25rem', padding: '0 1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', maxWidth: isMobile() ? '85%' : '75%' }}>
        {isBot && (
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: '#f5f5f0', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '14px', flexShrink: 0
          }}>🐾</div>
        )}
        <div>
          {msg.image && (
            <div style={{ marginBottom: '6px' }}>
              <img src={msg.image} alt="uploaded"
                style={{ maxWidth: '200px', borderRadius: '12px', display: 'block' }} />
            </div>
          )}
          {(msg.text && msg.text.trim() !== '') && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: isBot ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
              background: isBot ? '#fff' : '#7c3aed',
              color: isBot ? '#1a1a1a' : '#fff',
              fontSize: '14px', lineHeight: '1.6',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              whiteSpace: 'pre-wrap'
            }}>
              {msg.text}
            </div>
          )}
          {!isBot && labels && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px', justifyContent: 'flex-end' }}>
              {labels.map((label, i) => (
                <span key={i} style={{
                  background: '#f3f0ff', color: '#7c3aed',
                  fontSize: '11px', padding: '2px 8px',
                  borderRadius: '20px', border: '1px solid #e9d5ff'
                }}>{label}</span>
              ))}
            </div>
          )}
          {isBot && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px', alignItems: 'center' }}>
              {['up', 'down'].map(v => (
                <button key={v} onClick={() => !msg.feedback && onFeedback(msg.id, v)}
                  style={{
                    background: msg.feedback === v ? (v === 'up' ? '#dcfce7' : '#fee2e2') : 'transparent',
                    border: '1px solid #e5e7eb', borderRadius: '8px',
                    padding: '2px 8px', fontSize: '13px',
                    cursor: msg.feedback ? 'default' : 'pointer',
                    opacity: msg.feedback && msg.feedback !== v ? 0.4 : 1
                  }}>{v === 'up' ? '👍' : '👎'}</button>
              ))}
              {msg.feedback && (
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                  {msg.feedback === 'up' ? 'Thanks!' : 'Will improve!'}
                </span>
              )}
            </div>
          )}
          {isBot && confidence && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                background: confidence.score >= 8 ? '#86efac' : confidence.score >= 6 ? '#fde68a' : '#fca5a5'
              }} />
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                Confidence {confidence.score}/10 — {confidence.reason}
              </span>
            </div>
          )}
          {isBot && analysis && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '6px',
              marginTop: '6px', padding: '6px 10px',
              background: '#fff7ed', borderRadius: '8px',
              border: '1px solid #fed7aa'
            }}>
              <span style={{ fontSize: '12px' }}>⚠️</span>
              <div>
                <span style={{ fontSize: '11px', color: '#c2410c', fontWeight: '500' }}>
                  {analysis.label}
                </span>
                <span style={{ fontSize: '11px', color: '#9a3412' }}> — {analysis.suggestion}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const msgEnd = useRef(null);
  const fileInput = useRef(null);
  const [followUps, setFollowUps] = useState([]);
  const [feedbackAnalysis, setFeedbackAnalysis] = useState({});
  const [confidenceScores, setConfidenceScores] = useState(() => {
    try { return JSON.parse(localStorage.getItem('petbot_confidence') || '{}'); } catch { return {}; }
  });

  const [imageLabels, setImageLabels] = useState(() => {
    try { return JSON.parse(localStorage.getItem('petbot_labels') || '{}'); } catch { return {}; }
  });


  const [chats, setChats] = useState(() => {
    try {
      const saved = localStorage.getItem(CHATS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Object.keys(parsed).length > 0) return parsed;
      }
    } catch (e) { }
    const chat = newChatObj();
    return { [chat.id]: chat };
  });

  const [activeChatId, setActiveChatId] = useState(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_KEY);
      const chatsData = JSON.parse(localStorage.getItem(CHATS_KEY) || '{}');
      if (saved && chatsData[saved]) return saved;
      return Object.keys(chatsData).at(-1) || '';
    } catch (e) { return ''; }
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [gameOpen, setGameOpen] = useState(false);

  const activeChat = chats[activeChatId];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const messages = activeChat?.messages || [];
  const sortedChats = Object.values(chats).sort((a, b) => (b.updatedAt || b.id) - (a.updatedAt || a.id));

  useEffect(() => {
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem('petbot_confidence', JSON.stringify(confidenceScores));
  }, [confidenceScores]);

  useEffect(() => {
    localStorage.setItem('petbot_labels', JSON.stringify(imageLabels));
  }, [imageLabels]);

  const createNewChat = () => {
    const chat = newChatObj();
    setChats(prev => ({ ...prev, [chat.id]: chat }));
    setActiveChatId(chat.id);
    setInput('');
    setPendingImage(null);
    if (isMobile()) setSidebarOpen(false);
  };

  const deleteChat = (e, chatId) => {
    e.stopPropagation();
    setChats(prev => {
      const updated = { ...prev };
      delete updated[chatId];
      if (Object.keys(updated).length === 0) {
        const chat = newChatObj();
        updated[chat.id] = chat;
        setActiveChatId(chat.id);
      } else if (activeChatId === chatId) {
        setActiveChatId(Object.keys(updated).at(-1));
      }
      return updated;
    });
  };

  const handleSend = async () => {
    setFollowUps([]);

    if (messages.length > 10 && messages.length % 10 === 1) {
      const history = messages
        .filter(m => m.text && m.text.trim() !== '')
        .map(m => ({ role: m.isBot ? 'assistant' : 'user', content: m.text }));
      const summary = await summarizeConversation(history);
      setChats(prev => ({
        ...prev,
        [activeChatId]: { ...prev[activeChatId], summary }
      }));
    }

    const text = input.trim();
    if (!text && !pendingImage) return;
    if (loading) return;

    const imageBase64 = pendingImage?.base64 || null;
    const imagePreview = pendingImage?.preview || null;
    const userText = text || '';

    setInput('');
    setPendingImage(null);
    setLoading(true);

    const userMsg = {
      id: Date.now(), isBot: false,
      text: userText,
      image: imagePreview, feedback: null
    };

    const userMsgId = userMsg.id;

    const isFirstUserMsg = messages.filter(m => !m.isBot).length === 0;
    const newTitle = isFirstUserMsg
      ? (text || 'Photo analysis').slice(0, 32)
      : activeChat.title;

    const updatedMessages = [...messages, userMsg];

    setChats(prev => ({
      ...prev,
      [activeChatId]: {
        ...prev[activeChatId],
        title: newTitle,
        messages: updatedMessages,
        updatedAt: Date.now()
      }
    }));

    // unique botMsgId to avoid key collisions
    const botMsgId = Date.now() + Math.floor(Math.random() * 1000) + 100;

    try {
      const history = updatedMessages
        .filter(m => m.text && m.text.trim() !== '')
        .map(m => ({ role: m.isBot ? 'assistant' : 'user', content: m.text }));

      setChats(prev => ({
        ...prev,
        [activeChatId]: {
          ...prev[activeChatId],
          messages: [...prev[activeChatId].messages, {
            id: botMsgId, isBot: true, text: '', feedback: null
          }]
        }
      }));

      let finalBotText = '';

      const result = await sendMsgToOpenAI(Array.from(history), imageBase64, (partial) => {
        finalBotText = partial;
        setChats(prev => ({
          ...prev,
          [activeChatId]: {
            ...prev[activeChatId],
            messages: prev[activeChatId].messages.map(m =>
              m.id === botMsgId ? { ...m, text: partial } : m
            )
          }
        }));
      }, activeChat.summary || null);

      if (imageBase64 && result) {
        finalBotText = result;
        setChats(prev => ({
          ...prev,
          [activeChatId]: {
            ...prev[activeChatId],
            messages: prev[activeChatId].messages.map(m =>
              m.id === botMsgId ? { ...m, text: result } : m
            )
          }
        }));
      }

      // follow-up questions — delayed to avoid rate limits
      setTimeout(async () => {
        try {
          if (finalBotText) {
            const questions = await generateFollowUps(finalBotText);
            setFollowUps(questions);
          }
        } catch (e) { setFollowUps([]); }
      }, 1000);

      // confidence scoring — delayed further
      setTimeout(async () => {
        try {
          if (finalBotText) {
            const conf = await scoreConfidence(finalBotText, userText);
            setConfidenceScores(prev => ({ ...prev, [botMsgId]: conf }));
          }
        } catch (e) { }
      }, 2000);

      // image labels
      if (imageBase64) {
        setTimeout(async () => {
          try {
            const labels = await extractImageLabels(imageBase64);
            setImageLabels(prev => ({ ...prev, [userMsgId]: labels }));
          } catch (e) { }
        }, 3000);
      }

    } catch (err) {
      setChats(prev => ({
        ...prev,
        [activeChatId]: {
          ...prev[activeChatId],
          messages: [...prev[activeChatId].messages, {
            id: botMsgId, isBot: true,
            text: 'Sorry, something went wrong. Please try again.',
            feedback: null
          }]
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage({ base64: reader.result.split(',')[1], preview: reader.result });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFeedback = async (msgId, rating) => {
    setChats(prev => ({
      ...prev,
      [activeChatId]: {
        ...prev[activeChatId],
        messages: prev[activeChatId].messages.map(m =>
          m.id === msgId ? { ...m, feedback: rating } : m
        )
      }
    }));

    if (rating === 'down') {
      try {
        const allMsgs = chats[activeChatId]?.messages || [];
        const msgIndex = allMsgs.findIndex(m => m.id === msgId);
        const botMsg = allMsgs[msgIndex];
        const userMsg = allMsgs.slice(0, msgIndex).findLast(m => !m.isBot);

        if (botMsg?.text) {
          const analysis = await analyzeFeedback(
            userMsg?.text || '',
            botMsg.text
          );
          if (analysis) {
            setFeedbackAnalysis(prev => ({ ...prev, [msgId]: analysis }));
          }
        }
      } catch (e) { }
    }
  };

  const handleQuickSend = async (text) => {
    setInput('');
    setFollowUps([]);
    if (loading) return;

    setLoading(true);

    const userMsg = {
      id: Date.now(), isBot: false,
      text, image: null, feedback: null
    };

    const isFirstUserMsg = messages.filter(m => !m.isBot).length === 0;
    const newTitle = isFirstUserMsg ? text.slice(0, 32) : activeChat.title;
    const updatedMessages = [...messages, userMsg];

    setChats(prev => ({
      ...prev,
      [activeChatId]: {
        ...prev[activeChatId],
        title: newTitle,
        messages: updatedMessages,
        updatedAt: Date.now()
      }
    }));

    // unique botMsgId to avoid key collisions
    const botMsgId = Date.now() + Math.floor(Math.random() * 1000) + 100;

    try {
      const history = updatedMessages
        .filter(m => m.text && m.text.trim() !== '')
        .map(m => ({ role: m.isBot ? 'assistant' : 'user', content: m.text }));

      setChats(prev => ({
        ...prev,
        [activeChatId]: {
          ...prev[activeChatId],
          messages: [...prev[activeChatId].messages, {
            id: botMsgId, isBot: true, text: '', feedback: null
          }]
        }
      }));

      let finalBotText = '';

      await sendMsgToOpenAI(Array.from(history), null, (partial) => {
        finalBotText = partial;
        setChats(prev => ({
          ...prev,
          [activeChatId]: {
            ...prev[activeChatId],
            messages: prev[activeChatId].messages.map(m =>
              m.id === botMsgId ? { ...m, text: partial } : m
            )
          }
        }));
      }, activeChat.summary || null);

      // follow-up questions — delayed
      setTimeout(async () => {
        try {
          if (finalBotText) {
            const questions = await generateFollowUps(finalBotText);
            setFollowUps(questions);
          }
        } catch (e) { setFollowUps([]); }
      }, 1000);

      // confidence scoring — delayed further
      setTimeout(async () => {
        try {
          if (finalBotText) {
            const conf = await scoreConfidence(finalBotText, text);
            setConfidenceScores(prev => ({ ...prev, [botMsgId]: conf }));
          }
        } catch (e) { }
      }, 2000);

    } catch (err) {
      setChats(prev => ({
        ...prev,
        [activeChatId]: {
          ...prev[activeChatId],
          messages: [...prev[activeChatId].messages, {
            id: botMsgId, isBot: true,
            text: 'Sorry, something went wrong. Please try again.',
            feedback: null
          }]
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f9fafb' }}>

      {/* Game overlay */}
      {gameOpen && <Game onClose={() => setGameOpen(false)} />}

      {/* Mobile overlay */}
      {sidebarOpen && isMobile() && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} />
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <div style={{
          width: '260px', flexShrink: 0, background: '#111827',
          display: 'flex', flexDirection: 'column', height: '100vh',
          position: isMobile() ? 'fixed' : 'relative',
          left: 0, top: 0, zIndex: 100
        }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #1f2937' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <span style={{ fontSize: '20px' }}>🐾</span>
              <span style={{ color: '#fff', fontWeight: '600', fontSize: '16px' }}>PetBot</span>
              <button onClick={() => setSidebarOpen(false)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
            <button onClick={createNewChat}
              style={{
                width: '100%', padding: '0.6rem', background: '#1f2937',
                border: '1px solid #374151', borderRadius: '8px',
                color: '#fff', cursor: 'pointer', fontSize: '13px',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
              <span style={{ fontSize: '16px' }}>+</span> New chat
            </button>
            <button onClick={() => { setGameOpen(true); if (isMobile()) setSidebarOpen(false); }}
              style={{
                width: '100%', padding: '0.6rem', background: 'transparent',
                border: '1px solid #7c3aed44', borderRadius: '8px',
                color: '#c4b5fd', cursor: 'pointer', fontSize: '13px',
                display: 'flex', alignItems: 'center', gap: '8px',
                marginTop: '8px'
              }}>
              <span style={{ fontSize: '16px' }}>🎮</span> Pet Care Challenge
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            <p style={{ fontSize: '11px', color: '#6b7280', padding: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent</p>
            {sortedChats.map(chat => (
              <div key={chat.id}
                onClick={() => { setActiveChatId(chat.id); if (isMobile()) setSidebarOpen(false); }}
                style={{
                  padding: '0.6rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                  background: chat.id === activeChatId ? '#1f2937' : 'transparent',
                  color: chat.id === activeChatId ? '#fff' : '#9ca3af',
                  fontSize: '13px', marginBottom: '2px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '8px',
                  transition: 'all 0.3s ease',
                  animation: 'slideIn 0.3s ease'
                }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  💬 {chat.title}
                </span>
                <button onClick={(e) => deleteChat(e, chat.id)}
                  style={{
                    background: 'none', border: 'none', color: '#6b7280',
                    cursor: 'pointer', fontSize: '14px', flexShrink: 0,
                    opacity: 0, transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={e => e.target.style.opacity = 1}
                  onMouseLeave={e => e.target.style.opacity = 0}
                >🗑</button>
              </div>
            ))}
          </div>

          {/* Feedback Stats */}
          <div style={{ padding: '1rem', borderTop: '1px solid #1f2937' }}>
            <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              Feedback Stats
            </p>
            {(() => {
              const allMessages = Object.values(chats).flatMap(c => c.messages);
              const total = allMessages.filter(m => m.isBot && m.id !== 1).length;
              const thumbsUp = allMessages.filter(m => m.feedback === 'up').length;
              const thumbsDown = allMessages.filter(m => m.feedback === 'down').length;
              const rated = thumbsUp + thumbsDown;
              const score = rated > 0 ? Math.round((thumbsUp / rated) * 100) : null;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>Total responses</span>
                    <span style={{ fontSize: '13px', color: '#fff', fontWeight: '500' }}>{total}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>👍 Helpful</span>
                    <span style={{ fontSize: '13px', color: '#86efac', fontWeight: '500' }}>{thumbsUp}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>👎 Not helpful</span>
                    <span style={{ fontSize: '13px', color: '#fca5a5', fontWeight: '500' }}>{thumbsDown}</span>
                  </div>
                  {score !== null && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>Satisfaction</span>
                        <span style={{ fontSize: '12px', color: '#fff' }}>{score}%</span>
                      </div>
                      <div style={{ height: '4px', background: '#374151', borderRadius: '2px' }}>
                        <div style={{
                          height: '100%', width: `${score}%`,
                          background: score >= 70 ? '#86efac' : score >= 40 ? '#fde68a' : '#fca5a5',
                          borderRadius: '2px', transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  )}
                  {score === null && (
                    <p style={{ fontSize: '11px', color: '#4b5563', textAlign: 'center', margin: '4px 0 0' }}>
                      No feedback yet
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          padding: '0.875rem 1.5rem', background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <button onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#6b7280', display: sidebarOpen && !isMobile() ? 'none' : 'block' }}>☰</button>
          <p style={{ margin: 0, fontWeight: '600', fontSize: '15px', color: '#111' }}>
            {activeChat?.title || 'PetBot'}
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af', marginLeft: '4px' }}>· EN / TR</p>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 0' }}>
          {messages.filter(m => !m.isBot).length === 0 && (
            <div style={{ padding: '0 1rem', marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '10px', paddingLeft: isMobile() ? '8px' : '40px' }}>
                You can ask:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: isMobile() ? '8px' : '40px' }}>
                {[
                  '🐶 How to care for a Golden Retriever?',
                  '🐱 I want to adopt a cat',
                  '🐾 How do I train my dog?',
                  '🏥 My cat is sick, what should I do?',
                  '🦜 Tell me about parrot care',
                  '🐕 What breed is good for apartments?',
                ].map((q, i) => (
                  <button key={i}
                    onClick={() => handleQuickSend(q)}
                    style={{
                      background: '#fff', border: '1px solid #e5e7eb',
                      borderRadius: '20px', padding: '6px 14px',
                      fontSize: isMobile() ? '12px' : '13px',
                      cursor: 'pointer', color: '#374151', transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { e.target.style.background = '#7c3aed'; e.target.style.color = '#fff'; e.target.style.borderColor = '#7c3aed'; }}
                    onMouseLeave={e => { e.target.style.background = '#fff'; e.target.style.color = '#374151'; e.target.style.borderColor = '#e5e7eb'; }}
                  >{q}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map(msg => (
            <Message key={msg.id} msg={msg} onFeedback={handleFeedback} confidence={confidenceScores[msg.id]} analysis={feedbackAnalysis[msg.id]} labels={imageLabels[msg.id]} />
          ))}
          {loading && (
            <div style={{ padding: '0 1rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🐾</div>
              <div style={{ padding: '0.75rem 1rem', background: '#fff', borderRadius: '4px 16px 16px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', gap: '4px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7c3aed', animation: 'bounce 1s infinite', animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}
          {followUps.length > 0 && !loading && (
            <div style={{ padding: '0 1rem 0 3.5rem', display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '-0.5rem', marginBottom: '1rem' }}>
              {followUps.map((q, i) => (
                <button key={i}
                  onClick={() => { handleQuickSend(q); setFollowUps([]); }}
                  style={{
                    background: '#fff', border: '1px solid #e5e7eb',
                    borderRadius: '20px', padding: '5px 12px',
                    fontSize: '12px', cursor: 'pointer', color: '#7c3aed',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.target.style.background = '#7c3aed'; e.target.style.color = '#fff'; e.target.style.borderColor = '#7c3aed'; }}
                  onMouseLeave={e => { e.target.style.background = '#fff'; e.target.style.color = '#7c3aed'; e.target.style.borderColor = '#e5e7eb'; }}
                >↩ {q}</button>
              ))}
            </div>
          )}
          <div ref={msgEnd} />
        </div>

        {/* Input */}
        <div style={{ padding: isMobile() ? '0.75rem 1rem' : '1rem 1.5rem', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
          {pendingImage && (
            <div style={{ marginBottom: '8px', position: 'relative', display: 'inline-block' }}>
              <img src={pendingImage.preview} alt="preview"
                style={{ height: '60px', borderRadius: '8px', border: '2px solid #7c3aed' }} />
              <button onClick={() => setPendingImage(null)}
                style={{
                  position: 'absolute', top: '-6px', right: '-6px',
                  background: '#ef4444', border: 'none', borderRadius: '50%',
                  width: '18px', height: '18px', color: '#fff',
                  cursor: 'pointer', fontSize: '11px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center'
                }}>×</button>
            </div>
          )}
          <div style={{
            display: 'flex', gap: '8px', alignItems: 'flex-end',
            background: '#f9fafb', borderRadius: '16px',
            border: '1px solid #e5e7eb', padding: '8px'
          }}>
            <button onClick={() => fileInput.current.click()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '4px', borderRadius: '8px', flexShrink: 0 }}>📷</button>
            <input ref={fileInput} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={pendingImage ? 'Add a message or just hit Send...' : 'Ask about pets... or upload a photo 📷'}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '14px', padding: '4px', fontFamily: 'inherit', color: '#111' }}
            />
            <button onClick={handleSend}
              disabled={loading || (!input.trim() && !pendingImage)}
              style={{
                background: '#7c3aed', border: 'none', borderRadius: '10px',
                padding: '8px 16px', color: '#fff', cursor: 'pointer',
                fontSize: '14px', fontWeight: '500', flexShrink: 0,
                opacity: loading || (!input.trim() && !pendingImage) ? 0.5 : 1
              }}>Send</button>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#d1d5db', textAlign: 'center' }}>
            PetBot may make mistakes. Always consult a vet for medical advice.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
      `}</style>
    </div>
  );
}