"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import type { Quiz, QuizAttempt, QuizSession } from "@/lib/quiz";

type Unit = { id: string; title: string; sort_order: number };

const INPUT = "border border-slate-300 rounded-sm px-3 py-2 text-sm bg-white";

/**
 * แท็บ "แบบทดสอบ" ในหน้ารายวิชา
 * ครู: สร้างแบบทดสอบ ดูรายการ แล้วกดเข้าไปแก้คำถาม/เปิดสอบ/ดูผล
 * นักเรียน: เห็นเฉพาะแบบทดสอบที่เปิดให้ห้องตัวเองหรือเคยทำแล้ว
 */
export default function QuizzesPanel({
  courseId,
  isTeacher,
  units,
  myEnrollmentId,
  myClassroom,
}: {
  courseId: string;
  isTeacher: boolean;
  units: Unit[];
  myEnrollmentId: string | null;
  myClassroom: string | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [questionCount, setQuestionCount] = useState<Record<string, number>>({});
  // เวลาตอนโหลดข้อมูล ใช้ตัดสินว่าการทำไหนหมดเวลาแล้ว
  const [loadedAt, setLoadedAt] = useState(0);

  const [title, setTitle] = useState("");
  const [unitId, setUnitId] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data: qz, error: qErr } = await supabase
      .from("quizzes")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at");
    const ids = (qz ?? []).map((q) => q.id);
    const [sRes, aRes, qqRes] = await Promise.all([
      ids.length ? supabase.from("quiz_sessions").select("*").in("quiz_id", ids) : Promise.resolve({ data: [], error: null }),
      // นักเรียน: RLS คืนเฉพาะของตัวเอง · ครู: ใช้นับจำนวนคนที่ส่งแล้ว
      ids.length
        ? supabase.from("quiz_attempts").select("id, quiz_id, enrollment_id, started_at, deadline_at, submitted_at, score, max_score, answers, leave_count, leave_log, submit_reason").in("quiz_id", ids)
        : Promise.resolve({ data: [], error: null }),
      isTeacher && ids.length ? supabase.from("quiz_questions").select("quiz_id").in("quiz_id", ids) : Promise.resolve({ data: [], error: null }),
    ]);
    const firstErr = [qErr, sRes.error, aRes.error, qqRes.error].find(Boolean);
    setError(firstErr ? dbErrorMessage(firstErr) : null);
    setQuizzes((qz as Quiz[]) ?? []);
    setSessions((sRes.data as QuizSession[]) ?? []);
    setAttempts((aRes.data as QuizAttempt[]) ?? []);
    const counts: Record<string, number> = {};
    for (const row of (qqRes.data as { quiz_id: string }[]) ?? []) counts[row.quiz_id] = (counts[row.quiz_id] ?? 0) + 1;
    setQuestionCount(counts);
    setLoadedAt(Date.now());
    setLoading(false);
  }, [courseId, isTeacher, supabase]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function createQuiz(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const m = Number(minutes);
    if (!t) return setError("กรุณาใส่ชื่อแบบทดสอบ");
    if (!Number.isInteger(m) || m < 1 || m > 300) return setError("เวลาทำต้องเป็นจำนวนนาที 1–300");
    setCreating(true);
    const { data, error: insErr } = await supabase
      .from("quizzes")
      .insert({ course_id: courseId, title: t, unit_id: unitId || null, time_limit_minutes: m })
      .select("id")
      .single();
    setCreating(false);
    if (insErr || !data) return setError(dbErrorMessage(insErr) || "สร้างไม่สำเร็จ");
    router.push(`/dashboard/quizzes/${data.id}`);
  }

  const unitTitle = (id: string | null) => units.find((u) => u.id === id)?.title ?? null;
  const openRooms = (quizId: string) => sessions.filter((s) => s.quiz_id === quizId && !s.closed_at).map((s) => s.classroom);

  if (loading) return <p className="text-sm text-slate-500">กำลังโหลด...</p>;

  if (isTeacher) {
    return (
      <div className="space-y-5">
        {error && (
          <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-300 rounded-sm px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={createQuiz} className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
          <h2 className="font-display text-lg font-semibold text-slate-800">สร้างแบบทดสอบใหม่</h2>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_7rem_auto] sm:items-end">
            <label className="space-y-1">
              <span className="block text-sm text-slate-600">ชื่อแบบทดสอบ</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น แบบทดสอบบทที่ 15" className={`${INPUT} w-full`} />
            </label>
            <label className="space-y-1">
              <span className="block text-sm text-slate-600">หน่วยการเรียน</span>
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={`${INPUT} w-full`}>
                <option value="">— ไม่ระบุ —</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm text-slate-600">เวลา (นาที)</span>
              <input value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" className={`${INPUT} w-full`} />
            </label>
            <button disabled={creating} className="bg-slate-800 text-white rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-50">
              {creating ? "กำลังสร้าง..." : "สร้าง แล้วเพิ่มคำถาม"}
            </button>
          </div>
        </form>

        {quizzes.length === 0 ? (
          <p className="bg-white border border-slate-200 rounded-sm p-6 text-sm text-slate-500">
            ยังไม่มีแบบทดสอบ สร้างแบบทดสอบแรกด้านบน แล้วเพิ่มคำถามทีละข้อ
          </p>
        ) : (
          <ul className="bg-white border border-slate-200 rounded-sm divide-y divide-slate-200">
            {quizzes.map((q) => {
              const rooms = openRooms(q.id);
              const done = attempts.filter((a) => a.quiz_id === q.id && a.submitted_at).length;
              return (
                <li key={q.id}>
                  <Link href={`/dashboard/quizzes/${q.id}`} className="group flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-slate-100">
                    <span className="min-w-0 flex-1">
                      <span className="block font-display font-semibold text-slate-800">{q.title}</span>
                      <span className="block text-sm text-slate-500">
                        {[unitTitle(q.unit_id), `${questionCount[q.id] ?? 0} ข้อ`, `${q.time_limit_minutes} นาที`, `ส่งแล้ว ${done} คน`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {rooms.length > 0 ? (
                      <span className="text-sm font-medium text-green-700">เปิดอยู่: {rooms.join(", ")}</span>
                    ) : (
                      <span className="text-sm text-slate-400">ยังไม่เปิดสอบ</span>
                    )}
                    <svg viewBox="0 0 24 24" className="size-5 text-slate-400 group-hover:text-slate-700" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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

  // ---------------- นักเรียน ----------------
  const now = loadedAt;
  const visible = quizzes
    .map((q) => {
      const attempt = attempts.find((a) => a.quiz_id === q.id && a.enrollment_id === myEnrollmentId) ?? null;
      const open = !!myClassroom && openRooms(q.id).includes(myClassroom);
      return { q, attempt, open };
    })
    .filter((x) => x.open || x.attempt);

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-300 rounded-sm px-3 py-2">
        {error}
      </p>
    );
  }

  if (visible.length === 0) {
    return (
      <p className="bg-white border border-slate-200 rounded-sm p-6 text-sm text-slate-500">
        ตอนนี้ยังไม่มีแบบทดสอบที่เปิดให้ทำ เมื่อครูเปิดแบบทดสอบ จะขึ้นที่นี่
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {visible.map(({ q, attempt, open }) => {
        const expired = attempt && !attempt.submitted_at && new Date(attempt.deadline_at).getTime() < now;
        let status: React.ReactNode;
        let action: React.ReactNode = null;
        if (attempt?.submitted_at) {
          status = (
            <span className="font-num tnum text-2xl font-semibold text-slate-800">
              {attempt.score ?? "–"} <span className="text-base text-slate-500">/ {attempt.max_score}</span>
            </span>
          );
        } else if (attempt && !expired) {
          status = <span className="text-sm text-amber-700">กำลังทำอยู่</span>;
          action = <TakeLink quizId={q.id} label="ทำต่อ" />;
        } else if (expired) {
          status = <span className="text-sm text-slate-500">หมดเวลาแล้ว</span>;
          action = <TakeLink quizId={q.id} label="ดูคะแนน" />;
        } else if (open) {
          status = <span className="text-sm text-slate-500">{q.time_limit_minutes} นาที · ทำได้ครั้งเดียว</span>;
          action = <TakeLink quizId={q.id} label="เริ่มทำ" primary />;
        }
        return (
          <li key={q.id} className="bg-white border-2 border-slate-200 rounded-sm p-4 flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-semibold text-slate-800">{q.title}</span>
              {unitTitle(q.unit_id) && <span className="block text-sm text-slate-500">{unitTitle(q.unit_id)}</span>}
            </span>
            {status}
            {action}
          </li>
        );
      })}
    </ul>
  );
}

function TakeLink({ quizId, label, primary }: { quizId: string; label: string; primary?: boolean }) {
  return (
    <Link
      href={`/dashboard/quizzes/${quizId}/take`}
      className={`rounded-sm px-4 py-2 text-sm font-semibold ${
        primary ? "bg-[oklch(50%_0.24_345)] text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)]" : "border-2 border-porcelain text-slate-800 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );
}
