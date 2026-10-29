"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import {
  componentOptions,
  dueCountdown,
  formatBytes,
  formatDue,
  lateText,
  STATUS_DOT,
  STATUS_LABEL,
  STORAGE_QUOTA_BYTES,
  type Assignment,
  type StatusKey,
  type Submission,
} from "@/lib/assignments";
import AssignmentForm from "../../assignments/AssignmentForm";
import type { Enrollment } from "./ScoresPanel";

/**
 * แท็บ "งาน" ในหน้ารายวิชา
 * ครู: สร้างงาน + รายการงานพร้อมจำนวนที่ส่ง/รอตรวจ
 * นักเรียน: งานที่มอบหมายให้ห้องตัวเอง เรียงตามกำหนดส่ง พร้อมสถานะของตัวเอง
 */
export default function AssignmentsPanel({
  courseId,
  isTeacher,
  units,
  components,
  enrollments,
  myEnrollmentId,
}: {
  courseId: string;
  isTeacher: boolean;
  units: { id: string; title: string; sort_order: number }[];
  components: { id: string; unit_id: string; category: "K" | "P" | "A"; max_score: number }[];
  enrollments: Enrollment[];
  myEnrollmentId: string | null;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subs, setSubs] = useState<Pick<Submission, "assignment_id" | "enrollment_id" | "status" | "score" | "submitted_at">[]>([]);
  const [creating, setCreating] = useState(false);
  const [usedBytes, setUsedBytes] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data: a, error: aErr } = await supabase.from("assignments").select("*").eq("course_id", courseId).order("due_at", { nullsFirst: false }).order("created_at");
    const ids = (a ?? []).map((x) => x.id);
    let sQuery = supabase.from("assignment_submissions").select("assignment_id, enrollment_id, status, score, submitted_at");
    if (!isTeacher && myEnrollmentId) sQuery = sQuery.eq("enrollment_id", myEnrollmentId);
    const sRes = ids.length ? await sQuery.in("assignment_id", ids) : { data: [], error: null };
    const firstErr = aErr ?? sRes.error;
    setError(firstErr ? dbErrorMessage(firstErr) : null);
    setAssignments((a as Assignment[]) ?? []);
    setSubs((sRes.data as typeof subs) ?? []);
    if (isTeacher) {
      const { data: bytes } = await supabase.rpc("submissions_storage_bytes");
      setUsedBytes(bytes == null ? null : Number(bytes));
    }
    setLoading(false);
  }, [courseId, isTeacher, myEnrollmentId, supabase]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const rooms = useMemo(
    () => [...new Set(enrollments.map((e) => e.class_roster?.classroom).filter((r): r is string => !!r))].sort((a, b) => a.localeCompare(b, "th")),
    [enrollments]
  );
  const options = useMemo(() => componentOptions(units, components), [units, components]);
  const optionLabel = (id: string | null) => options.find((o) => o.id === id)?.label ?? null;

  if (loading) return <p className="text-sm text-slate-500">กำลังโหลด...</p>;

  const errorBox = error && (
    <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
      {error}
    </p>
  );

  // ---------------------------------------------------------------- ครู
  if (isTeacher) {
    const assignedCount = (a: Assignment) =>
      enrollments.filter((e) => !a.rooms || (e.class_roster?.classroom && a.rooms.includes(e.class_roster.classroom))).length;

    return (
      <div className="space-y-4">
        {errorBox}
        {creating ? (
          <AssignmentForm
            courseId={courseId}
            componentOptions={options}
            rooms={rooms}
            onCancel={() => setCreating(false)}
            onSaved={(a) => {
              setCreating(false);
              setAssignments((prev) => [...prev, a]);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-[oklch(50%_0.24_345)] px-4 text-sm font-semibold text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)] sm:min-h-9"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M8 3v10M3 8h10" />
            </svg>
            สร้างงาน
          </button>
        )}

        {usedBytes !== null && <StorageMeter used={usedBytes} />}

        {assignments.length === 0 ? (
          <p className="rounded-sm border border-slate-200 bg-white p-6 text-sm text-slate-500">
            ยังไม่มีงานในวิชานี้ — สร้างงาน กำหนดส่ง แล้วผูกกับช่อง K/P/A คะแนนจะเข้าช่องให้เองเมื่อตรวจ
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-sm border border-slate-200 bg-white">
            {assignments.map((a) => {
              const mine = subs.filter((s) => s.assignment_id === a.id);
              const sent = mine.filter((s) => s.status !== "missing").length;
              const waiting = mine.filter((s) => s.status === "submitted").length;
              const total = assignedCount(a);
              const comp = optionLabel(a.component_id);
              return (
                <li key={a.id}>
                  <Link href={`/dashboard/assignments/${a.id}`} className="group flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-slate-100">
                    <AssignmentIcon />
                    <span className="min-w-0 basis-[calc(100%-3.5rem)] sm:basis-0 sm:flex-1">
                      <span className="block font-display font-semibold text-slate-800">
                        {a.title}
                        {!a.published && <span className="ml-2 align-middle text-xs font-normal text-slate-500">(ยังไม่เผยแพร่)</span>}
                      </span>
                      <span className="block text-sm text-slate-500">
                        ส่ง {formatDue(a.due_at)} · เต็ม {Number(a.max_score)}
                        {comp ? ` · เข้าช่อง ${comp}` : ""}
                        {a.rooms ? ` · ${a.rooms.join(", ")}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 text-sm">
                      <span className="font-num tnum text-slate-700">
                        ส่งแล้ว <b className="text-slate-800">{sent}</b>/{total}
                      </span>
                      {waiting > 0 && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                          <span className="size-2 rounded-full bg-trace-yellow" aria-hidden />
                          รอตรวจ {waiting}
                        </span>
                      )}
                    </span>
                    <svg viewBox="0 0 24 24" className="hidden size-5 text-slate-400 group-hover:text-slate-700 sm:block" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M5 12h13M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- นักเรียน
  if (!assignments.length) {
    return (
      <div className="space-y-4">
        {errorBox}
        <p className="rounded-sm border border-slate-200 bg-white p-6 text-sm text-slate-500">ยังไม่มีงานที่ต้องส่ง เมื่อครูมอบหมายงาน จะขึ้นที่นี่</p>
      </div>
    );
  }

  // งานที่ยังต้องทำขึ้นก่อน (ยังไม่ส่ง / ส่งคืนให้แก้) แล้วตามด้วยงานที่ส่งแล้ว
  const rank = (k: StatusKey) => (k === "returned" ? 0 : k === "none" || k === "missing" ? 1 : 2);
  const rows = assignments
    .map((a) => {
      const s = subs.find((x) => x.assignment_id === a.id) ?? null;
      return { a, s, key: (s?.status ?? "none") as StatusKey };
    })
    .sort((x, y) => rank(x.key) - rank(y.key));

  return (
    <div className="space-y-4">
      {errorBox}
      <ul className="space-y-3">
        {rows.map(({ a, s, key }) => {
          const todo = key === "none" || key === "returned" || key === "missing";
          const cd = todo ? dueCountdown(a.due_at) : null;
          const late = s ? lateText(s.submitted_at, a.due_at) : null;
          return (
            <li key={a.id}>
              <Link
                href={`/dashboard/assignments/${a.id}`}
                className={`flex flex-wrap items-center gap-3 rounded-sm border-2 bg-white p-4 hover:border-slate-400 ${key === "returned" ? "border-trace-magenta" : "border-slate-200"}`}
              >
                <AssignmentIcon />
                <span className="min-w-0 basis-[calc(100%-3.5rem)] sm:basis-0 sm:flex-1">
                  <span className="block font-display text-lg font-semibold text-slate-800">{a.title}</span>
                  <span className="block text-sm text-slate-500">
                    ส่ง {formatDue(a.due_at)}
                    {cd && <b className={`ml-1.5 font-semibold ${cd.overdue ? "text-[var(--c-red-500)]" : cd.soon ? "text-slate-800" : "text-slate-600"}`}>· {cd.text}</b>}
                  </span>
                </span>
                <span className="ml-auto flex items-center gap-3 sm:ml-0">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <span className={`size-2 rounded-full ${STATUS_DOT[key]}`} aria-hidden />
                    {STATUS_LABEL[key]}
                    {late && key === "submitted" && <span className="text-slate-500">· {late}</span>}
                  </span>
                  {s?.score != null && (key === "graded" || key === "missing" || key === "returned") && (
                    <span className="font-num tnum text-xl font-semibold text-slate-800">
                      {Number(s.score)}
                      <span className="text-sm font-normal text-slate-500">/{Number(a.max_score)}</span>
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AssignmentIcon() {
  return (
    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-sm border-2 border-trace-magenta/60 text-trace-magenta">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M12 17v-6M9.5 13.5 12 11l2.5 2.5" />
      </svg>
    </span>
  );
}

/** พื้นที่เก็บไฟล์งาน (ทุกวิชารวมกัน) เทียบกับโควตาฟรี 1 GB */
function StorageMeter({ used }: { used: number }) {
  const pct = Math.min(100, (used / STORAGE_QUOTA_BYTES) * 100);
  const tone = pct >= 85 ? "bg-[var(--c-red-500)]" : pct >= 60 ? "bg-trace-yellow" : "bg-trace-lime";
  return (
    <div className="space-y-1.5 rounded-sm border border-slate-200 bg-white px-3 py-2.5">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="text-slate-700">พื้นที่ไฟล์งานที่ใช้ไป (ทุกวิชา)</span>
        <span className="font-num tnum text-slate-800">
          {formatBytes(used)} <span className="text-slate-500">/ 1 GB</span>
        </span>
      </p>
      <span className="block h-2 overflow-hidden rounded-full bg-slate-200" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="พื้นที่ไฟล์งานที่ใช้ไป">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.max(pct, used > 0 ? 1 : 0)}%` }} />
      </span>
      {pct >= 60 && (
        <p className="text-xs text-slate-600">ใกล้เต็มแล้ว — เปิดงานเก่าแล้วกด &quot;ลบไฟล์ที่นักเรียนส่ง&quot; (คะแนนยังอยู่) หรือตั้งงานใหม่ให้ส่งเป็นลิงก์</p>
      )}
    </div>
  );
}
