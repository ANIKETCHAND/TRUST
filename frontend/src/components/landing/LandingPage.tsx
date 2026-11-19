import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { Scene } from '../../shaders/spark-badge/Scene';
import { IllosGraphic } from '../ui/IllosGraphic';

interface SourceItem {
  id: string;
  label: string;
  path: string;
  who: string;
  when: string;
}

const SOURCES: SourceItem[] = [
  { id: 'wo', label: 'Agent Policy', path: '/policies/pol-4410-tool-execution.md', who: 'SecOps Team', when: '12 May' },
  { id: 'ticket', label: 'Incident Ticket', path: '/incidents/inc-2283-repeat-escalation.md', who: 'SOC Gateway', when: '09 May' },
  { id: 'note', label: 'Rule Patch', path: '/guardrails/quarantine-before-eval.md', who: 'SecOps Team', when: '14 May' },
  { id: 'log', label: 'Audit Log', path: '/audit/tool-audit-may-cluster.md', who: 'Gateway Enforcer', when: '15 May' },
  { id: 'runbook', label: 'Telemetry Runbook', path: '/runbook/agent-trips.md', who: 'CrossX Engine', when: '1s ago' },
];

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

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ferrow-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Ticking table data state
  const [ticks, setTicks] = useState([
    { file: 'agent-sandbox-contract.md', searchDate: 'Mar 2026', s: 1, fresh: false },
    { file: 'tool-registry-boundary.md', searchDate: 'Mar 2026', s: 4, fresh: false },
    { file: 'cross-tenant-isolation.md', searchDate: 'Mar 2026', s: 7, fresh: false },
    { file: 'credential-broker-scope.md', searchDate: 'Mar 2026', s: 10, fresh: false },
    { file: 'delegation-depth-limit.md', searchDate: 'Mar 2026', s: 13, fresh: false },
  ]);

  // Selected source card state
  const [activeSourceId, setActiveSourceId] = useState<string>('note');
  const [isSwappingCard, setIsSwappingCard] = useState<boolean>(false);

  // Teams tab state
  const [activeTeamTab, setActiveTeamTab] = useState<'field' | 'support' | 'logistics'>('field');

  // SparkBadge Scene vs Tactile Hardware View Toggle
  const [activeVisualMode, setActiveVisualMode] = useState<'tactile' | 'spark'>('tactile');

  // Interactive 11 Keys State
  const [activeDepressedKey, setActiveDepressedKey] = useState<string | null>(null);
  const [lastPressedKey, setLastPressedKey] = useState<string>('OK');
  const [keyPressCount, setKeyPressCount] = useState<number>(0);
  const [keyFeedback, setKeyFeedback] = useState<string>('Ready · Press any of the 11 tactile keys');

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

  const handleKeyPress = useCallback((keyId: string, label: string, freq = 320) => {
    playTactileClick(freq);
    setActiveDepressedKey(keyId);
    setLastPressedKey(keyId);
    setKeyPressCount((c) => c + 1);
    setKeyFeedback(`Key [${label}] pressed · Tactile bus active`);
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
        handleKeyPress('UP', 'Up Arrow', 400);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleKeyPress('DOWN', 'Down Arrow', 260);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleKeyPress('LEFT', 'Left Arrow', 300);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleKeyPress('RIGHT', 'Right Arrow', 340);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleKeyPress('OK', 'Center OK', 320);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleKeyPress('PLUS', 'Plus (+)', 440);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleKeyPress('MINUS', 'Minus (−)', 220);
      } else if (e.key === ' ') {
        e.preventDefault();
        handleKeyPress('PLAY', 'Play Stream', 420);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress]);

  // Header hairline on scroll
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Sync theme changes to documentElement
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('ferrow-theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Live ticking table timer
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let isLive = false;
    const compareEl = document.querySelector('.compare');
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) isLive = entry.isIntersecting;
    });

    if (compareEl) {
      observer.observe(compareEl);
    }

    const interval = setInterval(() => {
      if (!isLive) return;
      setTicks((prev) => {
        const resetIndex = Math.random() < 0.35 ? Math.floor(Math.random() * 3) : -1;
        return prev.map((item, idx) => {
          if (idx === resetIndex) {
            return { ...item, s: 1, fresh: true };
          }
          return { ...item, s: item.s + 1, fresh: false };
        });
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  const teamTabs: Array<'field' | 'support' | 'logistics'> = ['field', 'support', 'logistics'];
  const handleTabKeyDown = (e: React.KeyboardEvent, currentTab: 'field' | 'support' | 'logistics') => {
    const d: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    };
    const step = d[e.key];
    if (step) {
      e.preventDefault();
      const currentIndex = teamTabs.indexOf(currentTab);
      const nextIndex = (currentIndex + step + teamTabs.length) % teamTabs.length;
      const nextTab = teamTabs[nextIndex];
      setActiveTeamTab(nextTab);
      document.getElementById(`tab-${nextTab}`)?.focus();
    }
  };

  const handleSelectSource = (id: string) => {
    setActiveSourceId(id);
    setIsSwappingCard(true);
    setTimeout(() => setIsSwappingCard(false), 200);
  };

  const activeSource = SOURCES.find((s) => s.id === activeSourceId) || SOURCES[0];

  const handleEnterConsole = () => {
    navigate(isAuthenticated ? '/dashboard' : '/login');
  };

  return (
    <div className="ferrow-root min-h-screen text-[#2A2E35] selection:bg-[#2A2E35] selection:text-white">
      <a className="skip" href="#main">
        Skip to content
      </a>

      {/* Floating Top Nav Capsule - Hushkey Floating Pill Container */}
      <header className={`fixed top-4 inset-x-0 z-50 px-4 pointer-events-none transition-all duration-200 ${isScrolled ? 'translate-y-[-2px]' : ''}`}>
        <div className={`max-w-4xl mx-auto rounded-full bg-white/92 dark:bg-[#1E2127]/92 backdrop-blur-md px-6 border border-white/80 dark:border-white/10 shadow-[0_10px_30px_rgba(140,150,170,0.22),0_1px_3px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.95)] flex items-center justify-between pointer-events-auto transition-all ${isScrolled ? 'py-2 shadow-lg' : 'py-2.5'}`}>
          {/* Brand Wordmark */}
          <a
            className="flex items-center gap-2 text-[#2A2E35] dark:text-[#ECEFF4] font-black tracking-widest text-base uppercase select-none hover:opacity-85 transition-opacity"
            href="#top"
            aria-label="Hushkey / CrossX home"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <span>HUSHKEY</span>
            <span className="text-[10px] font-mono tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[#E2E6EE] dark:bg-[#2D323C] text-[#69707D] dark:text-[#A0A8B6]">
              CROSSX
            </span>
          </a>

          {/* Desktop Navigation Links matching Hushkey reference */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#2A2E35] dark:text-[#ECEFF4]" aria-label="Main">
            <a href="#keys" className="hover:text-[#69707D] transition-colors">
              Keys
            </a>
            <a href="#modes" className="hover:text-[#69707D] transition-colors">
              Modes
            </a>
            <a href="#chords" className="hover:text-[#69707D] transition-colors">
              Chords
            </a>
            <a href="#finishes" className="hover:text-[#69707D] transition-colors">
              Finishes
            </a>
            <a href="#faq" className="hover:text-[#69707D] transition-colors">
              FAQ
            </a>
            <a href="#contact" className="hover:text-[#69707D] transition-colors">
              Contact
            </a>
          </nav>

          {/* Right Action Pill Button */}
          <div className="flex items-center gap-3">
            <button
              className="p-1.5 rounded-full text-[#69707D] hover:text-[#2A2E35] dark:hover:text-[#ECEFF4] transition-colors cursor-pointer"
              id="theme"
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>

            <button
              onClick={handleEnterConsole}
              id="sign-in-tab"
              className="px-5 py-2 rounded-full bg-[#ECEFF3] dark:bg-[#2D323C] hover:bg-white dark:hover:bg-[#383F4C] text-[#2A2E35] dark:text-[#ECEFF4] font-semibold text-xs border border-white/90 dark:border-white/10 shadow-[2px_3px_8px_rgba(160,172,192,0.35),-1px_-1px_4px_rgba(255,255,255,0.95),inset_0_1px_0_rgba(255,255,255,0.95)] active:translate-y-[1px] transition-all cursor-pointer select-none"
            >
              {isAuthenticated ? 'SOC Console' : 'Pre-order'}
            </button>

            {/* Mobile menu trigger */}
            <button
              className="md:hidden p-1.5 rounded-full text-[#69707D]"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div className="max-w-4xl mx-auto mt-2 rounded-3xl bg-white/95 dark:bg-[#1E2127]/95 backdrop-blur-md p-6 border border-white/80 dark:border-white/10 shadow-xl space-y-4 pointer-events-auto md:hidden">
            <nav className="flex flex-col space-y-3 text-sm font-medium text-[#2A2E35] dark:text-[#ECEFF4]">
              <a href="#keys" onClick={() => setMenuOpen(false)}>Keys</a>
              <a href="#modes" onClick={() => setMenuOpen(false)}>Modes</a>
              <a href="#chords" onClick={() => setMenuOpen(false)}>Chords</a>
              <a href="#finishes" onClick={() => setMenuOpen(false)}>Finishes</a>
              <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
              <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
            </nav>
            <div className="pt-2 border-t border-[#D5DAE3] dark:border-slate-700">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleEnterConsole();
                }}
                className="w-full py-2.5 rounded-full bg-[#2A2E35] text-white font-semibold text-xs text-center"
              >
                {isAuthenticated ? 'Open SOC Console' : 'Launch Console / Pre-order'}
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="main">
        {/* Hero Section matching Hushkey Reference Layout */}
        <section className="hero pt-28 pb-16 md:pt-36 md:pb-24 px-4 overflow-hidden" id="keys">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Bold Display Typography & Body Copy */}
            <div className="lg:col-span-6 space-y-6 select-none">
              <h1 className="font-serif font-black tracking-tight text-[54px] sm:text-[72px] lg:text-[84px] leading-[0.98] text-[#2A2E35] dark:text-[#ECEFF4] drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">
                Eleven keys<br />
                for the whole<br />
                house.
              </h1>

              <p className="tracking-[0.25em] text-[11px] font-bold text-[#69707D] dark:text-[#9DA6B5] uppercase">
                TACTILE HOME CONTROLS
              </p>

              <p className="text-base sm:text-lg leading-relaxed text-[#2A2E35]/85 dark:text-[#ECEFF4]/85 max-w-lg font-sans">
                A palm-sized slab of soft keys for the lights, the music, the blinds and the heat.
                No screen to wake, no app to open. Press, and the room answers.
              </p>

              <div className="flex flex-wrap items-center gap-5 pt-2">
                <button
                  onClick={handleEnterConsole}
                  className="px-7 py-3.5 rounded-full bg-[#ECEFF3] dark:bg-[#2D323C] hover:bg-white dark:hover:bg-[#383F4C] text-[#2A2E35] dark:text-[#ECEFF4] font-semibold text-sm border border-white/90 dark:border-white/10 shadow-[4px_6px_14px_rgba(150,162,180,0.4),-2px_-2px_8px_rgba(255,255,255,0.95),inset_0_1px_0_rgba(255,255,255,0.95)] active:shadow-[inset_2px_2px_5px_rgba(150,162,180,0.5)] active:translate-y-[1px] transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Pre-order · €189</span>
                </button>

                <a
                  href="#modes"
                  className="text-sm font-semibold text-[#2A2E35] dark:text-[#ECEFF4] underline underline-offset-4 decoration-[#69707D]/40 hover:decoration-[#2A2E35] transition-colors"
                >
                  Meet the keys
                </a>
              </div>

              <p className="text-xs text-[#69707D] dark:text-[#9DA6B5] pt-1">
                Ships in March. Joins the hub your home already has.
              </p>

              {/* Live Tactile Feedback Banner */}
              <div className="pt-3">
                <div className="inline-flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-white/70 dark:bg-white/5 border border-white/80 dark:border-white/10 shadow-xs text-xs text-[#69707D] dark:text-[#A0A8B6]">
                  <span className="h-2 w-2 rounded-full bg-[#16A34A] animate-pulse" />
                  <span className="font-mono text-[11px] font-medium text-[#2A2E35] dark:text-[#ECEFF4]">
                    {keyFeedback} <span className="text-[#16A34A] font-bold">[{lastPressedKey}]</span>
                  </span>
                  <span className="text-[10px] text-[#8C94A0]">
                    ({keyPressCount} presses)
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Exact Tactile Hardware Interactive Plates (11 Keys) */}
            <div className="lg:col-span-6 relative flex flex-col items-center justify-center">
              {/* Visualizer Mode Switcher Pill */}
              <div className="mb-4 inline-flex items-center rounded-full bg-white/80 dark:bg-[#1E2127]/80 p-1 border border-white/90 dark:border-white/10 shadow-xs text-[11px] font-mono z-20">
                <button
                  type="button"
                  onClick={() => setActiveVisualMode('tactile')}
                  className={`px-3.5 py-1 rounded-full transition-all cursor-pointer font-medium ${
                    activeVisualMode === 'tactile'
                      ? 'bg-[#2A2E35] text-white shadow-xs'
                      : 'text-[#69707D] hover:text-[#2A2E35]'
                  }`}
                >
                  Tactile Keys (11)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveVisualMode('spark')}
                  className={`px-3.5 py-1 rounded-full transition-all cursor-pointer font-medium ${
                    activeVisualMode === 'spark'
                      ? 'bg-[#2A2E35] text-white shadow-xs'
                      : 'text-[#69707D] hover:text-[#2A2E35]'
                  }`}
                >
                  3D SparkBadge Scene
                </button>
              </div>

              {/* Visual Container */}
              {activeVisualMode === 'tactile' ? (
                <div className="relative w-full max-w-[540px] h-[480px] sm:h-[510px] select-none flex items-center justify-center">
                  {/* 1. Diamond D-Pad Plate (Top-Left) - 5 Keys */}
                  <div className="absolute left-[30px] sm:left-[50px] top-[15px] sm:top-[25px]">
                    <div className="w-50 h-50 sm:w-56 sm:h-56 rounded-[40px] bg-[#E3E7EE] dark:bg-[#252A33] border border-white/70 dark:border-white/10 shadow-[inset_2px_2px_4px_rgba(255,255,255,0.8),inset_-2px_-2px_4px_rgba(170,180,195,0.45),8px_14px_28px_rgba(155,168,188,0.38)] rotate-45 flex items-center justify-center relative">
                      <div className="-rotate-45 w-full h-full relative flex items-center justify-center">
                        {/* Center Key: OK */}
                        <div className="relative flex items-center justify-center">
                          <div className="absolute w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-[#D7DCE5] dark:bg-[#1E232B] shadow-[inset_1px_1px_3px_rgba(150,162,180,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.8)]" />
                          <button
                            type="button"
                            onClick={() => handleKeyPress('OK', 'Center OK', 320)}
                            className={`relative w-13 h-13 sm:w-14 sm:h-14 rounded-full tactile-key-cap text-xs font-bold ${
                              activeDepressedKey === 'OK' ? 'is-depressed' : ''
                            }`}
                            title="Center Key: OK"
                          >
                            OK
                          </button>
                        </div>

                        {/* Top Key: Up Arrow */}
                        <div className="absolute top-2 sm:top-2.5 flex items-center justify-center">
                          <div className="absolute w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#D7DCE5] dark:bg-[#1E232B] shadow-[inset_1px_1px_3px_rgba(150,162,180,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.8)]" />
                          <button
                            type="button"
                            onClick={() => handleKeyPress('UP', 'Up Arrow', 400)}
                            className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full tactile-key-cap ${
                              activeDepressedKey === 'UP' ? 'is-depressed' : ''
                            }`}
                            title="Key: Up"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M12 6l-6.5 8.5h13z" />
                            </svg>
                          </button>
                        </div>

                        {/* Bottom Key: Down Arrow */}
                        <div className="absolute bottom-2 sm:bottom-2.5 flex items-center justify-center">
                          <div className="absolute w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#D7DCE5] dark:bg-[#1E232B] shadow-[inset_1px_1px_3px_rgba(150,162,180,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.8)]" />
                          <button
                            type="button"
                            onClick={() => handleKeyPress('DOWN', 'Down Arrow', 260)}
                            className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full tactile-key-cap ${
                              activeDepressedKey === 'DOWN' ? 'is-depressed' : ''
                            }`}
                            title="Key: Down"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M12 18l6.5-8.5h-13z" />
                            </svg>
                          </button>
                        </div>

                        {/* Left Key: Left Arrow */}
                        <div className="absolute left-2 sm:left-2.5 flex items-center justify-center">
                          <div className="absolute w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#D7DCE5] dark:bg-[#1E232B] shadow-[inset_1px_1px_3px_rgba(150,162,180,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.8)]" />
                          <button
                            type="button"
                            onClick={() => handleKeyPress('LEFT', 'Left Arrow', 300)}
                            className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full tactile-key-cap ${
                              activeDepressedKey === 'LEFT' ? 'is-depressed' : ''
                            }`}
                            title="Key: Left"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M6 12l8.5-6.5v13z" />
                            </svg>
                          </button>
                        </div>

                        {/* Right Key: Right Arrow */}
                        <div className="absolute right-2 sm:right-2.5 flex items-center justify-center">
                          <div className="absolute w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#D7DCE5] dark:bg-[#1E232B] shadow-[inset_1px_1px_3px_rgba(150,162,180,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.8)]" />
                          <button
                            type="button"
                            onClick={() => handleKeyPress('RIGHT', 'Right Arrow', 340)}
                            className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full tactile-key-cap ${
                              activeDepressedKey === 'RIGHT' ? 'is-depressed' : ''
                            }`}
                            title="Key: Right"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M18 12l-8.5 6.5v-13z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Top-Right Horizontal Pill Tray (2 Keys) */}
                  <div className="absolute right-[20px] sm:right-[35px] top-[25px] sm:top-[35px]">
                    <div className="w-38 h-20 sm:w-42 sm:h-22 rounded-full bg-[#E3E7EE] dark:bg-[#252A33] border border-white/70 dark:border-white/10 shadow-[inset_2px_2px_4px_rgba(255,255,255,0.8),inset_-2px_-2px_4px_rgba(170,180,195,0.45),8px_14px_28px_rgba(155,168,188,0.38)] flex items-center justify-between px-3 sm:px-3.5">
                      {/* Left Arrow Key */}
                      <div className="relative flex items-center justify-center">
                        <div className="absolute w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-[#D7DCE5] dark:bg-[#1E232B] shadow-[inset_1px_1px_3px_rgba(150,162,180,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.8)]" />
                        <button
                          type="button"
                          onClick={() => handleKeyPress('H_PREV', 'Horizontal Prev', 310)}
                          className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-full tactile-key-cap ${
                            activeDepressedKey === 'H_PREV' ? 'is-depressed' : ''
                          }`}
                          title="Key: Previous"
                        >
                          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                            <path d="M7 12l7-5.5v11z" />
                          </svg>
                        </button>
                      </div>

                      {/* Right Arrow Key */}
                      <div className="relative flex items-center justify-center">
                        <div className="absolute w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-[#D7DCE5] dark:bg-[#1E232B] shadow-[inset_1px_1px_3px_rgba(150,162,180,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.8)]" />
                        <button
                          type="button"
                          onClick={() => handleKeyPress('H_NEXT', 'Horizontal Next', 350)}
                          className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-full tactile-key-cap ${
                            activeDepressedKey === 'H_NEXT' ? 'is-depressed' : ''
                          }`}
                          title="Key: Next"
                        >
                          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                            <path d="M17 12l-7 5.5v-11z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. Bottom-Left Vertical Pill Tray (2 Keys: +, −) */}
                  <div className="absolute left-[70px] sm:left-[95px] top-[280px] sm:top-[300px]">
                    <div className="w-20 h-38 sm:w-22 sm:h-42 rounded-full bg-[#E3E7EE] dark:bg-[#252A33] border border-white/70 dark:border-white/10 shadow-[inset_2px_2px_4px_rgba(255,255,255,0.8),inset_-2px_-2px_4px_rgba(170,180,195,0.45),8px_14px_28px_rgba(155,168,188,0.38)] flex flex-col items-center justify-between py-3 sm:py-3.5">
                      {/* Plus Key */}
                      <div className="relative flex items-center justify-center">
                        <div className="absolute w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-[#D7DCE5] dark:bg-[#1E232B] shadow-[inset_1px_1px_3px_rgba(150,162,180,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.8)]" />
                        <button
                          type="button"
                          onClick={() => handleKeyPress('PLUS', 'Plus (+)', 420)}
                          className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-full tactile-key-cap text-base font-bold ${
                            activeDepressedKey === 'PLUS' ? 'is-depressed' : ''
                          }`}
                          title="Key: Plus"
                        >
                          +
                        </button>
                      </div>

                      {/* Minus Key */}
                      <div className="relative flex items-center justify-center">
                        <div className="absolute w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-[#D7DCE5] dark:bg-[#1E232B] shadow-[inset_1px_1px_3px_rgba(150,162,180,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.8)]" />
                        <button
                          type="button"
                          onClick={() => handleKeyPress('MINUS', 'Minus (−)', 220)}
                          className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-full tactile-key-cap text-base font-bold ${
                            activeDepressedKey === 'MINUS' ? 'is-depressed' : ''
                          }`}
                          title="Key: Minus"
                        >
                          −
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 4. Bottom-Right Organic Audio / Play Controller (2 Keys: Play, Pause) */}
                  <div className="absolute right-[15px] sm:right-[30px] top-[205px] sm:top-[220px]">
                    <div className="relative w-48 h-52 sm:w-52 sm:h-56">
                      {/* SVG Organic Double-Bubble Plate Outline & Emboss */}
                      <svg
                        className="absolute inset-0 w-full h-full drop-shadow-[0_12px_24px_rgba(155,168,188,0.38)]"
                        viewBox="0 0 200 220"
                        fill="none"
                      >
                        {/* Organic Peanut / Double-Bubble Hull */}
                        <path
                          d="M 126,10 
                             C 166,10 192,36 192,76 
                             C 192,108 172,130 148,138 
                             C 134,142 124,146 116,156 
                             C 106,168 100,192 72,204 
                             C 42,216 12,198 12,166 
                             C 12,132 36,112 64,106 
                             C 78,102 90,96 98,82 
                             C 108,64 104,10 126,10 Z"
                          className="fill-[#E3E7EE] dark:fill-[#252A33] stroke-white/80 dark:stroke-white/10"
                          strokeWidth="1.5"
                        />
                        {/* Concentric Recessed Grooves around Buttons */}
                        {/* Large Play well groove */}
                        <circle
                          cx="136"
                          cy="76"
                          r="56"
                          className="fill-[#D7DCE5] dark:fill-[#1E232B] stroke-white/40 dark:stroke-white/5"
                          strokeWidth="1"
                        />
                        {/* Small Pause well groove */}
                        <circle
                          cx="58"
                          cy="166"
                          r="34"
                          className="fill-[#D7DCE5] dark:fill-[#1E232B] stroke-white/40 dark:stroke-white/5"
                          strokeWidth="1"
                        />
                      </svg>

                      {/* Large Primary Play Key (Upper-Right) */}
                      <button
                        type="button"
                        onClick={() => handleKeyPress('PLAY', 'Play Stream', 400)}
                        className={`absolute top-[28px] sm:top-[30px] right-[16px] sm:right-[18px] w-24 h-24 sm:w-26 sm:h-26 rounded-full tactile-key-cap z-10 ${
                          activeDepressedKey === 'PLAY' ? 'is-depressed' : ''
                        }`}
                        title="Key: Play"
                      >
                        <svg className="w-8 h-8 sm:w-9 sm:h-9 fill-current ml-1" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>

                      {/* Small Secondary Pause Key (Lower-Left) */}
                      <button
                        type="button"
                        onClick={() => handleKeyPress('PAUSE', 'Pause Stream', 270)}
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
              ) : (
                /* Three.js SparkBadge Scene Integration */
                <div className="w-full h-[460px] sm:h-[490px] relative rounded-3xl overflow-hidden bg-black border border-white/60 shadow-2xl">
                  <Scene
                    speed={1.0}
                    particleAmount={1.0}
                    rainAmount={1.0}
                    turbulence={1.0}
                    spread={1.0}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 01 Modes / The Problem Section */}
        <section className="chapter py-20 border-t border-[#D5DAE3] dark:border-slate-800" id="modes">
          <div className="wrap chapter-grid">
            <header className="chapter-head">
              <p className="chapter-no">
                <span>01</span>Modes
              </p>
              <h2 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-[#2A2E35] dark:text-[#ECEFF4]">
                Threats strike in milliseconds. <span className="text-[#69707D]">Static guardrails miss them.</span>
              </h2>
            </header>
            <div className="chapter-body entries">
              <article className="entry card-clean p-6">
                <div className="entry-art">
                  <IllosGraphic name="warehouse" />
                </div>
                <div className="entry-text">
                  <p className="kicker">
                    <span className="num">01</span>The dashboard.
                  </p>
                  <h3 className="text-lg font-bold text-[#2A2E35] dark:text-[#ECEFF4]">Counts the tokens. Misses the exploit chains.</h3>
                  <p className="text-sm text-[#69707D] dark:text-[#A0A8B6] leading-relaxed">
                    Standard LLM gateways display request counts and latency. The subtle parameter tampering an agent chained
                    across three sub-agents never shows up in token graphs.
                  </p>
                  <ul className="tags flex gap-2 pt-2 text-xs text-[#69707D]">
                    <li className="px-2 py-0.5 rounded bg-[#E2E6EE] dark:bg-[#2D323C]">Token metrics</li>
                    <li className="px-2 py-0.5 rounded bg-[#E2E6EE] dark:bg-[#2D323C]">Latency graphs</li>
                    <li className="px-2 py-0.5 rounded bg-[#E2E6EE] dark:bg-[#2D323C]">Generic logs</li>
                  </ul>
                </div>
              </article>

              <article className="entry card-clean p-6">
                <div className="entry-art">
                  <IllosGraphic name="seats" />
                </div>
                <div className="entry-text">
                  <p className="kicker">
                    <span className="num">02</span>Siloed policies.
                  </p>
                  <h3 className="text-lg font-bold text-[#2A2E35] dark:text-[#ECEFF4]">Good protections stay on one host.</h3>
                  <p className="text-sm text-[#69707D] dark:text-[#A0A8B6] leading-relaxed">
                    Each deployment keeps its own sandbox settings on an isolated container. When an adversary escapes one
                    tool boundary, the other worker agents remain vulnerable.
                  </p>
                  <ul className="tags flex gap-2 pt-2 text-xs text-[#69707D]">
                    <li className="px-2 py-0.5 rounded bg-[#E2E6EE] dark:bg-[#2D323C]">Local configs</li>
                    <li className="px-2 py-0.5 rounded bg-[#E2E6EE] dark:bg-[#2D323C]">Ad-hoc filters</li>
                    <li className="px-2 py-0.5 rounded bg-[#E2E6EE] dark:bg-[#2D323C]">Silent failures</li>
                  </ul>
                </div>
              </article>

              <article className="entry card-clean p-6">
                <div className="entry-art">
                  <IllosGraphic name="snapshot" />
                </div>
                <div className="entry-text">
                  <p className="kicker">
                    <span className="num">03</span>The static snapshot.
                  </p>
                  <h3 className="text-lg font-bold text-[#2A2E35] dark:text-[#ECEFF4]">Evaluates against rules saved last month.</h3>
                  <p className="text-sm text-[#69707D] dark:text-[#A0A8B6] leading-relaxed">
                    Security scanners test against snapshot benchmarks. Until someone manually re-runs evaluation sets,
                    production agents execute zero-day vulnerabilities in the dark.
                  </p>
                  <ul className="tags flex gap-2 pt-2 text-xs text-[#69707D]">
                    <li className="px-2 py-0.5 rounded bg-[#E2E6EE] dark:bg-[#2D323C]">Static rules</li>
                    <li className="px-2 py-0.5 rounded bg-[#E2E6EE] dark:bg-[#2D323C]">Manual reviews</li>
                    <li className="px-2 py-0.5 rounded bg-[#E2E6EE] dark:bg-[#2D323C]">Lagging audits</li>
                  </ul>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* 02 Chords / Live Defense Updates */}
        <section className="chapter py-20 border-t border-[#D5DAE3] dark:border-slate-800" id="chords">
          <div className="wrap chapter-grid">
            <header className="chapter-head">
              <p className="chapter-no">
                <span>02</span>Chords
              </p>
              <h2 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-[#2A2E35] dark:text-[#ECEFF4]">
                The rule changes when the attack is intercepted.{' '}
                <span className="text-[#69707D]">Not after the post-mortem.</span>
              </h2>
              <p className="chapter-sub text-sm text-[#69707D] dark:text-[#A0A8B6] mt-3 leading-relaxed">
                Each agent contract is a verifiable security policy. When a prompt injection or unauthorised tool attempt is
                contained, CrossX propagates the patch instantly with full audit trails.
              </p>
            </header>
            <div className="chapter-body">
              <div className="compare card-clean p-6">
                <table>
                  <caption className="sr-only">
                    When each security contract last changed, in static evaluations and in CrossX
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="text-left font-mono text-xs uppercase text-[#69707D]">Contract</th>
                      <th scope="col" className="text-left">
                        <span className="col-name font-bold text-xs">Static Guardrail</span>
                        <span className="status text-[11px] text-[#DC2626]">
                          <i></i>Behind
                        </span>
                        <span className="col-note text-[11px] text-[#8C94A0]">Configured once, then left alone.</span>
                      </th>
                      <th scope="col" className="is-live text-left">
                        <span className="col-name font-bold text-xs text-[#16A34A]">CrossX Zero-Trust</span>
                        <span className="status ok text-[11px] text-[#16A34A]">
                          <i></i>Live
                        </span>
                        <span className="col-note text-[11px] text-[#8C94A0]">Continuously enforced at gateway runtime.</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticks.map((t) => (
                      <tr key={t.file} className="border-t border-[#D5DAE3] dark:border-slate-800">
                        <th scope="row" className="text-left font-mono text-xs py-3 text-[#2A2E35] dark:text-[#ECEFF4]">
                          <span className="file">
                            <i></i>
                            {t.file}
                          </span>
                        </th>
                        <td className="text-xs text-[#69707D] dark:text-[#A0A8B6]">{t.searchDate}</td>
                        <td className="is-live text-xs font-mono font-medium text-[#16A34A]">
                          <span className={`tick ${t.fresh ? 'fresh font-bold text-[#16A34A]' : ''}`} data-s={t.s}>
                            {t.s}s ago
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#D5DAE3] dark:border-slate-700">
                      <th scope="row" className="text-left text-xs font-bold py-3 text-[#2A2E35] dark:text-[#ECEFF4]">Agents protected with current contract</th>
                      <td>
                        <span className="score font-mono text-xs font-semibold">44%</span>
                        <span className="meter" aria-hidden="true">
                          <i style={{ transform: 'scaleX(0.44)' }}></i>
                        </span>
                      </td>
                      <td className="is-live">
                        <span className="score font-mono text-xs font-bold text-[#16A34A]">99.8%</span>
                        <span className="meter" aria-hidden="true">
                          <i style={{ transform: 'scaleX(0.998)' }}></i>
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* 03 Finishes / Ceramic Craftsmanship & Sources */}
        <section className="chapter py-20 border-t border-[#D5DAE3] dark:border-slate-800" id="finishes">
          <div className="wrap chapter-grid">
            <header className="chapter-head">
              <p className="chapter-no">
                <span>03</span>Finishes
              </p>
              <h2 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-[#2A2E35] dark:text-[#ECEFF4]">
                Every action traces back to the policy and prompt behind it.
              </h2>
              <p className="chapter-sub text-sm text-[#69707D] dark:text-[#A0A8B6] mt-3 leading-relaxed">
                Tap any source chip to verify which policy rule intercepted an agent call, who authorized the boundary, and
                exact execution telemetry.
              </p>
            </header>
            <div className="chapter-body">
              <div className="chat card-clean p-6">
                <div className="chat-bar flex items-center justify-between text-xs text-[#69707D] border-b border-[#D5DAE3] dark:border-slate-700 pb-3 mb-4 font-mono">
                  <span>Inspect Agent Telemetry</span>
                  <span aria-hidden="true">/</span>
                  <span>Agent Cluster Alpha</span>
                </div>
                <p className="q font-medium text-sm text-[#2A2E35] dark:text-[#ECEFF4] mb-3">
                  Worker-4 at EU site attempted file system escape. What was the containment verdict?
                </p>
                <div className="a flex gap-4">
                  <span className="avatar w-8 h-8 rounded-full bg-[#2A2E35] text-white flex items-center justify-center font-bold text-xs shrink-0" aria-hidden="true">
                    X
                  </span>
                  <div className="a-body space-y-4 text-xs text-[#2A2E35] dark:text-[#ECEFF4]">
                    <p className="leading-relaxed">
                      Blocked immediately. Zero-trust gateway intercepted recursive directory traversal before execution.
                      Contract rule pol-4410 moved this step to automatic quarantine with fail-closed containment.
                    </p>
                    <p className="label font-mono text-[11px] font-semibold text-[#69707D] uppercase">
                      Provenance Sources
                    </p>
                    <div className="srcs flex flex-wrap gap-2" id="srcs" role="group" aria-label="Sources">
                      {SOURCES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={activeSourceId === s.id}
                          onClick={() => handleSelectSource(s.id)}
                          className={`px-3 py-1 rounded-full text-xs font-mono transition-all cursor-pointer ${
                            activeSourceId === s.id
                              ? 'bg-[#2A2E35] text-white'
                              : 'bg-[#E2E6EE] dark:bg-[#2D323C] text-[#2A2E35] dark:text-[#ECEFF4]'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className={`src-card p-4 rounded-xl bg-[#F0F3F7] dark:bg-[#252A33] border border-[#D5DAE3] dark:border-slate-700 ${isSwappingCard ? 'swap' : ''}`} id="src-card" aria-live="polite">
                      <p className="src-path font-mono text-xs font-semibold text-[#2A2E35] dark:text-[#ECEFF4]">{activeSource.path}</p>
                      <dl className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <dt className="text-[#69707D]">Verified By</dt>
                        <dd className="font-medium">{activeSource.who}</dd>
                        <dt className="text-[#69707D]">Enforced</dt>
                        <dd className="font-medium">{activeSource.when}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 04 Access & Security Band */}
        <section className="band py-20 bg-[#1E2228] text-[#ECEFF4]" id="access">
          <div className="wrap space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <p className="chapter-no text-[#9DA6B5] font-mono text-xs uppercase">
                  <span>04</span>Access
                </p>
                <h2 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-white mt-2">
                  Each agent sees <span className="text-[#9DA6B5]">only the tools its scope permits.</span>
                </h2>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-[#9DA6B5] leading-relaxed">
                  A support agent can search documentation. It can never invoke database drops or write to server configs.
                  CrossX validates every call against cryptographically signed boundary scopes.
                </p>
                <button
                  onClick={handleEnterConsole}
                  className="px-6 py-2.5 rounded-full bg-white text-[#1E2228] font-semibold text-xs hover:bg-[#ECEFF4] transition-colors cursor-pointer"
                >
                  Inspect security console
                </button>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden bg-black/40 border border-white/10 p-4">
              <IllosGraphic name="governance" />
            </div>

            <ul className="points grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-xs">
              <li className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <h3 className="font-bold text-sm text-white">Scopes per agent role</h3>
                <p className="text-[#9DA6B5]">Define strictly which tools, URLs, and external services each agent can call. Sub-agents inherit tighter bounds.</p>
              </li>
              <li className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <h3 className="font-bold text-sm text-white">Cryptographic audit log</h3>
                <p className="text-[#9DA6B5]">Inspect immutable event records tracking every prompt, tool response, and policy evaluation.</p>
              </li>
              <li className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <h3 className="font-bold text-sm text-white">Instant emergency killswitch</h3>
                <p className="text-[#9DA6B5]">Quarantine compromised agents or isolate rogue delegation loops in a single click with zero downtime.</p>
              </li>
            </ul>
          </div>
        </section>

        {/* 05 FAQ & Teams */}
        <section className="chapter py-20 border-t border-[#D5DAE3] dark:border-slate-800" id="faq">
          <div className="wrap chapter-grid">
            <header className="chapter-head">
              <p className="chapter-no">
                <span>05</span>FAQ & Deployments
              </p>
              <h2 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-[#2A2E35] dark:text-[#ECEFF4]">
                Where engineering teams put Hushkey & CrossX to work.
              </h2>
              <div className="tablist flex flex-col gap-2 mt-6" role="tablist" aria-label="Teams" id="tabs">
                <button
                  type="button"
                  role="tab"
                  id="tab-field"
                  aria-controls="panel-field"
                  aria-selected={activeTeamTab === 'field'}
                  tabIndex={activeTeamTab === 'field' ? 0 : -1}
                  onClick={() => setActiveTeamTab('field')}
                  onKeyDown={(e) => handleTabKeyDown(e, 'field')}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    activeTeamTab === 'field'
                      ? 'border-[#2A2E35] bg-white dark:bg-[#252A33] shadow-xs'
                      : 'border-transparent text-[#69707D]'
                  }`}
                >
                  <span className="label block font-mono text-[10px] text-[#69707D]">Autonomous Workflows</span>
                  <span className="text-xs font-bold text-[#2A2E35] dark:text-[#ECEFF4]">Contain risks on the first execution</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-support"
                  aria-controls="panel-support"
                  aria-selected={activeTeamTab === 'support'}
                  tabIndex={activeTeamTab === 'support' ? 0 : -1}
                  onClick={() => setActiveTeamTab('support')}
                  onKeyDown={(e) => handleTabKeyDown(e, 'support')}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    activeTeamTab === 'support'
                      ? 'border-[#2A2E35] bg-white dark:bg-[#252A33] shadow-xs'
                      : 'border-transparent text-[#69707D]'
                  }`}
                >
                  <span className="label block font-mono text-[10px] text-[#69707D]">Customer Copilots</span>
                  <span className="text-xs font-bold text-[#2A2E35] dark:text-[#ECEFF4]">Prevent prompt injection & data leaks</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-logistics"
                  aria-controls="panel-logistics"
                  aria-selected={activeTeamTab === 'logistics'}
                  tabIndex={activeTeamTab === 'logistics' ? 0 : -1}
                  onClick={() => setActiveTeamTab('logistics')}
                  onKeyDown={(e) => handleTabKeyDown(e, 'logistics')}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    activeTeamTab === 'logistics'
                      ? 'border-[#2A2E35] bg-white dark:bg-[#252A33] shadow-xs'
                      : 'border-transparent text-[#69707D]'
                  }`}
                >
                  <span className="label block font-mono text-[10px] text-[#69707D]">Multi-Agent Swarms</span>
                  <span className="text-xs font-bold text-[#2A2E35] dark:text-[#ECEFF4]">Enforce cross-agent delegation boundaries</span>
                </button>
              </div>
            </header>
            <div className="chapter-body panels">
              <article
                className="panel card-clean p-6 space-y-4"
                role="tabpanel"
                id="panel-field"
                aria-labelledby="tab-field"
                hidden={activeTeamTab !== 'field'}
              >
                <div className="panel-art">
                  <IllosGraphic name="fieldservice" />
                </div>
                <h3 className="text-lg font-bold text-[#2A2E35] dark:text-[#ECEFF4]">Contain risks on the first execution.</h3>
                <p className="text-sm text-[#69707D] dark:text-[#A0A8B6] leading-relaxed">
                  When an automated agent generates shell commands or file operations, CrossX intercepts anomalous patterns
                  before syscall execution. The policy updates automatically across the cluster.
                </p>
              </article>

              <article
                className="panel card-clean p-6 space-y-4"
                role="tabpanel"
                id="panel-support"
                aria-labelledby="tab-support"
                hidden={activeTeamTab !== 'support'}
              >
                <div className="panel-art">
                  <IllosGraphic name="support" />
                </div>
                <h3 className="text-lg font-bold text-[#2A2E35] dark:text-[#ECEFF4]">Prevent prompt injection & data leaks.</h3>
                <p className="text-sm text-[#69707D] dark:text-[#A0A8B6] leading-relaxed">
                  User messages flow through real-time ML guardrails that detect indirect prompt injections, jailbreaks, and
                  PII exfiltration attempts before your model responds.
                </p>
              </article>

              <article
                className="panel card-clean p-6 space-y-4"
                role="tabpanel"
                id="panel-logistics"
                aria-labelledby="tab-logistics"
                hidden={activeTeamTab !== 'logistics'}
              >
                <div className="panel-art">
                  <IllosGraphic name="logistics" />
                </div>
                <h3 className="text-lg font-bold text-[#2A2E35] dark:text-[#ECEFF4]">Enforce cross-agent delegation boundaries.</h3>
                <p className="text-sm text-[#69707D] dark:text-[#A0A8B6] leading-relaxed">
                  When primary agents spawn worker tasks, delegations are signed and verified against a depth limit. Recursive
                  agent loops and privilege escalation attacks are neutralized immediately.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* 06 Contact / Pre-order Call-to-Action */}
        <section className="cta py-24 border-t border-[#D5DAE3] dark:border-slate-800" id="contact">
          <div className="wrap">
            <div className="cta-box card-clean p-10 text-center max-w-2xl mx-auto space-y-6">
              <h2 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-[#2A2E35] dark:text-[#ECEFF4]">
                Eleven keys for your whole home. <span className="text-[#69707D]">Zero friction.</span>
              </h2>
              <p className="text-sm text-[#69707D] dark:text-[#A0A8B6] max-w-md mx-auto leading-relaxed">
                Pre-order today for March batch delivery. Includes full CrossX zero-trust autonomous agent defense console.
              </p>
              <div className="ctas flex justify-center gap-4 pt-2">
                <button
                  onClick={handleEnterConsole}
                  className="px-8 py-3.5 rounded-full bg-[#2A2E35] text-white hover:bg-black font-semibold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  {isAuthenticated ? 'Open SOC Console' : 'Pre-order · €189'}
                </button>
                <a
                  href="#keys"
                  className="px-6 py-3.5 rounded-full bg-[#E2E6EE] dark:bg-[#2D323C] text-[#2A2E35] dark:text-[#ECEFF4] font-semibold text-xs hover:bg-[#D5DAE3] transition-colors"
                >
                  Back to top
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer matching Hushkey / CrossX */}
      <footer className="foot border-t border-[#D5DAE3] dark:border-slate-800 py-12 text-xs text-[#69707D]">
        <div className="wrap foot-grid">
          <div className="foot-brand space-y-2">
            <a
              className="brand text-base font-black tracking-widest text-[#2A2E35] dark:text-[#ECEFF4] uppercase"
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              HUSHKEY · CROSSX
            </a>
            <p className="max-w-xs text-xs text-[#69707D]">The tactile minimalist controller and autonomous AI agent defense platform.</p>
          </div>
          <nav className="foot-cols grid grid-cols-3 gap-6" aria-label="Footer">
            <div className="space-y-1.5 flex flex-col">
              <h4 className="font-bold text-[#2A2E35] dark:text-[#ECEFF4]">Product</h4>
              <a href="#keys" className="hover:text-[#2A2E35]">Keys</a>
              <a href="#modes" className="hover:text-[#2A2E35]">Modes</a>
              <a href="#chords" className="hover:text-[#2A2E35]">Chords</a>
              <a href="#finishes" className="hover:text-[#2A2E35]">Finishes</a>
            </div>
            <div className="space-y-1.5 flex flex-col">
              <h4 className="font-bold text-[#2A2E35] dark:text-[#ECEFF4]">Resources</h4>
              <a href="/docs" className="hover:text-[#2A2E35]">API Docs</a>
              <a href="/redoc" className="hover:text-[#2A2E35]">ReDoc Schema</a>
              <a href="#contact" className="hover:text-[#2A2E35]">Support & FAQ</a>
            </div>
            <div className="space-y-1.5 flex flex-col">
              <h4 className="font-bold text-[#2A2E35] dark:text-[#ECEFF4]">Console</h4>
              <button
                onClick={handleEnterConsole}
                className="text-left text-[#69707D] hover:text-[#2A2E35] block py-0.5 cursor-pointer"
              >
                {isAuthenticated ? 'SOC Console' : 'Sign In'}
              </button>
              <a href="#keys" className="hover:text-[#2A2E35]">Live Radar</a>
            </div>
          </nav>
        </div>
        <div className="wrap legal pt-8 mt-8 border-t border-[#D5DAE3] dark:border-slate-800 flex justify-between items-center text-[11px]">
          <span>&copy; 2026 Hushkey & CrossX. All rights reserved.</span>
          <span className="legal-links flex gap-4">
            <a href="#" className="hover:underline">Privacy</a>
            <a href="#" className="hover:underline">Terms</a>
            <a href="#" className="hover:underline">Security</a>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
