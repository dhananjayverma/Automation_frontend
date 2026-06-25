import React from "react";

export function StatusBadge({ status }: { status: string }) {
  const normStatus = (status || "").toLowerCase();

  let text = "ACTIVE";
  let color = "bg-[#dbeafe]/50 text-[#2563eb] border-[#bfdbfe]/50";

  if (normStatus === "completed" || normStatus === "success") {
    text = "SUCCESS";
    color = "bg-[#d1fae5]/50 text-[#10b981] border-[#a7f3d0]/50";
  } else if (normStatus === "failed" || normStatus === "error" || normStatus === "cancelled") {
    text = normStatus === "cancelled" ? "FAILED" : "FAILED"; // standard failure representation
    color = "bg-[#fee2e2]/50 text-[#ef4444] border-[#fca5a5]/50";
  }

  return (
    <span className={`rounded px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap inline-flex items-center justify-center border ${color}`}>
      {text}
    </span>
  );
}
