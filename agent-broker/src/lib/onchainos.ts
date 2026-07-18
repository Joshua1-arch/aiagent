import { exec } from 'child_process';
import { promisify } from 'util';
import type { MarketAgent, SearchResult } from './types';

const execAsync = promisify(exec);
const CLI = 'onchainos';

// The buyer agent ID used to create tasks (AgentGate = user-role agent)
export const BUYER_AGENT_ID = process.env.AGENTGATE_AGENT_ID ?? '4885';

// ── Generic CLI runner ────────────────────────────────────
export async function run(cmd: string): Promise<unknown> {
  try {
    const { stdout, stderr } = await execAsync(`${CLI} ${cmd}`, {
      timeout: 45000,
    });
    const out = stdout.trim();
    if (!out && stderr) throw new Error(stderr.trim());

    // Try parsing as JSON if it looks like JSON
    if (out.startsWith('{') || out.startsWith('[')) {
      try {
        return JSON.parse(out);
      } catch {
        // Fall through to plain text parsing
      }
    }

    // Handle plain text success strings like "✓ Draft saved (jobId: 0x...)"
    if (out.includes('✓')) {
      const jobIdMatch = out.match(/jobId:\s*([a-fA-F0-9xX]+)/);
      return {
        ok: true,
        data: {
          jobId: jobIdMatch ? jobIdMatch[1] : undefined,
          id: jobIdMatch ? jobIdMatch[1] : undefined,
        },
        jobId: jobIdMatch ? jobIdMatch[1] : undefined,
      };
    }

    // Default fallback for plain text successes
    return { ok: true, raw: out };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    // Some CLI errors still emit valid JSON on stdout
    if (error.stdout) {
      try { return JSON.parse(error.stdout.trim()); } catch { /* fall through */ }
    }
    throw new Error(`CLI [${cmd.split(' ')[0]}]: ${error.message ?? 'unknown error'}`);
  }
}

// ── Agent normalization ───────────────────────────────────
function normalizeAgent(raw: Record<string, unknown>): MarketAgent {
  const services = Array.isArray(raw.services) ? raw.services : [];
  return {
    agentId: String(raw.agentId ?? ''),
    name: String(raw.name ?? 'Unknown'),
    category: Array.isArray(raw.categoryName)
      ? String(raw.categoryName[0] ?? 'Other')
      : 'Other',
    rating: typeof raw.feedbackRate === 'number' ? `★ ${Math.round(raw.feedbackRate)}` : null,
    minPrice: typeof raw.serviceMinPrice === 'number' ? raw.serviceMinPrice : null,
    soldCount: typeof raw.soldCount === 'number' ? raw.soldCount : null,
    description: String(raw.profileDescription ?? ''),
    communicationAddress: String(raw.communicationAddress ?? ''),
    onlineStatus: typeof raw.onlineStatus === 'number' ? raw.onlineStatus : 2,
    services: services.map((s: Record<string, unknown>) => ({
      serviceId: String(s.serviceId ?? ''),
      serviceName: String(s.serviceName ?? ''),
      serviceType: s.serviceType === 'A2MCP' ? 'A2MCP' : 'A2A',
      fee: typeof s.feeAmount === 'number' ? s.feeAmount : null,
      endpoint: s.endpoint ? String(s.endpoint) : null,
      description: String(s.serviceDescription ?? ''),
    })),
  };
}

// ── Scoring ───────────────────────────────────────────────
function scoreAgent(a: MarketAgent, budget: number, query?: string): number {
  let s = 0;
  if (a.onlineStatus === 1) s += 40;
  if (a.soldCount && a.soldCount > 0) s += Math.min(a.soldCount * 2, 30);
  if (a.rating) s += 20;
  if (a.minPrice !== null && a.minPrice <= budget) s += 10;
  else if (a.minPrice === null) s += 5;

  // Boost for query name matches (helps demo selection)
  if (query) {
    const q = query.toLowerCase().trim();
    const name = a.name.toLowerCase();
    if (name === q) {
      s += 1000;
    } else if (name.includes(q) || q.includes(name)) {
      s += 500;
    }
  }
  return s;
}

function buildReasoning(a: MarketAgent): string {
  const r: string[] = [];
  if (a.onlineStatus === 1) r.push('currently online');
  if (a.soldCount && a.soldCount > 5) r.push(`${a.soldCount} completed tasks`);
  if (a.rating) r.push(`top-rated (${a.rating}/100)`);
  if (a.services.length > 1) r.push(`${a.services.length} services available`);
  return `Selected because it is ${r.join(', ') || 'the best available match'}.`;
}

// Known broken agents on XLayer due to on-chain registry mismatch (stale database records)
const BROKEN_AGENT_IDS = new Set(['3345', '2023', '2135', '4570']);

// ── Public API: search ────────────────────────────────────
export async function searchAgents(query: string, budget: number): Promise<SearchResult> {
  type Resp = { ok: boolean; data: { list: Record<string, unknown>[]; total: number } };

  // Resolve query keyword to prevent long sentences from failing in Elasticsearch
  let queryTerm = query;
  if (query.toLowerCase().includes('collabshield')) {
    queryTerm = 'collabshield';
  }

  const result = await run(
    `agent search --query "${queryTerm.replace(/"/g, "'")}" --page 1`
  ) as Resp;

  if (!result?.ok || !result?.data?.list) {
    return { agents: [], recommended: null, reasoning: '', total: 0 };
  }

  // Filter out agents without active services or with known on-chain registry issues, ensuring status is active
  const agents = result.data.list
    .filter(raw => typeof raw.status !== 'number' || raw.status === 1)
    .map(normalizeAgent)
    .filter(a => a.services.length > 0 && !BROKEN_AGENT_IDS.has(a.agentId));

  const scored = agents
    .map((a) => ({ agent: a, score: scoreAgent(a, budget, query) }))
    .sort((x, y) => y.score - x.score);

  const recommended = scored[0]?.agent ?? null;
  return {
    agents,
    recommended,
    reasoning: recommended ? buildReasoning(recommended) : '',
    total: agents.length,
  };
}

// ── Public API: marketplace listing ──────────────────────
export async function getMarketplaceAgents(page = 1) {
  type Resp = { ok: boolean; data: { list: Record<string, unknown>[]; total: number } };
  const result = await run(
    `agent search --query "agent" --status active --page ${page}`
  ) as Resp;

  if (!result?.ok || !result?.data?.list) return { agents: [], total: 0 };

  // Filter out agents without active services or with known on-chain registry issues
  const agents = result.data.list
    .map(normalizeAgent)
    .filter(a => a.services.length > 0 && !BROKEN_AGENT_IDS.has(a.agentId));

  return {
    agents,
    total: agents.length,
  };
}

// ── Public API: create a real task draft + publish ────────
export interface CreateTaskInput {
  title: string;
  description: string;
  budget: number;
  providerAgentId: string;     // the hired agent
  serviceId?: string;
}

export interface CreatedTask {
  draftId: string;
  jobId: string | null;        // null until published
  published: boolean;
}

export async function createAndPublishTask(input: CreateTaskInput): Promise<CreatedTask> {
  // 1. Sanitise fields — platform enforces 30-char title limit
  const rawTitle = input.title.replace(/"/g, "'");
  const title = rawTitle.length > 30 ? rawTitle.slice(0, 27) + '…' : rawTitle;
  const summary = input.description.slice(0, 100).replace(/"/g, "'");
  const desc = input.description.replace(/"/g, "'");

  // 2. Resolve service details dynamically
  let serviceId = input.serviceId;
  let serviceType = 'A2A';
  let feeAmount = input.budget;
  let feeToken = '';

  if (input.providerAgentId) {
    try {
      type ServiceItem = {
        id?: string | number;
        serviceType?: string;
        fee?: string;
        contractAddress?: string;
      };
      type ServiceListResp = { ok: boolean; data?: Array<{ list?: Array<ServiceItem> }> };
      const svcs = await run(`agent service-list --agent-id ${input.providerAgentId}`) as ServiceListResp;
      if (svcs?.ok && Array.isArray(svcs.data) && svcs.data.length > 0) {
        const list = svcs.data[0].list;
        if (Array.isArray(list) && list.length > 0) {
          const matched = serviceId
            ? list.find(s => String(s.id) === String(serviceId))
            : list[0];
          if (matched) {
            serviceId = String(matched.id ?? '');
            serviceType = matched.serviceType ?? 'A2A';
            if (matched.fee) {
              feeAmount = parseFloat(matched.fee);
            }
            feeToken = matched.contractAddress ?? '';
          }
        }
      }
    } catch {
      // ignore and fallback
    }
  }

  if (input.providerAgentId && !serviceId) {
    throw new Error(`Agent #${input.providerAgentId} does not have any active services listed. Only service providers (ASPs) can be hired.`);
  }

  const payMode = serviceType === 'A2MCP' ? 'x402' : 'escrow';
  const budget = input.budget || feeAmount || 0.01;

  // 3. Draft create
  type DraftResp = {
    ok: boolean;
    data?: { jobId?: string; id?: string };
    jobId?: string;
  };

  let draftCmd = `agent draft create --title "${title}" --description "${desc}" --description-summary "${summary}" --budget ${budget} --max-budget ${budget} --currency USDT --provider ${input.providerAgentId} --visibility 1 --payment-mode ${payMode}`;
  if (serviceId) {
    draftCmd += ` --service-id ${serviceId}`;
  }
  if (payMode === 'x402' && feeToken) {
    draftCmd += ` --service-token-address "${feeToken}" --service-token-amount ${budget}`;
  }

  const draftResult = await run(draftCmd) as DraftResp;
  const draftId =
    draftResult?.data?.jobId ??
    draftResult?.data?.id ??
    draftResult?.jobId ??
    '';

  if (!draftId) {
    throw new Error(`Draft creation failed: ${JSON.stringify(draftResult)}`);
  }

  // 4. Publish on-chain
  type PubResp = { ok: boolean; data?: { jobId?: string } };
  const pubResult = await run(`agent draft publish ${draftId}`) as PubResp;
  const jobId = pubResult?.data?.jobId ?? draftId;

  return { draftId, jobId, published: !!pubResult?.ok };
}

// ── Public API: get real task status ──────────────────────
export interface TaskStatus {
  jobId: string;
  status: string;             // raw platform status string
  statusCode: number;
  title?: string;
  budget?: number;
  providerName?: string;
  deliverable?: string;
  updatedAt?: string;
}

export async function getTaskStatus(jobId: string): Promise<TaskStatus | null> {
  type Resp = {
    ok: boolean;
    data?: {
      buyerTasks?: Array<{
        jobId: string;
        status?: number;
        statusLabel?: string;
        title?: string;
        budget?: number;
        providerName?: string;
        deliverable?: string;
        updatedAt?: string;
      }>;
    };
  };

  // task-in-progress needs an agent ID; use our buyer agent
  const result = await run(
    `agent task-in-progress --agent-ids ${BUYER_AGENT_ID}`
  ) as Resp;

  if (!result?.ok || !result?.data?.buyerTasks) return null;

  const task = result.data.buyerTasks.find((t) => String(t.jobId) === String(jobId));
  if (!task) return null;

  return {
    jobId: String(task.jobId),
    status: task.statusLabel ?? String(task.status ?? 'unknown'),
    statusCode: task.status ?? 0,
    title: task.title,
    budget: task.budget,
    providerName: task.providerName,
    deliverable: task.deliverable,
    updatedAt: task.updatedAt,
  };
}

// ── Public API: list deliverables for a task ──────────────
export async function getDeliverables(jobId: string): Promise<string | null> {
  type Resp = {
    ok: boolean;
    data?: Array<{ content?: string; text?: string; deliverable?: string }>;
  };

  try {
    const result = await run(
      `agent task-deliverable-list --job-id ${jobId} --role user`
    ) as Resp;

    if (!result?.ok || !Array.isArray(result?.data) || result.data.length === 0) return null;
    const first = result.data[0];
    return first.content ?? first.text ?? first.deliverable ?? JSON.stringify(first);
  } catch {
    return null;
  }
}

// ── Public API: confirm task complete + release payment ───
export async function confirmComplete(jobId: string): Promise<boolean> {
  type Resp = { ok: boolean };
  try {
    const result = await run(`agent complete ${jobId}`) as Resp;
    return !!result?.ok;
  } catch {
    return false;
  }
}

// ── Map platform status code → UI TaskStatus ──────────────
export function mapStatusCode(code: number): string {
  const map: Record<number, string> = {
    [-1]: 'publishing',     // Init
    0: 'pending_agent',    // Created: awaiting acceptance
    1: 'in_progress',      // Accepted: provider working
    2: 'verifying',        // Submitted: delivered, waiting for review
    3: 'failed',           // Rejected
    4: 'verifying',        // Disputed
    5: 'failed',           // AdminStopped
    6: 'complete',         // Completed
    7: 'failed',           // Close
    8: 'failed',           // Expired
    9: 'failed',           // Failed (refunded)
  };
  return map[code] ?? 'in_progress';
}
