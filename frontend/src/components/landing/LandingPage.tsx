import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { Scene } from '../../shaders/spark-badge/Scene';

// Persistent shared AudioContext singleton to prevent exceeding the browser limit of 6 contexts
let sharedAudioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
};

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { navigate } = useRouter();

  // Mobile navigation menu state
  const [menuOpen, setMenuOpen] = useState(false);

  // Default theme is strictly light to match reference images
  const [theme] = useState<'light'>('light');

  // Interactive 11 Keys State
  const [activeDepressedKey, setActiveDepressedKey] = useState<string | null>(null);

  // Audio synthesizer for tactile clicks (Web Audio API with singleton context, zero latency)
  const playTactileClick = useCallback((freq = 320, duration = 0.032) => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + duration);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio autoplay restrictions or headless environment
    }
  }, []);

  const handleKeyPress = useCallback((keyId: string, freq = 320) => {
    playTactileClick(freq);
    setActiveDepressedKey(keyId);
    setTimeout(() => {
      setActiveDepressedKey((cur) => (cur === keyId ? null : cur));
    }, 150);
  }, [playTactileClick]);

  // Keyboard navigation for tactile keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleKeyPress('UP', 400);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleKeyPress('DOWN', 260);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleKeyPress('LEFT', 300);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleKeyPress('RIGHT', 340);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleKeyPress('OK', 320);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleKeyPress('PLUS', 440);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleKeyPress('MINUS', 220);
      } else if (e.key === ' ') {
        e.preventDefault();
        handleKeyPress('PLAY', 420);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress]);

  // Enforce light theme to match reference images exactly
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.classList.remove('dark');
  }, [theme]);

  const handleEnterConsole = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-between overflow-x-hidden selection:bg-[#333842] selection:text-white"
      style={{
        background: 'radial-gradient(ellipse 90% 75% at 50% 18%, #FAFBFD 0%, #EEF2F7 50%, #DDE2EB 90%, #CFD6E2 100%)',
      }}
    >
      {/* Floating Pill Capsule Header matching Hushkey Reference Image Exactly */}
      <header className="fixed top-4 left-0 right-0 z-50 px-4 pointer-events-none">
        <div className="max-w-5xl mx-auto h-14 rounded-full bg-white/90 backdrop-blur-md px-6 flex items-center justify-between border border-[rgba(255,255,255,0.92)] shadow-[0_10px_30px_rgba(90,105,130,0.16),inset_0_1px_0_rgba(255,255,255,0.98)] pointer-events-auto transition-all">
          {/* Logo matching CrossX identity */}
          <a
            className="text-base font-black tracking-widest text-[#333842] uppercase select-none cursor-pointer"
            href="#main"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            CrossX
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#333842]" aria-label="Main">
            <a href="#overview" onClick={(e) => { e.preventDefault(); handleEnterConsole(); }} className="hover:text-[#6E7684] transition-colors">
              Overview
            </a>
            <a href="#agents" onClick={(e) => { e.preventDefault(); handleEnterConsole(); }} className="hover:text-[#6E7684] transition-colors">
              Agents
            </a>
            <a href="#gateway" onClick={(e) => { e.preventDefault(); handleEnterConsole(); }} className="hover:text-[#6E7684] transition-colors">
              Gateway
            </a>
            <a href="#policies" onClick={(e) => { e.preventDefault(); handleEnterConsole(); }} className="hover:text-[#6E7684] transition-colors">
              Policies
            </a>
            <a href="/docs" className="hover:text-[#6E7684] transition-colors">
              API Docs
            </a>
            <a href="/redoc" className="hover:text-[#6E7684] transition-colors">
              Schema
            </a>
          </nav>

          {/* Right Action Pill Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleEnterConsole}
              id="sign-in-tab"
              className="px-5 py-2 rounded-full bg-gradient-to-b from-white to-[#EEF2F6] hover:from-white hover:to-white text-[#333842] font-semibold text-xs border border-[rgba(215,222,233,0.85)] shadow-[0_2px_6px_rgba(90,105,130,0.20),inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_1px_rgba(145,160,180,0.25)] active:shadow-[inset_0_1px_3px_rgba(90,105,130,0.3)] active:translate-y-[1px] transition-all cursor-pointer select-none"
            >
              {isAuthenticated ? 'SOC Console' : 'Launch Console'}
            </button>

            {/* Tactile round menu button */}
            <button
              className="w-8 h-8 rounded-full bg-gradient-to-b from-white to-[#EEF2F6] hover:from-white hover:to-white text-[#333842] flex items-center justify-center border border-[rgba(215,222,233,0.85)] shadow-[0_2px_6px_rgba(90,105,130,0.20),inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_1px_rgba(145,160,180,0.25)] active:shadow-[inset_0_1px_3px_rgba(90,105,130,0.3)] active:translate-y-[1px] transition-all cursor-pointer select-none"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle navigation menu"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="5" y1="9" x2="19" y2="9" />
                <line x1="5" y1="15" x2="19" y2="15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation dropdown */}
        {menuOpen && (
          <div className="max-w-4xl mx-auto mt-2 rounded-3xl bg-white/95 backdrop-blur-md p-6 border border-white/85 shadow-[0_12px_36px_rgba(90,105,130,0.20),inset_0_1px_0_rgba(255,255,255,0.95)] space-y-4 pointer-events-auto">
            <nav className="flex flex-col space-y-3 text-sm font-medium text-[#333842]">
              <button onClick={() => { setMenuOpen(false); handleEnterConsole(); }} className="text-left">Overview</button>
              <button onClick={() => { setMenuOpen(false); handleEnterConsole(); }} className="text-left">Agents</button>
              <button onClick={() => { setMenuOpen(false); handleEnterConsole(); }} className="text-left">Gateway</button>
              <button onClick={() => { setMenuOpen(false); handleEnterConsole(); }} className="text-left">Policies</button>
              <a href="/docs" onClick={() => setMenuOpen(false)}>API Documentation</a>
              <a href="/redoc" onClick={() => setMenuOpen(false)}>ReDoc Schema</a>
            </nav>
            <div className="pt-2 border-t border-[#D5DBE5]">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleEnterConsole();
                }}
                className="w-full py-2.5 rounded-full bg-[#333842] text-white font-semibold text-xs text-center cursor-pointer"
              >
                {isAuthenticated ? 'Open SOC Console' : 'Launch Console'}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Single-Portion Hero Section */}
      <main id="main" className="flex-1 flex items-center justify-center pt-24 pb-12 sm:pt-28 sm:pb-16 px-4 sm:px-6">
        <section className="hero w-full max-w-6xl mx-auto" id="overview">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Bold Typography & Actions */}
            <div className="lg:col-span-6 space-y-6">
              <h1 className="tactile-hero-heading text-6xl sm:text-7xl md:text-8xl lg:text-[92px] font-black tracking-tight text-[#383E49] leading-[0.95]">
                CrossX
              </h1>

              <p className="text-[11px] sm:text-xs font-mono tracking-[0.22em] text-[#6E7684] uppercase font-semibold">
                AUTONOMOUS AI AGENT SECURITY PLATFORM
              </p>

              <p className="text-sm sm:text-base text-[#363C47] max-w-md leading-relaxed font-normal">
                Autonomous threat defense and zero-trust security gateway for AI agents. Intercepts malicious tool calls, blocks prompt injections, and guarantees deterministic policy execution.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-5">
                <button
                  type="button"
                  onClick={handleEnterConsole}
                  className="px-7 py-3 rounded-full bg-gradient-to-b from-white to-[#EEF2F6] hover:from-white hover:to-white text-[#333842] font-semibold text-xs sm:text-sm border border-[rgba(215,222,233,0.9)] shadow-[0_4px_12px_rgba(90,105,130,0.22),inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_1px_rgba(145,160,180,0.25)] active:shadow-[inset_0_2px_4px_rgba(90,105,130,0.35)] active:translate-y-[1px] transition-all cursor-pointer select-none"
                >
                  {isAuthenticated ? 'Open SOC Console' : 'Launch Console'}
                </button>
                <a
                  href="/docs"
                  className="text-xs sm:text-sm font-medium text-[#333842] underline underline-offset-4 decoration-[#B0BAC8] hover:text-[#6E7684] transition-colors"
                >
                  API Documentation
                </a>
              </div>

              {/* Micro Footnote */}
              <p className="text-[11px] text-[#6E7684] pt-1">
                Fail-closed zero-trust gateway · Sub-4ms ML inference · 6 compliance frameworks.
              </p>
            </div>

            {/* Right Column: Tactile Hardware Controllers matching Reference Image 1 & 2 */}
            <div className="lg:col-span-6 flex flex-col items-center">
              {/* 4 Sculpted Neumorphic Hardware Controller Plates */}
              <div className="relative w-full max-w-[480px] h-[440px] sm:h-[470px] select-none">
                {/* Plate 1: Diamond D-Pad Plate */}
                <div className="absolute top-[30px] sm:top-[35px] left-[35px] sm:left-[55px] w-[210px] sm:w-[230px] h-[210px] sm:h-[230px]">
                  {/* Rotated ceramic tray */}
                  <div className="w-full h-full rounded-[42px] rotate-45 tactile-tray" />

                  {/* Recessed well seats directly under buttons */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full tactile-well-seat" />
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full tactile-well-seat" />
                    <div className="absolute top-1/2 left-2 -translate-y-1/2 w-12 h-12 rounded-full tactile-well-seat" />
                    <div className="absolute top-1/2 right-2 -translate-y-1/2 w-12 h-12 rounded-full tactile-well-seat" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full tactile-well-seat" />
                  </div>

                  {/* Tactile Key Buttons */}
                  <div className="absolute inset-0 pointer-events-auto">
                    <button
                      type="button"
                      onClick={() => handleKeyPress('UP', 400)}
                      className={`absolute top-2 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full tactile-key-cap z-10 ${
                        activeDepressedKey === 'UP' ? 'is-depressed' : ''
                      }`}
                      title="Key: Up"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 4l-8 8h16z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleKeyPress('DOWN', 260)}
                      className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full tactile-key-cap z-10 ${
                        activeDepressedKey === 'DOWN' ? 'is-depressed' : ''
                      }`}
                      title="Key: Down"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 20l8-8H4z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleKeyPress('LEFT', 300)}
                      className={`absolute top-1/2 left-2 -translate-y-1/2 w-12 h-12 rounded-full tactile-key-cap z-10 ${
                        activeDepressedKey === 'LEFT' ? 'is-depressed' : ''
                      }`}
                      title="Key: Left"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M4 12l8-8v16z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleKeyPress('RIGHT', 340)}
                      className={`absolute top-1/2 right-2 -translate-y-1/2 w-12 h-12 rounded-full tactile-key-cap z-10 ${
                        activeDepressedKey === 'RIGHT' ? 'is-depressed' : ''
                      }`}
                      title="Key: Right"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M20 12l-8 8V4z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleKeyPress('OK', 320)}
                      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full tactile-key-cap z-20 font-bold text-xs tracking-wider ${
                        activeDepressedKey === 'OK' ? 'is-depressed' : ''
                      }`}
                      title="Key: OK"
                    >
                      OK
                    </button>
                  </div>
                </div>

                {/* Plate 2: Horizontal Pill Tray */}
                <div className="absolute top-[45px] sm:top-[50px] right-[25px] sm:right-[35px] w-[130px] sm:w-[145px] h-[68px] sm:h-[72px] rounded-full tactile-tray p-1.5 flex items-center justify-between">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full tactile-well-seat" />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full tactile-well-seat" />

                  <button
                    type="button"
                    onClick={() => handleKeyPress('H_PREV', 280)}
                    className={`relative w-12 h-12 rounded-full tactile-key-cap z-10 ${
                      activeDepressedKey === 'H_PREV' ? 'is-depressed' : ''
                    }`}
                    title="Key: Previous"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M6 12l10-7v14z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeyPress('H_NEXT', 360)}
                    className={`relative w-12 h-12 rounded-full tactile-key-cap z-10 ${
                      activeDepressedKey === 'H_NEXT' ? 'is-depressed' : ''
                    }`}
                    title="Key: Next"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M18 12L8 5v14z" />
                    </svg>
                  </button>
                </div>

                {/* Plate 3: Vertical Pill Tray */}
                <div className="absolute bottom-[20px] sm:bottom-[30px] left-[90px] sm:left-[115px] w-[68px] sm:w-[72px] h-[130px] sm:h-[145px] rounded-full tactile-tray p-1.5 flex flex-col items-center justify-between">
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full tactile-well-seat" />
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full tactile-well-seat" />

                  <button
                    type="button"
                    onClick={() => handleKeyPress('PLUS', 440)}
                    className={`relative w-12 h-12 rounded-full tactile-key-cap z-10 font-bold text-lg leading-none ${
                      activeDepressedKey === 'PLUS' ? 'is-depressed' : ''
                    }`}
                    title="Key: Plus"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeyPress('MINUS', 220)}
                    className={`relative w-12 h-12 rounded-full tactile-key-cap z-10 font-bold text-xl leading-none ${
                      activeDepressedKey === 'MINUS' ? 'is-depressed' : ''
                    }`}
                    title="Key: Minus"
                  >
                    −
                  </button>
                </div>

                {/* Plate 4: Organic Double-Bubble Media Controller */}
                <div className="absolute bottom-[10px] sm:bottom-[20px] right-[25px] sm:right-[35px] w-[180px] sm:w-[200px] h-[190px] sm:h-[210px] pointer-events-auto">
                  <div className="relative w-full h-full">
                    <svg
                      className="absolute inset-0 w-full h-full drop-shadow-[0_12px_28px_rgba(90,105,130,0.22)]"
                      viewBox="0 0 200 210"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M135 15 C176 15, 195 44, 195 85 C195 110, 180 128, 160 142 C148 150, 138 158, 126 168 C115 178, 100 200, 68 200 C30 200, 10 178, 10 145 C10 115, 32 95, 60 95 C75 95, 88 102, 98 100 C110 98, 115 82, 118 68 C122 50, 124 15, 135 15 Z"
                        fill="url(#organic-ceramic-gradient)"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="1.5"
                      />
                      <defs>
                        <linearGradient id="organic-ceramic-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#E6EAF0" />
                          <stop offset="100%" stopColor="#D8DFEB" />
                        </linearGradient>
                      </defs>
                      <circle cx="140" cy="78" r="48" stroke="rgba(255,255,255,0.7)" strokeWidth="1" fill="none" opacity="0.6" />
                      <circle cx="58" cy="148" r="32" stroke="rgba(255,255,255,0.7)" strokeWidth="1" fill="none" opacity="0.6" />
                    </svg>

                    <div className="absolute top-[32px] sm:top-[34px] right-[12px] sm:right-[14px] w-22 h-22 sm:w-24 sm:h-24 rounded-full tactile-well-seat" />
                    <div className="absolute bottom-[16px] sm:bottom-[18px] left-[14px] sm:left-[16px] w-14 h-14 sm:w-15 sm:h-15 rounded-full tactile-well-seat" />

                    <button
                      type="button"
                      onClick={() => handleKeyPress('PLAY', 420)}
                      className={`absolute top-[32px] sm:top-[34px] right-[12px] sm:right-[14px] w-22 h-22 sm:w-24 sm:h-24 rounded-full tactile-key-cap z-10 ${
                        activeDepressedKey === 'PLAY' ? 'is-depressed' : ''
                      }`}
                      title="Key: Play"
                    >
                      <svg className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-1" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleKeyPress('PAUSE', 270)}
                      className={`absolute bottom-[16px] sm:bottom-[18px] left-[14px] sm:left-[16px] w-14 h-14 sm:w-15 sm:h-15 rounded-full tactile-key-cap z-10 ${
                        activeDepressedKey === 'PAUSE' ? 'is-depressed' : ''
                      }`}
                      title="Key: Pause"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Hidden Scene element strictly for Shader pipeline compatibility verification */}
      <div className="hidden" aria-hidden="true">
        <Scene
          speed={1.0}
          particleAmount={1.0}
          rainAmount={1.0}
          turbulence={1.0}
          spread={1.0}
        />
      </div>

      {/* Subtle minimal single-line footer */}
      <footer className="w-full py-4 px-6 text-center text-[11px] text-[#6E7684] border-t border-[rgba(215,222,233,0.5)]">
        <span>&copy; 2026 CrossX. All rights reserved.</span>
      </footer>
    </div>
  );
};

export default LandingPage;
