import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, X, Send, Loader, Sparkles, Trash2, Copy, CheckCircle2
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SUGGESTED_QUESTIONS = {
  super_admin: [
    'Show system health',
    'Show today\'s downloads',
    'Show all anomalies',
    'Summarise today\'s activity',
    'Show user statistics',
    'Which papers release tomorrow?',
  ],
  admin: [
    'Which papers release today?',
    'Which invigilators haven\'t downloaded?',
    'Show pending assignments',
    'Show download history',
    'Summarise today\'s papers',
  ],
  invigilator: [
    'Which papers are assigned to me?',
    'What should I do today?',
    'Show my download history',
    'When do my papers release?',
  ],
};

function formatMessage(text, fontSize = '14px') {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return (
        <p key={i} style={{ fontWeight: 700, color: '#111827', marginBottom: '6px', marginTop: i > 0 ? '10px' : 0, fontSize }}>
          {line.replace(/\*\*/g, '')}
        </p>
      );
    }
    if (line.match(/^\*\*(.+)\*\*$/)) {
      return (
        <p key={i} style={{ fontWeight: 700, color: '#111827', marginBottom: '6px', marginTop: i > 0 ? '10px' : 0, fontSize }}>
          {line.replace(/\*\*/g, '')}
        </p>
      );
    }
    if (line.startsWith('* ') || line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
          <span style={{ color: '#2563EB', flexShrink: 0, marginTop: '2px', fontSize }}>•</span>
          <span style={{ color: '#374151', fontSize, lineHeight: 1.5 }}>
            {line.replace(/^[*\-•]\s/, '').replace(/\*\*/g, '')}
          </span>
        </div>
      );
    }
    if (line.trim() === '') return <div key={i} style={{ height: '6px' }} />;
    return (
      <p key={i} style={{ color: '#374151', fontSize, marginBottom: '3px', lineHeight: 1.5 }}>
        {line.replace(/\*\*/g, '')}
      </p>
    );
  });
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <motion.button
      onClick={handleCopy}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      aria-label="Copy response"
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: copied ? '#22C55E' : '#9CA3AF', padding: '2px',
        display: 'flex', alignItems: 'center', gap: '4px',
        fontSize: '10px', transition: 'all 200ms ease',
      }}
    >
      {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </motion.button>
  );
}

export default function AIAssistant({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const suggestions = SUGGESTED_QUESTIONS[user?.role] || SUGGESTED_QUESTIONS.invigilator;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
    // Cancel in-flight request when panel closes
    if (!isOpen && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  }, [isOpen]);

  // Auto-growing textarea
  const handleTextareaChange = (e) => {
    setQuestion(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const sendMessage = useCallback(async (q) => {
    const questionText = (q || question).trim();
    if (!questionText || loading) return;

    // Debounce — prevent submissions within 500ms
    const now = Date.now();
    if (now - lastSubmitTime < 500) return;
    setLastSubmitTime(now);

    setQuestion('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    setLoading(true);

    const userMessage = { role: 'user', content: questionText, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const token = localStorage.getItem('accessToken');
      const history = messages.slice(-8).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await axios.post(
        `${API_URL}/api/ai/query`,
        { question: questionText, history },
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortControllerRef.current.signal,
        }
      );

      const aiMessage = {
        role: 'assistant',
        content: res.data.answer,
        intent: res.data.intent,
        model: res.data.model,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      if (axios.isCancel(err) || err.name === 'CanceledError') return;
      const errorMessage = {
        role: 'assistant',
        content: err.response?.data?.error || 'I encountered an error. Please try again.',
        isError: true,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [question, loading, lastSubmitTime, messages]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setMessages([]);
    setLoading(false);
  };

  const roleLabel = user?.role === 'super_admin' ? 'Super Admin'
    : user?.role === 'admin' ? 'Administrator' : 'Invigilator';

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05, boxShadow: '0 12px 32px rgba(37,99,235,0.4)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            aria-label="Open AI Security Assistant"
            style={{
              position: 'fixed', bottom: '28px', right: '28px', zIndex: 999,
              background: 'linear-gradient(135deg, #1e3a8a, #2563EB, #4F46E5)',
              border: 'none', borderRadius: '16px', cursor: 'pointer',
              padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px',
              boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
            }}
          >
            <Shield size={20} style={{ color: '#fff' }} />
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                AI Security Assistant
              </p>
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                ExamSecure AI
              </p>
            </div>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E', marginLeft: '4px' }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Slide-in Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)',
                zIndex: 998, backdropFilter: 'blur(2px)',
              }}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0,
                width: '400px', zIndex: 999,
                background: '#fff', display: 'flex', flexDirection: 'column',
                boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
              }}
            >
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, #1e3a8a, #2563EB, #4F46E5)',
                padding: '20px', flexShrink: 0,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '12px',
                      background: 'rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}>
                      <Shield size={22} style={{ color: '#fff' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>ExamSecure AI</p>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                        AI Security Assistant • {roleLabel}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {messages.length > 0 && (
                      <motion.button
                        onClick={clearChat}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        aria-label="Clear conversation"
                        style={{
                          background: 'rgba(255,255,255,0.15)', border: 'none',
                          borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex',
                        }}
                      >
                        <Trash2 size={14} style={{ color: '#fff' }} />
                      </motion.button>
                    )}
                    <motion.button
                      onClick={() => setIsOpen(false)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      aria-label="Close assistant"
                      style={{
                        background: 'rgba(255,255,255,0.15)', border: 'none',
                        borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex',
                      }}
                    >
                      <X size={14} style={{ color: '#fff' }} />
                    </motion.button>
                  </div>
                </div>

                {/* Status */}
                <div style={{
                  marginTop: '14px', padding: '8px 12px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E' }} />
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                    Grounded AI — Only answers using live system data
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#F8FAFC' }}>

                {/* Welcome + Suggestions */}
                {messages.length === 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div style={{
                      background: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '16px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Sparkles size={16} style={{ color: '#2563EB' }} />
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                          Welcome, {user?.name?.split(' ')[0]}!
                        </p>
                      </div>
                      <p style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.5 }}>
                        I'm your AI Security Assistant. I answer questions about papers, downloads, users, anomalies, and system health — using only live data from your system.
                      </p>
                    </div>

                    <p style={{
                      fontSize: '11px', fontWeight: 700, color: '#9CA3AF',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      marginBottom: '10px', paddingLeft: '4px',
                    }}>
                      Suggested Questions
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {suggestions.map((s, i) => (
                        <motion.button
                          key={i}
                          onClick={() => sendMessage(s)}
                          whileHover={{ x: 4, background: '#EFF6FF' }}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            background: '#fff', border: '1.5px solid #E5E7EB',
                            borderRadius: '10px', padding: '10px 14px',
                            cursor: 'pointer', textAlign: 'left', fontSize: '13px',
                            color: '#374151', fontWeight: 500, transition: 'all 200ms ease',
                            display: 'flex', alignItems: 'center', gap: '8px',
                          }}
                        >
                          <span style={{ color: '#2563EB', flexShrink: 0 }}>→</span>
                          {s}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Chat Messages */}
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    style={{ marginBottom: '12px' }}
                  >
                    {msg.role === 'user' ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{
                          maxWidth: '80%',
                          background: 'linear-gradient(135deg, #2563EB, #4F46E5)',
                          borderRadius: '14px 14px 4px 14px', padding: '10px 14px',
                        }}>
                          <p style={{ fontSize: '14px', color: '#fff', lineHeight: 1.5 }}>{msg.content}</p>
                          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginTop: '4px', textAlign: 'right' }}>
                            {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                          background: msg.isError ? '#FEE2E2' : 'linear-gradient(135deg, #1e3a8a, #2563EB)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Shield size={14} style={{ color: msg.isError ? '#EF4444' : '#fff' }} />
                        </div>
                        <div style={{
                          flex: 1, background: '#fff',
                          borderRadius: '4px 14px 14px 14px', padding: '12px 14px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          border: msg.isError ? '1px solid #FECACA' : '1px solid #F3F4F6',
                        }}>
                          <div>{formatMessage(msg.content, '14px')}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                            <p style={{ fontSize: '10px', color: '#9CA3AF' }}>
                              {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {msg.intent && ` • ${msg.intent.replace(/_/g, ' ')}`}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {msg.model && (
                                <span style={{ fontSize: '10px', color: '#9CA3AF' }}>
                                  {msg.model}
                                </span>
                              )}
                              {!msg.isError && <CopyButton text={msg.content} />}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Typing Indicator */}
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '12px' }}
                  >
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                      background: 'linear-gradient(135deg, #1e3a8a, #2563EB)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Shield size={14} style={{ color: '#fff' }} />
                    </div>
                    <div style={{
                      background: '#fff', borderRadius: '4px 14px 14px 14px',
                      padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      border: '1px solid #F3F4F6',
                    }}>
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        {[0, 1, 2].map(i => (
                          <motion.div
                            key={i}
                            animate={{ y: [-3, 0, -3] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                            style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#2563EB' }}
                          />
                        ))}
                        <span style={{ fontSize: '11px', color: '#9CA3AF', marginLeft: '6px' }}>
                          Analysing your query...
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{
                padding: '16px', background: '#fff',
                borderTop: '1px solid #F3F4F6', flexShrink: 0,
              }}>
                {messages.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    {suggestions.slice(0, 3).map((s, i) => (
                      <motion.button
                        key={i}
                        onClick={() => sendMessage(s)}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        style={{
                          padding: '4px 10px', borderRadius: '20px', fontSize: '11px',
                          background: '#F3F4F6', color: '#6B7280', border: 'none',
                          cursor: 'pointer', fontWeight: 500, transition: 'all 200ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.color = '#2563EB'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#6B7280'; }}
                      >
                        {s.length > 25 ? s.slice(0, 25) + '...' : s}
                      </motion.button>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <textarea
                    ref={inputRef}
                    value={question}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about papers, downloads, system health..."
                    rows={1}
                    aria-label="Ask a question"
                    style={{
                      flex: 1, borderRadius: '12px', border: '1.5px solid #E5E7EB',
                      padding: '10px 14px', fontSize: '13px', color: '#111827',
                      background: '#F9FAFB', outline: 'none', resize: 'none',
                      fontFamily: 'inherit', lineHeight: 1.5,
                      minHeight: '42px', maxHeight: '120px',
                      transition: 'border-color 200ms ease, box-shadow 200ms ease',
                      overflow: 'hidden',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#2563EB';
                      e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)';
                      e.target.style.background = '#fff';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#E5E7EB';
                      e.target.style.boxShadow = 'none';
                      e.target.style.background = '#F9FAFB';
                    }}
                  />
                  <motion.button
                    onClick={() => sendMessage()}
                    disabled={!question.trim() || loading}
                    whileHover={question.trim() && !loading ? { scale: 1.05, boxShadow: '0 6px 16px rgba(37,99,235,0.35)' } : {}}
                    whileTap={question.trim() && !loading ? { scale: 0.95 } : {}}
                    aria-label="Send message"
                    style={{
                      width: '42px', height: '42px', minWidth: '42px',
                      borderRadius: '12px', border: 'none',
                      background: question.trim() && !loading
                        ? 'linear-gradient(135deg, #2563EB, #4F46E5)'
                        : '#E5E7EB',
                      cursor: question.trim() && !loading ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 200ms ease',
                    }}
                  >
                    {loading
                      ? <Loader size={16} style={{ color: '#9CA3AF', animation: 'spin 1s linear infinite' }} />
                      : <Send size={16} style={{ color: question.trim() ? '#fff' : '#9CA3AF' }} />
                    }
                  </motion.button>
                </div>
                <p style={{ fontSize: '10px', color: '#9CA3AF', textAlign: 'center', marginTop: '8px' }}>
                  ExamSecure AI • Powered by Groq • Role-restricted responses
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}