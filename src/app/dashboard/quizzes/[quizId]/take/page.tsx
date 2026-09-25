"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CHOICE_LABELS, quizErrorMessage, type TakePayload } from "@/lib/quiz";
import QuizText from "@/components/QuizText";

type Phase =
  | { kind: "loading" }
  | { kind: "intro"; title: string; minutes: number; courseId: string }
  | { kind: "taking"; data: TakePayload; courseId: string }
  | { kind: "done"; score: number | null; max: number; courseId: string; title: string }
  | { kind: "error"; message: string; courseId: string | null };

/**
 * หน้าทำแบบทดสอบของนักเรียน
 * - ก่อนเริ่มมีหน้ายืนยัน (เวลาเริ่มนับทันทีที่กดเริ่ม)
 * - กดตัวเลือกแล้วบันทึกทันที เน็ตหลุดกลางทางคำตอบที่บันทึกแล้วไม่หาย กลับมาเปิดหน้านี้ทำต่อได้
 * - เวลานับจากนาฬิกาของเซิร์ฟเวอร์ หมดเวลาแล้วส่งให้อัตโนมัติ
 * - ส่งแล้วเห็นแค่คะแนน ไม่เห็นเฉลย
 */
export default function TakeQuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = use(params);
  const supabase = createClient();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const showScore = useCallback(
    async (courseId: string, title: string) => {
      const { data } = await supabase.from("quiz_attempts").select("score, max_score").eq("quiz_id", quizId).maybeSingle();
      setPhase({ kind: "done", score: data?.score ?? null, max: data?.max_score ?? 0, courseId, title });
    },
    [quizId, supabase]
  );

  const start = useCallback(
    async (courseId: string, title: string) => {
      setPhase({ kind: "loading" });
      const { data, error } = await supabase.rpc("quiz_start", { p_quiz: quizId });
      if (error) {
        const msg = error.message ?? "";
        if (msg.includes("already_submitted") || msg.includes("time_up")) return showScore(courseId, title);
        return setPhase({ kind: "error", message: quizErrorMessage(msg), courseId });
      }
      setPhase({ kind: "taking", data: data as TakePayload, courseId });
    },
    [quizId, showScore, supabase]
  );

  useEffect(() => {
    async function init() {
      const { data: quiz, error } = await supabase.from("quizzes").select("id, course_id, title, time_limit_minutes").eq("id", quizId).maybeSingle();
      if (error || !quiz) return setPhase({ kind: "error", message: "ไม่พบแบบทดสอบนี้", courseId: null });
      // เคยเริ่มแล้ว → ข้ามหน้ายืนยัน (ทำต่อ หรือดูคะแนน)
      const { data: attempt } = await supabase.from("quiz_attempts").select("id, submitted_at").eq("quiz_id", quizId).maybeSingle();
      if (attempt?.submitted_at) return showScore(quiz.course_id, quiz.title);
      if (attempt) return start(quiz.course_id, quiz.title);
      setPhase({ kind: "intro", title: quiz.title, minutes: quiz.time_limit_minutes, courseId: quiz.course_id });
    }
    const timer = setTimeout(init, 0);
    return () => clearTimeout(timer);
  }, [quizId, showScore, start, supabase]);

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-2xl mx-auto">
        {phase.kind === "loading" && <p className="text-sm text-slate-500">กำลังโหลด...</p>}

        {phase.kind === "error" && (
          <div className="bg-white border-2 border-slate-200 rounded-sm p-6 space-y-4">
            <p className="text-slate-800">{phase.message}</p>
            {phase.courseId && <BackLink courseId={phase.courseId} />}
          </div>
        )}

        {phase.kind === "intro" && (
          <div className="bg-white border-2 border-porcelain rounded-sm p-6 space-y-5">
            <h1 className="font-display text-2xl font-bold text-slate-800">{phase.title}</h1>
            <ul className="space-y-2 text-slate-700">
              <li>
                เวลา <span className="font-num tnum font-semibold">{phase.minutes}</span> นาที นับทันทีที่กดเริ่ม
              </li>
              <li>ทำได้ครั้งเดียว ส่งแล้วแก้ไม่ได้</li>
              <li>คำตอบบันทึกทุกครั้งที่กดเลือก ถ้าเน็ตหลุด กลับมาเปิดหน้านี้ทำต่อได้ (เวลายังเดินต่อ)</li>
              <li>หมดเวลาแล้วระบบส่งให้อัตโนมัติ</li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => start(phase.courseId, phase.title)}
                className="rounded-sm px-5 py-2.5 font-semibold bg-[oklch(50%_0.24_345)] text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)]"
              >
                เริ่มทำ
              </button>
              <BackLink courseId={phase.courseId} label="ยังไม่ทำตอนนี้" />
            </div>
          </div>
        )}

        {phase.kind === "taking" && (
          <Taking data={phase.data} onFinished={(score, max) => setPhase({ kind: "done", score, max, courseId: phase.courseId, title: phase.data.title })} />
        )}

        {phase.kind === "done" && (
          <div className="bg-white border-2 border-porcelain rounded-sm p-6 text-center space-y-3">
            <h1 className="font-display text-xl font-semibold text-slate-800">{phase.title}</h1>
            <p className="text-slate-600">ส่งแล้ว คะแนนของคุณ</p>
            <p className="font-num tnum text-6xl font-bold text-slate-800">
              {phase.score ?? "–"}
              <span className="text-2xl text-slate-500"> / {phase.max}</span>
            </p>
            <BackLink courseId={phase.courseId} />
          </div>
        )}
      </div>
    </div>
  );
}

function BackLink({ courseId, label = "กลับไปหน้ารายวิชา" }: { courseId: string; label?: string }) {
  return (
    <Link href={`/dashboard/courses/${courseId}`} className="inline-block rounded-sm border-2 border-porcelain px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">
      {label}
    </Link>
  );
}

function Taking({ data, onFinished }: { data: TakePayload; onFinished: (score: number | null, max: number) => void }) {
  const supabase = createClient();
  const [answers, setAnswers] = useState<Record<string, number>>(data.answers ?? {});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ต่างเวลาระหว่างเครื่องนักเรียนกับเซิร์ฟเวอร์ — ใช้เวลาเซิร์ฟเวอร์เป็นหลัก
  const skew = useRef(0);
  const deadline = new Date(data.deadline_at).getTime();
  const [left, setLeft] = useState(deadline - new Date(data.server_now).getTime());
  const submittedRef = useRef(false);
  // คำตอบที่กำลังบันทึกอยู่ — ตอนส่งต้องรอให้บันทึกเสร็จก่อน ไม่งั้นข้อสุดท้ายที่เพิ่งกดอาจไม่ถูกนับ
  const pendingSaves = useRef(new Set<Promise<unknown>>());

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    await Promise.allSettled([...pendingSaves.current]);
    const { data: res, error: e } = await supabase.rpc("quiz_submit", { p_attempt: data.attempt_id });
    if (e) {
      submittedRef.current = false;
      setSubmitting(false);
      return setError(quizErrorMessage(e.message));
    }
    const r = res as { score: number | null; max_score: number };
    onFinished(r.score, r.max_score);
  }, [data.attempt_id, onFinished, supabase]);

  useEffect(() => {
    skew.current = new Date(data.server_now).getTime() - Date.now();
    const id = setInterval(() => {
      const remaining = deadline - (Date.now() + skew.current);
      setLeft(remaining);
      if (remaining <= 0) submit();
    }, 500);
    return () => clearInterval(id);
  }, [data.server_now, deadline, submit]);

  async function choose(questionId: string, k: number) {
    if (submittedRef.current) return;
    setAnswers((a) => ({ ...a, [questionId]: k }));
    setSaving((s) => ({ ...s, [questionId]: true }));
    const call = supabase.rpc("quiz_save_answer", { p_attempt: data.attempt_id, p_question: questionId, p_choice: k });
    const request = Promise.resolve(call);
    pendingSaves.current.add(request);
    const { error: e } = await request;
    pendingSaves.current.delete(request);
    setSaving((s) => ({ ...s, [questionId]: false }));
    setFailed((f) => ({ ...f, [questionId]: !!e }));
    if (e) setError(`บันทึกคำตอบไม่สำเร็จ — ${quizErrorMessage(e.message)} ลองกดใหม่อีกครั้ง`);
    else setError(null);
  }

  const total = data.questions.length;
  const answered = data.questions.filter((q) => answers[q.id] !== undefined).length;
  const secs = Math.max(0, Math.ceil(left / 1000));
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0");
  const urgent = secs <= 60;

  function confirmSubmit() {
    const blank = total - answered;
    const msg = blank > 0 ? `ยังไม่ได้ตอบ ${blank} ข้อ\nส่งเลยไหม? ส่งแล้วแก้ไม่ได้` : "ส่งคำตอบเลยไหม? ส่งแล้วแก้ไม่ได้";
    if (window.confirm(msg)) submit();
  }

  return (
    <div className="space-y-4">
      {/* แถบเวลาติดด้านบนตลอด */}
      <div className="sticky top-0 z-20 -mx-4 sm:mx-0 px-4 sm:px-4 py-3 bg-slate-50 border-b-2 border-slate-200 flex items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate font-display font-semibold text-slate-800">{data.title}</h1>
        <span className="text-sm text-slate-600">
          ตอบแล้ว <span className="font-num tnum font-semibold text-slate-800">{answered}</span>/<span className="font-num tnum">{total}</span>
        </span>
        <span
          aria-live="off"
          aria-label={`เหลือเวลา ${mm} นาที ${ss} วินาที`}
          className={`font-num tnum text-2xl font-bold ${urgent ? "text-red-600" : "text-slate-800"}`}
        >
          {mm}:{ss}
        </span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-300 rounded-sm px-3 py-2">
          {error}
        </p>
      )}

      <ol className="space-y-4">
        {data.questions.map((q, i) => (
          <li key={q.id} className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
            <p className="text-slate-800 leading-relaxed">
              <span className="font-display font-bold mr-1.5">{i + 1}.</span>
              <QuizText text={q.prompt} />
            </p>
            {q.image && (
              // eslint-disable-next-line @next/next/no-img-element -- data URI ใช้ next/image ไม่ได้
              <img src={q.image} alt={`รูปประกอบข้อ ${i + 1}`} className="max-h-72 w-auto max-w-full rounded-sm border border-slate-200 bg-[oklch(100%_0_0)]" />
            )}
            <div role="radiogroup" aria-label={`ตัวเลือกข้อ ${i + 1}`} className="grid gap-2">
              {q.choices.map((c, j) => {
                const on = answers[q.id] === c.k;
                return (
                  <button
                    key={c.k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={submitting}
                    onClick={() => choose(q.id, c.k)}
                    className={`flex items-start gap-3 rounded-sm border-2 px-3 py-2.5 text-left transition-colors ${
                      on ? "border-trace-cyan bg-[color-mix(in_oklch,var(--trace-cyan)_14%,transparent)]" : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <span
                      className={`grid place-items-center size-7 shrink-0 rounded-full border-2 font-display text-sm font-semibold ${
                        on ? "border-trace-cyan bg-trace-cyan text-[var(--sign-ink)]" : "border-slate-300 text-slate-500"
                      }`}
                    >
                      {CHOICE_LABELS[j]}
                    </span>
                    <QuizText text={c.text} className="pt-0.5 text-slate-800" />
                  </button>
                );
              })}
            </div>
            {saving[q.id] && <p className="text-xs text-slate-400">กำลังบันทึก...</p>}
            {failed[q.id] && !saving[q.id] && <p className="text-xs text-red-600">ยังไม่ได้บันทึกข้อนี้ กดเลือกอีกครั้ง</p>}
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={confirmSubmit}
        disabled={submitting}
        className="w-full rounded-sm py-3 font-semibold bg-[oklch(50%_0.24_345)] text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)] disabled:opacity-50"
      >
        {submitting ? "กำลังส่ง..." : `ส่งคำตอบ (ตอบแล้ว ${answered}/${total} ข้อ)`}
      </button>
    </div>
  );
}
