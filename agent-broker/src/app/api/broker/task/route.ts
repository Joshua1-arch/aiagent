import { NextResponse } from 'next/server';
import {
  createAndPublishTask,
  getTaskStatus,
  getDeliverables,
  confirmComplete,
  mapStatusCode,
  BUYER_AGENT_ID,
} from '@/lib/onchainos';

import fs from 'fs';
import path from 'path';

// ── Persistent task store (using local JSON file for hackathon demo) ──
interface StoredTask {
  jobId: string;
  platformJobId: string | null;   // the real on-chain job ID after publish
  draftId: string;
  taskDescription: string;
  budget: number;
  agentId: string;
  agentName: string;
  serviceId: string;
  serviceName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  result?: string;
  timeline: { time: string; event: string; status: string }[];
  error?: string;
}

const dbPath = path.join(process.cwd(), 'tasks_db.json');
const taskStore = new Map<string, StoredTask>();

try {
  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(data);
    for (const [k, v] of Object.entries(parsed)) {
      taskStore.set(k, v as StoredTask);
    }
  }
} catch (err) {
  console.error('Failed to load tasks_db.json', err);
}

function saveTask(id: string, task: StoredTask) {
  taskStore.set(id, task);
  try {
    fs.writeFileSync(dbPath, JSON.stringify(Object.fromEntries(taskStore), null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save tasks_db.json', err);
  }
}

// ── POST — create a real task ──────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      taskDescription: string;
      budget: number;
      agentId: string;
      agentName: string;
      serviceId: string;
      serviceName: string;
    };

    const { taskDescription, budget, agentId, agentName, serviceId, serviceName } = body;

    if (!taskDescription || !agentId) {
      return NextResponse.json(
        { ok: false, error: 'taskDescription and agentId are required' },
        { status: 400 }
      );
    }

    // Generate a local tracking ID immediately so the UI can start polling
    const localId = `BRK-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    // Create the task record in "publishing" state right away
    const task: StoredTask = {
      jobId: localId,
      platformJobId: null,
      draftId: '',
      taskDescription,
      budget,
      agentId,
      agentName,
      serviceId,
      serviceName,
      status: 'publishing',
      createdAt: now,
      updatedAt: now,
      timeline: [
        { time: now, event: `📤 Creating task for ${agentName}…`, status: 'publishing' },
      ],
    };
    saveTask(localId, task);

    // Run the real task creation asynchronously so we don't block the HTTP response
    runRealTaskCreation(localId, {
      title: taskDescription.slice(0, 28),
      description: taskDescription,
      budget,
      providerAgentId: agentId,
      serviceId: serviceId || undefined,
    });

    return NextResponse.json({ ok: true, jobId: localId, status: 'publishing' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// ── GET — poll a task or list all ─────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    const all = Array.from(taskStore.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return NextResponse.json({ ok: true, tasks: all });
  }

  const task = taskStore.get(jobId);
  if (!task) {
    return NextResponse.json({ ok: false, error: 'Task not found' }, { status: 404 });
  }

  // If the task has a real platform job ID and isn't complete/failed yet,
  // do a live status refresh from the platform
  if (
    task.platformJobId &&
    !['complete', 'failed'].includes(task.status)
  ) {
    await refreshTaskStatus(jobId);
  }

  return NextResponse.json({ ok: true, task: taskStore.get(jobId) });
}

// ── PATCH — client confirms complete (releases payment) ───
export async function PATCH(req: Request) {
  try {
    const { jobId } = await req.json() as { jobId: string };
    const task = taskStore.get(jobId);
    if (!task) {
      return NextResponse.json({ ok: false, error: 'Task not found' }, { status: 404 });
    }

    const targetId = task.platformJobId ?? task.jobId;
    const success = await confirmComplete(targetId);

    if (success) {
      pushEvent(task, 'complete', '✅ Payment released. Task confirmed complete.');
      task.status = 'complete';
      task.updatedAt = new Date().toISOString();
      saveTask(jobId, task);
    }

    return NextResponse.json({ ok: success });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// ── Helpers ────────────────────────────────────────────────

function pushEvent(task: StoredTask, status: string, event: string) {
  task.timeline.push({ time: new Date().toISOString(), event, status });
  task.status = status;
  task.updatedAt = new Date().toISOString();
}

async function runRealTaskCreation(
  localId: string,
  input: {
    title: string;
    description: string;
    budget: number;
    providerAgentId: string;
    serviceId?: string;
  }
) {
  const task = taskStore.get(localId);
  if (!task) return;

  try {
    // Step 1: Draft create + publish
    const created = await createAndPublishTask(input);
    task.draftId = created.draftId;
    task.platformJobId = created.jobId;

    if (!created.published) {
      pushEvent(task, 'failed', `❌ Failed to publish task on-chain (draftId: ${created.draftId})`);
      task.error = 'Publish failed — the draft was created but could not be broadcast.';
      saveTask(localId, task);
      return;
    }

    pushEvent(
      task,
      'pending_agent',
      `📡 Task published on-chain (jobId: ${created.jobId}). Waiting for ${task.agentName} to accept…`
    );
    saveTask(localId, task);

    // Step 2: Poll platform status until terminal
    await pollUntilTerminal(localId);
  } catch (err) {
    const t = taskStore.get(localId);
    if (!t) return;
    pushEvent(t, 'failed', `❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    t.error = err instanceof Error ? err.message : String(err);
    saveTask(localId, t);
  }
}

async function refreshTaskStatus(localId: string) {
  const task = taskStore.get(localId);
  if (!task?.platformJobId) return;

  try {
    const status = await getTaskStatus(task.platformJobId);
    if (!status) return;

    const uiStatus = mapStatusCode(status.statusCode);

    // Only add a timeline entry if something changed
    if (uiStatus !== task.status) {
      const labels: Record<string, string> = {
        pending_agent: `⏳ Agent accepted. Task in queue…`,
        in_progress: `⚡ ${task.agentName} is working on your task…`,
        verifying: `🔎 Agent delivered. Verifying output…`,
        complete: `✅ Task complete. Payment released.`,
        failed: `❌ Task failed on platform.`,
      };
      pushEvent(task, uiStatus, labels[uiStatus] ?? `Status: ${uiStatus}`);
    }

    // If complete, try to fetch the deliverable
    if (uiStatus === 'verifying' || uiStatus === 'complete') {
      if (!task.result) {
        const deliverable = await getDeliverables(task.platformJobId);
        if (deliverable) {
          task.result = deliverable;
          if (uiStatus === 'verifying') {
            pushEvent(task, 'complete', '✅ Output verified. Payment auto-released.');
          }
        }
      }
    }

    saveTask(localId, task);
  } catch {
    // Non-fatal — just keep the last known status
  }
}

async function pollUntilTerminal(localId: string, maxAttempts = 60) {
  const INTERVAL_MS = 8000;

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(INTERVAL_MS);
    const task = taskStore.get(localId);
    if (!task?.platformJobId) break;

    await refreshTaskStatus(localId);

    const latest = taskStore.get(localId);
    if (!latest) break;
    if (['complete', 'failed'].includes(latest.status)) break;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Expose buyer agent ID for the UI ──────────────────────
export { BUYER_AGENT_ID };
