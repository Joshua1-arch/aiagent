'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { MarketAgent } from '@/lib/types';
import styles from './dashboard.module.css';
import ConnectWallet from '@/components/ConnectWallet';

type TaskStatus = string;

/* ── Status config ───────────────────────────────────────── */
const STATUS_META: Record<TaskStatus, { label: string; color: string; icon: string }> = {
  searching:    { label: 'Searching',     color: 'var(--cyan)',    icon: '🔍' },
  selecting:    { label: 'Selecting',     color: 'var(--purple)',  icon: '🧠' },
  publishing:   { label: 'Publishing',    color: 'var(--orange)',  icon: '📤' },
  pending_agent:{ label: 'Pending Agent', color: 'var(--yellow)',  icon: '⏳' },
  in_progress:  { label: 'In Progress',   color: 'var(--cyan)',    icon: '⚡' },
  verifying:    { label: 'Verifying',     color: 'var(--purple)',  icon: '🔎' },
  complete:     { label: 'Complete',      color: 'var(--green)',   icon: '✅' },
  failed:       { label: 'Failed',        color: 'var(--pink)',    icon: '❌' },
};

/* ── Step progress bar ───────────────────────────────────── */
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
                isPublishing ? <span className={styles.spinnerIcon}>📤</span> : m.icon
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

/* ── Agent card ──────────────────────────────────────────── */
function AgentCard({
  agent,
  recommended,
  selected,
  onSelect,
}: {
  agent: MarketAgent;
  recommended: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`${styles.agentCard} ${selected ? styles.agentCardSelected : ''} ${recommended ? styles.agentCardRecommended : ''}`}
      onClick={onSelect}
    >
      {recommended && (
        <div className={styles.recommendBadge}>⭐ Recommended</div>
      )}
      <div className={styles.agentCardHeader}>
        <div
          className={styles.agentOnline}
          style={{ background: agent.onlineStatus === 1 ? 'var(--green)' : 'var(--text-muted)' }}
        />
        <span className={styles.agentId}>#{agent.agentId}</span>
        {agent.rating && (
          <span className={styles.agentRating}>{agent.rating}</span>
        )}
        {agent.soldCount != null && agent.soldCount > 0 && (
          <span className={styles.agentSales}>{agent.soldCount} sales</span>
        )}
      </div>
      <div className={styles.agentName}>{agent.name}</div>
      <div className={styles.agentCat}>{agent.category}</div>
      <p className={styles.agentDesc}>
        {agent.description.slice(0, 120)}{agent.description.length > 120 ? '…' : ''}
      </p>
      <div className={styles.agentServices}>
        {agent.services.slice(0, 2).map((s) => (
          <span key={s.serviceId} className={`badge ${s.serviceType === 'A2MCP' ? 'badge-cyan' : 'badge-purple'}`}>
            {s.serviceType}
          </span>
        ))}
      </div>
      <div className={styles.agentPrice}>
        {agent.minPrice != null ? `from ${agent.minPrice} USDC` : 'Negotiable'}
      </div>
      <button
        className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-outline'}`}
        style={{ width: '100%', marginTop: '12px' }}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        {selected ? '✓ Selected' : 'Select Agent'}
      </button>
    </div>
  );
}

/* ── Timeline ────────────────────────────────────────────── */
function Timeline({ events }: {
  events: { time: string; event: string; status: TaskStatus }[];
}) {
  return (
    <div className={styles.timeline}>
      {events.map((e, i) => {
        const m = STATUS_META[e.status];
        return (
          <div key={i} className={styles.timelineItem}>
            <div className={styles.timelineDot} style={{ borderColor: m.color, color: m.color }}>
              {m.icon}
            </div>
            <div className={styles.timelineContent}>
              <div className={styles.timelineEvent}>{e.event}</div>
              <div className={styles.timelineTime}>
                {new Date(e.time).toLocaleTimeString()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Task history row ────────────────────────────────────── */
function TaskRow({ task, onClick }: {
  task: {
    jobId: string;
    taskDescription: string;
    agentName: string;
    budget: number;
    status: TaskStatus;
    createdAt: string;
  };
  onClick: () => void;
}) {
  const m = STATUS_META[task.status];
  return (
    <div className={styles.taskRow} onClick={onClick}>
      <div className={styles.taskRowId}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-2)' }}>
          {task.jobId}
        </span>
      </div>
      <div className={styles.taskRowDesc}>
        {task.taskDescription.slice(0, 60)}{task.taskDescription.length > 60 ? '…' : ''}
      </div>
      <div className={styles.taskRowAgent}>{task.agentName}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--cyan)' }}>
        {task.budget} USDT
      </div>
      <div>
        <span
          className="badge"
          style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}40` }}
        >
          {m.icon} {m.label}
        </span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
        {new Date(task.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}

/* ── Main Dashboard ──────────────────────────────────────── */
type Phase = 'form' | 'searching' | 'select' | 'active' | 'history';

interface Task {
  jobId: string;
  platformJobId?: string | null;
  taskDescription: string;
  budget: number;
  agentId: string;
  agentName: string;
  serviceId: string;
  serviceName: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  result?: string;
  error?: string;
  timeline: { time: string; event: string; status: TaskStatus }[];
}

export default function DashboardPage() {
  const [phase, setPhase] = useState<Phase>('form');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Form state
  const [taskDesc, setTaskDesc] = useState('');
  const [budget, setBudget] = useState('5');
  const [category, setCategory] = useState('');

  useEffect(() => {
    const updateWallet = () => {
      setWalletAddress(localStorage.getItem('connectedWallet'));
    };
    updateWallet();
    window.addEventListener('walletConnectionChanged', updateWallet);
    return () => window.removeEventListener('walletConnectionChanged', updateWallet);
  }, []);

  // Search results
  const [searchResults, setSearchResults] = useState<MarketAgent[]>([]);
  const [recommended, setRecommended] = useState<MarketAgent | null>(null);
  const [reasoning, setReasoning] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<MarketAgent | null>(null);

  // Active task
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // History
  const [history, setHistory] = useState<Task[]>([]);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);

  // Error
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async () => {
    const res = await fetch('/api/broker/task');
    const data = await res.json();
    if (data.ok) setHistory(data.tasks);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Poll active task — 5s interval to account for real platform latency
  useEffect(() => {
    if (!activeTask) return;
    if (['complete', 'failed'].includes(activeTask.status)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/broker/task?jobId=${activeTask.jobId}`);
        const data = await res.json();
        if (data.ok) {
          setActiveTask(data.task);
          if (['complete', 'failed'].includes(data.task.status)) {
            clearInterval(interval);
            fetchHistory();
          }
        }
      } catch {
        // network blip — keep polling
      }
    }, 5000);

    setPollInterval(interval);
    return () => clearInterval(interval);
  }, [activeTask?.jobId, activeTask?.status, fetchHistory]);

  async function handleConfirmComplete() {
    if (!activeTask) return;
    try {
      const res = await fetch('/api/broker/task', {
        method: 'PATCH',
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm failed');
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!taskDesc.trim()) return;
    setError('');
    setPhase('searching');
    setSearchResults([]);
    setSelectedAgent(null);

    try {
      const res = await fetch('/api/broker/search', {
        method: 'POST',
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setPhase('form');
    }
  }

  async function handleHire() {
    if (!selectedAgent) return;
    setError('');

    const service = selectedAgent.services[0];

    try {
      const res = await fetch('/api/broker/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskDescription: taskDesc,
          budget: Number(budget),
          agentId: selectedAgent.agentId,
          agentName: selectedAgent.name,
          serviceId: service?.serviceId ?? '',
          serviceName: service?.serviceName ?? '',
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      // Fetch full task
      const taskRes = await fetch(`/api/broker/task?jobId=${data.jobId}`);
      const taskData = await taskRes.json();
      if (taskData.ok) setActiveTask(taskData.task);

      setPhase('active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    }
  }

  function reset() {
    setPhase('form');
    setTaskDesc('');
    setBudget('5');
    setCategory('');
    setSearchResults([]);
    setSelectedAgent(null);
    setActiveTask(null);
    setError('');
    if (pollInterval) clearInterval(pollInterval);
  }

  return (
    <div className={styles.shell}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.sidebarLogo}>
          <span className={styles.sidebarLogoIcon}>⬡</span>
          <span>AgentBroker</span>
        </Link>

        <div style={{ padding: '0 20px 20px 20px', borderBottom: '1px solid var(--border)', marginBottom: '10px' }}>
          <ConnectWallet />
        </div>

        <nav className={styles.sidebarNav}>
          <button
            className={`${styles.navBtn} ${phase !== 'history' ? styles.navBtnActive : ''}`}
            onClick={() => phase !== 'active' && reset()}
          >
            <span>🤖</span> New Task
          </button>
          <button
            className={`${styles.navBtn} ${phase === 'history' ? styles.navBtnActive : ''}`}
            onClick={() => { fetchHistory(); setPhase('history'); setHistoryTask(null); }}
          >
            <span>📋</span> Task History
            {history.length > 0 && (
              <span className={styles.navBadge}>{history.length}</span>
            )}
          </button>
        </nav>

        <div className={styles.sidebarStats}>
          <div className={styles.sidebarStat}>
            <span className={styles.sidebarStatNum}>{history.length}</span>
            <span className={styles.sidebarStatLabel}>Total Tasks</span>
          </div>
          <div className={styles.sidebarStat}>
            <span className={styles.sidebarStatNum}>
              {history.filter((t) => t.status === 'complete').length}
            </span>
            <span className={styles.sidebarStatLabel}>Completed</span>
          </div>
        </div>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarFooterItem}>
            <span className="dot-online" /> OKX.AI Live
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className={styles.main}>

        {/* ── FORM phase ── */}
        {phase === 'form' && (
          <div className={styles.phasePane}>
            <div className={styles.paneHeader}>
              <h1 className={styles.paneTitle}>New Broker Task</h1>
              <p className={styles.paneSub}>
                Describe what you need. AgentBroker will find, hire, and manage the best agent for you.
              </p>
            </div>

            <form onSubmit={handleSearch} className={styles.taskForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Task Description *</label>
                <textarea
                  className="input"
                  rows={5}
                  placeholder="e.g. Audit my smart contract at 0xABC... for honeypot patterns, rug pull risk, and ownership issues. I need a detailed risk report."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  required
                />
                <div className={styles.formHint}>
                  Be specific. The more context you provide, the better agent the broker will match.
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Budget (USDT)</label>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Category (optional)</label>
                  <select
                    className="input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="">Any category</option>
                    <option value="Finance">Finance</option>
                    <option value="Software services">Software services</option>
                    <option value="Lifestyle">Lifestyle</option>
                    <option value="Art creation">Art creation</option>
                  </select>
                </div>
              </div>

              {error && <div className={styles.errorBox}>{error}</div>}

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                🔍 Find Best Agent →
              </button>
            </form>

            {/* Example tasks */}
            <div className={styles.examplesSection}>
              <div className={styles.examplesLabel}>Quick examples:</div>
              <div className={styles.examples}>
                {[
                  'Verify GitHub PR diffs against task spec using CollabShield',
                  'Scan my smart contract 0x1234... for security risks and honeypot patterns',
                  'Find the best USDC yield opportunity for $10,000 right now',
                  'Analyze Polymarket for mispriced prediction markets today',
                  'Create a risk report for this token: 0xABC...',
                ].map((ex) => (
                  <button
                    key={ex}
                    className={styles.exampleChip}
                    onClick={() => setTaskDesc(ex)}
                    type="button"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SEARCHING phase ── */}
        {phase === 'searching' && (
          <div className={styles.phasePane}>
            <div className={styles.searchingState}>
              <div className={styles.searchingOrb} />
              <h2 className={styles.searchingTitle}>Scanning marketplace…</h2>
              <p className={styles.searchingSub}>
                Querying {35} live agents, scoring by rating, sales, price fit, and online status.
              </p>
              <div className={styles.searchingBars}>
                {['Rating score', 'Sales history', 'Price match', 'Online status', 'Category fit'].map((l, i) => (
                  <div key={l} className={styles.searchingBar}>
                    <span>{l}</span>
                    <div className={styles.searchingBarTrack}>
                      <div
                        className={styles.searchingBarFill}
                        style={{ animationDelay: `${i * 200}ms` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SELECT phase ── */}
        {phase === 'select' && (
          <div className={styles.phasePane}>
            <div className={styles.paneHeader}>
              <div className={styles.paneHeaderRow}>
                <div>
                  <h1 className={styles.paneTitle}>Agent Matches</h1>
                  <p className={styles.paneSub}>
                    Found {searchResults.length} agents. Select one to proceed.
                  </p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={reset}>← New task</button>
              </div>

              {reasoning && (
                <div className={styles.reasoningBox}>
                  <span style={{ color: 'var(--green)' }}>🧠 Broker recommendation:</span>{' '}
                  {reasoning}
                </div>
              )}
            </div>

            {error && <div className={styles.errorBox}>{error}</div>}

            <div className={styles.agentGrid}>
              {searchResults.map((a) => (
                <AgentCard
                  key={a.agentId}
                  agent={a}
                  recommended={a.agentId === recommended?.agentId}
                  selected={a.agentId === selectedAgent?.agentId}
                  onSelect={() => setSelectedAgent(a)}
                />
              ))}
            </div>

            {selectedAgent && (
              <div className={styles.hireBar}>
                <div className={styles.hireBarInfo}>
                  <span style={{ color: 'var(--text-2)' }}>Selected:</span>{' '}
                  <strong>{selectedAgent.name}</strong>
                  {selectedAgent.minPrice != null && (
                    <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>
                      {' '}· {selectedAgent.minPrice} USDT
                    </span>
                  )}
                </div>
                {walletAddress ? (
                  <button className="btn btn-primary btn-lg" onClick={handleHire}>
                    ⚡ Hire This Agent →
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <button className="btn btn-primary btn-lg" disabled style={{ opacity: 0.5 }}>
                      ⚡ Hire This Agent →
                    </button>
                    <span style={{ color: 'var(--pink)', fontSize: '12px' }}>
                      Connect wallet to hire
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVE phase ── */}
        {phase === 'active' && activeTask && (
          <div className={styles.phasePane}>
            <div className={styles.paneHeader}>
              <div className={styles.paneHeaderRow}>
                <div>
                  <h1 className={styles.paneTitle}>Task Active</h1>
                  <p className={styles.paneSub}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-2)', fontSize: '13px' }}>
                      Local: {activeTask.jobId}
                      {activeTask.platformJobId && (
                        <> &nbsp;·&nbsp; On-chain: <strong style={{ color: 'var(--cyan)' }}>{activeTask.platformJobId}</strong></>
                      )}
                    </span>
                  </p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={reset}>+ New task</button>
              </div>
            </div>

            <StepBar current={activeTask.status as 'publishing' | 'pending_agent' | 'in_progress' | 'verifying' | 'complete'} />

            {activeTask.error && (
              <div className={styles.errorBox} style={{ marginBottom: '20px' }}>
                ⚠️ {activeTask.error}
              </div>
            )}

            <div className={styles.activeGrid}>
              {/* Left: info */}
              <div>
                <div className={styles.activeCard}>
                  <div className={styles.activeCardLabel}>Task</div>
                  <div className={styles.activeCardValue}>{activeTask.taskDescription}</div>
                </div>
                <div className={styles.activeCard}>
                  <div className={styles.activeCardLabel}>Agent</div>
                  <div className={styles.activeCardValue}>{activeTask.agentName}</div>
                </div>
                <div className={styles.activeCard}>
                  <div className={styles.activeCardLabel}>Service</div>
                  <div className={styles.activeCardValue}>{activeTask.serviceName || '—'}</div>
                </div>
                <div className={styles.activeCard}>
                  <div className={styles.activeCardLabel}>Budget</div>
                  <div className={styles.activeCardValue} style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>
                    {activeTask.budget} USDT
                  </div>
                </div>
                <div className={styles.activeCard}>
                  <div className={styles.activeCardLabel}>Status</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(() => {
                      const s = activeTask.status;
                      const knownStatuses: Record<string, { label: string; color: string; icon: string }> = STATUS_META as unknown as Record<string, { label: string; color: string; icon: string }>;
                      const m = knownStatuses[s] ?? { label: s, color: 'var(--text-2)', icon: '⏳' };
                      return (
                        <span
                          className="badge"
                          style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}40`, fontSize: '14px', padding: '6px 14px' }}
                        >
                          {m.icon} {m.label}
                        </span>
                      );
                    })()}
                    {activeTask.status === 'verifying' && (
                      <button className="btn btn-primary" onClick={handleConfirmComplete}>
                        ✅ Confirm Complete &amp; Release Payment
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: timeline + result */}
              <div>
                <div className={styles.timelineCard}>
                  <div className={styles.timelineCardTitle}>Live Timeline</div>
                  <Timeline events={activeTask.timeline} />
                  {!['complete', 'failed'].includes(activeTask.status) && (
                    <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      ⟳ Polling platform every 5 seconds…
                    </div>
                  )}
                </div>

                {activeTask.result && (
                  <div className={styles.resultCard}>
                    <div className={styles.resultCardTitle}>✅ Agent Deliverable</div>
                    <pre className={styles.resultPre}>{activeTask.result}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY phase ── */}
        {phase === 'history' && (
          <div className={styles.phasePane}>
            <div className={styles.paneHeader}>
              <div className={styles.paneHeaderRow}>
                <div>
                  <h1 className={styles.paneTitle}>Task History</h1>
                  <p className={styles.paneSub}>{history.length} tasks in this session.</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={reset}>+ New task</button>
              </div>
            </div>

            {history.length === 0 ? (
              <div className={styles.emptyState}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📋</div>
                <p style={{ color: 'var(--text-2)' }}>No tasks yet. Create your first broker task above.</p>
              </div>
            ) : (
              <>
                <div className={styles.historyTable}>
                  <div className={styles.historyHeader}>
                    <span>Job ID</span>
                    <span>Description</span>
                    <span>Agent</span>
                    <span>Budget</span>
                    <span>Status</span>
                    <span>Date</span>
                  </div>
                  {history.map((t) => (
                    <TaskRow
                      key={t.jobId}
                      task={t}
                      onClick={() => setHistoryTask(t)}
                    />
                  ))}
                </div>

                {historyTask && (
                  <div className={styles.historyDetail}>
                    <div className={styles.historyDetailHeader}>
                      <strong>{historyTask.jobId}</strong>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setHistoryTask(null)}
                      >
                        ✕ Close
                      </button>
                    </div>
                    <StepBar current={historyTask.status} />
                    <Timeline events={historyTask.timeline} />
                    {historyTask.result && (
                      <div className={styles.resultCard} style={{ marginTop: '20px' }}>
                        <div className={styles.resultCardTitle}>Result</div>
                        <pre className={styles.resultPre}>{historyTask.result}</pre>
                      </div>
                    )}
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
