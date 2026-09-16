"use client";

export type AlertRow = {
  id: number;
  kind: string;
  message: string;
  notified: boolean;
  notify_error: string | null;
  created_at: string;
};

const KIND_STYLE: Record<string, { icon: string; className: string; label: string }> = {
  high: { icon: "▲", className: "text-red-700", label: "สูงเกินเกณฑ์" },
  low: { icon: "▼", className: "text-blue-700", label: "ต่ำกว่าเกณฑ์" },
  recovered: { icon: "✓", className: "text-green-800", label: "กลับสู่ปกติ" },
  offline: { icon: "⚠", className: "text-amber-700", label: "ขาดการติดต่อ" },
  online: { icon: "✓", className: "text-green-800", label: "กลับมาออนไลน์" },
};

export default function AlertsPanel({ alerts }: { alerts: AlertRow[] }) {
  if (alerts.length === 0) {
    return (
      <p className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-400">
        ยังไม่มีการแจ้งเตือน
      </p>
    );
  }

  return (
    <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
      {alerts.map((a) => {
        const style = KIND_STYLE[a.kind] ?? { icon: "•", className: "text-slate-600", label: a.kind };
        return (
          <li key={a.id} className="p-3 flex items-start gap-3 text-sm">
            <span className={`${style.className} mt-0.5`} aria-hidden>
              {style.icon}
            </span>
            <div className="flex-1">
              <p className="text-slate-700">
                <span className={`${style.className} font-medium`}>{style.label}</span> — {a.message}
              </p>
              <p className="text-xs text-slate-400">
                {new Date(a.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
                {!a.notified && (
                  <span className="text-amber-700 ml-2">
                    ส่ง LINE ไม่สำเร็จ{a.notify_error ? `: ${a.notify_error}` : ""}
                  </span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
