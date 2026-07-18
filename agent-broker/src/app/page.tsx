'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import type { MarketAgent, ValidationResult } from '@/lib/types';
import ConnectWallet from '@/components/ConnectWallet';

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

const TASKS = [
  'Audit my smart contract for vulnerabilities',
  'Analyze my wallet\'s DeFi yield opportunities',
  'Pre-check my ASP before OKX listing',
  'Validate my endpoint for x402 compliance',
  'Find the best agent for yield farming research',
  'Check my listing metadata completeness',
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pass: 'var(--green)',
    fail: 'var(--pink)',
    warn: 'var(--orange)',
    error: 'var(--pink)',
  };
  return (
    <span
      className="badge"
      style={{
        background: `${colors[status] || 'var(--text-muted)'}18`,
        color: colors[status] || 'var(--text-2)',
        border: `1px solid ${colors[status] || 'transparent'}40`,
        fontSize: '11px',
        textTransform: 'uppercase',
      }}
    >
      {status}
    </span>
  );
}

export default function HomePage() {
  const [agents, setAgents] = useState<MarketAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/agents?page=1')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAgents(d.agents.slice(0, 6));
      })
      .catch(() => {})
      .finally(() => setAgentsLoading(false));
  }, []);

  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [valLoading, setValLoading] = useState(false);
  const [valForm, setValForm] = useState({
    aspName: '',
    aspDescription: '',
    serviceName: '',
    serviceDescription: '',
    serviceType: 'A2A' as 'A2A' | 'A2MCP',
    fee: 0,
    endpoint: '',
    openApiSpec: '',
    profilePicture: '',
  });

  async function runValidation(e: React.FormEvent) {
    e.preventDefault();
    setValLoading(true);
    setValidationResult(null);
    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valForm),
      });
      const data = await res.json();
      if (data.ok) setValidationResult(data as ValidationResult);
    } catch {
      // ignore
    } finally {
      setValLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* ── Navbar ── */}
      <nav className={styles.nav}>
        <div className={`container-wide ${styles.navInner}`}>
          <div className={styles.navLogo}>
            <span className={styles.navLogoIcon}>⬡</span>
            <span>AgentGate</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#how" className={styles.navLink}>How it works</a>
            <a href="#validate" className={styles.navLink}>Pre-Validate</a>
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
            <span>Live on OKX.AI — Pre-Validate & Hire</span>
          </div>

          <h1 className={styles.heroTitle}>
            The <span className="grad-text">Quality Gate</span><br />
            for AI Agents
          </h1>

          <p className={styles.heroSub}>
            Pre-check your ASP before listing to avoid rejection. Then hire the best
            agents on the marketplace. AgentGate validates, matches, and manages —
            all on-chain.
          </p>

          <div className={styles.heroCtas}>
            <a href="#validate" className="btn btn-primary btn-lg">
              Pre-Validate Your ASP →
            </a>
            <Link href="/dashboard" className="btn btn-outline btn-lg">
              Hire an Agent →
            </Link>
          </div>

          <div className={styles.heroDemo}>
            <div className={styles.heroDemoLabel}>Try saying:</div>
            <div className={styles.heroDemoText}>
              <TypingText />
            </div>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <div className={styles.heroStatNum}><AnimatedNumber target={278} />+</div>
              <div className={styles.heroStatLabel}>Marketplace Agents</div>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <div className={styles.heroStatNum}><AnimatedNumber target={8} /></div>
              <div className={styles.heroStatLabel}>Validation Checks</div>
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

      {/* ── Validation Section ── */}
      <section id="validate" className={styles.demoSection}>
        <div className="container">
          <div className={styles.demoBox}>
            <div className={styles.demoBoxHeader}>
              <div className={styles.sectionEyebrow} style={{ color: 'var(--cyan)' }}>
                PRE-VALIDATION CHECK
              </div>
              <h2 className={styles.sectionTitle} style={{ fontSize: '2rem' }}>
                Check your ASP <span className="grad-text">before submission</span>
              </h2>
              <p className={styles.sectionSub}>
                Avoid the opaque rejection loop. Paste your draft below and AgentGate
                will check x402 compliance, endpoint quality, metadata completeness,
                Docker compatibility, and more.
              </p>
            </div>

            <form onSubmit={runValidation} className={styles.demoForm}>
              <div className={styles.demoFormRow}>
                <div style={{ flex: 1 }}>
                  <label className={styles.budgetLabel}>ASP Name</label>
                  <input className="input" placeholder="e.g. My Security Scanner" value={valForm.aspName}
                    onChange={(e) => setValForm({ ...valForm, aspName: e.target.value })} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label className={styles.budgetLabel}>Service Name</label>
                  <input className="input" placeholder="e.g. Smart Contract Audit" value={valForm.serviceName}
                    onChange={(e) => setValForm({ ...valForm, serviceName: e.target.value })} required />
                </div>
                <div style={{ flex: '0 0 120px' }}>
                  <label className={styles.budgetLabel}>Type</label>
                  <select className="input" value={valForm.serviceType}
                    onChange={(e) => setValForm({ ...valForm, serviceType: e.target.value as 'A2A' | 'A2MCP' })}
                    style={{ cursor: 'pointer' }}>
                    <option value="A2A">A2A</option>
                    <option value="A2MCP">A2MCP</option>
                  </select>
                </div>
                <div style={{ flex: '0 0 100px' }}>
                  <label className={styles.budgetLabel}>Fee (USDT)</label>
                  <input className="input" type="number" min="0" step="0.01" value={valForm.fee}
                    onChange={(e) => setValForm({ ...valForm, fee: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              <div>
                <label className={styles.budgetLabel}>ASP Description</label>
                <textarea className="input" rows={2} placeholder="Describe your agent and who it serves"
                  value={valForm.aspDescription}
                  onChange={(e) => setValForm({ ...valForm, aspDescription: e.target.value })} />
              </div>

              <div>
                <label className={styles.budgetLabel}>Service Description <span style={{ color: 'var(--pink)' }}>(include parameter details & usage examples)</span></label>
                <textarea className="input" rows={3}
                  placeholder="Describe what your service does, what parameters it accepts, and show a usage example. Be specific — this is what the reviewer reads."
                  value={valForm.serviceDescription}
                  onChange={(e) => setValForm({ ...valForm, serviceDescription: e.target.value })} required />
              </div>

              {valForm.serviceType === 'A2MCP' && (
                <div>
                  <label className={styles.budgetLabel}>Endpoint URL</label>
                  <input className="input" placeholder="https://your-agent.com/api/service"
                    value={valForm.endpoint}
                    onChange={(e) => setValForm({ ...valForm, endpoint: e.target.value })} />
                </div>
              )}

              <button type="submit" className="btn btn-cyan btn-lg" style={{ width: '100%' }}
                disabled={valLoading || !valForm.aspName || !valForm.serviceName || !valForm.serviceDescription}>
                {valLoading ? '⟳ Running checks...' : '🔍 Run Pre-Validation →'}
              </button>
            </form>

            {validationResult && (
              <div style={{ marginTop: '24px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
                  padding: '12px 16px', borderRadius: '8px',
                  background: validationResult.overall === 'pass' ? 'rgba(0,255,136,0.08)' :
                    validationResult.overall === 'warn' ? 'rgba(255,165,0,0.08)' : 'rgba(255,77,125,0.08)',
                  border: `1px solid ${
                    validationResult.overall === 'pass' ? 'var(--green)' :
                    validationResult.overall === 'warn' ? 'var(--orange)' : 'var(--pink)'
                  }40`
                }}>
                  <span style={{ fontSize: '1.5rem' }}>
                    {validationResult.overall === 'pass' ? '✅' : validationResult.overall === 'warn' ? '⚠️' : '❌'}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      Score: {validationResult.score}/100 — {validationResult.overall === 'pass' ? 'Ready to submit' :
                        validationResult.overall === 'warn' ? 'Minor issues' : 'Needs work'}
                    </div>
                    <div style={{ color: 'var(--text-2)', fontSize: '13px' }}>{validationResult.summary}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                  {validationResult.checks.map((c, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '8px',
                      padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
                      background: c.status === 'pass' ? 'rgba(0,255,136,0.04)' :
                        c.status === 'fail' ? 'rgba(255,77,125,0.04)' : 'rgba(255,165,0,0.04)',
                    }}>
                      <StatusBadge status={c.status} />
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '2px' }}>{c.name}</div>
                        <div style={{ color: 'var(--text-2)' }}>{c.message}</div>
                        {c.details && <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{c.details}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                {validationResult.recommendations.length > 0 && (
                  <div style={{
                    background: 'rgba(255,165,0,0.06)', border: '1px solid rgba(255,165,0,0.2)',
                    borderRadius: '8px', padding: '16px'
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--orange)' }}>
                      📋 Recommended Fixes
                    </div>
                    {validationResult.recommendations.map((r, i) => (
                      <div key={i} style={{ padding: '4px 0', fontSize: '13px', color: 'var(--text-2)' }}>
                        {i + 1}. {r}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionEyebrow}>HOW IT WORKS</div>
            <h2 className={styles.sectionTitle}>
              Two sides of the <span className="grad-text">same gate</span>
            </h2>
            <p className={styles.sectionSub}>
              Validate before listing. Hire with confidence. One agent for both sides of the marketplace.
            </p>
          </div>

          <div className={styles.flowGrid}>
            <FlowStep
              num={1}
              icon="🔍"
              title="Pre-Validate Your ASP"
              desc="Submit your draft ASP — AgentGate checks x402 compliance, endpoint latency, Docker compat, metadata completeness, and more. Get a scorecard with fix recommendations."
              delay={0}
            />
            <div className={styles.flowConnector}>→</div>
            <FlowStep
              num={2}
              icon="🤝"
              title="Fix & Submit to OKX"
              desc="Use the fix recommendations to polish your listing. Resubmit to OKX.AI with confidence, knowing all checks passed."
              delay={150}
            />
            <div className={styles.flowConnector}>→</div>
            <FlowStep
              num={3}
              icon="⚡"
              title="Hire Verified Agents"
              desc="Once your ASP is live, or if you just need work done, AgentGate searches the marketplace, finds the best agent, and manages the task on-chain."
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
              Built for <span className="grad-text-warm">quality agents</span>
            </h2>
          </div>

          <div className="grid-3">
            <Feature
              icon="🔒"
              title="x402 Compliance Check"
              desc="Verifies your endpoint returns proper HTTP 402 with PAYMENT-REQUIRED header, EIP-712 digest, accepts array, and Bazaar discovery extension."
              color="var(--purple-light)"
            />
            <Feature
              icon="⚡"
              title="Endpoint Performance"
              desc="Measures latency across multiple probes. Flags slow endpoints (>2s) that could be rejected during review or frustrate paying users."
              color="var(--cyan)"
            />
            <Feature
              icon="📋"
              title="Metadata Completeness"
              desc="Checks all listing fields — name, description, pricing, service type — against known OKX review criteria. Flags vague descriptions and missing fields."
              color="var(--green)"
            />
            <Feature
              icon="🐳"
              title="Docker Compatibility"
              desc="Detects localhost bindings and unresolvable hostnames that will break inside Docker containers — the #1 deployment gotcha for agent endpoints."
              color="var(--orange)"
            />
            <Feature
              icon="📐"
              title="Schema Validation"
              desc="If you provide an OpenAPI spec, validates it against your endpoint. Ensures paths, methods, and request/response shapes are consistent."
              color="var(--pink)"
            />
            <Feature
              icon="🏆"
              title="Hackathon Eligibility"
              desc="Checks if your ASP meets known hackathon requirements. Maps your service description to prize categories (Best Product, Revenue Rocket, etc.)."
              color="var(--yellow)"
            />
          </div>
        </div>
      </section>

      {/* ── Marketplace Preview ── */}
      <section id="marketplace" className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionEyebrow}>LIVE MARKETPLACE</div>
            <h2 className={styles.sectionTitle}>
              Agents available <span className="grad-text">right now</span>
            </h2>
            <p className={styles.sectionSub}>
              AgentGate pulls from the live OKX.AI marketplace. These are real agents, updated in real-time.
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
              Browse all agents & start hiring →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className={styles.ctaBanner}>
        <div className={styles.ctaGlow} />
        <div className={`container ${styles.ctaContent}`}>
          <h2 className={styles.ctaTitle}>
            One gate.<br />
            <span className="grad-text">Both sides of the marketplace.</span>
          </h2>
          <p className={styles.ctaSub}>
            AgentGate is the quality gate for OKX.AI. Pre-validate your listing, then hire
            with confidence. Built on the OKX Agent Payments Protocol. Open and composable.
          </p>
          <div className={styles.ctaBtns}>
            <a href="#validate" className="btn btn-primary btn-lg">
              Pre-Validate Your ASP →
            </a>
            <Link href="/dashboard" className="btn btn-outline btn-lg">
              Hire an Agent ↗
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={`container ${styles.footerInner}`}>
          <div className={styles.footerLogo}>
            <span style={{ fontSize: '24px' }}>⬡</span>
            <span style={{ fontWeight: 700 }}>AgentGate</span>
          </div>
          <div className={styles.footerMeta}>
            Built for the OKX.AI Hackathon 2026 &nbsp;·&nbsp; Powered by OKX Agent Payments Protocol
          </div>
          <div className={styles.footerLinks}>
            <Link href="/dashboard">Dashboard</Link>
            <a href="#how">How it works</a>
            <a href="#validate">Pre-Validate</a>
            <a href="#marketplace">Marketplace</a>
          </div>
        </div>
      </footer>
    </div>
  );
}