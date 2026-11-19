import React, { useState, useEffect } from 'react';
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

  // SparkBadge Scene visibility toggle in plate
  const [showSparkBadge, setShowSparkBadge] = useState<boolean>(false);

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

  // Live ticking table timer with IntersectionObserver and reduced motion support
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
    <div className="ferrow-root min-h-screen">
      <a className="skip" href="#main">
        Skip to content
      </a>

      {/* Top Header Bar */}
      <header className={`top ${isScrolled ? 'is-scrolled' : ''}`} id="top">
        <div className="wrap bar">
          <a
            className="brand"
            href="#top"
            aria-label="CrossX home"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <span className="brand-mark" aria-hidden="true"></span>
            CrossX
          </a>

          <nav className={`links ${menuOpen ? 'open' : ''}`} id="menu" aria-label="Main">
            <a href="#why" onClick={() => setMenuOpen(false)}>
              The problem
            </a>
            <a href="#how" onClick={() => setMenuOpen(false)}>
              How defense updates
            </a>
            <a href="#answers" onClick={() => setMenuOpen(false)}>
              Sources
            </a>
            <a href="#security" onClick={() => setMenuOpen(false)}>
              Access
            </a>
            <a href="#uses" onClick={() => setMenuOpen(false)}>
              Teams
            </a>
            <button
              onClick={() => {
                setMenuOpen(false);
                handleEnterConsole();
              }}
              className="btn links-cta"
            >
              {isAuthenticated ? 'SOC Console' : 'Sign In'}
            </button>
          </nav>

          <div className="actions">
            <button
              className="icon-btn"
              id="theme"
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              <svg
                className="moon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21.5 14.08C20.3 14.72 18.93 15.08 17.48 15.08C12.75 15.08 8.92 11.25 8.92 6.52C8.92 5.07 9.28 3.7 9.92 2.5C5.67 3.5 2.5 7.32 2.5 11.87C2.5 17.19 6.81 21.5 12.13 21.5C16.68 21.5 20.5 18.33 21.5 14.08Z" />
              </svg>
              <svg
                className="sun"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M17 12C17 14.76 14.76 17 12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12Z" />
                <path d="M12 2V3.5M12 20.5V22M19.07 19.07L18.01 18.01M5.99 5.99L4.93 4.93M22 12H20.5M3.5 12H2M19.07 4.93L18.01 5.99M5.99 18.01L4.93 19.07" />
              </svg>
            </button>

            <button
              onClick={handleEnterConsole}
              id="sign-in-tab"
              className="btn btn-sm bar-cta"
            >
              {isAuthenticated ? 'SOC Console' : 'Sign In'}
            </button>

            <button
              className="icon-btn menu-btn"
              id="menu-btn"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg
                className="open"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 8L20 8" />
                <path d="M4 16L20 16" />
              </svg>
              <svg
                className="close"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M18 6L6 18M18 18L6 6" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero Section */}
        <section className="hero">
          <div className="wrap">
            <p className="eyebrow">
              <span className="pulse" aria-hidden="true"></span>
              For autonomous AI agents & SOC operators
            </p>
            <h1>
              Every autonomous agent <span className="muted">defended at runtime.</span>
            </h1>
            <div className="hero-row">
              <p className="lede">
                When an agent attempts a tool call or delegation cascade, CrossX checks every step against zero-trust policy.
                Patches and verified guardrails update across all agents instantly with complete cryptographic provenance.
              </p>
              <div className="ctas">
                <button onClick={handleEnterConsole} className="btn">
                  {isAuthenticated ? 'Open SOC Console' : 'Launch CrossX'}
                  <svg
                    className="ic"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18.5 12L5 12" />
                    <path d="M13 18C13 18 19 13.58 19 12C19 10.42 13 6 13 6" />
                  </svg>
                </button>
                <a className="btn ghost" href="#how">
                  Watch live defense
                </a>
              </div>
            </div>
          </div>

          <div className="wrap">
            <div className="plate">
              <div className="plate-art relative min-h-[380px] flex items-center justify-center">
                {/* Switchable View: Animated SVG Illustration or Full Interactive ThreeUI Canvas */}
                {!showSparkBadge ? (
                  <div className="w-full max-w-[720px] py-4">
                    <IllosGraphic name="hero" />
                  </div>
                ) : (
                  <div className="w-full h-[400px] relative rounded-xl overflow-hidden bg-black">
                    <Scene
                      speed={1.0}
                      particleAmount={1.0}
                      rainAmount={1.0}
                      turbulence={1.0}
                      spread={1.0}
                    />
                  </div>
                )}

                {/* Toggle badge in corner of plate */}
                <button
                  type="button"
                  onClick={() => setShowSparkBadge(!showSparkBadge)}
                  className="absolute bottom-4 right-4 z-20 text-[11px] font-mono px-3 py-1 rounded-full border border-[var(--line-2)] bg-[var(--card)] text-[var(--ink-2)] hover:text-[var(--ink)] shadow-xs transition-all"
                  title="Toggle 3D SparkBadge Visualizer"
                >
                  {showSparkBadge ? 'Show Architecture Diagram' : 'Show 3D SparkBadge Scene'}
                </button>
              </div>

              <div className="flow">
                <div className="flow-group">
                  <p className="label">Monitors agent activity from</p>
                  <ul className="pills">
                    <li>Tool Calls</li>
                    <li>Prompts</li>
                    <li>Delegations</li>
                  </ul>
                </div>
                <span className="flow-arrow" aria-hidden="true"></span>
                <div className="flow-group">
                  <p className="label">Enforces</p>
                  <ul className="pills">
                    <li className="is-live">Zero-Trust Gateway</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 01 Why / The Problem */}
        <section className="chapter" id="why">
          <div className="wrap chapter-grid">
            <header className="chapter-head">
              <p className="chapter-no">
                <span>01</span>The problem
              </p>
              <h2>
                Threats strike in milliseconds. <span className="muted">Static guardrails miss them.</span>
              </h2>
            </header>
            <div className="chapter-body entries">
              <article className="entry">
                <div className="entry-art">
                  <IllosGraphic name="warehouse" />
                </div>
                <div className="entry-text">
                  <p className="kicker">
                    <span className="num">01</span>The dashboard.
                  </p>
                  <h3>Counts the tokens. Misses the exploit chains.</h3>
                  <p>
                    Standard LLM gateways display request counts and latency. The subtle parameter tampering an agent chained
                    across three sub-agents never shows up in token graphs.
                  </p>
                  <ul className="tags">
                    <li>Token metrics</li>
                    <li>Latency graphs</li>
                    <li>Generic logs</li>
                  </ul>
                </div>
              </article>

              <article className="entry">
                <div className="entry-art">
                  <IllosGraphic name="seats" />
                </div>
                <div className="entry-text">
                  <p className="kicker">
                    <span className="num">02</span>Siloed policies.
                  </p>
                  <h3>Good protections stay on one host.</h3>
                  <p>
                    Each deployment keeps its own sandbox settings on an isolated container. When an adversary escapes one
                    tool boundary, the other worker agents remain vulnerable.
                  </p>
                  <ul className="tags">
                    <li>Local configs</li>
                    <li>Ad-hoc filters</li>
                    <li>Silent failures</li>
                  </ul>
                </div>
              </article>

              <article className="entry">
                <div className="entry-art">
                  <IllosGraphic name="snapshot" />
                </div>
                <div className="entry-text">
                  <p className="kicker">
                    <span className="num">03</span>The static snapshot.
                  </p>
                  <h3>Evaluates against rules saved last month.</h3>
                  <p>
                    Security scanners test against snapshot benchmarks. Until someone manually re-runs evaluation sets,
                    production agents execute zero-day vulnerabilities in the dark.
                  </p>
                  <ul className="tags">
                    <li>Static rules</li>
                    <li>Manual reviews</li>
                    <li>Lagging audits</li>
                  </ul>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* 02 How it works / Live Adaptation */}
        <section className="chapter" id="how">
          <div className="wrap chapter-grid">
            <header className="chapter-head">
              <p className="chapter-no">
                <span>02</span>How defense updates
              </p>
              <h2>
                The rule changes when the attack is intercepted.{' '}
                <span className="muted">Not after the post-mortem.</span>
              </h2>
              <p className="chapter-sub">
                Each agent contract is a verifiable security policy. When a prompt injection or unauthorised tool attempt is
                contained, CrossX propagates the patch instantly with full audit trails.
              </p>
            </header>
            <div className="chapter-body">
              <div className="compare">
                <table>
                  <caption className="sr-only">
                    When each security contract last changed, in static evaluations and in CrossX
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Contract</th>
                      <th scope="col">
                        <span className="col-name">Static Guardrail</span>
                        <span className="status">
                          <i></i>Behind
                        </span>
                        <span className="col-note">Configured once, then left alone.</span>
                      </th>
                      <th scope="col" className="is-live">
                        <span className="col-name">CrossX Zero-Trust</span>
                        <span className="status ok">
                          <i></i>Live
                        </span>
                        <span className="col-note">Continuously enforced at gateway runtime.</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticks.map((t) => (
                      <tr key={t.file}>
                        <th scope="row">
                          <span className="file">
                            <i></i>
                            {t.file}
                          </span>
                        </th>
                        <td>{t.searchDate}</td>
                        <td className="is-live">
                          <span className={`tick ${t.fresh ? 'fresh' : ''}`} data-s={t.s}>
                            {t.s}s ago
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Agents protected with current contract</th>
                      <td>
                        <span className="score">44%</span>
                        <span className="meter" aria-hidden="true">
                          <i style={{ transform: 'scaleX(0.44)' }}></i>
                        </span>
                      </td>
                      <td className="is-live">
                        <span className="score">99.8%</span>
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

        {/* 03 Sources & Provenance */}
        <section className="chapter" id="answers">
          <div className="wrap chapter-grid">
            <header className="chapter-head">
              <p className="chapter-no">
                <span>03</span>Sources
              </p>
              <h2>Every action traces back to the policy and prompt behind it.</h2>
              <p className="chapter-sub">
                Tap any source chip to verify which policy rule intercepted an agent call, who authorized the boundary, and
                exact execution telemetry.
              </p>
            </header>
            <div className="chapter-body">
              <div className="chat">
                <div className="chat-bar">
                  <span>Inspect Agent Telemetry</span>
                  <span aria-hidden="true">/</span>
                  <span>Agent Cluster Alpha</span>
                </div>
                <p className="q">Worker-4 at EU site attempted file system escape. What was the containment verdict?</p>
                <div className="a">
                  <span className="avatar" aria-hidden="true">
                    X
                  </span>
                  <div className="a-body">
                    <p>
                      Blocked immediately. Zero-trust gateway intercepted recursive directory traversal before execution.
                      Contract rule pol-4410 moved this step to automatic quarantine with fail-closed containment.
                    </p>
                    <p className="label">Provenance Sources</p>
                    <div className="srcs" id="srcs" role="group" aria-label="Sources">
                      {SOURCES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={activeSourceId === s.id}
                          onClick={() => handleSelectSource(s.id)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className={`src-card ${isSwappingCard ? 'swap' : ''}`} id="src-card" aria-live="polite">
                      <p className="src-path">{activeSource.path}</p>
                      <dl>
                        <dt>Verified By</dt>
                        <dd>{activeSource.who}</dd>
                        <dt>Enforced</dt>
                        <dd>{activeSource.when}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 04 Setup */}
        <section className="chapter" id="cost">
          <div className="wrap chapter-grid">
            <header className="chapter-head">
              <p className="chapter-no">
                <span>04</span>Setup
              </p>
              <h2>
                Connect your agent gateway once. <span className="muted">Every worker starts from zero-trust.</span>
              </h2>
              <p className="chapter-sub">
                CrossX integrates into your LangChain, AutoGen, CrewAI, or bespoke agents via one standard proxy line.
                Duplicate calls and dangerous capabilities are isolated by default.
              </p>
            </header>
            <div className="chapter-body">
              <div className="frame">
                <IllosGraphic name="foundation" />
              </div>
            </div>
          </div>
        </section>

        {/* 05 Security Band */}
        <section className="band on-dark" id="security">
          <div className="wrap">
            <div className="band-head">
              <div>
                <p className="chapter-no">
                  <span>05</span>Access
                </p>
                <h2>
                  Each agent sees <span className="muted">only the tools its scope permits.</span>
                </h2>
              </div>
              <div>
                <p className="band-sub">
                  A support agent can search documentation. It can never invoke database drops or write to server configs.
                  CrossX validates every call against cryptographically signed boundary scopes.
                </p>
                <button
                  onClick={handleEnterConsole}
                  className="btn light"
                >
                  Inspect security console
                  <svg
                    className="ic"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18.5 12L5 12" />
                    <path d="M13 18C13 18 19 13.58 19 12C19 10.42 13 6 13 6" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="band-art">
              <IllosGraphic name="governance" />
            </div>

            <ul className="points">
              <li>
                <h3>Scopes per agent role</h3>
                <p>Define strictly which tools, URLs, and external services each agent can call. Sub-agents inherit tighter bounds.</p>
              </li>
              <li>
                <h3>Cryptographic audit log</h3>
                <p>Inspect immutable event records tracking every prompt, tool response, and policy evaluation.</p>
              </li>
              <li>
                <h3>Instant emergency killswitch</h3>
                <p>Quarantine compromised agents or isolate rogue delegation loops in a single click with zero downtime.</p>
              </li>
            </ul>
          </div>
        </section>

        {/* 06 Teams & Deployments */}
        <section className="chapter" id="uses">
          <div className="wrap chapter-grid">
            <header className="chapter-head">
              <p className="chapter-no">
                <span>06</span>Teams
              </p>
              <h2>Where engineering teams put CrossX to work.</h2>
              <div className="tablist" role="tablist" aria-label="Teams" id="tabs">
                <button
                  type="button"
                  role="tab"
                  id="tab-field"
                  aria-controls="panel-field"
                  aria-selected={activeTeamTab === 'field'}
                  tabIndex={activeTeamTab === 'field' ? 0 : -1}
                  onClick={() => setActiveTeamTab('field')}
                  onKeyDown={(e) => handleTabKeyDown(e, 'field')}
                >
                  <span className="label">Autonomous Workflows</span>
                  Contain risks on the first execution
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
                >
                  <span className="label">Customer Copilots</span>
                  Prevent prompt injection & data leaks
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
                >
                  <span className="label">Multi-Agent Swarms</span>
                  Enforce cross-agent delegation boundaries
                </button>
              </div>
            </header>
            <div className="chapter-body panels">
              <article
                className="panel"
                role="tabpanel"
                id="panel-field"
                aria-labelledby="tab-field"
                hidden={activeTeamTab !== 'field'}
              >
                <div className="panel-art">
                  <IllosGraphic name="fieldservice" />
                </div>
                <h3>Contain risks on the first execution.</h3>
                <p>
                  When an automated agent generates shell commands or file operations, CrossX intercepts anomalous patterns
                  before syscall execution. The policy updates automatically across the cluster.
                </p>
              </article>

              <article
                className="panel"
                role="tabpanel"
                id="panel-support"
                aria-labelledby="tab-support"
                hidden={activeTeamTab !== 'support'}
              >
                <div className="panel-art">
                  <IllosGraphic name="support" />
                </div>
                <h3>Prevent prompt injection & data leaks.</h3>
                <p>
                  User messages flow through real-time ML guardrails that detect indirect prompt injections, jailbreaks, and
                  PII exfiltration attempts before your model responds.
                </p>
              </article>

              <article
                className="panel"
                role="tabpanel"
                id="panel-logistics"
                aria-labelledby="tab-logistics"
                hidden={activeTeamTab !== 'logistics'}
              >
                <div className="panel-art">
                  <IllosGraphic name="logistics" />
                </div>
                <h3>Enforce cross-agent delegation boundaries.</h3>
                <p>
                  When primary agents spawn worker tasks, delegations are signed and verified against a depth limit. Recursive
                  agent loops and privilege escalation attacks are neutralized immediately.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta" id="start">
          <div className="wrap">
            <div className="cta-box">
              <h2>
                Deploy CrossX zero-trust protection <span className="muted">in 5 minutes.</span>
              </h2>
              <div className="ctas">
                <button onClick={handleEnterConsole} className="btn">
                  {isAuthenticated ? 'Open SOC Console' : 'Start Free Console'}
                </button>
                <a className="btn ghost" href="#how">
                  Watch live defense
                  <svg
                    className="ic"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18.5 12L5 12" />
                    <path d="M13 18C13 18 19 13.58 19 12C19 10.42 13 6 13 6" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="foot">
        <div className="wrap foot-grid">
          <div className="foot-brand">
            <a
              className="brand"
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <span className="brand-mark" aria-hidden="true"></span>
              CrossX
            </a>
            <p>The autonomous AI agent defense platform that updates as threats evolve.</p>
          </div>
          <nav className="foot-cols" aria-label="Footer">
            <div>
              <h4>Product</h4>
              <a href="#why">The problem</a>
              <a href="#how">How defense updates</a>
              <a href="#answers">Sources</a>
              <a href="#security">Access</a>
            </div>
            <div>
              <h4>Resources</h4>
              <a href="/docs">API Docs</a>
              <a href="/redoc">ReDoc Schema</a>
              <a href="#start">Console Setup</a>
              <a href="#">Agent Security Guide</a>
            </div>
            <div>
              <h4>Console</h4>
              <button
                onClick={handleEnterConsole}
                className="text-left text-[14px] text-[var(--ink-2)] hover:text-[var(--ink)] block py-1"
              >
                {isAuthenticated ? 'SOC Console' : 'Sign In'}
              </button>
              <a href="#">Status</a>
              <a href="#">Incident Feed</a>
            </div>
          </nav>
        </div>
        <div className="wrap legal">
          <span>&copy; 2026 CrossX. Autonomous AI Agent Security Platform.</span>
          <a
            className="illos-credit"
            href="https://illos.dev/?utm_source=ferrow-template&amp;utm_medium=example"
            rel="noopener noreferrer"
            target="_blank"
          >
            <svg viewBox="-26.8 0 400 400" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M0,253.81 L0,100 L173.21,0 L346.41,100 L346.41,300 L173.21,400 L76.6,344.23 L76.6,204 L116.6,227.09 L116.6,321.13 L173.21,353.81 L306.41,276.91 L306.41,123.09 L173.21,46.19 L40,123.09 L40,276.91 Z M76.6,140 L116.6,163.09 L116.6,203.09 L76.6,180 Z"
              />
            </svg>
            Animated assets by Illos
          </a>
          <span className="legal-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Security</a>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
