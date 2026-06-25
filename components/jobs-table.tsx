import { RUN_PHASES } from "@/lib/constants";
import type { Job } from "@/lib/types";
import { StatusBadge } from "./status-badge";

export function JobsTable({
  jobs,
  total,
  selectedJobId,
  search,
  phaseFilter,
  statusFilter,
  onSearchChange,
  onPhaseChange,
  onStatusChange,
  onRefresh,
  onSelect,
  onDelete,
  loading = false,
}: {
  jobs: Job[];
  total?: number;
  selectedJobId?: string;
  search: string;
  phaseFilter: string;
  statusFilter: string;
  onSearchChange: (value: string) => void;
  onPhaseChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onRefresh: () => void;
  onSelect: (jobId: string) => void;
  onDelete: (job: Job) => void;
  loading?: boolean;
}) {
  const realTotal = total ?? jobs.length;
  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.02),0_4px_12px_0_rgba(0,0,0,0.01)] overflow-hidden transition-all duration-300">
      {/* Table Header and Filters */}
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between bg-white">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">All Runs</h2>
          {loading && <p className="text-[11px] font-semibold text-orange-500 mt-1">Refreshing runs...</p>}
        </div>
        
        {/* Filters Panel matching mockup */}
        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              onBlur={onRefresh}
              placeholder="Search PAN..."
              className="h-8.5 rounded-lg border border-slate-200 bg-white pl-3 pr-7 text-xs text-slate-600 outline-none focus:border-[#f97316] focus:ring-4 focus:ring-orange-500/5 transition-all placeholder-slate-400 font-medium"
            />
            {search && (
              <button 
                onClick={() => { onSearchChange(""); setTimeout(onRefresh, 0); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white cursor-pointer select-none hover:border-slate-350 transition-colors">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <select
              value={statusFilter}
              onChange={(event) => onStatusChange(event.target.value)}
              className="bg-transparent text-xs text-slate-600 outline-none cursor-pointer font-semibold pr-1"
            >
              <option value="">All Status</option>
              <option value="running">Running</option>
              <option value="waiting_for_operator">Waiting</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white cursor-pointer select-none hover:border-slate-350 transition-colors">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <select
              value={phaseFilter}
              onChange={(event) => onPhaseChange(event.target.value)}
              className="bg-transparent text-xs text-slate-600 outline-none cursor-pointer font-semibold pr-1"
            >
              <option value="">All Time</option>
              {RUN_PHASES.map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:border-[#f97316] hover:text-[#f97316] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            title="Refresh runs"
          >
            {loading ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Table Data */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <th className="px-6 py-3.5 font-bold">Job ID</th>
              <th className="px-6 py-3.5 font-bold">PAN</th>
              <th className="px-6 py-3.5 font-bold">Current Phase</th>
              <th className="px-6 py-3.5 font-bold">Status</th>
              <th className="px-6 py-3.5 font-bold">Started At</th>
              <th className="px-6 py-3.5 font-bold">Duration</th>
              <th className="px-6 py-3.5 font-bold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((job) => {
              const isSelected = selectedJobId === job.jobId;
              
              // Format phase badge
              let phaseBadgeClass = "bg-slate-50 text-slate-600 border border-slate-150";
              const phase = job.phase || "STARTED";
              if (phase === "OTP_WAITING" || phase === "WAITING_FOR_OTP") {
                phaseBadgeClass = "bg-[#fff7ed] text-[#ea580c] border border-[#ffedd5]";
              } else if (phase === "COMPLETED") {
                phaseBadgeClass = "bg-[#f0fdf4] text-[#16a34a] border border-[#dcfce7]";
              } else if (phase === "FAILED" || phase === "CANCELLED") {
                phaseBadgeClass = "bg-[#fef2f2] text-[#dc2626] border border-[#fee2e2]";
              } else if (phase === "PASSWORD_GENERATED" || phase === "PASSWORD_GEN") {
                phaseBadgeClass = "bg-[#eff6ff] text-[#2563eb] border border-[#dbeafe]";
              } else if (phase === "CAPTCHA_REQUIRED") {
                phaseBadgeClass = "bg-[#fdf2f8] text-[#db2777] border border-[#fce7f3]";
              } else if (phase === "STARTED" || phase === "OPEN_PORTAL" || phase === "IDENTITY") {
                phaseBadgeClass = "bg-[#f0f9ff] text-[#0284c7] border border-[#e0f2fe]";
              }

              return (
                <tr
                  key={job.jobId}
                  onClick={() => onSelect(job.jobId)}
                  className={`cursor-pointer transition-all duration-200 text-slate-700 text-xs ${
                    isSelected 
                      ? "bg-gradient-to-r from-[#fff7ed]/40 to-white" 
                      : "hover:bg-slate-50/40"
                  }`}
                >
                  <td className="px-6 py-4 font-semibold text-slate-500">
                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <span className="h-2 w-2 rounded-full bg-[#f97316] shadow-[0_0_8px_#f97316] animate-pulse shrink-0" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-slate-200 shrink-0" />
                      )}
                      #{job.jobId.slice(0, 8)}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800 tracking-wide">{job.maskedPan}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${phaseBadgeClass}`}>
                      {phase}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-semibold">{formatStartedAt(job.startedAt)}</td>
                  <td className="px-6 py-4 font-bold text-slate-700">{formatDurationMMSS(job.durationMs)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(job.jobId);
                        }}
                        className="border border-[#f97316] text-[#f97316] text-xs font-bold px-3 py-1 rounded-lg hover:bg-[#f97316] hover:text-white transition-all duration-200 active:scale-95 cursor-pointer shadow-sm shadow-orange-100"
                      >
                        View
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(job);
                        }}
                        disabled={!["completed", "failed", "cancelled"].includes(job.status)}
                        className="border border-red-200 text-red-500 text-xs font-bold px-3 py-1 rounded-lg hover:bg-red-500 hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-red-500 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 cursor-pointer shadow-sm shadow-red-50"
                        title={["completed", "failed", "cancelled"].includes(job.status) ? "Delete run" : "Cancel active run before deleting"}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <svg className="w-10 h-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    <span className="font-semibold text-slate-500 text-xs">
                      {loading ? "Loading runs..." : "No runs registered"}
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="border-t border-slate-100 px-6 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white text-xs text-slate-500 font-semibold">
        <div>
          {jobs.length === 0
            ? "No results"
            : `Showing ${jobs.length} of ${realTotal} result${realTotal !== 1 ? "s" : ""}`}
        </div>
        {realTotal > jobs.length && (
          <div className="text-[11px] text-slate-400 font-medium">
            Showing first {jobs.length} — use filters to narrow results
          </div>
        )}
      </div>
    </div>
  );
}

function formatStartedAt(isoString: string) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = months[date.getMonth()];
  const d = date.getDate().toString().padStart(2, "0");
  const time = date.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return `${m} ${d}, ${time}`;
}

function formatDurationMMSS(ms: number) {
  if (!ms || isNaN(ms)) return "00:00";
  const totalSeconds = Math.round(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
