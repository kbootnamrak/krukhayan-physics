"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import type { Quiz, QuizAttempt, QuizQuestion, QuizSession } from "@/lib/quiz";
import Breadcrumbs from "../../Breadcrumbs";
import QuestionsEditor from "./QuestionsEditor";
import SessionsPanel from "./SessionsPanel";
import ResultsPanel, { type RosterEnrollment } from "./ResultsPanel";

type Tab = "questions" | "sessions" | "results";

/** หน้าจัดการแบบทดสอบของครู: แก้คำถามและเฉลย · เปิด/ปิดสอบทีละห้อง · ดูผล */
export default function QuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = use(params);
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [courseName, setCourseName] = useState("");
  const [units, setUnits] = useState<{ id: string; title: string }[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [keys, setKeys] = useState<Record<string, number>>({});
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [enrollments, setEnrollments] = useState<RosterEnrollment[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [tab, setTab] = useState<Tab>("questions");
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(async () => {
    // หน้านี้สำหรับครู — นักเรียนที่เข้าลิงก์นี้ พาไปหน้าทำแบบทดสอบแทน
    const { data: userData } = await supabase.auth.getUser();
    const { data: me } = await supabase.from("profiles").select("role").eq("id", userData.user?.id ?? "").maybeSingle();
    if (me?.role !== "teacher") {
      router.replace(`/dashboard/quizzes/${quizId}/take`);
      return;
    }
    const { data: q, error: qErr } = await supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle();
    if (qErr || !q) {
      setError(qErr ? dbErrorMessage(qErr) : "ไม่พบแบบทดสอบนี้ อาจถูกลบไปแล้ว");
      setLoading(false);
      return;
    }
    const [courseRes, unitRes, qqRes, sRes, enRes, aRes] = await Promise.all([
      supabase.from("courses").select("subjects(name)").eq("id", q.course_id).maybeSingle(),
      supabase.from("course_units").select("id, title").eq("course_id", q.course_id).order("sort_order"),
      supabase.from("quiz_questions").select("*").eq("quiz_id", quizId).order("position"),
      supabase.from("quiz_sessions").select("*").eq("quiz_id", quizId).order("opened_at"),
      supabase
        .from("enrollments")
        .select("id, student_id, class_roster(full_name, student_code, classroom, class_number)")
        .eq("course_id", q.course_id),
      supabase
        .from("quiz_attempts")
        .select("id, quiz_id, enrollment_id, started_at, deadline_at, submitted_at, score, max_score, answers, leave_count, leave_log, submit_reason")
        .eq("quiz_id", quizId),
    ]);
    const ids = ((qqRes.data as QuizQuestion[]) ?? []).map((x) => x.id);
    const keyRes = ids.length
      ? await supabase.from("quiz_answer_keys").select("question_id, correct_index").in("question_id", ids)
      : { data: [], error: null };

    const firstErr = [courseRes.error, unitRes.error, qqRes.error, sRes.error, enRes.error, aRes.error, keyRes.error].find(Boolean);
    setError(firstErr ? `โหลดข้อมูลบางส่วนไม่สำเร็จ: ${dbErrorMessage(firstErr)}` : null);
    setQuiz(q as Quiz);
    setCourseName((courseRes.data as unknown as { subjects: { name: string } | null } | null)?.subjects?.name ?? "");
    setUnits(unitRes.data ?? []);
    setQuestions((qqRes.data as QuizQuestion[]) ?? []);
    const k: Record<string, number> = {};
    for (const row of (keyRes.data as { question_id: string; correct_index: number }[]) ?? []) k[row.question_id] = row.correct_index;
    setKeys(k);
    setSessions((sRes.data as QuizSession[]) ?? []);
    setEnrollments((enRes.data as unknown as RosterEnrollment[]) ?? []);
    setAttempts((aRes.data as QuizAttempt[]) ?? []);
    setLoadedAt(Date.now());
    setLoading(false);
  }, [quizId, router, supabase]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (loading) return <div className="px-6 py-10 text-sm text-slate-500">กำลังโหลด...</div>;

  if (!quiz) {
    return (
      <div className="px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-4">
          <Breadcrumbs items={[{ label: "หน้าหลัก", href: "/dashboard" }, { label: "รายวิชาของฉัน", href: "/dashboard/courses" }, { label: "ไม่พบแบบทดสอบ" }]} />
          <p className="bg-white border border-slate-200 rounded-sm p-6 text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const missingKeys = questions.filter((q) => keys[q.id] === undefined).length;
  const openCount = sessions.filter((s) => !s.closed_at).length;
  const submitted = attempts.filter((a) => a.submitted_at).length;

  const tabs: { key: Tab; label: string; badge?: string }[] = [
    { key: "questions", label: "คำถามและเฉลย", badge: `${questions.length} ข้อ` },
    { key: "sessions", label: "เปิดสอบ", badge: openCount ? `เปิด ${openCount} ห้อง` : undefined },
    { key: "results", label: "ผลสอบ", badge: submitted ? `ส่งแล้ว ${submitted}` : undefined },
  ];

  return (
    <div className="px-4 sm:px-6 py-8 sm:py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-2">
          <Breadcrumbs
            items={[
              { label: "หน้าหลัก", href: "/dashboard" },
              { label: courseName || "รายวิชา", href: `/dashboard/courses/${quiz.course_id}` },
              { label: quiz.title },
            ]}
          />
          <QuizHeader quiz={quiz} units={units} onSaved={load} />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-300 rounded-sm px-3 py-2">
            {error}
          </p>
        )}
        {missingKeys > 0 && (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-sm px-3 py-2">
            ยังไม่ได้เลือกเฉลย {missingKeys} ข้อ — ข้อที่ไม่มีเฉลยจะไม่ได้คะแนนสำหรับทุกคน
          </p>
        )}

        <div role="tablist" className="flex gap-1 border-b border-slate-200 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-[3px] px-4 py-2.5 text-sm whitespace-nowrap ${
                tab === t.key ? "border-trace-magenta text-slate-800 font-medium" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
              {t.badge && <span className="ml-1.5 text-xs text-slate-400">{t.badge}</span>}
            </button>
          ))}
        </div>

        {tab === "questions" && <QuestionsEditor quizId={quizId} questions={questions} keys={keys} locked={attempts.length > 0} onChanged={load} />}
        {tab === "sessions" && <SessionsPanel quizId={quizId} sessions={sessions} enrollments={enrollments} attempts={attempts} ready={questions.length > 0} onChanged={load} />}
        {tab === "results" && <ResultsPanel quiz={quiz} enrollments={enrollments} attempts={attempts} loadedAt={loadedAt} onChanged={load} />}
      </div>
    </div>
  );
}

/** ชื่อ หน่วย เวลา การสลับข้อ — แก้ได้ในที่เดียว */
function QuizHeader({ quiz, units, onSaved }: { quiz: Quiz; units: { id: string; title: string }[]; onSaved: () => void }) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(quiz.title);
  const [unitId, setUnitId] = useState(quiz.unit_id ?? "");
  const [minutes, setMinutes] = useState(String(quiz.time_limit_minutes));
  const [shuffle, setShuffle] = useState(quiz.shuffle);
  const [maxLeaves, setMaxLeaves] = useState(String(quiz.max_leaves));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const m = Number(minutes);
    if (!title.trim()) return setError("กรุณาใส่ชื่อแบบทดสอบ");
    if (!Number.isInteger(m) || m < 1 || m > 300) return setError("เวลาทำต้องเป็นจำนวนนาที 1–300");
    const ml = Number(maxLeaves);
    if (!Number.isInteger(ml) || ml < 0 || ml > 20) return setError("จำนวนครั้งที่ออกจากหน้าได้ต้องเป็น 0–20 (0 = ไม่จำกัด)");
    setBusy(true);
    const { error: upErr } = await supabase
      .from("quizzes")
      .update({ title: title.trim(), unit_id: unitId || null, time_limit_minutes: m, shuffle, max_leaves: ml })
      .eq("id", quiz.id);
    setBusy(false);
    if (upErr) return setError(dbErrorMessage(upErr));
    setEditing(false);
    setError(null);
    onSaved();
  }

  const unitTitle = units.find((u) => u.id === quiz.unit_id)?.title;

  if (!editing) {
    return (
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-800">{quiz.title}</h1>
          <p className="text-slate-500 text-sm">
            {[
              unitTitle,
              `${quiz.time_limit_minutes} นาที`,
              quiz.shuffle ? "สลับข้อและตัวเลือก" : "ไม่สลับข้อ",
              "ทำได้ครั้งเดียว",
              quiz.max_leaves > 0 ? `ออกจากหน้าครบ ${quiz.max_leaves} ครั้งส่งอัตโนมัติ` : "ออกจากหน้าได้ไม่จำกัด (บันทึกไว้)",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button onClick={() => setEditing(true)} className="text-sm border border-slate-300 rounded-sm px-3 py-1.5 text-slate-700 hover:bg-slate-100">
          แก้ชื่อ/เวลา
        </button>
      </div>
    );
  }

  const INPUT = "border border-slate-300 rounded-sm px-3 py-2 text-sm bg-white";
  return (
    <form onSubmit={save} className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_7rem]">
        <label className="space-y-1">
          <span className="block text-sm text-slate-600">ชื่อแบบทดสอบ</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${INPUT} w-full`} />
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
      </div>
      <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
        ส่งข้อสอบอัตโนมัติเมื่อออกจากหน้าครบ
        <input value={maxLeaves} onChange={(e) => setMaxLeaves(e.target.value)} inputMode="numeric" aria-label="จำนวนครั้ง" className={`${INPUT} w-16 text-center`} />
        ครั้ง <span className="text-slate-500">(0 = ไม่ส่ง แค่บันทึกจำนวนครั้ง)</span>
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} className="size-4" />
        สลับลำดับข้อและตัวเลือกให้แต่ละคน (มีผลกับคนที่เริ่มทำหลังจากนี้)
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="bg-slate-800 text-white rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-50">
          บันทึก
        </button>
        <button type="button" onClick={() => setEditing(false)} className="border border-slate-300 rounded-sm px-4 py-2 text-sm text-slate-700">
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
