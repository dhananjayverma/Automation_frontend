export type Job = {
  jobId: string;
  maskedPan: string;
  phase: string;
  status: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  durationMs: number;
  result?: { userId?: string; passwordSaved?: boolean };
  error?: { code?: string; message?: string };
};

export type JobEvent = {
  eventId: string;
  jobId: string;
  seq: number;
  phase: string;
  level: "info" | "warn" | "error";
  message: string;
  step?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  error?: { code?: string; message?: string };
};

export type Metrics = {
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  running: number;
  waiting: number;
  successRate: number;
  p50DurationMs: number;
  p99DurationMs: number;
};
