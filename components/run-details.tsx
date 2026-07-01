"use client";
import React, { useEffect, useRef } from "react";
import type { Job, JobEvent } from "@/lib/types";

const DEFAULT_PHASES = [
  { key: "STARTED",            label: "Started" },
  { key: "OPEN_PORTAL",        label: "Open Portal" },
  { key: "IDENTITY",           label: "Identity" },
  { key: "CAPTCHA_REQUIRED",   label: "CAPTCHA" },
  { key: "CAPTCHA_SOLVED",     label: "CAPTCHA Solved" },
  { key: "OTP_REQUIRED",       label: "OTP Required" },
  { key: "WAITING_FOR_OTP",    label: "Awaiting OTP" },
  { key: "OTP_VERIFIED",       label: "OTP Verified" },
  { key: "PASSWORD_GENERATED", label: "Password Set" },
  { key: "COMPLETED",          label: "Success" }
];

const TERMINAL_PHASES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

function getPhaseIndex(phasesList: typeof DEFAULT_PHASES, currentPhase: string) {
  if (currentPhase === "FAILED" || currentPhase === "CANCELLED") return -1;
  return phasesList.findIndex((p) => p.key === currentPhase);
}

function getPhaseDescription(phase: string) {
  const descs: Record<string, string> = {
    STARTED: "Initializing automation runner...",
    OPEN_PORTAL: "Loading Income Tax Portal pages...",
    IDENTITY: "Entering PAN and continuing on the portal...",
    CAPTCHA_REQUIRED: "Waiting for CAPTCHA resolution...",
    CAPTCHA_SOLVED: "CAPTCHA or portal challenge is cleared...",
    OTP_REQUIRED: "OTP requested from portal...",
    WAITING_FOR_OTP: "Awaiting OTP submission from dashboard...",
    OTP_VERIFIED: "OTP validated successfully...",
    PASSWORD_GENERATED: "Setting strong password on portal...",
    COMPLETED: "Successfully saved credentials!",
  };
  return descs[phase] || "";
}

export function RunDetails({
  job,
  events,
  otp,
  error,
  autoScroll = true,
  streamState = "idle",
  onOtpChange,
  onSubmitOtp,
  onContinueCaptcha,
  onCancel,
  continueBusy = false,
  onAutoScrollChange,
  showEventConsole = true,
}: {
  job?: Job;
  events: JobEvent[];
  otp: string;
  error: string;
  autoScroll?: boolean;
  streamState?: "idle" | "connecting" | "connected" | "disconnected" | "error";
  onOtpChange: (v: string) => void;
  onSubmitOtp: () => void;
  onContinueCaptcha: () => void;
  onCancel: () => void;
  continueBusy?: boolean;
  onAutoScrollChange: (v: boolean) => void;
  showEventConsole?: boolean;
}) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  });

  if (!job) {
    return (
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm flex flex-col items-center justify-center h-80 text-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-500">No run selected</p>
          <p className="text-xs text-slate-400 font-medium mt-1">Start a new run or click a row to view details</p>
        </div>
      </div>
    );
  }

  const phasesToShow = DEFAULT_PHASES;

  const currentIdx = getPhaseIndex(phasesToShow, job.phase);
  const isTerminal = TERMINAL_PHASES.has(job.phase);
  const isRunning = !isTerminal && job.status !== "completed" && job.status !== "failed" && job.status !== "cancelled";
  const isFailed = job.phase === "FAILED" || job.phase === "CANCELLED";
  const isCompleted = job.phase === "COMPLETED";
  const isCaptcha = job.phase === "CAPTCHA_REQUIRED";
  const latestCaptchaEvent = [...events].reverse().find((event) => event.phase === "CAPTCHA_REQUIRED");
  const captchaStep = latestCaptchaEvent?.step;
  const latestOtpEvent = [...events].reverse().find(
    (event) =>
      event.phase === "WAITING_FOR_OTP" ||
      event.step === "otp_required" ||
      event.step === "wrong_otp" ||
      event.step === "otp_supplied",
  );
  const needsManualBrowserAction = isCaptcha && isRunning;
  const captchaHint =
    captchaStep === "captcha_manual_required"
      ? "CAPTCHA detected in the Playwright browser window."
      : "Open the Playwright browser, solve CAPTCHA on the recovery form, then click Continue below.";
  const isWaitingOtp =
    job.phase === "OTP_REQUIRED" ||
    job.phase === "WAITING_FOR_OTP" ||
    latestOtpEvent?.step === "wrong_otp" ||
    latestOtpEvent?.step === "otp_required";
  const otpHint =
    latestOtpEvent?.step === "wrong_otp"
      ? "Portal rejected the last OTP. Enter a fresh 6-digit OTP from your phone/email."
      : job.phase === "OTP_REQUIRED"
        ? "OTP should arrive on your registered mobile/email. Enter it here — bot will fill the portal form."
        : "Enter the 6-digit OTP here. Do not type OTP in the Playwright browser window.";
  const showOperatorGuide = isRunning && (needsManualBrowserAction || isWaitingOtp);
  const splitConsoleLayout = showEventConsole;

  const detailContent = (
    <>
      {/* Header */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">#{job.jobId.slice(0, 8).toUpperCase()}</span>
            <span className="text-[10px] font-bold text-slate-400">·</span>
            <span className="text-xs font-bold text-slate-500">{job.maskedPan}</span>
            {isRunning && !isCaptcha && !isWaitingOtp && (
              <span className="flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                RUNNING
              </span>
            )}
            {needsManualBrowserAction && (
              <span className="flex items-center gap-1 text-[9px] font-black text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                CAPTCHA
              </span>
            )}
            {isWaitingOtp && (
              <span className="flex items-center gap-1 text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                AWAITING OTP
              </span>
            )}
            {isCompleted && (
              <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✓ DONE</span>
            )}
            {isFailed && (
              <span className="text-[9px] font-black text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">✕ {job.phase}</span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            Started {new Date(job.startedAt).toLocaleTimeString()}
            {job.durationMs ? ` · ${Math.round(job.durationMs / 1000)}s` : ""}
          </p>
        </div>
        {isRunning && (
          <button
            onClick={onCancel}
            className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
          >
            Cancel Run
          </button>
        )}
      </div>

      {/* Phase Stepper */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Progress</p>
        <div className="space-y-0">
          {phasesToShow.map((phase, idx) => {
            const done = currentIdx >= 0 && idx < currentIdx;
            const active = currentIdx === idx;
            const last = idx === phasesToShow.length - 1;
            return (
              <div key={phase.key} className="flex items-start gap-2.5">
                <div className="flex flex-col items-center">
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isCompleted && idx === phasesToShow.length - 1
                      ? "bg-emerald-500 border-emerald-500"
                      : isFailed && active
                      ? "bg-red-500 border-red-500"
                      : done || (isCompleted)
                      ? "bg-emerald-500 border-emerald-500"
                      : active
                      ? "bg-[#f97316] border-[#f97316]"
                      : "bg-white border-slate-200"
                  }`}>
                    {(done || isCompleted) ? (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : active && !isFailed ? (
                      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    ) : isFailed && active ? (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : null}
                  </div>
                  {!last && <div className={`w-0.5 h-4 mt-0.5 ${ done || isCompleted ? "bg-emerald-300" : active ? "bg-orange-200" : "bg-slate-100" }`} />}
                </div>
                <div className="pb-4 flex-1">
                  <p className={`text-[11px] font-extrabold leading-tight ${
                    (done || isCompleted) ? "text-emerald-600" : active && !isFailed ? "text-[#f97316]" : isFailed && active ? "text-red-600" : "text-slate-400"
                  }`}>{phase.label}</p>
                  {active && !isFailed && !isCompleted && (
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-normal animate-pulse">
                      {getPhaseDescription(phase.key)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showOperatorGuide && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Operator steps</p>
          <ol className="text-[11px] text-slate-700 font-medium space-y-1.5 list-decimal list-inside">
            <li className={needsManualBrowserAction ? "text-[#f97316] font-bold" : "text-slate-400"}>
              Solve CAPTCHA in the Playwright browser → click Continue below
            </li>
            <li className={isWaitingOtp ? "text-[#f97316] font-bold" : "text-slate-400"}>
              When OTP arrives on phone/email → enter it here (not in browser)
            </li>
            <li className="text-slate-400">Bot fills password on portal and saves encrypted credentials</li>
          </ol>
        </div>
      )}

      {/* CAPTCHA instruction */}
      {needsManualBrowserAction && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">🖥️</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-900 mb-1">CAPTCHA Step — {captchaHint}</p>
              <ol className="text-[11px] text-amber-800 font-medium space-y-1 list-decimal list-inside">
                <li>Playwright browser window is on the recovery form</li>
                <li>Solve only the CAPTCHA / security challenge in that window</li>
                <li>Do not enter OTP in the browser — OTP comes from this dashboard</li>
                <li>Click Continue below once CAPTCHA is solved</li>
                <li>Bot will auto-submit the form and request OTP</li>
              </ol>
              <button
                onClick={onContinueCaptcha}
                disabled={continueBusy}
                className="mt-3 h-10 bg-[#f97316] text-white text-xs font-bold px-5 rounded-lg hover:bg-[#ea580c] active:scale-95 transition-all cursor-pointer shadow-md shadow-orange-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {continueBusy ? "Continue sent…" : "Continue Automation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP Input */}
      {isWaitingOtp && (
        <div className="bg-white border-2 border-[#f97316]/30 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Enter OTP in dashboard</p>
              <p className="text-[10px] text-slate-500 font-medium">{otpHint}</p>
            </div>
          </div>
          {error && (
            <p className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-2">{error}</p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="● ● ● ● ● ●"
              className="flex-1 h-11 rounded-lg border-2 border-slate-200 focus:border-[#f97316] focus:ring-4 focus:ring-orange-500/10 px-4 text-center text-xl font-black tracking-[0.4em] text-slate-800 outline-none transition-all bg-slate-50"
              onKeyDown={(e) => { if (e.key === "Enter" && otp.length === 6) onSubmitOtp(); }}
            />
            <button
              onClick={onSubmitOtp}
              disabled={otp.length !== 6}
              className="h-11 bg-[#f97316] text-white text-xs font-bold px-5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#ea580c] active:scale-95 transition-all cursor-pointer shadow-md shadow-orange-100 shrink-0"
            >
              Submit OTP
            </button>
          </div>
        </div>
      )}

      {/* Success credentials */}
      {isCompleted && job.result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-xs font-bold text-emerald-800">Credentials Generated Successfully</p>
          </div>
          <div className="space-y-2">
            <div className="bg-white rounded-lg border border-emerald-100 px-3 py-2 flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">User ID (PAN)</span>
              <span className="text-xs font-black font-mono text-slate-800 break-all text-right">{job.result.userId || job.maskedPan}</span>
            </div>
            <div className="bg-white rounded-lg border border-emerald-100 px-3 py-2 flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Password</span>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-black font-mono text-slate-800 break-all text-right">
                  {job.result.password || (job.result.passwordSaved ? "[saved — refresh run]" : "[not saved]")}
                </span>
                {job.result.password && (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(job.result?.password || "").catch(() => {})}
                    className="text-[10px] font-bold text-[#f97316] hover:underline shrink-0 cursor-pointer"
                  >
                    Copy
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-emerald-700 font-medium mt-2">
            Bot set this password on the portal reset screen. Stored encrypted in MongoDB; shown here for the operator after success.
          </p>
        </div>
      )}

      {/* Error panel */}
      {isFailed && job.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-bold text-red-800 mb-1">Run Failed: {job.error.code}</p>
          <p className="text-[11px] text-red-700 font-medium">{job.error.message}</p>
        </div>
      )}
    </>
  );

  return (
    <div className={`w-full ${splitConsoleLayout ? "grid gap-4 xl:grid-cols-[minmax(320px,0.76fr)_minmax(0,1.24fr)]" : "space-y-4"}`}>
      <div className="space-y-4 min-w-0">
        {detailContent}
      </div>

      {showEventConsole && (
        <div className="min-w-0 w-full">
          <LiveEventConsole
            events={events}
            autoScroll={autoScroll}
            isLive={isRunning}
            streamState={streamState}
            heightClass="h-[540px]"
            onAutoScrollChange={onAutoScrollChange}
          />
        </div>
      )}
    </div>
  );
}

export function LiveEventConsole({
  events,
  autoScroll,
  isLive,
  streamState = "idle",
  className = "",
  heightClass = "h-60",
  onAutoScrollChange,
}: {
  events: JobEvent[];
  autoScroll: boolean;
  isLive: boolean;
  streamState?: "idle" | "connecting" | "connected" | "disconnected" | "error";
  className?: string;
  heightClass?: string;
  onAutoScrollChange: (v: boolean) => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [autoScroll, events]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0a1018] via-[#0d1117] to-[#111827] shadow-[0_24px_80px_-20px_rgba(15,23,42,0.95)] ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_30%)]" />
      <div className="relative px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3 bg-white/[0.03] backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex gap-1.5 shrink-0">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.45)]" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80 shadow-[0_0_12px_rgba(234,179,8,0.35)]" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500/80 shadow-[0_0_12px_rgba(34,197,94,0.35)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-300">Live Events</p>
            <p className="text-[10px] font-mono text-slate-500">{events.length} event{events.length !== 1 ? "s" : ""} received</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span
            className={`flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-full border backdrop-blur-sm ${
              streamState === "connected"
                ? "text-emerald-300 bg-emerald-500/10 border-emerald-400/20"
                : streamState === "connecting"
                ? "text-sky-300 bg-sky-500/10 border-sky-400/20"
                : streamState === "disconnected"
                ? "text-amber-300 bg-amber-500/10 border-amber-400/20"
                : streamState === "error"
                ? "text-red-300 bg-red-500/10 border-red-400/20"
                : "text-slate-300 bg-slate-500/10 border-slate-400/20"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                streamState === "connected"
                  ? "bg-emerald-300 animate-pulse"
                  : streamState === "connecting"
                  ? "bg-sky-300 animate-pulse"
                  : streamState === "disconnected"
                  ? "bg-amber-300 animate-pulse"
                  : streamState === "error"
                  ? "bg-red-300"
                  : "bg-slate-400"
              }`}
            />
            {streamState === "connected"
              ? "SSE connected"
              : streamState === "connecting"
              ? "Connecting"
              : streamState === "disconnected"
              ? "Reconnecting"
              : streamState === "error"
              ? "Stream error"
              : "SSE ready"}
          </span>
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(event) => onAutoScrollChange(event.target.checked)}
              className="h-3 w-3 accent-[#f97316]"
            />
            Auto-scroll
          </label>
          {isLive && (
            <span className="flex items-center gap-1 text-[9px] font-black text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse shadow-[0_0_10px_rgba(110,231,183,0.4)]" />
              LIVE
            </span>
          )}
        </div>
      </div>
      <div ref={logRef} className={`relative ${heightClass} overflow-y-auto p-4 space-y-2 font-mono text-[11px] scrollbar-thin`}>
        <div className="mb-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[10px] text-slate-300 shadow-inner shadow-black/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="font-bold uppercase tracking-[0.18em] text-[9px] text-slate-400">No refresh needed</span>
          </div>
          Live updates arrive over SSE, so OTP and CAPTCHA state changes appear instantly.
        </div>
        {events.length === 0 ? (
          <div className="h-full min-h-40 flex flex-col items-center justify-center text-slate-500 gap-2">
            <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
            </div>
            <p className="text-xs font-semibold">Waiting for events...</p>
            <p className="text-[10px] text-slate-600 text-center max-w-[220px]">
              The Playwright run will stream each step here as soon as the backend emits it.
            </p>
          </div>
        ) : (
          events.map((ev) => (
            <div
              key={ev.eventId}
              className="grid grid-cols-[64px_42px_1fr] gap-2 items-start leading-relaxed rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
            >
              <span className="text-slate-500 shrink-0">{new Date(ev.timestamp).toLocaleTimeString([], { hour12: false })}</span>
              <span className={`shrink-0 text-center font-bold uppercase text-[9px] px-1 rounded ${
                ev.level === "error" ? "bg-red-500/15 text-red-300 border border-red-500/15" :
                ev.level === "warn"  ? "bg-amber-500/15 text-amber-300 border border-amber-500/15" :
                "bg-sky-500/15 text-sky-300 border border-sky-500/15"
              }`}>{ev.level}</span>
              <span className="text-slate-200 whitespace-pre-wrap break-words">{ev.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
