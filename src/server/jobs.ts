// Async job dispatch — the seam between "fire research" and "how it actually runs".
//
// ARI research takes ~15-18s, which is far too long to hold an HTTP request open: the browser
// blocks, the demo stalls, and a fan-out across a portfolio would serialise. So callers dispatch a
// job, get an id back immediately, and poll. The page stays responsive and N jobs run concurrently.
//
// `Dispatcher` is deliberately a small interface. Today the only implementation runs in-process
// (no extra service, works on Render's free tier). A durable backend — Render Workflows, a queue,
// a worker pool — implements the same three methods without touching any caller.

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface Job<T = unknown> {
  id: string;
  kind: string; // e.g. "research"
  label: string; // human label for the job board
  status: JobStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  result: T | null;
  error: string | null;
  meta?: Record<string, unknown>;
}

export interface Dispatcher {
  dispatch<T>(kind: string, label: string, work: () => Promise<T>, meta?: Record<string, unknown>): Job<T>;
  get(id: string): Job | undefined;
  list(limit?: number): Job[];
}

const iso = () => new Date().toISOString();

// In-process dispatcher: runs the work on the event loop, retains a bounded history.
// Jobs are ephemeral by design — they don't survive a restart, which is the honest trade-off
// for needing no extra service. A durable backend would swap in here.
export class InProcessDispatcher implements Dispatcher {
  private jobs = new Map<string, Job<any>>();
  private order: string[] = [];
  private seq = 0;

  constructor(private maxHistory = 200) {}

  dispatch<T>(kind: string, label: string, work: () => Promise<T>, meta?: Record<string, unknown>): Job<T> {
    const id = `job_${kind}_${++this.seq}_${Math.random().toString(36).slice(2, 8)}`;
    const job: Job<T> = {
      id, kind, label, status: "queued",
      created_at: iso(), started_at: null, finished_at: null, duration_ms: null,
      result: null, error: null, meta,
    };
    this.jobs.set(id, job);
    this.order.push(id);
    while (this.order.length > this.maxHistory) {
      const drop = this.order.shift();
      if (drop) this.jobs.delete(drop);
    }

    // Kick off on the next tick so dispatch() always returns before any work begins.
    queueMicrotask(async () => {
      job.status = "running";
      job.started_at = iso();
      const t0 = Date.now();
      try {
        job.result = await work();
        job.status = "completed";
      } catch (err) {
        job.error = (err as Error).message;
        job.status = "failed";
      } finally {
        job.finished_at = iso();
        job.duration_ms = Date.now() - t0;
      }
    });

    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  // Newest first.
  list(limit = 50): Job[] {
    return this.order.slice(-limit).reverse().map((id) => this.jobs.get(id)!).filter(Boolean);
  }
}

export const jobs: Dispatcher = new InProcessDispatcher();
