'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';

// ---- Types ----
interface GameMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  text: string;
  options: string[];
  status: 'playing' | 'win' | 'lose';
  inventoryChange: string | null;
  lifeChange: number;
}

// ---- Constants ----
const STARTING_LIVES = 3;

const ITEM_EMOJI: Record<string, string> = {
  '古堡印章': '📜',
  '月光宝盒': '📿',
  '灵魂宝石': '💎',
};

// Helper: get emoji for any inventory item
const getItemEmoji = (item: string) => {
  return ITEM_EMOJI[item] || '📦';
};

// ---- Component ----
export default function Home() {
  // ---- State ----
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [inventory, setInventory] = useState<string[]>([]);
  const [gameStatus, setGameStatus] = useState<'playing' | 'win' | 'lose'>('playing');
  const [isStarted, setIsStarted] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');

  // ---- Refs ----
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentTextRef = useRef('');

  // ---- Auto scroll ----
  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, typingText]);

  // ---- Keyboard shortcut ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        if (
          idx < currentOptions.length &&
          gameStatus === 'playing' &&
          !isLoading &&
          !isTyping
        ) {
          sendAction(currentOptions[idx]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentOptions, gameStatus, isLoading, isTyping]);

  // ---- Typing effect ----
  const typeText = useCallback(async (text: string) => {
    currentTextRef.current = text;
    setIsTyping(true);
    setTypingText('');

    for (let i = 0; i < text.length; i++) {
      if (currentTextRef.current !== text) break;
      setTypingText(text.slice(0, i + 1));
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 20));
    }

    if (currentTextRef.current === text) {
      setTypingText(text);
      setIsTyping(false);
    }
  }, []);

  // ---- Confetti ----
  const fireConfetti = useCallback(() => {
    const end = Date.now() + 3000;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ['#ffd700', '#c8a88c', '#8b5cf6', '#ff6b6b'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ['#ffd700', '#c8a88c', '#8b5cf6', '#ff6b6b'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  // ---- Start game ----
  const startGame = useCallback(async () => {
    setIsStarted(true);
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '开始游戏' }],
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: AIResponse = await res.json();
      setMessages([{ role: 'assistant', content: data.text }]);
      setCurrentOptions(data.options || []);
      setGameStatus(data.status || 'playing');
      await typeText(data.text);
    } catch {
      setError('⚠️ 请检查 .env.local 中的 API Key 配置是否正确');
      setMessages([
        {
          role: 'assistant',
          content: '⚠️ 连接失败。请配置 OPENAI_API_KEY 环境变量后重启。',
        },
      ]);
    }
    setIsLoading(false);
  }, [typeText]);

  // ---- Send action ----
  const sendAction = useCallback(
    async (action: string) => {
      if (isLoading || isTyping || gameStatus !== 'playing') return;

      setInput('');
      setError('');
      setIsLoading(true);

      const updatedMessages: GameMessage[] = [
        ...messages,
        { role: 'user', content: action },
      ];
      setMessages(updatedMessages);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data: AIResponse = await res.json();

        // Update lives
        if (data.lifeChange && data.lifeChange < 0) {
          setLives((prev) => Math.max(0, prev + data.lifeChange));
        }

        // Update inventory
        if (data.inventoryChange) {
          setInventory((prev) => [...prev, data.inventoryChange!]);
        }

        // Update options
        if (data.options?.length) {
          setCurrentOptions(data.options);
        }

        // Update status
        setGameStatus(data.status || 'playing');

        // Add AI response
        const aiMsg: GameMessage = { role: 'assistant', content: data.text };
        setMessages((prev) => [...prev, aiMsg]);

        // Typing effect
        await typeText(data.text);

        // Win animation
        if (data.status === 'win') {
          setTimeout(fireConfetti, 500);
        }
      } catch (e) {
        setError('网络错误，请稍后再试');
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '⚠️ 网络错误，请稍后再试。' },
        ]);
      }

      setIsLoading(false);
    },
    [messages, isLoading, isTyping, gameStatus, typeText, fireConfetti]
  );

  // ---- Submit text input ----
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) sendAction(input.trim());
  };

  // ---- Restart ----
  const restart = () => {
    setMessages([]);
    setCurrentOptions([]);
    setInput('');
    setIsLoading(false);
    setLives(STARTING_LIVES);
    setInventory([]);
    setGameStatus('playing');
    setIsStarted(false);
    setTypingText('');
    setIsTyping(false);
    setError('');
  };

  // ---- Derive last AI message index ----
  const lastAiIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  })();

  // ---- Loading dots ----
  const LoadingDots = () => (
    <span className="inline-flex gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-gold-400/50 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gold-400/50 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gold-400/50 animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );

  // =============================================
  // RENDER
  // =============================================
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col relative">
      {/* ---- Background layers ---- */}
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      <div className="absolute inset-0 stone-wall opacity-70" />

      {/* Dark vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* Subtle ambient glow */}
      <div
        className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(200,168,140,0.03) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(180,160,200,0.02) 0%, transparent 70%)',
        }}
      />

      {/* ---- Main content ---- */}
      <div className="relative z-10 flex flex-col h-full">
        {/* ---- Cover / Start Screen ---- */}
        {!isStarted && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-6">
              {/* Candles */}
              <div className="flex justify-center gap-4 mb-6">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="candle-glow text-3xl"
                    style={{ animationDelay: `${i * 0.8}s` }}
                  >
                    🕯️
                  </div>
                ))}
              </div>

              <h1
                className="text-5xl md:text-6xl font-bold mb-4 tracking-[0.15em]"
                style={{
                  color: '#d4c8b8',
                  textShadow:
                    '0 0 60px rgba(200,168,140,0.12), 0 2px 4px rgba(0,0,0,0.8)',
                  fontFamily: 'Georgia, serif',
                }}
              >
                无限轮回
              </h1>
              <p
                className="text-sm md:text-base mb-2 tracking-widest"
                style={{ color: '#a09080' }}
              >
                神秘古堡 · 暗影重重
              </p>
              <p
                className="text-xs tracking-wider mb-10"
                style={{ color: '#605548' }}
              >
                集齐三件圣物 · 逃出生天
              </p>

              <button
                onClick={startGame}
                disabled={isLoading}
                className="px-14 py-4 rounded-lg text-base font-bold tracking-widest transition-all duration-500 border cursor-pointer hover:bg-white/5 active:scale-95"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(40,28,18,0.85), rgba(60,38,22,0.7))',
                  color: '#c8a88c',
                  borderColor: 'rgba(200,168,140,0.15)',
                  boxShadow: '0 0 40px rgba(200,168,140,0.06)',
                }}
              >
                {isLoading ? '踏入中...' : '🏰 踏入古堡'}
              </button>

              {/* Gothic divider */}
              <div className="mt-12 flex items-center justify-center gap-3 text-xs tracking-[0.3em]" style={{ color: 'rgba(200,168,140,0.15)' }}>
                <span>━━━</span>
                <span>✦</span>
                <span>━━━</span>
              </div>
            </div>
          </div>
        )}

        {/* ---- Game Screen ---- */}
        {isStarted && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* ===== LEFT PANEL: Chat ===== */}
            <div className="flex-1 flex flex-col overflow-hidden border-r-0 md:border-r border-[rgba(200,168,140,0.06)]">
              {/* Header */}
              <div
                className="px-5 py-3 text-center border-b shrink-0"
                style={{ borderColor: 'rgba(200,168,140,0.06)' }}
              >
                <span
                  className="text-[10px] tracking-[0.3em]"
                  style={{ color: 'rgba(200,168,140,0.25)' }}
                >
                  ✦ 古堡回响 ✦
                </span>
              </div>

              {/* Messages */}
              <div
                ref={chatRef}
                className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4"
              >
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`transition-opacity duration-500 ${
                      msg.role === 'user' ? 'text-right' : 'text-left'
                    }`}
                    style={{
                      opacity: Math.min(1, ((i + 1) / 3) * 0.9 + 0.1),
                    }}
                  >
                    <div
                      className={`inline-block px-5 py-3 rounded-2xl max-w-[88%] md:max-w-[80%] backdrop-blur-sm ${
                        msg.role === 'user'
                          ? 'msg-bubble-user rounded-tr-none'
                          : 'msg-bubble-ai rounded-tl-none'
                      }`}
                    >
                      {msg.role === 'assistant' && i === lastAiIdx && isTyping ? (
                        <p className="text-sm leading-relaxed" style={{ color: '#d4c8b8' }}>
                          {typingText}
                          <span className="typing-cursor" />
                        </p>
                      ) : (
                        <p
                          className="text-sm leading-relaxed whitespace-pre-wrap"
                          style={{
                            color: msg.role === 'user' ? '#c8b8a8' : '#d4c8b8',
                            fontFamily: msg.role === 'assistant' ? 'Georgia, serif' : 'inherit',
                          }}
                        >
                          {msg.content}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && !isTyping && (
                  <div className="text-left">
                    <div className="inline-block px-5 py-3 rounded-2xl rounded-tl-none msg-bubble-ai">
                      <LoadingDots />
                    </div>
                  </div>
                )}
              </div>

              {/* ---- Input area ---- */}
              <div
                className="px-4 md:px-6 py-3 border-t shrink-0"
                style={{ borderColor: 'rgba(200,168,140,0.06)' }}
              >
                {/* Quick action buttons */}
                {currentOptions.length > 0 && gameStatus === 'playing' && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {currentOptions.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => sendAction(opt)}
                        disabled={isLoading || isTyping}
                        className="action-btn px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer disabled:opacity-30"
                      >
                        <span className="mr-1 text-[10px]" style={{ color: 'rgba(200,168,140,0.4)' }}>
                          [{i + 1}]
                        </span>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Text input */}
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="输入你的行动..."
                    disabled={isLoading || isTyping || gameStatus !== 'playing'}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                    style={{
                      background: 'rgba(20,16,14,0.8)',
                      border: '1px solid rgba(200,168,140,0.1)',
                      color: '#d4c8b8',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading || isTyping || gameStatus !== 'playing'}
                    className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer disabled:opacity-30"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(40,28,18,0.8), rgba(60,38,22,0.6))',
                      border: '1px solid rgba(200,168,140,0.12)',
                      color: '#c8a88c',
                    }}
                  >
                    行动
                  </button>
                </form>

                {error && (
                  <p className="text-xs mt-2" style={{ color: '#c0392b' }}>
                    {error}
                  </p>
                )}
              </div>
            </div>

            {/* ===== RIGHT PANEL: Status ===== */}
            <div
              className="w-full md:w-72 shrink-0 flex flex-col overflow-y-auto"
              style={{ background: 'rgba(12,10,16,0.6)' }}
            >
              {/* Panel header */}
              <div className="px-5 py-4 text-center border-b shrink-0" style={{ borderColor: 'rgba(200,168,140,0.06)' }}>
                <div className="text-lg" style={{ filter: 'drop-shadow(0 0 20px rgba(200,180,100,0.15))' }}>
                  🏰
                </div>
                <h2
                  className="text-xs font-bold tracking-[0.2em] mt-1"
                  style={{ color: '#c8a88c' }}
                >
                  探险者状态
                </h2>
              </div>

              <div className="p-5 space-y-6">
                {/* Lives */}
                <div>
                  <h3
                    className="text-[10px] tracking-[0.15em] mb-2"
                    style={{ color: 'rgba(200,168,140,0.3)' }}
                  >
                    生命值
                  </h3>
                  <div className="flex gap-1.5">
                    {Array.from({ length: STARTING_LIVES }).map((_, i) => (
                      <span
                        key={i}
                        className={`text-lg transition-all duration-500 ${
                          i < lives ? 'opacity-100 scale-100' : 'opacity-20 scale-75 grayscale'
                        }`}
                        style={{
                          filter: i < lives ? 'drop-shadow(0 0 6px rgba(255,80,80,0.3))' : 'none',
                        }}
                      >
                        ❤️
                      </span>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px" style={{ background: 'rgba(200,168,140,0.06)' }} />

                {/* Inventory */}
                <div>
                  <h3
                    className="text-[10px] tracking-[0.15em] mb-3"
                    style={{ color: 'rgba(200,168,140,0.3)' }}
                  >
                    背包物品
                  </h3>
                  {inventory.length === 0 ? (
                    <div
                      className="text-[11px] italic leading-relaxed"
                      style={{ color: 'rgba(200,168,140,0.2)' }}
                    >
                      空荡荡的...
                      <br />
                      探索古堡寻找线索吧
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {inventory.map((item, i) => (
                        <div
                          key={i}
                          className="inventory-item flex flex-col items-center gap-1 p-2 rounded-lg cursor-default"
                          style={{
                            background: 'rgba(200,168,140,0.04)',
                            border: '1px solid rgba(200,168,140,0.08)',
                          }}
                        >
                          <span className="text-xl">{getItemEmoji(item)}</span>
                          <span
                            className="text-[9px] text-center leading-tight"
                            style={{ color: '#a09080' }}
                          >
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px" style={{ background: 'rgba(200,168,140,0.06)' }} />

                {/* Status indicator */}
                {gameStatus === 'win' && (
                  <div className="text-center py-3 rounded-lg animate-pulse" style={{ background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.15)' }}>
                    <p className="text-sm" style={{ color: '#27ae60' }}>🏆 逃出生天！</p>
                  </div>
                )}
                {gameStatus === 'lose' && (
                  <div className="text-center py-3 rounded-lg animate-pulse" style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.15)' }}>
                    <p className="text-sm" style={{ color: '#e74c3c' }}>💀 古堡吞噬了你...</p>
                  </div>
                )}

                {/* Restart button */}
                {(gameStatus === 'win' || gameStatus === 'lose') && (
                  <button
                    onClick={restart}
                    className="w-full py-2.5 rounded-lg text-xs font-bold tracking-wider transition-all cursor-pointer hover:bg-white/5"
                    style={{
                      background: 'rgba(30,24,18,0.7)',
                      border: '1px solid rgba(200,168,140,0.1)',
                      color: '#c8a88c',
                    }}
                  >
                    重新开始
                  </button>
                )}

                {/* Bottom decoration */}
                <div className="pt-4 text-center">
                  <span className="text-[8px] tracking-[0.4em]" style={{ color: 'rgba(200,168,140,0.1)' }}>
                    ——— 三件圣物 ———
                  </span>
                  <div className="flex justify-center gap-3 mt-2">
                    <span title="古堡印章" className="text-xs" style={{ filter: 'grayscale(0.6)', opacity: inventory.includes('古堡印章') ? 1 : 0.25 }}>📜</span>
                    <span title="月光宝盒" className="text-xs" style={{ filter: 'grayscale(0.6)', opacity: inventory.includes('月光宝盒') ? 1 : 0.25 }}>📿</span>
                    <span title="灵魂宝石" className="text-xs" style={{ filter: 'grayscale(0.6)', opacity: inventory.includes('灵魂宝石') ? 1 : 0.25 }}>💎</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- Win/Lose overlay ---- */}
      {isStarted && gameStatus === 'win' && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
          <div
            className="text-center animate-pulse"
            style={{
              textShadow: '0 0 60px rgba(200,168,140,0.2), 0 0 120px rgba(200,168,140,0.1)',
            }}
          >
            <div className="text-6xl mb-3">🗝️</div>
            <h2
              className="text-4xl font-bold tracking-wider"
              style={{ color: '#d4c8b8' }}
            >
              逃出生天
            </h2>
          </div>
        </div>
      )}

      {isStarted && gameStatus === 'lose' && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-3">🕯️</div>
            <h2
              className="text-3xl font-bold tracking-wider"
              style={{ color: '#605548' }}
            >
              古堡低语...
            </h2>
            <p className="text-sm mt-2" style={{ color: '#504538' }}>
              黑暗吞噬了一切
            </p>
          </div>
        </div>
      )}

      {/* ---- Style tag for bounce animation ---- */}
      <style>{`
        .animate-bounce {
          animation: bounce 1.4s ease-in-out infinite;
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
