'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { MarketAgent, ValidationResult, ValidateRequest } from '@/lib/types';
import styles from './dashboard.module.css';
import ConnectWallet from '@/components/ConnectWallet';

type TaskStatus = string;

const STATUS_META: Record<TaskStatus, { label: string; color: string; icon: string }> = {
  searching:    { label: 'Searching',     color: 'var(--cyan)',    icon: '~' },
  selecting:    { label: 'Selecting',     color: 'var(--purple)',  icon: '~' },
  publishing:   { label: 'Publishing',    color: 'var(--orange)',  icon: '~' },
  pending_agent:{ label: 'Pending Agent', color: 'var(--yellow)',  icon: '~' },
  in_progress:  { label: 'In Progress',   color: 'var(--cyan)',    icon: '~' },
  verifying:    { label: 'Verifying',     color: 'var(--purple)',  icon: '~' },
  complete:     { label: 'Complete',      color: 'var(--green)',   icon: '~' },
  failed:       { label: 'Failed',        color: 'var(--pink)',    icon: '~' },
};

const STEPS: TaskStatus[] = ['publishing','pending_agent','in_progress','verifying','complete'];

function StepBar({ current }: { current: TaskStatus }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className={styles.stepBar}>
      {STEPS.map((s, i) => {
        const m = STATUS_META[s];
        const done = i < idx;
        const active = i === idx;
        const isPublishing = s === 'publishing';
        return (
          <div key={s} className={styles.stepItem}>
            <div
              className={`${styles.stepDot} ${active && isPublishing ? styles.spinnerDot : ''}`}
              style={{
                background: done || active ? m.color : 'transparent',
                borderColor: done || active ? m.color : 'var(--border)',
                boxShadow: active ? `0 0 12px ${m.color}` : 'none',
              }}
            >
              {done ? '✓' : active ? (
                isPublishing ? <span className={styles.spinnerIcon}>~</span> : m.icon
              ) : ''}
            </div>
            <span
              className={styles.stepLabel}
              style={{ color: done || active ? m.color : 'var(--text-muted)' }}
            >
              {m.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={styles.stepLine}
                style={{ background: done ? 'var(--purple)' : 'var(--border)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AgentCard({ agent, recommended, selected, onSelect }: {
  agent: MarketAgent; recommended: boolean; selected: boolean; onSelect: () => void;
}) {
  return (
    <div
      className={`${styles.agentCard} ${selected ? styles.agentCardSelected : ''} ${recommended ? styles.agentCardRecommended : ''}`}
      onClick={onSelect}
    >
      {recommended && <div className={styles.recommendBadge}>Recommended</div>}
      <div className={styles.agentCardHeader}>
        <div className={styles.agentOnline} style={{ background: agent.onlineStatus === 1 ? 'var(--green)' : 'var(--text-muted)' }} />
        <span className={styles.agentId}>#{agent.agentId}</span>
        {agent.rating && <span className={styles.agentRating}>{agent.rating}</span>}
        {agent.soldCount != null && agent.soldCount > 0 && <span className={styles.agentSales}>{agent.soldCount} sales</span>}
      </div>
      <div className={styles.agentName}>{agent.name}</div>
      <div className={styles.agentCat}>{agent.category}</div>
      <p className={styles.agentDesc}>{agent.description.slice(0, 120)}{agent.description.length > 120 ? '…' : ''}</p>
      <div className={styles.agentServices}>
        {agent.services.slice(0, 2).map((s) => (
          <span key={s.serviceId} className={`badge ${s.serviceType === 'A2MCP' ? 'badge-cyan' : 'badge-purple'}`}>{s.serviceType}</span>
        ))}
      </div>
      <div className={styles.agentPrice}>{agent.minPrice != null ? `from ${agent.minPrice} USDC` : 'Negotiable'}</div>
      <button className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-outline'}`} style={{ width: '100%', marginTop: '12px' }}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        {selected ? '✓ Selected' : 'Select Agent'}
      </button>
    </div>
  );
}

function Timeline({ events }: { events: { time: string; event: string; status: TaskStatus }[] }) {
  return (
    <div className={styles.timeline}>
      {events.map((e, i) => {
        const m = STATUS_META[e.status];
        return (
          <div key={i} className={styles.timelineItem}>
            <div className={styles.timelineDot} style={{ borderColor: m.color, color: m.color }}>{m.icon}</div>
            <div className={styles.timelineContent}>
              <div className={styles.timelineEvent}>{e.event}</div>
              <div className={styles.timelineTime}>{new Date(e.time).toLocaleTimeString()}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskRow({ task, onClick }: { task: any; onClick: () => void }) {
  const m = STATUS_META[task.status] || { label: task.status, color: 'var(--text-2)', icon: '~' };
  return (
    <div className={styles.taskRow} onClick={onClick}>
      <div className={styles.taskRowId}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-2)' }}>{task.jobId}</span>
      </div>
      <div className={styles.taskRowDesc}>{task.taskDescription.slice(0, 60)}{task.taskDescription.length > 60 ? '…' : ''}</div>
      <div className={styles.taskRowAgent}>{task.agentName}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--cyan)' }}>{task.budget} USDT</div>
      <div>
        <span className="badge" style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}40` }}>
          {m.icon} {m.label}
        </span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{new Date(task.createdAt).toLocaleDateString()}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { pass: 'var(--green)', fail: 'var(--pink)', warn: 'var(--orange)', error: 'var(--pink)' };
  return (
    <span className="badge" style={{
      background: `${colors[status] || 'var(--text-muted)'}18`,
      color: colors[status] || 'var(--text-2)',
      border: `1px solid ${colors[status] || 'transparent'}40`,
      fontSize: '11px', textTransform: 'uppercase',
    }}>{status}</span>
  );
}

interface Task {
  jobId: string; platformJobId?: string | null; taskDescription: string; budget: number;
  agentId: string; agentName: string; serviceId: string; serviceName: string;
  status: TaskStatus; createdAt: string; updatedAt: string; result?: string; error?: string;
  timeline: { time: string; event: string; status: TaskStatus }[];
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'hire' | 'validate' | 'history'>('hire');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setWalletAddress(localStorage.getItem('connectedWallet'));
    update();
    window.addEventListener('walletConnectionChanged', update);
    return () => window.removeEventListener('walletConnectionChanged', update);
  }, []);

  // ── HIRE state ──
  const [hireMode, setHireMode] = useState<'quick' | 'manual'>('quick');
  const [phase, setPhase] = useState<'form' | 'searching' | 'select' | 'active'>('form');
  const [taskDesc, setTaskDesc] = useState('');
  const [budget, setBudget] = useState('5');
  const [category, setCategory] = useState('');
  const [searchResults, setSearchResults] = useState<MarketAgent[]>([]);
  const [recommended, setRecommended] = useState<MarketAgent | null>(null);
  const [reasoning, setReasoning] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<MarketAgent | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [history, setHistory] = useState<Task[]>([]);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [error, setError] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);

  // ── VALIDATE state ──
  const [valMode, setValMode] = useState<'quick' | 'manual'>('quick');
  const [quickInstruction, setQuickInstruction] = useState('');
  const [valForm, setValForm] = useState<ValidateRequest>({
    aspName: '', aspDescription: '', serviceName: '', serviceDescription: '',
    serviceType: 'A2A', fee: 0, endpoint: '', openApiSpec: '', profilePicture: '',
  });
  const [valResult, setValResult] = useState<ValidationResult | null>(null);
  const [valLoading, setValLoading] = useState(false);

  useEffect(() => {
    if (activeTask?.result) setShowResultModal(true);
  }, [activeTask?.result]);

  const fetchHistory = useCallback(async () => {
    const res = await fetch('/api/broker/task');
    const data = await res.json();
    if (data.ok) setHistory(data.tasks);
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    if (!activeTask || ['complete', 'failed'].includes(activeTask.status)) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/broker/task?jobId=${activeTask.jobId}`);
        const data = await res.json();
        if (data.ok) {
          setActiveTask(data.task);
          if (['complete', 'failed'].includes(data.task.status)) { clearInterval(interval); fetchHistory(); }
        }
      } catch {}
    }, 5000);
    setPollInterval(interval);
    return () => clearInterval(interval);
  }, [activeTask?.jobId, activeTask?.status, fetchHistory]);

  async function handleConfirmComplete() {
    if (!activeTask) return;
    try {
      const res = await fetch('/api/broker/task', { method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: activeTask.jobId }),
      });
      const data = await res.json();
      if (data.ok) {
        const refreshed = await fetch(`/api/broker/task?jobId=${activeTask.jobId}`);
        const r = await refreshed.json();
        if (r.ok) setActiveTask(r.task);
        fetchHistory();
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Confirm failed'); }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!taskDesc.trim()) return;
    setError(''); setPhase('searching'); setSearchResults([]); setSelectedAgent(null);
    try {
      const res = await fetch('/api/broker/search', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: taskDesc, budget: Number(budget), category }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSearchResults(data.agents ?? []);
      setRecommended(data.recommended ?? null);
      setReasoning(data.reasoning ?? '');
      setSelectedAgent(data.recommended ?? null);
      setPhase('select');
    } catch (err) { setError(err instanceof Error ? err.message : 'Search failed'); setPhase('form'); }
  }

  async function handleHire() {
    if (!selectedAgent) return;
    setError('');
    const service = selectedAgent.services[0];
    try {
      const res = await fetch('/api/broker/task', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskDescription: taskDesc, budget: Number(budget),
          agentId: selectedAgent.agentId, agentName: selectedAgent.name,
          serviceId: service?.serviceId ?? '', serviceName: service?.serviceName ?? '',
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      const taskRes = await fetch(`/api/broker/task?jobId=${data.jobId}`);
      const taskData = await taskRes.json();
      if (taskData.ok) setActiveTask(taskData.task);
      setPhase('active');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create task'); }
  }

  async function handleValidate(e: React.FormEvent) {
    e.preventDefault();
    setValLoading(true); setValResult(null);
    try {
      const res = await fetch('/api/validate', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valForm),
      });
      const data = await res.json();
      if (data.ok) setValResult(data as ValidationResult);
    } catch {} finally { setValLoading(false); }
  }

  function reset() {
    setPhase('form'); setTaskDesc(''); setBudget('5'); setCategory('');
    setSearchResults([]); setSelectedAgent(null); setActiveTask(null);
    setError(''); if (pollInterval) clearInterval(pollInterval);
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.sidebarLogo}>
          <span className={styles.sidebarLogoIcon}>⬡</span>
          <span>AgentGate</span>
        </Link>
        <div style={{ padding: '0 20px 20px 20px', borderBottom: '1px solid var(--border)', marginBottom: '10px' }}>
          <ConnectWallet />
        </div>
        <nav className={styles.sidebarNav}>
          <button className={`${styles.navBtn} ${activeTab === 'hire' ? styles.navBtnActive : ''}`}
            onClick={() => { setActiveTab('hire'); reset(); }}>
            Hire an Agent
          </button>
          <button className={`${styles.navBtn} ${activeTab === 'validate' ? styles.navBtnActive : ''}`}
            onClick={() => setActiveTab('validate')}>
            Pre-Validate ASP
          </button>
          <button className={`${styles.navBtn} ${activeTab === 'history' ? styles.navBtnActive : ''}`}
            onClick={() => { setActiveTab('history'); fetchHistory(); setHistoryTask(null); }}>
            Task History
            {history.length > 0 && <span className={styles.navBadge}>{history.length}</span>}
          </button>
        </nav>
        <div className={styles.sidebarStats}>
          <div className={styles.sidebarStat}>
            <span className={styles.sidebarStatNum}>{history.length}</span>
            <span className={styles.sidebarStatLabel}>Total Tasks</span>
          </div>
          <div className={styles.sidebarStat}>
            <span className={styles.sidebarStatNum}>{history.filter((t) => t.status === 'complete').length}</span>
            <span className={styles.sidebarStatLabel}>Completed</span>
          </div>
        </div>
        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarFooterItem}><span className="dot-online" /> OKX.AI Live</div>
        </div>
      </aside>

      <main className={styles.main}>

        {/* ════════════ HIRE TAB ════════════ */}
        {activeTab === 'hire' && phase === 'form' && (
          <div className={styles.phasePane}>
            <div className={styles.paneHeader}>
              <h1 className={styles.paneTitle}>Hire an Agent</h1>
              <p className={styles.paneSub}>Describe what you need. AgentGate finds the best agent and creates the task on-chain.</p>
            </div>

            {/* ── Mode Toggle ── */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button type="button" className={`btn ${hireMode === 'quick' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setHireMode('quick')} style={{ flex: 1 }}>
                Quick — Copy & Paste to your AI
              </button>
              <button type="button" className={`btn ${hireMode === 'manual' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setHireMode('manual')} style={{ flex: 1 }}>
                Manual — Search & fill form
              </button>
            </div>

            {hireMode === 'quick' && (
              <div style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '12px' }}>Copy this into your AI (Codex, Claude Code, Hermes, OpenClaw):</div>
                <div style={{
                  background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '8px',
                  padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '1.8',
                  color: 'var(--cyan)', marginBottom: '16px', wordBreak: 'break-word', whiteSpace: 'pre-wrap'
                }}>
{`I'd like to use the service provided by Agent 4885：

Service title: Agent Pre-Validation & Hiring Broker
Service type: A2A

Task: ${taskDesc || '<describe what you need done>'}
Budget: ${budget || '<amount>'} USDT
${category ? `Category: ${category}` : ''}

Please find the best agent and publish the task.`}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <button className="btn btn-sm btn-primary" onClick={() => {
                    navigator.clipboard.writeText(`I'd like to use the service provided by Agent 4885：

Service title: Agent Pre-Validation & Hiring Broker
Service type: A2A

Task: ${taskDesc || '<describe what you need done>'}
Budget: ${budget || '<amount>'} USDT${category ? `\nCategory: ${category}` : ''}

Please find the best agent and publish the task.`);
                  }}>Copy Instruction</button>
                  <button className="btn btn-sm btn-cyan" disabled={!taskDesc} onClick={handleSearch}>
                    Or test search directly
                  </button>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-2)', marginBottom: '8px' }}>Fill these in to customize your instruction:</div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Task Description</label>
                      <textarea className="input" rows={3}
                        placeholder="e.g. Audit my smart contract for honeypot patterns"
                        value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Budget (USDT)</label>
                        <input className="input" type="number" min="0.01" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Category</label>
                        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} style={{ cursor: 'pointer' }}>
                          <option value="">Any category</option>
                          <option value="Finance">Finance</option>
                          <option value="Software services">Software services</option>
                          <option value="Lifestyle">Lifestyle</option>
                          <option value="Art creation">Art creation</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {hireMode === 'manual' && (
              <>
                <form onSubmit={handleSearch} className={styles.taskForm}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Task Description *</label>
                    <textarea className="input" rows={5}
                      placeholder="e.g. Audit my smart contract at 0xABC... for honeypot patterns, rug pull risk, and ownership issues."
                      value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} required />
                    <div className={styles.formHint}>Be specific. More context = better agent match.</div>
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Budget (USDT)</label>
                      <input className="input" type="number" min="0.01" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Category (optional)</label>
                      <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} style={{ cursor: 'pointer' }}>
                        <option value="">Any category</option>
                        <option value="Finance">Finance</option>
                        <option value="Software services">Software services</option>
                        <option value="Lifestyle">Lifestyle</option>
                        <option value="Art creation">Art creation</option>
                      </select>
                    </div>
                  </div>
                  {error && <div className={styles.errorBox}>{error}</div>}
                  <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }}>Find Best Agent</button>
                </form>
                <div className={styles.examplesSection}>
                  <div className={styles.examplesLabel}>Quick examples:</div>
                  <div className={styles.examples}>
                    {[
                      { label: 'Audit smart contract for risks', text: 'Scan my smart contract 0x1234... for security risks and honeypot patterns' },
                      { label: 'Find best USDC yield opportunity', text: 'Find the best USDC yield opportunity for $10,000 right now' },
                      { label: 'Verify PR code quality', text: 'Verify this GitHub PR for code quality and spec compliance: https://github.com/okx/onchainos-skills/pull/12' },
                    ].map((ex) => (
                      <button key={ex.label} className={styles.exampleChip} onClick={() => setTaskDesc(ex.text)} type="button">
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'hire' && phase === 'searching' && (
          <div className={styles.phasePane}>
            <div className={styles.searchingState}>
              <div className={styles.searchingOrb} />
              <h2 className={styles.searchingTitle}>Scanning marketplace…</h2>
              <p className={styles.searchingSub}>Querying live agents, scoring by rating, sales, price fit, and online status.</p>
              <div className={styles.searchingBars}>
                {['Rating score', 'Sales history', 'Price match', 'Online status', 'Category fit'].map((l, i) => (
                  <div key={l} className={styles.searchingBar}>
                    <span>{l}</span>
                    <div className={styles.searchingBarTrack}>
                      <div className={styles.searchingBarFill} style={{ animationDelay: `${i * 200}ms` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hire' && phase === 'select' && (
          <div className={styles.phasePane}>
            <div className={styles.paneHeader}>
              <div className={styles.paneHeaderRow}>
                <div>
                  <h1 className={styles.paneTitle}>Agent Matches</h1>
                  <p className={styles.paneSub}>Found {searchResults.length} agents. Select one to proceed.</p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={reset}>New task</button>
              </div>
              {reasoning && <div className={styles.reasoningBox}><span style={{ color: 'var(--green)' }}>AgentGate recommendation:</span> {reasoning}</div>}
            </div>
            {error && <div className={styles.errorBox}>{error}</div>}
            <div className={styles.agentGrid}>
              {searchResults.map((a) => (
                <AgentCard key={a.agentId} agent={a} recommended={a.agentId === recommended?.agentId}
                  selected={a.agentId === selectedAgent?.agentId} onSelect={() => setSelectedAgent(a)} />
              ))}
            </div>
            {selectedAgent && (
              <div className={styles.hireBar}>
                <div className={styles.hireBarInfo}>
                  <span style={{ color: 'var(--text-2)' }}>Selected:</span> <strong>{selectedAgent.name}</strong>
                  {selectedAgent.minPrice != null && <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}> · {selectedAgent.minPrice} USDT</span>}
                </div>
                {walletAddress ? (
                  <button className="btn btn-primary btn-lg" onClick={handleHire}>Hire This Agent</button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <button className="btn btn-primary btn-lg" disabled style={{ opacity: 0.5 }}>Hire This Agent</button>
                    <span style={{ color: 'var(--pink)', fontSize: '12px' }}>Connect wallet to hire</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'hire' && phase === 'active' && activeTask && (
          <div className={styles.phasePane}>
            <div className={styles.paneHeader}>
              <div className={styles.paneHeaderRow}>
                <div>
                  <h1 className={styles.paneTitle}>Task Active</h1>
                  <p className={styles.paneSub}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-2)', fontSize: '13px' }}>
                      Local: {activeTask.jobId}
                      {activeTask.platformJobId && <> · On-chain: <strong style={{ color: 'var(--cyan)' }}>{activeTask.platformJobId}</strong></>}
                    </span>
                  </p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={reset}>+ New task</button>
              </div>
            </div>
            <StepBar current={activeTask.status as any} />
            {activeTask.error && <div className={styles.errorBox} style={{ marginBottom: '20px' }}>{activeTask.error}</div>}
            <div className={styles.activeGrid}>
              <div>
                <div className={styles.activeCard}><div className={styles.activeCardLabel}>Task</div><div className={styles.activeCardValue}>{activeTask.taskDescription}</div></div>
                <div className={styles.activeCard}><div className={styles.activeCardLabel}>Agent</div><div className={styles.activeCardValue}>{activeTask.agentName}</div></div>
                <div className={styles.activeCard}><div className={styles.activeCardLabel}>Service</div><div className={styles.activeCardValue}>{activeTask.serviceName || '—'}</div></div>
                <div className={styles.activeCard}><div className={styles.activeCardLabel}>Budget</div><div className={styles.activeCardValue} style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>{activeTask.budget} USDT</div></div>
                <div className={styles.activeCard}>
                  <div className={styles.activeCardLabel}>Status</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(() => { const s = activeTask.status; const ks: any = STATUS_META; const m = ks[s] ?? { label: s, color: 'var(--text-2)', icon: '~' }; return (
                      <span className="badge" style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}40`, fontSize: '14px', padding: '6px 14px' }}>{m.label}</span>
                    ); })()}
                    {activeTask.status === 'verifying' && <button className="btn btn-primary" onClick={handleConfirmComplete}>Confirm Complete & Release Payment</button>}
                  </div>
                </div>
              </div>
              <div>
                <div className={styles.timelineCard}>
                  <div className={styles.timelineCardTitle}>Live Timeline</div>
                  <Timeline events={activeTask.timeline} />
                  {!['complete', 'failed'].includes(activeTask.status) && <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>⟳ Polling platform every 5 seconds…</div>}
                </div>
                {activeTask.result && <div className={styles.resultCard}><div className={styles.resultCardTitle}>Agent Deliverable Ready</div>
                  <button className="btn btn-primary" onClick={() => setShowResultModal(true)} style={{ width: '100%', marginTop: '10px' }}>View Full Report</button></div>}
              </div>
            </div>
            {showResultModal && activeTask.result && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: '#13141b', border: '1px solid #333', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '700px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>
                     <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem' }}>Agent Deliverable</h2>
                    <button onClick={() => setShowResultModal(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}>X</button>
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'var(--font-mono)', fontSize: '14.5px', lineHeight: '1.6', color: '#e0e0e0', background: '#0a0a0f', padding: '20px', borderRadius: '8px', border: '1px solid #222' }}>{activeTask.result}</pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════ VALIDATE TAB ════════════ */}
        {activeTab === 'validate' && (
          <div className={styles.phasePane}>
            <div className={styles.paneHeader}>
              <h1 className={styles.paneTitle}>Pre-Validate Your ASP</h1>
              <p className={styles.paneSub}>
                AgentGate runs 8 real checks (x402, latency, DNS, schema, metadata, quality, Docker, hackathon) and returns a scorecard with fix recommendations.
              </p>
            </div>

            {/* ── Mode Toggle ── */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button type="button" className={`btn ${valMode === 'quick' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setValMode('quick')} style={{ flex: 1 }}>
                Quick — Copy & Paste to your AI
              </button>
              <button type="button" className={`btn ${valMode === 'manual' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setValMode('manual')} style={{ flex: 1 }}>
                Manual — Fill form & test directly
              </button>
            </div>

            {valMode === 'quick' && (
              <div style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '12px' }}>Copy this into your AI (Codex, Claude Code, Hermes, OpenClaw):</div>
                <div style={{
                  background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '8px',
                  padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '1.8',
                  color: 'var(--cyan)', marginBottom: '16px', wordBreak: 'break-word', whiteSpace: 'pre-wrap'
                }}>
{`I'd like to use the service provided by Agent 4885：

Service title: Agent Pre-Validation & Hiring Broker
Service type: A2A

Please validate my ASP endpoint for OKX listing readiness.`}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button className="btn btn-sm btn-cyan" onClick={() => {
                    navigator.clipboard.writeText(`I'd like to use the service provided by Agent 4885：\n\nService title: Agent Pre-Validation & Hiring Broker\nService type: A2A\n\nPlease validate my ASP endpoint for OKX listing readiness.`);
                  }}>Copy for Validation</button>
                  <button className="btn btn-sm btn-primary" onClick={() => {
                    navigator.clipboard.writeText(`I'd like to use the service provided by Agent 4885：\n\nService title: Agent Pre-Validation & Hiring Broker\nService type: A2A\n\nPlease help me hire an agent for my task.`);
                  }}>Copy for Hiring</button>
                </div>
                <div style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: '1.6', marginBottom: '16px', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(0,0,0,0.15)' }}>
                  <strong>How it works:</strong> Once agent #4885 is approved on the marketplace, users search "AgentGate" → click "Use Now" → see this instruction → paste into their AI → AgentGate converses with them to collect ASP details and runs all 8 checks.
                </div>
                <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-2)', marginBottom: '8px' }}>Test your endpoint right now (quick scan):</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="input" placeholder="Paste your ASP endpoint URL here for a quick scan" value={quickInstruction}
                      onChange={(e) => setQuickInstruction(e.target.value)} style={{ flex: 1 }} />
                    <button className="btn btn-sm btn-cyan" disabled={!quickInstruction}
                      onClick={async () => {
                        setValLoading(true); setValResult(null); setError('');
                        const match = quickInstruction.match(/https?:\/\/[^\s]+/);
                        if (!match) { setValLoading(false); setError('No URL found'); return; }
                        const res = await fetch('/api/validate', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            aspName: 'My ASP', serviceName: 'My Service',
                            serviceDescription: 'Quick scan via URL paste',
                            serviceType: 'A2MCP', fee: 0, endpoint: match[0],
                          }),
                        });
                        const data = await res.json();
                        if (data.ok) setValResult(data as ValidationResult);
                        else setError(data.error || 'Validation failed');
                        setValLoading(false);
                      }}>
                      {valLoading ? 'Scanning...' : 'Scan'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleValidate} className={styles.taskForm} style={{ display: valMode === 'manual' ? 'flex' : 'none' }}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>ASP Name *</label>
                  <input className="input" placeholder="e.g. My Security Scanner" value={valForm.aspName}
                    onChange={(e) => setValForm({ ...valForm, aspName: e.target.value })} required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Service Name *</label>
                  <input className="input" placeholder="e.g. Smart Contract Audit" value={valForm.serviceName}
                    onChange={(e) => setValForm({ ...valForm, serviceName: e.target.value })} required />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Service Type</label>
                  <select className="input" value={valForm.serviceType}
                    onChange={(e) => setValForm({ ...valForm, serviceType: e.target.value as 'A2A' | 'A2MCP' })}
                    style={{ cursor: 'pointer' }}>
                    <option value="A2A">A2A (negotiated tasks)</option>
                    <option value="A2MCP">A2MCP (API endpoint)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Fee (USDT)</label>
                  <input className="input" type="number" min="0" step="0.01" value={valForm.fee}
                    onChange={(e) => setValForm({ ...valForm, fee: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>ASP Description</label>
                <textarea className="input" rows={2} placeholder="Describe your agent — what it does, who it serves, why it's valuable"
                  value={valForm.aspDescription}
                  onChange={(e) => setValForm({ ...valForm, aspDescription: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Service Description * <span style={{ color: 'var(--pink)' }}>(include parameter details & usage examples)</span></label>
                <textarea className="input" rows={4}
                  placeholder="Describe exactly what your service does, what parameters it accepts, what output format it returns, and include a usage example. This is what the OKX reviewer reads."
                  value={valForm.serviceDescription}
                  onChange={(e) => setValForm({ ...valForm, serviceDescription: e.target.value })} required />
              </div>
              {valForm.serviceType === 'A2MCP' && (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Endpoint URL</label>
                    <input className="input" placeholder="https://your-agent.com/api/service" value={valForm.endpoint}
                      onChange={(e) => setValForm({ ...valForm, endpoint: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>OpenAPI Spec (optional JSON)</label>
                    <textarea className="input" rows={3}
                      placeholder='Paste your OpenAPI 3.x spec as JSON for schema validation'
                      value={valForm.openApiSpec} onChange={(e) => setValForm({ ...valForm, openApiSpec: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Profile Picture URL (optional)</label>
                    <input className="input" placeholder="https://..." value={valForm.profilePicture}
                      onChange={(e) => setValForm({ ...valForm, profilePicture: e.target.value })} />
                  </div>
                </>
              )}
              {error && <div className={styles.errorBox}>{error}</div>}
              <button type="submit" className="btn btn-cyan btn-lg" style={{ width: '100%' }}
                disabled={valLoading || !valForm.aspName || !valForm.serviceName || !valForm.serviceDescription}>
                {valLoading ? 'Running 8 checks...' : 'Run Pre-Validation'}
              </button>
            </form>

            {valResult && (
              <div style={{ marginTop: '24px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
                  padding: '12px 16px', borderRadius: '8px',
                  background: valResult.overall === 'pass' ? 'rgba(0,255,136,0.08)' : valResult.overall === 'warn' ? 'rgba(255,165,0,0.08)' : 'rgba(255,77,125,0.08)',
                  border: `1px solid ${valResult.overall === 'pass' ? 'var(--green)' : valResult.overall === 'warn' ? 'var(--orange)' : 'var(--pink)'}40`
                }}>
                  <span style={{ fontSize: '1.5rem' }}>{valResult.overall === 'pass' ? 'PASS' : valResult.overall === 'warn' ? 'WARN' : 'FAIL'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Score: {valResult.score}/100 — {valResult.overall === 'pass' ? 'Ready to submit' : valResult.overall === 'warn' ? 'Minor issues' : 'Needs work'}</div>
                    <div style={{ color: 'var(--text-2)', fontSize: '13px' }}>{valResult.summary}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                  {valResult.checks.map((c, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
                      background: c.status === 'pass' ? 'rgba(0,255,136,0.04)' : c.status === 'fail' ? 'rgba(255,77,125,0.04)' : 'rgba(255,165,0,0.04)',
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
                {valResult.recommendations.length > 0 && (
                  <div style={{ background: 'rgba(255,165,0,0.06)', border: '1px solid rgba(255,165,0,0.2)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--orange)' }}>Recommended Fixes</div>
                    {valResult.recommendations.map((r, i) => (
                      <div key={i} style={{ padding: '4px 0', fontSize: '13px', color: 'var(--text-2)' }}>{i + 1}. {r}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════ HISTORY TAB ════════════ */}
        {activeTab === 'history' && (
          <div className={styles.phasePane}>
            <div className={styles.paneHeader}>
              <div className={styles.paneHeaderRow}>
                <div>
                  <h1 className={styles.paneTitle}>Task History</h1>
                  <p className={styles.paneSub}>{history.length} tasks in this session.</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => { setActiveTab('hire'); reset(); }}>+ New task</button>
              </div>
            </div>
            {history.length === 0 ? (
              <div className={styles.emptyState}>
                <p style={{ color: 'var(--text-2)' }}>No tasks yet. Create your first task.</p>
              </div>
            ) : (
              <>
                <div className={styles.historyTable}>
                  <div className={styles.historyHeader}>
                    <span>Job ID</span><span>Description</span><span>Agent</span><span>Budget</span><span>Status</span><span>Date</span>
                  </div>
                  {history.map((t) => <TaskRow key={t.jobId} task={t} onClick={() => setHistoryTask(t)} />)}
                </div>
                {historyTask && (
                  <div className={styles.historyDetail}>
                    <div className={styles.historyDetailHeader}>
                      <strong>{historyTask.jobId}</strong>
                      <button className="btn btn-outline btn-sm" onClick={() => setHistoryTask(null)}>Close</button>
                    </div>
                    <StepBar current={historyTask.status as any} />
                    <Timeline events={historyTask.timeline} />
                    {historyTask.result && <div className={styles.resultCard} style={{ marginTop: '20px' }}>
                      <div className={styles.resultCardTitle}>Result</div>
                      <pre className={styles.resultPre}>{historyTask.result}</pre>
                    </div>}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}