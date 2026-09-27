/**
 * หน้ารอระหว่างเปลี่ยนหน้าใน /dashboard
 * กดเมนูแล้วเปลี่ยนมาหน้านี้ทันที (แถบด้านบนยังอยู่) แทนการค้างหน้าเดิมจนข้อมูลหน้าใหม่มาครบ
 */
export default function Loading() {
  return (
    <div className="px-4 sm:px-6 py-8 sm:py-10" aria-busy="true">
      <div className="max-w-5xl mx-auto space-y-4">
        <p className="flex items-center gap-2.5 text-sm text-slate-500" role="status">
          <svg viewBox="0 0 24 24" className="size-5 text-trace-cyan route-glow" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path className="signal-pulse" strokeLinecap="round" d="M2 12h5l2-5 3 10 2-5h8" />
            <path className="opacity-25" strokeLinecap="round" d="M2 12h5l2-5 3 10 2-5h8" />
          </svg>
          กำลังโหลด...
        </p>
        <div className="h-10 w-2/3 max-w-sm rounded-sm bg-slate-200/60" />
        <div className="h-28 rounded-sm border-2 border-slate-200 bg-white" />
        <div className="h-28 rounded-sm border-2 border-slate-200 bg-white" />
      </div>
    </div>
  );
}
