"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import {
  ATTACH_BUCKET,
  BUCKET,
  storedPaths,
  SUBMIT_MODE_LABEL,
  formatDue,
  formatWhen,
  lateText,
  STATUS_DOT,
  STATUS_LABEL,
  type Assignment,
  type ComponentOption,
  type StatusKey,
  type Submission,
} from "@/lib/assignments";
import AssignmentForm from "../AssignmentForm";
import { FileGallery } from "./files";

export type Student = { enrollmentId: string; name: string; code: string; room: string; number: number | null };
type Filter = "all" | "submitted" | "none" | "returned" | "graded";

/**
 * หน้างานของครู: ภาพรวม · รายชื่อพร้อมสถานะ · ตรวจทีละคน (ดูรูป ให้คะแนน ความเห็น ส่งคืน)
 * คะแนนเข้าช่อง K/P/A ที่ผูกไว้อัตโนมัติจากฝั่งฐานข้อมูล (assignment_grade)
 */
export default function TeacherAssignment({
  initial,
  students,
  initialSubs,
  componentOptions,
  rooms,
  courseLabel,
}: {
  initial: Assignment;
  students: Student[];
  initialSubs: Submission[];
  componentOptions: ComponentOption[];
  rooms: string[];
  courseLabel: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [a, setA] = useState(initial);
  const [subs, setSubs] = useState<Submission[]>(initialSubs);
  const [editing, setEditing] = useState<false | "all" | "attach">(false);
  const [room, setRoom] = useState<string>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const assigned = useMemo(() => students.filter((s) => !a.rooms || a.rooms.includes(s.room)), [students, a.rooms]);
  const subOf = (id: string) => subs.find((s) => s.enrollment_id === id) ?? null;
  const keyOf = (id: string): StatusKey => subOf(id)?.status ?? "none";

  const counts = useMemo(() => {
    const c = { sent: 0, waiting: 0, late: 0, none: 0, graded: 0 };
    for (const s of assigned) {
      const sub = subs.find((x) => x.enrollment_id === s.enrollmentId);
      const k = sub?.status ?? "none";
      if (k === "none" || k === "missing") c.none++;
      else c.sent++;
      if (k === "submitted") c.waiting++;
      if (k === "graded") c.graded++;
      if (sub && k !== "missing" && lateText(sub.submitted_at, a.due_at)) c.late++;
    }
    return c;
  }, [assigned, subs, a.due_at]);

  const visible = assigned.filter((s) => {
    if (room !== "all" && s.room !== room) return false;
    const k = keyOf(s.enrollmentId);
    if (filter === "all") return true;
    if (filter === "none") return k === "none" || k === "missing";
    return k === filter;
  });

  const noneIds = assigned.filter((s) => keyOf(s.enrollmentId) === "none").map((s) => s.enrollmentId);
  const overdue = !!a.due_at && new Date(a.due_at).getTime() < openedAt;
  const comp = componentOptions.find((o) => o.id === a.component_id)?.label ?? null;
  const assignedRooms = a.rooms ?? rooms;

  async function togglePublished() {
    setError(null);
    const { data, error: e } = await supabase.from("assignments").update({ published: !a.published }).eq("id", a.id).select().single();
    if (e) return setError(dbErrorMessage(e));
    setA(data as Assignment);
  }

  async function remove() {
    const n = subs.filter((s) => s.files.length).length;
    if (!window.confirm(`ลบงาน "${a.title}" ?${n ? ` งานที่นักเรียนส่งมา ${n} คนจะหายทั้งหมด` : ""}${comp ? " และคะแนนในช่องที่ผูกไว้จะถูกคิดใหม่" : ""}`)) return;
    setBusy(true);
    const paths = allStudentPaths(subs);
    const { error: e } = await supabase.from("assignments").delete().eq("id", a.id);
    if (e) {
      setBusy(false);
      return setError(dbErrorMessage(e));
    }
    await removeInBatches(supabase, BUCKET, paths);
    await removeInBatches(supabase, ATTACH_BUCKET, storedPaths(a.attachments));
    router.push(`/dashboard/courses/${a.course_id}`);
  }

  async function zeroMissing() {
    if (!window.confirm(`ให้ 0 คะแนน ${noneIds.length} คนที่ยังไม่ส่ง?\nถ้าส่งช้าภายหลัง ครูตรวจแล้วให้คะแนนใหม่ได้`)) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("assignment_zero_missing", { p_assignment: a.id });
    if (e) {
      setBusy(false);
      return setError(dbErrorMessage(e));
    }
    const { data } = await supabase.from("assignment_submissions").select("*").eq("assignment_id", a.id);
    setSubs((data as Submission[]) ?? []);
    setBusy(false);
  }

  // ลบรูป/ไฟล์ที่นักเรียนส่งของงานนี้ออกจากที่เก็บ — คะแนน ความเห็น และลิงก์ยังอยู่
  const studentPaths = allStudentPaths(subs);
  async function purgeFiles() {
    if (
      !window.confirm(
        `ลบรูป/ไฟล์ที่นักเรียนส่งในงานนี้ ${studentPaths.length} ไฟล์ ออกจากที่เก็บ?\nคะแนนและความเห็นยังอยู่ครบ แต่จะเปิดดูรูปงานไม่ได้อีก และนักเรียนส่งไฟล์เพิ่มไม่ได้ (ส่งเป็นลิงก์ได้)`
      )
    )
      return;
    setBusy(true);
    setError(null);
    const failed = await removeInBatches(supabase, BUCKET, studentPaths);
    if (failed) {
      setBusy(false);
      return setError(failed);
    }
    const { data, error: e } = await supabase.from("assignments").update({ files_purged_at: new Date().toISOString() }).eq("id", a.id).select().single();
    setBusy(false);
    if (e) return setError(dbErrorMessage(e));
    setA(data as Assignment);
  }

  function exportExcel() {
    const rows = assigned.map((s) => {
      const sub = subOf(s.enrollmentId);
      const k = keyOf(s.enrollmentId);
      return {
        ห้อง: s.room,
        เลขที่: s.number ?? "",
        รหัส: s.code,
        "ชื่อ-สกุล": s.name,
        สถานะ: STATUS_LABEL[k],
        ส่งเมื่อ: sub?.submitted_at ? new Date(sub.submitted_at).toLocaleString("th-TH") : "",
        ส่งช้า: (sub && k !== "missing" && lateText(sub.submitted_at, a.due_at)) || "",
        [`คะแนน (${Number(a.max_score)})`]: sub?.score ?? "",
        ความเห็น: sub?.feedback ?? "",
      };
    });
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 8 }, { wch: 6 }, { wch: 10 }, { wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 40 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "งาน");
    XLSX.writeFile(book, `${a.title}.xlsx`);
  }

  const current = selected ? assigned.find((s) => s.enrollmentId === selected) ?? null : null;
  // ลำดับสำหรับปุ่มคนก่อน/ถัดไป = รายชื่อที่กรองอยู่ ถ้าคนที่เลือกหลุดตัวกรอง ใช้รายชื่อทั้งหมด
  const order = current && visible.some((s) => s.enrollmentId === current.enrollmentId) ? visible : assigned;
  const pos = current ? order.findIndex((s) => s.enrollmentId === current.enrollmentId) : -1;

  return (
    <div className="space-y-5">
      {/* ---------- หัวเรื่อง ---------- */}
      {editing ? (
        <AssignmentForm
          courseId={a.course_id}
          focusAttach={editing === "attach"}
          initial={a}
          componentOptions={componentOptions}
          rooms={rooms}
          onCancel={() => setEditing(false)}
          onSaved={(next) => {
            setA(next);
            setEditing(false);
          }}
        />
      ) : (
        <section className="space-y-3 rounded-sm border-2 border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <h1 className="font-display text-2xl font-bold text-slate-800">{a.title}</h1>
              <p className="text-sm text-slate-500">{courseLabel}</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${a.published ? "text-slate-800" : "text-slate-500"}`}>
              <span className={`size-2 rounded-full ${a.published ? "bg-trace-lime" : "bg-slate-300"}`} aria-hidden />
              {a.published ? "เผยแพร่แล้ว" : "ยังไม่เผยแพร่"}
            </span>
          </div>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Info label="กำหนดส่ง" value={formatDue(a.due_at)} />
            <Info label="คะแนนเต็ม" value={String(Number(a.max_score))} />
            <Info label="เข้าช่อง" value={comp ?? "ไม่ผูก"} />
            <Info label="มอบหมายให้" value={a.rooms ? a.rooms.join(", ") : "ทุกห้อง"} />
            <Info label="นักเรียนส่งเป็น" value={SUBMIT_MODE_LABEL[a.submit_mode]} />
          </dl>
          {a.instructions && <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{a.instructions}</p>}
          {a.attachments.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-slate-700">ไฟล์งานที่แนบให้นักเรียน</p>
              <FileGallery files={a.attachments} bucket={ATTACH_BUCKET} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing("attach")}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm border-2 border-dashed border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-trace-cyan hover:text-slate-800"
            >
              <svg viewBox="0 0 24 24" className="size-5 text-trace-cyan" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
                <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
              </svg>
              แนบไฟล์งาน / ลิงก์ให้นักเรียน
            </button>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <SmallButton onClick={() => setEditing("all")}>แก้ไข / แนบไฟล์</SmallButton>
            <SmallButton onClick={togglePublished}>{a.published ? "ซ่อนจากนักเรียน" : "เผยแพร่"}</SmallButton>
            <SmallButton onClick={exportExcel}>ดาวน์โหลด Excel</SmallButton>
            {!a.files_purged_at && studentPaths.length > 0 && (
              <SmallButton onClick={purgeFiles} disabled={busy}>
                ลบไฟล์ที่นักเรียนส่ง (เก็บคะแนนไว้)
              </SmallButton>
            )}
            <SmallButton onClick={remove} danger disabled={busy}>
              ลบงาน
            </SmallButton>
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* ---------- ภาพรวม ---------- */}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="ส่งแล้ว" value={`${counts.sent}/${assigned.length}`} />
        <Stat label="รอตรวจ" value={counts.waiting} dot="bg-trace-yellow" />
        <Stat label="ส่งช้า" value={counts.late} />
        <Stat label="ยังไม่ส่ง" value={counts.none} />
      </dl>

      {overdue && noneIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-sm border-2 border-slate-200 bg-white p-3 text-sm">
          <span className="min-w-0 flex-1 text-slate-700">
            เลยกำหนดส่งแล้ว ยังไม่ส่ง <b className="text-slate-800">{noneIds.length} คน</b>
            {comp && " — ถ้าไม่ให้ 0 ช่องคะแนนของคนเหล่านี้จะคิดจากงานที่ตรวจแล้วเท่านั้น"}
          </span>
          <SmallButton onClick={zeroMissing} disabled={busy}>
            ให้ 0 คนที่ไม่ส่ง
          </SmallButton>
        </div>
      )}

      {/* ---------- รายชื่อ + ตรวจ ---------- */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <section className={`space-y-3 ${current ? "hidden lg:block" : ""}`} aria-label="รายชื่อนักเรียน">
          <div className="flex flex-wrap gap-1.5">
            {assignedRooms.length > 1 && (
              <select
                aria-label="ห้อง"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="min-h-11 rounded-sm border-2 border-slate-300 bg-white px-2 text-base text-slate-800 sm:min-h-9 sm:text-sm"
              >
                <option value="all">ทุกห้อง</option>
                {assignedRooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}
            {(
              [
                ["all", "ทั้งหมด"],
                ["submitted", "รอตรวจ"],
                ["none", "ยังไม่ส่ง"],
                ["returned", "ส่งคืน"],
                ["graded", "ตรวจแล้ว"],
              ] as [Filter, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
                className={`min-h-11 rounded-sm border-2 px-3 text-sm sm:min-h-9 ${filter === k ? "border-trace-magenta font-semibold text-slate-800" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-sm border border-slate-200 bg-white p-4 text-sm text-slate-500">ไม่มีนักเรียนในกลุ่มนี้</p>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-sm border border-slate-200 bg-white">
              {visible.map((s) => {
                const sub = subOf(s.enrollmentId);
                const k = keyOf(s.enrollmentId);
                const late = sub && k !== "missing" ? lateText(sub.submitted_at, a.due_at) : null;
                const on = selected === s.enrollmentId;
                return (
                  <li key={s.enrollmentId}>
                    <button
                      type="button"
                      onClick={() => setSelected(s.enrollmentId)}
                      aria-current={on}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-100 ${on ? "bg-[color-mix(in_oklch,var(--trace-magenta)_10%,transparent)]" : ""}`}
                    >
                      <span className="w-14 shrink-0 font-num tnum text-xs text-slate-500">
                        {assignedRooms.length > 1 && <span className="block">{s.room}</span>}
                        เลขที่ {s.number ?? "–"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-800">{s.name}</span>
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span className={`size-2 rounded-full ${STATUS_DOT[k]}`} aria-hidden />
                          {STATUS_LABEL[k]}
                          {late && <span className="text-[var(--c-red-500)]">· {late}</span>}
                        </span>
                      </span>
                      {sub?.score != null && (
                        <span className="font-num tnum text-sm font-semibold text-slate-800">
                          {Number(sub.score)}
                          <span className="font-normal text-slate-500">/{Number(a.max_score)}</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {current ? (
          <Grader
            key={current.enrollmentId}
            assignment={a}
            student={current}
            sub={subOf(current.enrollmentId)}
            hasPrev={pos > 0}
            hasNext={pos >= 0 && pos < order.length - 1}
            onPrev={() => setSelected(order[pos - 1].enrollmentId)}
            onNext={() => setSelected(order[pos + 1]?.enrollmentId ?? null)}
            onClose={() => setSelected(null)}
            onSaved={(next) => setSubs((prev) => [...prev.filter((x) => x.enrollment_id !== next.enrollment_id), next])}
          />
        ) : (
          <p className="hidden rounded-sm border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 lg:block">เลือกนักเรียนทางซ้ายเพื่อดูงานและให้คะแนน</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ตรวจงานหนึ่งคน
// ---------------------------------------------------------------------------
function Grader({
  assignment,
  student,
  sub,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  onSaved,
}: {
  assignment: Assignment;
  student: Student;
  sub: Submission | null;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onSaved: (s: Submission) => void;
}) {
  const supabase = createClient();
  const [score, setScore] = useState(sub?.score != null && sub.status !== "missing" ? String(Number(sub.score)) : "");
  const [feedback, setFeedback] = useState(sub?.feedback ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const topRef = useRef<HTMLElement>(null);
  const k: StatusKey = sub?.status ?? "none";
  const late = sub && k !== "missing" ? lateText(sub.submitted_at, assignment.due_at) : null;
  const max = Number(assignment.max_score);

  // มือถือ: แผงตรวจแทนที่รายชื่อ เลื่อนขึ้นไปหัวแผง (จอใหญ่อยู่ข้างรายชื่ออยู่แล้ว)
  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  async function save(returnIt: boolean) {
    const text = score.trim().replace(",", ".");
    const value = text === "" ? null : Number(text);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > max)) return setError(`คะแนนต้องอยู่ระหว่าง 0 ถึง ${max}`);
    if (value === null && !returnIt) return setError("ใส่คะแนนก่อนบันทึก");
    if (returnIt && !feedback.trim()) return setError("เขียนความเห็นบอกนักเรียนว่าต้องแก้อะไร");
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.rpc("assignment_grade", {
      p_assignment: assignment.id,
      p_enrollment: student.enrollmentId,
      p_score: value,
      p_feedback: feedback,
      p_return: returnIt,
    });
    setBusy(false);
    if (e) return setError(dbErrorMessage(e));
    onSaved(data as Submission);
    setSaved(returnIt ? "ส่งคืนให้แก้แล้ว" : "บันทึกคะแนนแล้ว");
    if (!returnIt && hasNext) setTimeout(onNext, 350);
  }

  return (
    <section ref={topRef} className="scroll-mt-4 space-y-4 rounded-sm border-2 border-slate-200 bg-white p-4 sm:p-5" aria-label={`ตรวจงาน ${student.name}`}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-1 rounded-sm px-1 text-sm text-slate-600 hover:text-slate-800 lg:hidden">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M19 12H6M11 6l-6 6 6 6" />
          </svg>
          รายชื่อ
        </button>
        <span className="ml-auto flex gap-1.5">
          <NavButton disabled={!hasPrev} onClick={onPrev} label="คนก่อน" dir="prev" />
          <NavButton disabled={!hasNext} onClick={onNext} label="คนถัดไป" dir="next" />
        </span>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-slate-800">{student.name}</h2>
        <p className="text-sm text-slate-500">
          {student.room} · เลขที่ {student.number ?? "–"} · {student.code}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
            <span className={`size-2 rounded-full ${STATUS_DOT[k]}`} aria-hidden />
            {STATUS_LABEL[k]}
          </span>
          {sub?.submitted_at && <span className="text-slate-500">ส่ง {formatWhen(sub.submitted_at)}</span>}
          {late && <span className="font-medium text-[var(--c-red-500)]">{late}</span>}
          {sub && sub.attempt > 1 && <span className="text-slate-500">รอบที่ {sub.attempt}</span>}
        </p>
      </div>

      {sub?.note && (
        <p className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="block text-xs text-slate-500">ข้อความจากนักเรียน</span>
          {sub.note}
        </p>
      )}

      {sub && sub.files.length > 0 ? (
        <FileGallery files={sub.files} large purged={!!assignment.files_purged_at} />
      ) : (
        <p className="rounded-sm border-2 border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
          ไม่มีไฟล์ — ถ้านักเรียนส่งเป็นกระดาษ ให้คะแนนด้านล่างได้เลย
        </p>
      )}

      <div className="space-y-3 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="g-score" className="block text-sm font-medium text-slate-700">
              คะแนน (เต็ม {max})
            </label>
            <input
              id="g-score"
              inputMode="decimal"
              enterKeyHint="done"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save(false);
              }}
              className="h-12 w-28 rounded-sm border-2 border-slate-300 bg-white px-3 text-center font-num text-xl text-slate-800"
            />
          </div>
          <button type="button" onClick={() => setScore(String(max))} className="min-h-11 rounded-sm border-2 border-slate-200 px-3 text-sm text-slate-700 hover:border-slate-400">
            เต็ม {max}
          </button>
        </div>
        <div className="space-y-1">
          <label htmlFor="g-fb" className="block text-sm font-medium text-slate-700">
            ความเห็นถึงนักเรียน <span className="font-normal text-slate-500">(ไม่บังคับ ยกเว้นตอนส่งคืน)</span>
          </label>
          <textarea id="g-fb" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} maxLength={4000} className="w-full rounded-sm border-2 border-slate-300 bg-white px-3 py-2 text-base text-slate-800 sm:text-sm" />
        </div>

        {error && (
          <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        {saved && !error && (
          <p role="status" className="text-sm font-medium text-green-700">
            {saved}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => save(false)}
            className="min-h-12 flex-1 rounded-sm bg-[oklch(50%_0.24_345)] px-5 font-semibold text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)] disabled:opacity-50"
          >
            {busy ? "กำลังบันทึก..." : hasNext ? "บันทึก แล้วไปคนถัดไป" : "บันทึกคะแนน"}
          </button>
          {sub && sub.files.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => save(true)}
              className="min-h-12 rounded-sm border-2 border-trace-magenta px-5 font-semibold text-slate-800 hover:bg-[color-mix(in_oklch,var(--trace-magenta)_10%,transparent)] disabled:opacity-50"
            >
              ส่งคืนให้แก้
            </button>
          )}
        </div>
      </div>

      {sub && sub.history.length > 0 && (
        <details className="rounded-sm border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm text-slate-700">รอบก่อนหน้า ({sub.history.length})</summary>
          <div className="mt-3 space-y-4">
            {[...sub.history].reverse().map((h) => (
              <div key={h.attempt} className="space-y-2">
                <p className="text-sm text-slate-600">
                  รอบที่ {h.attempt} · ส่ง {formatWhen(h.submitted_at)}
                  {h.score != null && ` · ${Number(h.score)}/${max}`}
                  {h.feedback && ` · ความเห็น: ${h.feedback}`}
                </p>
                <FileGallery files={h.files} purged={!!assignment.files_purged_at} />
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function Stat({ label, value, dot }: { label: string; value: number | string; dot?: string }) {
  return (
    <div className="rounded-sm border border-slate-200 bg-white px-3 py-2">
      <dt className="flex items-center gap-1.5 text-xs text-slate-500">
        {dot && <span className={`size-2 rounded-full ${dot}`} aria-hidden />}
        {label}
      </dt>
      <dd className="font-num tnum text-2xl font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function SmallButton({ children, onClick, danger, disabled }: { children: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 rounded-sm border-2 px-3 text-sm font-semibold disabled:opacity-50 sm:min-h-9 ${
        danger ? "border-red-300 text-red-700 hover:bg-red-50" : "border-slate-300 text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function NavButton({ disabled, onClick, label, dir }: { disabled: boolean; onClick: () => void; label: string; dir: "prev" | "next" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-11 place-items-center rounded-sm border-2 border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-30 sm:size-9"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d={dir === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}

/** ไฟล์ทุกไฟล์ที่นักเรียนส่งในงานนี้ (รวมรอบก่อน ๆ) */
function allStudentPaths(subs: Submission[]): string[] {
  return subs.flatMap((s) => [...storedPaths(s.files), ...s.history.flatMap((h) => storedPaths(h.files))]);
}

/** ลบไฟล์จากที่เก็บทีละ 100 — คืนข้อความผิดพลาด หรือ null ถ้าสำเร็จ */
async function removeInBatches(supabase: ReturnType<typeof createClient>, bucket: string, paths: string[]): Promise<string | null> {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) return `ลบไฟล์ไม่สำเร็จ: ${dbErrorMessage(error)}`;
  }
  return null;
}
