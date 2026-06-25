import React from "react";

type MetricTone = "orange" | "green" | "red" | "yellow" | "purple";

export function MetricCard({
  label,
  value,
  trendText,
  trendColor = "green",
  tone = "orange",
}: {
  label: string;
  value: number | string;
  trendText?: string;
  trendColor?: "green" | "red" | "purple";
  tone?: MetricTone;
}) {
  const tones = {
    orange: {
      bg: "bg-gradient-to-br from-[#fff7ed] to-[#ffedd5] border-[#ffedd5]",
      text: "text-[#ea580c]",
      cardBg: "from-white to-[#fff7ed]/30",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5h11M9 12h11M9 19h11M5 5h.01M5 12h.01M5 19h.01" />
        </svg>
      )
    },
    green: {
      bg: "bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] border-[#dcfce7]",
      text: "text-[#16a34a]",
      cardBg: "from-white to-[#f0fdf4]/30",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      )
    },
    red: {
      bg: "bg-gradient-to-br from-[#fef2f2] to-[#fee2e2] border-[#fee2e2]",
      text: "text-[#dc2626]",
      cardBg: "from-white to-[#fef2f2]/30",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    },
    yellow: {
      bg: "bg-gradient-to-br from-[#fefce8] to-[#fef9c3] border-[#fef9c3]",
      text: "text-[#ca8a04]",
      cardBg: "from-white to-[#fefce8]/30",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    purple: {
      bg: "bg-gradient-to-br from-[#faf5ff] to-[#f3e8ff] border-[#f3e8ff]",
      text: "text-[#9333ea]",
      cardBg: "from-white to-[#faf5ff]/30",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4.5 12h2.5l2-5 3 10 2.5-7 1.5 2h3.5" />
        </svg>
      )
    }
  };

  const selectedTone = tones[tone];

  const trendColors = {
    green: "text-[#16a34a] bg-[#f0fdf4] border-[#dcfce7]",
    red: "text-[#dc2626] bg-[#fef2f2] border-[#fee2e2]",
    purple: "text-[#9333ea] bg-[#faf5ff] border-[#f3e8ff]",
  };

  return (
    <div className={`bg-gradient-to-br ${selectedTone.cardBg} rounded-2xl border border-slate-100/80 p-5 flex items-center gap-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.01),0_4px_16px_0_rgba(0,0,0,0.01)] hover:-translate-y-1 hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.04)] hover:border-slate-200/50 transition-all duration-300 group`}>
      {/* Icon Circle */}
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center border ${selectedTone.bg} ${selectedTone.text} shrink-0 group-hover:scale-105 transition-transform duration-300`}>
        {selectedTone.icon}
      </div>

      {/* Label, Value, Trend */}
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
        <span className="text-2xl font-extrabold text-slate-800 tracking-tight mt-0.5">{value}</span>
        {trendText && (
          <div className="mt-1 flex">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none ${trendColors[trendColor]}`}>
              {trendText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
