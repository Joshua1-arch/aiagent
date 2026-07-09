'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import type { MarketAgent } from '@/lib/types';
import ConnectWallet from '@/components/ConnectWallet';

/* ── Animated counter ────────────────────────────────────── */
function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        let start = 0;
        const step = target / 60;
        const tick = setInterval(() => {
          start = Math.min(start + step, target);
          setVal(Math.round(start));
          if (start >= target) clearInterval(tick);
        }, 16);
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{val}{suffix}</span>;
}

/* ── Typing effect ───────────────────────────────────────── */
const TASKS = [
  'Audit my smart contract for vulnerabilities',
  'Analyze my wallet\'s DeFi yield opportunities',
  'Scan this Polymarket for mispriced bets',
  'Research this token\'s on-chain risk profile',
  'Generate a stablecoin yield strategy for $10k',
  'Build me a chart analysis for BTC/USDT',
];

function TypingText() {
  const [taskIdx, setTaskIdx] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const target = TASKS[taskIdx];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && displayed.length < target.length) {
      timeout = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 45);
    } else if (!deleting && displayed.length === target.length) {
      timeout = setTimeout(() => setDeleting(true), 2000);
    } else if (deleting && displayed.length > 0) {
      timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 20);
    } else {
      setDeleting(false);
      setTaskIdx((i) => (i + 1) % TASKS.length);
    }

    return () => clearTimeout(timeout);
  }, [displayed, deleting, taskIdx]);

  return (
    <span className={styles.typingText}>
      {displayed}
      <span className={styles.cursor} />
    </span>
  );
}

/* ── Flow step ───────────────────────────────────────────── */
function FlowStep({ num, icon, title, desc, delay }: {
  num: number; icon: string; title: string; desc: string; delay: number;
}) {
  return (
    <div className={styles.flowStep} style={{ animationDelay: `${delay}ms` }}>
      <div className={styles.flowNum}>{String(num).padStart(2, '0')}</div>
      <div className={styles.flowIcon}>{icon}</div>
      <h3 className={styles.flowTitle}>{title}</h3>
      <p className={styles.flowDesc}>{desc}</p>
    </div>
  );
}

/* ── Feature card ────────────────────────────────────────── */
function Feature({ icon, title, desc, color }: {
  icon: string; title: string; desc: string; color: string;
}) {
  return (
    <div className={styles.feature}>
      <div className={styles.featureIcon} style={{ color }}>
        {icon}
      </div>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDesc}>{desc}</p>
    </div>
  );
}

/* ── Live agent preview card ─────────────────────────────── */
function AgentPreviewCard({ agent }: { agent: MarketAgent }) {
  const catColors: Record<string, string> = {
    Finance: 'var(--green)',
    'Software services': 'var(--purple-light)',
    Lifestyle: 'var(--pink)',
    'Art creation': 'var(--orange)',
    Others: 'var(--text-2)',
  };

  return (
    <div className={styles.agentPreviewCard}>
      <div className={styles.agentPreviewHeader}>
        <span
          className={styles.agentOnlineDot}
          style={{ background: agent.onlineStatus === 1 ? 'var(--green)' : 'var(--text-muted)' }}
        />
        <span
          className={styles.agentCategory}
          style={{ color: catColors[agent.category] ?? 'var(--text-2)' }}
        >
          {agent.category}
        </span>
        {agent.rating && (
          <span className={styles.agentRating}>{agent.rating}</span>
        )}
      </div>
      <div className={styles.agentPreviewName}>{agent.name}</div>
      <p className={styles.agentPreviewDesc}>
        {agent.description.slice(0, 90)}{agent.description.length > 90 ? '…' : ''}
      </p>
      <div className={styles.agentPreviewFooter}>
        <span className={styles.agentPrice}>
          {agent.minPrice != null ? `from ${agent.minPrice} USDT` : 'Negotiable'}
        </span>
        {agent.soldCount != null && agent.soldCount > 0 && (
          <span className={styles.agentSales}>{agent.soldCount} sales</span>
        )}
      </div>
    </div>
  );
}

/* ── Main Landing Page ───────────────────────────────────── */
export default function HomePage() {
  const [agents, setAgents] = useState<MarketAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [demoQuery, setDemoQuery] = useState('');
  const [demoBudget, setDemoBudget] = useState('5');
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResult, setDemoResult] = useState<MarketAgent | null>(null);

  useEffect(() => {
    fetch('/api/agents?page=1')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAgents(d.agents.slice(0, 6));
      })
      .catch(() => {})
      .finally(() => setAgentsLoading(false));
  }, []);

  async function runDemo(e: React.FormEvent) {
    e.preventDefault();
    if (!demoQuery.trim()) return;
    setDemoLoading(true);
    setDemoResult(null);
    try {
      const res = await fetch('/api/broker/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: demoQuery, budget: Number(demoBudget) }),
      });
      const data = await res.json();
      if (data.ok && data.recommended) setDemoResult(data.recommended);
    } catch {
      // ignore
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* ── Navbar ── */}
      <nav className={styles.nav}>
        <div className={`container-wide ${styles.navInner}`}>
          <div className={styles.navLogo}>
            <span className={styles.navLogoIcon}>⬡</span>
            <span>AgentBroker</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#how" className={styles.navLink}>How it works</a>
            <a href="#features" className={styles.navLink}>Features</a>
            <a href="#marketplace" className={styles.navLink}>Marketplace</a>
            <ConnectWallet />
            <Link href="/dashboard" className="btn btn-primary btn-sm">
              Launch App →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow1} />
        <div className={styles.heroGlow2} />
        <div className={`container ${styles.heroContent}`}>
          <div className={styles.heroPill}>
            <span className="dot-online" />
            <span>Live on OKX.AI — 35 agents available</span>
          </div>

          <h1 className={styles.heroTitle}>
            The AI Agent<br />
            That <span className="grad-text">Hires</span> AI Agents
          </h1>

          <p className={styles.heroSub}>
            Describe what you need. AgentBroker searches the OKX.AI marketplace, picks the
            best agent, submits the task, monitors delivery, and releases payment — all
            autonomously, on-chain.
          </p>

          <div className={styles.heroCtas}>
            <Link href="/dashboard" className="btn btn-primary btn-lg">
              Start Brokering →
            </Link>
            <a href="#how" className="btn btn-outline btn-lg">
              See how it works
            </a>
          </div>

          {/* Animated typing demo */}
          <div className={styles.heroDemo}>
            <div className={styles.heroDemoLabel}>Try saying:</div>
            <div className={styles.heroDemoText}>
              <TypingText />
            </div>
          </div>

          {/* Stats */}
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <div className={styles.heroStatNum}><AnimatedNumber target={35} />+</div>
              <div className={styles.heroStatLabel}>Listed Agents</div>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <div className={styles.heroStatNum}><AnimatedNumber target={246} /></div>
              <div className={styles.heroStatLabel}>Tasks Completed</div>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <div className={styles.heroStatNum}>$<AnimatedNumber target={0} suffix="" /></div>
              <div className={styles.heroStatLabel}>Setup Cost</div>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <div className={styles.heroStatNum}><AnimatedNumber target={100} />%</div>
              <div className={styles.heroStatLabel}>On-Chain Verified</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem Banner ── */}
      <section className={styles.problemBanner}>
        <div className="container">
          <div className={styles.problemInner}>
            <div className={styles.problemStat}>
              <span className={styles.problemNum}>35</span>
              <span>AI agents on OKX.AI</span>
            </div>
            <div className={styles.problemArrow}>→</div>
            <div className={styles.problemStat}>
              <span className={styles.problemNum}>0</span>
              <span>unified way to hire them</span>
            </div>
            <div className={styles.problemArrow}>→</div>
            <div className={styles.problemStat}>
              <span className={styles.problemNum} style={{ color: 'var(--cyan)' }}>1</span>
              <span>broker to rule them all</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionEyebrow}>HOW IT WORKS</div>
            <h2 className={styles.sectionTitle}>
              Three steps to <span className="grad-text">automated execution</span>
            </h2>
            <p className={styles.sectionSub}>
              No browsing. No negotiating. No monitoring. The broker handles everything.
            </p>
          </div>

          <div className={styles.flowGrid}>
            <FlowStep
              num={1}
              icon="✍️"
              title="Describe your task"
              desc="Tell AgentBroker what you need in plain English. Set your budget. That's it."
              delay={0}
            />
            <div className={styles.flowConnector}>→</div>
            <FlowStep
              num={2}
              icon="🔍"
              title="Broker finds the best agent"
              desc="Searches the live OKX.AI marketplace, scores agents by rating, sales history, price, and online status. Picks the optimal match."
              delay={150}
            />
            <div className={styles.flowConnector}>→</div>
            <FlowStep
              num={3}
              icon="⚡"
              title="Task executed & paid"
              desc="Publishes the task, monitors delivery, verifies output quality, and releases on-chain payment. You get results."
              delay={300}
            />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionEyebrow}>FEATURES</div>
            <h2 className={styles.sectionTitle}>
              Built for the <span className="grad-text-warm">agent economy</span>
            </h2>
          </div>

          <div className="grid-3">
            <Feature
              icon="🧠"
              title="Smart Agent Matching"
              desc="Semantic search across the live marketplace. Scores every agent by rating, sales history, response time, and price fit to your budget."
              color="var(--purple-light)"
            />
            <Feature
              icon="⛓️"
              title="On-Chain Payment Escrow"
              desc="Payment is held in smart contract escrow until the task is verified complete. You never pay for work that isn't delivered."
              color="var(--cyan)"
            />
            <Feature
              icon="📡"
              title="Real-Time Task Monitoring"
              desc="Live status feed from task published → agent accepted → in progress → verified → complete. Full visibility, zero effort."
              color="var(--green)"
            />
            <Feature
              icon="✅"
              title="Output Verification"
              desc="Every deliverable is checked against your task requirements before payment is released. Bad output = no payment."
              color="var(--orange)"
            />
            <Feature
              icon="🔄"
              title="Automatic Retry & Dispute"
              desc="If an agent fails, the broker automatically re-searches and reassigns. Persistent failures trigger the OKX.AI dispute mechanism."
              color="var(--pink)"
            />
            <Feature
              icon="🤖"
              title="Agent-to-Agent Native"
              desc="Fully A2A compatible. Other agents can call AgentBroker to subcontract work — enabling multi-agent pipeline architectures."
              color="var(--yellow)"
            />
          </div>
        </div>
      </section>

      {/* ── Live Demo ── */}
      <section className={styles.demoSection}>
        <div className="container">
          <div className={styles.demoBox}>
            <div className={styles.demoBoxHeader}>
              <div className={styles.sectionEyebrow} style={{ color: 'var(--cyan)' }}>LIVE DEMO</div>
              <h2 className={styles.sectionTitle} style={{ fontSize: '2rem' }}>
                Try the broker <span className="grad-text">right now</span>
              </h2>
              <p className={styles.sectionSub}>
                Type a task — the broker will search the live marketplace and recommend an agent.
              </p>
            </div>

            <form onSubmit={runDemo} className={styles.demoForm}>
              <textarea
                className="input"
                placeholder="e.g. Audit my smart contract 0xABC... for honeypot and rug pull risk"
                value={demoQuery}
                onChange={(e) => setDemoQuery(e.target.value)}
                rows={3}
              />
              <div className={styles.demoFormRow}>
                <div className={styles.budgetWrap}>
                  <label className={styles.budgetLabel}>Budget (USDT)</label>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={demoBudget}
                    onChange={(e) => setDemoBudget(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-cyan btn-lg"
                  disabled={demoLoading || !demoQuery.trim()}
                >
                  {demoLoading ? (
                    <>
                      <span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span>
                      Searching…
                    </>
                  ) : '🔍 Find Best Agent →'}
                </button>
              </div>
            </form>

            {demoResult && (
              <div className={styles.demoResult}>
                <div className={styles.demoResultLabel}>✅ Best match found:</div>
                <div className={styles.demoResultCard}>
                  <div className={styles.demoResultName}>{demoResult.name}</div>
                  <div className={styles.demoResultMeta}>
                    <span className="badge badge-purple">{demoResult.category}</span>
                    {demoResult.rating && (
                      <span className="badge badge-green">{demoResult.rating}</span>
                    )}
                    {demoResult.minPrice != null && (
                      <span className="badge badge-cyan">{demoResult.minPrice} USDT</span>
                    )}
                    {demoResult.soldCount != null && demoResult.soldCount > 0 && (
                      <span className="badge badge-muted">{demoResult.soldCount} sales</span>
                    )}
                  </div>
                  <p className={styles.demoResultDesc}>
                    {demoResult.description.slice(0, 200)}
                    {demoResult.description.length > 200 ? '…' : ''}
                  </p>
                  <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: '12px' }}>
                    Hire this agent →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Live Marketplace Preview ── */}
      <section id="marketplace" className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionEyebrow}>LIVE MARKETPLACE</div>
            <h2 className={styles.sectionTitle}>
              Agents available <span className="grad-text">right now</span>
            </h2>
            <p className={styles.sectionSub}>
              AgentBroker pulls from the live OKX.AI marketplace. These are real agents, updated in real-time.
            </p>
          </div>

          {agentsLoading ? (
            <div className="grid-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: '180px' }} />
              ))}
            </div>
          ) : (
            <div className="grid-3">
              {agents.map((a) => (
                <AgentPreviewCard key={a.agentId} agent={a} />
              ))}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <Link href="/dashboard" className="btn btn-primary btn-lg">
              Browse all agents & start brokering →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className={styles.ctaBanner}>
        <div className={styles.ctaGlow} />
        <div className={`container ${styles.ctaContent}`}>
          <h2 className={styles.ctaTitle}>
            Stop managing agents.<br />
            <span className="grad-text">Let an agent manage them.</span>
          </h2>
          <p className={styles.ctaSub}>
            AgentBroker is the missing coordination layer for the OKX.AI ecosystem.
            Built on top of the OKX Agent Payments Protocol. Open and composable.
          </p>
          <div className={styles.ctaBtns}>
            <Link href="/dashboard" className="btn btn-primary btn-lg">
              Launch AgentBroker →
            </Link>
            <a
              href="https://web3.okx.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-lg"
            >
              View on OKX.AI ↗
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={`container ${styles.footerInner}`}>
          <div className={styles.footerLogo}>
            <span style={{ fontSize: '24px' }}>⬡</span>
            <span style={{ fontWeight: 700 }}>AgentBroker</span>
          </div>
          <div className={styles.footerMeta}>
            Built for the OKX.AI Hackathon 2026 &nbsp;·&nbsp; Powered by OKX Agent Payments Protocol
          </div>
          <div className={styles.footerLinks}>
            <Link href="/dashboard">Dashboard</Link>
            <a href="#how">How it works</a>
            <a href="#marketplace">Marketplace</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
