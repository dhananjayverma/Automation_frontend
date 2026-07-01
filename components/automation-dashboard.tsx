"use client";

import type { ReactNode, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelJob,
  createJob,
  deleteJob,
  getJobEvents,
  getMetrics,
  listJobs,
  openEventStream,
  sendOtp,
  continueAfterCaptcha,
} from "@/lib/api";
import { API_BASE } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import type { Job, JobEvent, Metrics } from "@/lib/types";
import { JobsTable } from "./jobs-table";
import { MetricCard } from "./metric-card";
import { LiveEventConsole, RunDetails } from "./run-details";

type Tab = "dashboard" | "runs" | "live" | "metrics" | "settings";
type Toast = { id: string; tone: "success" | "error" | "info"; message: string };
type StreamState = "idle" | "connecting" | "connected" | "disconnected" | "error";
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const NAV_ITEMS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
      </svg>
    ),
  },
  {
    id: "runs",
    label: "Runs",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    id: "live",
    label: "Live Runs",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    id: "metrics",
    label: "Metrics",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function AutomationDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pan, setPan] = useState("");
  const [panError, setPanError] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [jobsLoading, setJobsLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [continueBusy, setContinueBusy] = useState(false);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const lastSeqRef = useRef(0);
  const jobsRequestSeqRef = useRef(0);
  const toastSeqRef = useRef(0);

  const showToast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    toastSeqRef.current += 1;
    const id = `${Date.now()}-${toastSeqRef.current}`;
    setToasts((current) => [...current, { id, tone, message }].slice(-4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  const refreshJobs = useCallback(async (overrides: { search?: string; phase?: string; status?: string } = {}) => {
    const requestSeq = jobsRequestSeqRef.current + 1;
    jobsRequestSeqRef.current = requestSeq;
    setJobsLoading(true);
    try {
      const result = await listJobs({
        search: overrides.search ?? search,
        phase: overrides.phase ?? phaseFilter,
        status: overrides.status ?? statusFilter,
      });
      if (jobsRequestSeqRef.current !== requestSeq) return;
      setJobs(result.jobs);
      setTotalJobs(result.total);
      setError("");
    } finally {
      if (jobsRequestSeqRef.current === requestSeq) {
        setJobsLoading(false);
      }
    }
  }, [phaseFilter, search, statusFilter]);

  const refreshMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const nextMetrics = await getMetrics();
      setMetrics(nextMetrics);
      setError("");
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.jobId === selectedJobId) || jobs[0],
    [jobs, selectedJobId],
  );
  const activeJobId = selectedJob?.jobId || "";

  useEffect(() => {
    const metricsTimer = window.setTimeout(() => {
      refreshMetrics().catch((caught) => {
        setError(errorMessage(caught, "Could not load backend metrics."));
      });
    }, 0);

    return () => { window.clearTimeout(metricsTimer); };
  }, [refreshMetrics]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      refreshJobs().catch((caught) => {
        setError(errorMessage(caught, "Could not load backend jobs."));
        setJobsLoading(false);
      });
    }, 250);

    return () => { window.clearTimeout(refreshTimer); };
  }, [refreshJobs]);

  useEffect(() => {
    if (!activeJobId) {
      lastSeqRef.current = 0;
      const idleTimer = window.setTimeout(() => setStreamState("idle"), 0);
      return () => { window.clearTimeout(idleTimer); };
    }
    let closed = false;
    let cleanup: (() => void) | undefined;
    const connectingTimer = window.setTimeout(() => setStreamState("connecting"), 0);

    async function connectStream() {
      const history = await getJobEvents(activeJobId);
      if (closed) return;
      setEvents(history);
      lastSeqRef.current = history.at(-1)?.seq || 0;
      const stream = openEventStream(activeJobId, lastSeqRef.current);
      setStreamState("connected");
      stream.addEventListener("job-event", (message) => {
        const event = JSON.parse((message as MessageEvent).data) as JobEvent;
        lastSeqRef.current = Math.max(lastSeqRef.current, event.seq);
        setEvents((current) => {
          if (current.some((item) => item.eventId === event.eventId)) return current;
          return [...current, event].sort((a, b) => a.seq - b.seq);
        });
        setJobs((current) =>
          current.map((job) =>
            job.jobId === event.jobId
              ? { ...job, phase: event.phase, status: statusFromEvent(event), updatedAt: event.timestamp }
              : job,
          ),
        );
        if (event.step === "captcha_manual_required") {
          showToast("CAPTCHA: solve it in the Playwright browser, then click Continue.", "info");
        }
        if (event.step === "captcha_waiting") {
          showToast("Still waiting on CAPTCHA — solve in browser, then click Continue.", "info");
        }
        if (event.step === "otp_required" || (event.phase === "WAITING_FOR_OTP" && event.step === "waiting_for_otp")) {
          showToast("OTP needed — enter it in this dashboard (not in the browser).", "info");
        }
        if (event.step === "uidai_error") {
          showToast("UIDAI is temporarily unavailable. If an OTP arrives, enter it in the dashboard.", "info");
        }
        if (event.step === "wrong_otp") {
          showToast(event.message, "error");
        }
        if (event.phase === "COMPLETED") {
          showToast("Run completed — credentials are ready in the console.", "success");
          refreshJobs().catch(() => {});
          refreshMetrics().catch(() => {});
        }
        if (event.phase === "FAILED") {
          showToast(event.error?.message || "Run failed.", "error");
          refreshMetrics().catch(() => {});
        }
        if (event.phase === "CANCELLED") {
          showToast("Run cancelled.", "info");
          refreshMetrics().catch(() => {});
        }
      });
      stream.onerror = () => {
        setStreamState("disconnected");
        setError("Live stream disconnected. Browser will retry automatically.");
      };
      cleanup = () => {
        setStreamState("idle");
        stream.close();
      };
    }

    connectStream().catch(() => {
      if (!closed) {
        setStreamState("error");
        setError("Could not load event history.");
      }
    });
    return () => {
      window.clearTimeout(connectingTimer);
      closed = true;
      cleanup?.();
    };
  }, [activeJobId, refreshJobs, refreshMetrics, showToast]);

  async function handleCreateRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const normalizedPan = pan.trim().toUpperCase();
    if (!PAN_REGEX.test(normalizedPan)) {
      const message = "PAN must be 5 letters, 4 digits, then 1 letter. Example: ABCDE1234F";
      setPanError(message);
      showToast(message, "error");
      return;
    }
    try {
      const job = await createJob({ pan: normalizedPan });
      setPan("");
      setPanError("");
      setSelectedJobId(job.jobId);
      setJobs((current) => [job, ...current.filter((item) => item.jobId !== job.jobId)]);
      setTotalJobs((current) => Math.max(current + 1, 1));
      await refreshJobs();
      setActiveTab("live");
      showToast("Run started. Opening live console.", "success");
    } catch (caught) {
      const message = errorMessage(caught, "Could not start run.");
      setError(message);
      showToast(message, "error");
    }
  }

  async function handleContinueCaptcha() {
    if (!selectedJob || continueBusy) return;
    setContinueBusy(true);
    try {
      await continueAfterCaptcha(selectedJob.jobId);
      showToast("Continue signal sent. Bot will resume within a few seconds.", "success");
    } catch (caught) {
      const message = errorMessage(caught, "Could not resume automation.");
      setError(message);
      showToast(message, "error");
    } finally {
      window.setTimeout(() => setContinueBusy(false), 5000);
    }
  }

  async function handleSubmitOtp() {
    if (!selectedJob) return;
    try {
      await sendOtp(selectedJob.jobId, otp);
      setOtp("");
      await Promise.all([refreshJobs(), refreshMetrics()]);
      showToast("OTP submitted to automation.", "success");
    } catch (caught) {
      const message = errorMessage(caught, "OTP was rejected.");
      setError(message);
      showToast(message, "error");
    }
  }

  async function handleCancelRun() {
    if (!selectedJob) return;
    try {
      await cancelJob(selectedJob.jobId);
      setJobs((current) =>
        current.map((job) =>
          job.jobId === selectedJob.jobId
            ? { ...job, phase: "CANCELLED", status: "cancelled", completedAt: new Date().toISOString() }
            : job,
        ),
      );
      await Promise.all([refreshJobs(), refreshMetrics()]);
      showToast("Run cancelled.", "info");
    } catch (caught) {
      const message = errorMessage(caught, "Could not cancel run.");
      setError(message);
      showToast(message, "error");
    }
  }

  async function handleDeleteRun(job: Job) {
    if (!["completed", "failed", "cancelled"].includes(job.status)) {
      showToast("Cancel or finish this run before deleting it.", "error");
      return;
    }
    const confirmed = window.confirm(`Delete run #${job.jobId.slice(0, 8)}? This removes its event history too.`);
    if (!confirmed) return;

    try {
      await deleteJob(job.jobId);
      setJobs((current) => current.filter((item) => item.jobId !== job.jobId));
      setTotalJobs((current) => Math.max(0, current - 1));
      if (selectedJobId === job.jobId) {
        setSelectedJobId("");
        setEvents([]);
      }
      await Promise.all([refreshJobs(), refreshMetrics()]);
      showToast("Run deleted.", "success");
    } catch (caught) {
      const message = errorMessage(caught, "Could not delete run.");
      setError(message);
      showToast(message, "error");
    }
  }

  function handlePhaseChange(value: string) {
    setPhaseFilter(value);
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
  }

  const liveJobs = jobs.filter((j) => j.status === "running" || j.status === "waiting_for_operator");
  const metricsTrend = metricsLoading ? "Loading..." : "Unavailable";

  return (
    <div className="min-h-screen flex bg-[radial-gradient(circle_at_top_left,_#f7fbff_0%,_#f4f7fb_34%,_#edf2f7_100%)] text-[#172033] font-sans antialiased">
      <div className="fixed right-4 top-4 z-50 space-y-2 w-[min(360px,calc(100vw-2rem))]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-3 text-xs font-bold shadow-lg bg-white ${
              toast.tone === "success"
                ? "border-emerald-200 text-emerald-700"
                : toast.tone === "error"
                ? "border-red-200 text-red-700"
                : "border-blue-200 text-blue-700"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* ── LEFT SIDEBAR ── */}
      <aside className="w-[240px] shrink-0 bg-white border-r border-slate-100 hidden md:flex flex-col justify-between shadow-sm">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-50">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center shadow-md shadow-orange-100 shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[17px] font-bold text-slate-800">
              Register<span className="text-[#f97316]">Karo</span>
            </span>
          </div>

          {/* Navigation */}
          <nav className="p-3 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                    isActive
                      ? "bg-[#fff7ed] text-[#f97316] border-l-4 border-[#f97316]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 border-l-4 border-transparent"
                  }`}
                >
                  <span className={isActive ? "text-[#f97316]" : "text-slate-400"}>{item.icon}</span>
                  {item.label}
                  {/* Live badge */}
                  {item.id === "live" && liveJobs.length > 0 && (
                    <span className="ml-auto bg-[#f97316] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {liveJobs.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-slate-50/60">
            <div className="h-8 w-8 rounded-xl bg-[#0f172a] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 leading-tight">Operator</p>
              <p className="text-[10px] text-slate-400 font-medium truncate">operator@registerkaro.in</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-100 px-7 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              {activeTab === "dashboard" && "Automation Dashboard"}
              {activeTab === "runs" && "All Runs"}
              {activeTab === "live" && "Live Runs"}
              {activeTab === "metrics" && "Metrics & Analytics"}
              {activeTab === "settings" && "Settings"}
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              {activeTab === "dashboard" && "Monitor ITR credential generation runs in real-time"}
              {activeTab === "runs" && "Browse and search all historical automation runs"}
              {activeTab === "live" && "Runs currently active — submit OTP or cancel runs here"}
              {activeTab === "metrics" && "Performance and success metrics across all runs"}
              {activeTab === "settings" && "Configure automation behaviour and backend settings"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                Promise.all([refreshJobs(), refreshMetrics()])
                  .then(() => showToast("Dashboard refreshed.", "success"))
                  .catch((caught) => {
                    const message = errorMessage(caught, "Could not refresh dashboard.");
                    setError(message);
                    showToast(message, "error");
                  });
              }}
              disabled={jobsLoading || metricsLoading}
              className="h-9 rounded-lg hover:bg-slate-100 flex items-center gap-2 px-3 text-slate-500 transition-colors border border-slate-200 bg-white disabled:opacity-60 disabled:cursor-not-allowed"
              title="Refresh dashboard"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5.5 15A7 7 0 0018 17.5M18.5 9A7 7 0 006 6.5" />
              </svg>
              <span className="text-xs font-bold hidden sm:inline">{jobsLoading || metricsLoading ? "Refreshing" : "Refresh"}</span>
            </button>
            <div className="flex items-center gap-2 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 bg-white cursor-pointer shadow-sm hover:border-slate-300 transition-colors">
              <div className="h-7 w-7 rounded-full bg-[#f97316] flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-orange-100 shrink-0">O</div>
              <span className="text-xs font-bold text-slate-700">Operator</span>
              <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </header>

        {/* ── PAGE CONTENT ── */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Global Error */}
          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
              <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600 font-bold">×</button>
            </div>
          )}

          {/* ══════════════ DASHBOARD TAB ══════════════ */}
          {activeTab === "dashboard" && (
            <div className="space-y-3">
              {/* Metrics Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <MetricCard label="Total Runs" value={metrics?.total ?? 0} trendText={metrics ? `${metrics.total} runs total` : metricsTrend} trendColor="purple" tone="orange" />
                <MetricCard label="Success Rate" value={metrics ? `${(metrics.successRate * 100).toFixed(1)}%` : "—"} trendText={metrics ? `${metrics.completed} completed` : metricsTrend} trendColor="green" tone="green" />
                <MetricCard label="Failed Runs" value={metrics?.failed ?? 0} trendText={metrics ? `${metrics.cancelled} cancelled` : metricsTrend} trendColor="red" tone="red" />
                <MetricCard label="Avg. Duration" value={metrics ? formatDuration(metrics.p50DurationMs) : "—"} trendText={metrics ? `P99: ${formatDuration(metrics.p99DurationMs)}` : metricsTrend} trendColor="purple" tone="yellow" />
                <MetricCard label="Active Runs" value={(metrics?.running ?? 0) + (metrics?.waiting ?? 0)} trendText={metrics ? `${metrics.running} running · ${metrics.waiting} waiting` : metricsTrend} trendColor="purple" tone="purple" />
              </div>

              {/* Top Row: Start + Runs */}
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] gap-3 items-start">
                <div className="rounded-2xl border border-orange-100/70 bg-gradient-to-br from-orange-50/90 via-white to-orange-50/30 p-4 shadow-[0_4px_20px_-2px_rgba(249,115,22,0.03)]">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#f97316]" />
                        <h3 className="text-xs font-black text-orange-850 uppercase tracking-[0.18em]">Start New Run</h3>
                      </div>
                      <p className="text-[11px] text-orange-650/80 font-semibold leading-relaxed max-w-md">
                        Enter PAN to start the real portal identity, CAPTCHA, OTP, password flow.
                      </p>
                    </div>
                    <form onSubmit={handleCreateRun} className="space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_120px] gap-2 items-center">
                        <input
                          value={pan}
                          onChange={(e) => {
                            const nextPan = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
                            setPan(nextPan);
                            setPanError(nextPan && !PAN_REGEX.test(nextPan)
                              ? "Format: 5 letters, 4 digits, 1 letter"
                              : "");
                          }}
                          placeholder="Enter PAN (e.g. ABCDE1234F)"
                          maxLength={10}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-[#f97316] focus:ring-4 focus:ring-orange-500/5 transition-all font-semibold tracking-wider text-slate-700 placeholder-slate-400"
                        />
                        <button type="submit" className="h-10 w-full md:w-auto justify-center bg-[#f97316] text-white text-xs font-bold px-3 rounded-lg flex items-center gap-1.5 hover:bg-[#ea580c] transition-all duration-200 active:scale-95 cursor-pointer shadow-md shadow-orange-100 shrink-0">
                          Start Run
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                      {panError && (
                        <p className="text-[11px] font-bold text-red-600">{panError}</p>
                      )}
                    </form>
                  </div>
                </div>

                <div className="min-w-0">
                  <JobsTable
                    jobs={jobs.slice(0, 1)}
                    total={totalJobs}
                    selectedJobId={selectedJob?.jobId}
                    search={search} phaseFilter={phaseFilter} statusFilter={statusFilter}
                    onSearchChange={setSearch} onPhaseChange={handlePhaseChange}
                    onStatusChange={handleStatusChange} onRefresh={refreshJobs}
                    loading={jobsLoading}
                    onSelect={(id) => { setSelectedJobId(id); setActiveTab("live"); }}
                    onDelete={handleDeleteRun}
                    compact
                    elevated
                  />
                </div>
              </div>

              {/* Bottom Row: Progress + Live Events */}
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] gap-3 items-start">
                <div className="min-w-0 xl:sticky xl:top-6 self-start">
                  <RunDetails
                    job={selectedJob} events={events} otp={otp} error={error}
                    autoScroll={autoScroll}
                    onOtpChange={setOtp}
                    onSubmitOtp={handleSubmitOtp}
                    onContinueCaptcha={handleContinueCaptcha}
                    continueBusy={continueBusy}
                    onCancel={handleCancelRun}
                    onAutoScrollChange={setAutoScroll}
                    showEventConsole={false}
                  />
                </div>
                <div className="min-w-0 w-full xl:sticky xl:top-6 self-start">
                  <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Events</p>
                        <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                          SSE stream for CAPTCHA, OTP, and password updates
                        </p>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        streamState === "connected"
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : streamState === "connecting"
                          ? "text-blue-700 bg-blue-50 border-blue-200"
                          : streamState === "disconnected"
                          ? "text-amber-700 bg-amber-50 border-amber-200"
                          : streamState === "error"
                          ? "text-red-700 bg-red-50 border-red-200"
                          : "text-slate-500 bg-slate-50 border-slate-200"
                      }`}>
                        {streamState === "connected"
                          ? "Connected"
                          : streamState === "connecting"
                          ? "Connecting"
                          : streamState === "disconnected"
                          ? "Reconnecting"
                          : streamState === "error"
                          ? "Error"
                          : "SSE ready"}
                      </span>
                    </div>
                    <LiveEventConsole
                      events={events}
                      autoScroll={autoScroll}
                      isLive={Boolean(selectedJob && (selectedJob.status === "running" || selectedJob.status === "waiting_for_operator"))}
                      streamState={streamState}
                      heightClass="h-[420px]"
                      className="rounded-none border-0 shadow-none"
                      onAutoScrollChange={setAutoScroll}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ RUNS TAB ══════════════ */}
          {activeTab === "runs" && (
            <div className="space-y-5">
              <JobsTable
                jobs={jobs}
                total={totalJobs}
                selectedJobId={selectedJob?.jobId}
                search={search} phaseFilter={phaseFilter} statusFilter={statusFilter}
                onSearchChange={setSearch} onPhaseChange={handlePhaseChange}
                onStatusChange={handleStatusChange} onRefresh={refreshJobs}
                loading={jobsLoading}
                onSelect={(id) => { setSelectedJobId(id); setActiveTab("live"); }}
                onDelete={handleDeleteRun}
              />
            </div>
          )}

          {/* ══════════════ LIVE RUNS TAB ══════════════ */}
          {activeTab === "live" && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(340px,0.82fr)_minmax(0,1.18fr)] gap-6 items-start">
              {/* Left: active jobs list + event stream */}
              <div className="space-y-4">
                <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Live Runs</h2>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{liveJobs.length} run{liveJobs.length !== 1 ? "s" : ""} currently active</p>
                    </div>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      LIVE
                    </span>
                  </div>
                  {liveJobs.length === 0 ? (
                    <div className="px-5 py-16 flex flex-col items-center gap-3 text-slate-400">
                      <svg className="w-10 h-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      <span className="text-xs font-semibold text-slate-500">No live runs right now</span>
                      <button onClick={() => setActiveTab("dashboard")} className="text-xs font-bold text-[#f97316] hover:underline cursor-pointer">← Start a new run</button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {liveJobs.map((job) => (
                        <div
                          key={job.jobId}
                          onClick={() => setSelectedJobId(job.jobId)}
                          className={`px-5 py-4 flex items-center justify-between cursor-pointer transition-colors ${selectedJob?.jobId === job.jobId ? "bg-orange-50/30" : "hover:bg-slate-50"}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316] animate-pulse shrink-0 shadow-sm shadow-orange-200" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800">#{job.jobId.slice(0, 8)}</p>
                              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{job.maskedPan} · {job.phase}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {job.phase === "WAITING_FOR_OTP" && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">OTP Needed</span>
                            )}
                            {job.phase === "CAPTCHA_REQUIRED" && job.status === "waiting_for_operator" && (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">CAPTCHA</span>
                            )}
                            {job.status === "waiting_for_operator" && job.phase !== "WAITING_FOR_OTP" && job.phase !== "CAPTCHA_REQUIRED" && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">Action Needed</span>
                            )}
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* All completed runs at bottom */}
                {jobs.filter(j => j.status === "completed").length > 0 && (
                  <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100">
                      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Recently Completed</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {jobs.filter(j => j.status === "completed").slice(0, 5).map((job) => (
                        <div key={job.jobId} onClick={() => setSelectedJobId(job.jobId)}
                          className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-slate-700">#{job.jobId.slice(0, 8)}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{job.maskedPan}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">DONE</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Run Details Console */}
              <div className="min-w-0 w-full space-y-4 xl:sticky xl:top-6">
                <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Events</p>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                        SSE stream for CAPTCHA, OTP, and password updates
                      </p>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                      streamState === "connected"
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : streamState === "connecting"
                        ? "text-blue-700 bg-blue-50 border-blue-200"
                        : streamState === "disconnected"
                        ? "text-amber-700 bg-amber-50 border-amber-200"
                        : streamState === "error"
                        ? "text-red-700 bg-red-50 border-red-200"
                        : "text-slate-500 bg-slate-50 border-slate-200"
                    }`}>
                      {streamState === "connected"
                        ? "Connected"
                        : streamState === "connecting"
                        ? "Connecting"
                        : streamState === "disconnected"
                        ? "Reconnecting"
                        : streamState === "error"
                        ? "Error"
                        : "SSE ready"}
                    </span>
                  </div>
                  <LiveEventConsole
                    events={events}
                    autoScroll={autoScroll}
                    isLive={Boolean(selectedJob && (selectedJob.status === "running" || selectedJob.status === "waiting_for_operator"))}
                    streamState={streamState}
                    heightClass="h-[420px]"
                    className="rounded-none border-0 shadow-none"
                    onAutoScrollChange={setAutoScroll}
                  />
                </div>

                <RunDetails
                  job={selectedJob} events={events} otp={otp} error={error}
                  autoScroll={autoScroll}
                  streamState={streamState}
                  onOtpChange={setOtp}
                  onSubmitOtp={handleSubmitOtp}
                  onContinueCaptcha={handleContinueCaptcha}
                  continueBusy={continueBusy}
                  onCancel={handleCancelRun}
                  onAutoScrollChange={setAutoScroll}
                  showEventConsole={false}
                />
              </div>
            </div>
          )}

          {/* ══════════════ METRICS TAB ══════════════ */}
          {activeTab === "metrics" && (
            <div className="space-y-6">
              {/* Top metrics cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total Runs" value={metrics?.total ?? 0} trendText={metrics ? `${metrics.total} total` : metricsTrend} trendColor="purple" tone="orange" />
                <MetricCard label="Completed" value={metrics?.completed ?? 0} trendText={metrics ? `${(metrics.successRate * 100).toFixed(1)}% success rate` : metricsTrend} trendColor="green" tone="green" />
                <MetricCard label="Failed" value={metrics?.failed ?? 0} trendText={metrics ? `out of ${metrics.total} runs` : metricsTrend} trendColor="red" tone="red" />
                <MetricCard label="Cancelled" value={metrics?.cancelled ?? 0} trendText={metrics ? `out of ${metrics.total} runs` : metricsTrend} trendColor="purple" tone="purple" />
              </div>

              {/* Performance Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-5">Performance Percentiles</h3>
                  <div className="space-y-4">
                    {[
                      { label: "P50 Duration (Median)", value: metrics?.p50DurationMs ?? 0, color: "bg-emerald-500" },
                      { label: "P99 Duration (Worst 1%)", value: metrics?.p99DurationMs ?? 0, color: "bg-red-500" },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-semibold text-slate-600">{stat.label}</span>
                          <span className="text-xs font-bold text-slate-800">{formatDuration(stat.value)}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${stat.color} rounded-full transition-all duration-700`}
                            style={{ width: `${Math.min(100, (stat.value / Math.max(1, (metrics?.p99DurationMs ?? 1))) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-5">Run Status Breakdown</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Running", value: metrics?.running ?? 0, total: metrics?.total ?? 1, color: "bg-blue-500", text: "text-blue-700" },
                      { label: "Waiting (OTP)", value: metrics?.waiting ?? 0, total: metrics?.total ?? 1, color: "bg-amber-500", text: "text-amber-700" },
                      { label: "Completed", value: metrics?.completed ?? 0, total: metrics?.total ?? 1, color: "bg-emerald-500", text: "text-emerald-700" },
                      { label: "Failed", value: metrics?.failed ?? 0, total: metrics?.total ?? 1, color: "bg-red-500", text: "text-red-700" },
                      { label: "Cancelled", value: metrics?.cancelled ?? 0, total: metrics?.total ?? 1, color: "bg-slate-400", text: "text-slate-600" },
                    ].map((row) => {
                      const pct = metrics?.total ? Math.round((row.value / metrics.total) * 100) : 0;
                      return (
                        <div key={row.label} className="flex items-center gap-3">
                          <span className={`text-xs font-semibold w-28 shrink-0 ${row.text}`}>{row.label}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${row.color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-700 w-10 text-right">{row.value}</span>
                          <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Success rate callout */}
              <div className="bg-gradient-to-r from-[#fff7ed] to-[#fef3c7] border border-[#ffedd5] rounded-xl p-6 flex items-center gap-6">
                <div className="h-16 w-16 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-orange-100">
                  <svg className="w-8 h-8 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#9a3412]">Overall Success Rate</p>
                  <p className="text-3xl font-black text-[#f97316] mt-1">{metrics ? `${(metrics.successRate * 100).toFixed(1)}%` : "—"}</p>
                  <p className="text-xs text-[#c2410c] font-semibold mt-1">{metrics?.completed ?? 0} successful out of {metrics?.total ?? 0} total runs</p>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ SETTINGS TAB ══════════════ */}
          {activeTab === "settings" && (
            <div className="max-w-2xl space-y-5">
              {/* API Config */}
              <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/40">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Backend Configuration</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Connection settings for the automation backend</p>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">API Base URL</label>
                    <div className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 flex items-center text-xs font-mono text-slate-600 select-all">
                      {API_BASE}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Auth Token</label>
                    <div className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 flex items-center text-xs font-mono text-slate-400">
                      {process.env.NEXT_PUBLIC_AUTH_TOKEN ? "••••••••••••••••" : "Not configured"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Automation Info */}
              <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/40">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Automation</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Configure via backend <code className="bg-slate-100 px-1 rounded text-[10px]">.env</code></p>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    {
                      key: "PLAYWRIGHT_HEADLESS",
                      val: "false",
                      desc: "Playwright drives Chromium against the live portal. Keep false for CAPTCHA or portal-side challenge visibility; OTP comes from the dashboard.",
                      badge: "ACTIVE",
                      badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
                    },
                  ].map((item) => (
                    <div key={item.key} className="rounded-lg border border-slate-100 p-3.5">
                      <div className="flex items-center justify-between mb-1">
                        <code className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{item.key}={item.val}</code>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${item.badgeColor}`}>{item.badge}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Portal URL */}
              <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/40">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Target Portal</h3>
                </div>
                <div className="p-5">
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3.5 flex items-start gap-3">
                    <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div>
                      <p className="text-xs font-bold text-blue-800">Income Tax e-Filing Credential Recovery</p>
                      <a href="https://www.incometax.gov.in/iec/foportal/" target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 font-mono hover:underline break-all">
                        https://www.incometax.gov.in/iec/foportal/
                      </a>
                      <p className="text-[10px] text-blue-600/70 font-medium mt-1">Playwright opens the real portal and uses the Forgot Password flow for already registered PANs</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Important Note */}
              <div className="bg-[#fffbeb] border border-[#fef08a] rounded-xl p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-[#854d0e] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <div>
                  <p className="text-xs font-bold text-[#854d0e] mb-1">Real OTP Requirement</p>
                  <p className="text-[11px] text-[#a16207] leading-relaxed font-medium">
                    A real OTP from the Income Tax portal will only arrive on the <strong>mobile number or email registered against the PAN</strong> being used. Without access to that contact, the OTP cannot be received regardless of the automation setup.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

function statusFromEvent(event: JobEvent) {
  if (event.phase === "COMPLETED") return "completed";
  if (event.phase === "FAILED") return "failed";
  if (event.phase === "CANCELLED") return "cancelled";
  if (event.phase === "WAITING_FOR_OTP") return "waiting_for_operator";
  if (
    event.phase === "CAPTCHA_REQUIRED" &&
    (event.step === "captcha_manual_required" || event.step === "captcha_waiting")
  ) {
    return "waiting_for_operator";
  }
  return "running";
}

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}
