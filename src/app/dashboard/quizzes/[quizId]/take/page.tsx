"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CHOICE_LABELS, quizErrorMessage, type MyAttempt, type SubmitReason, type SubmittedResult, type TakePayload } from "@/lib/quiz";
import QuizText from "@/components/QuizText";
import { getDeviceId, getDeviceModel } from "@/lib/device";

type Done = { kind: "done"; score: number | null; max: number; reason: SubmitReason | null; released: boolean; courseId: string; title: string };
type Phase =
  | { kind: "loading" }
  | { kind: "intro"; title: string; minutes: number; maxLeaves: number; courseId: string }
  | { kind: "taking"; data: TakePayload; courseId: string }
  | Done
  | { kind: "error"; message: string; courseId: string | null };

/**
 * หน้าทำแบบทดสอบของนักเรียน
 * - ก่อนเริ่มมีหน้ายืนยัน (เวลาเริ่มนับทันทีที่กดเริ่ม)
 * - แสดงทีละข้อ กดตัวเลือกแล้วบันทึกทันที เน็ตหลุดคำตอบที่บันทึกแล้วไม่หาย
 * - เวลานับจากนาฬิกาของเซิร์ฟเวอร์ หมดเวลาแล้วส่งให้อัตโนมัติ
 * - ออกจากหน้า (สลับแอป/แท็บ/รีเฟรช) ถูกนับ ครบกำหนดแล้วเซิร์ฟเวอร์ส่งให้เอง
 * - ลายน้ำชื่อ-รหัส และห้ามคัดลอกข้อความ (กันแคปหน้าจอไม่ได้ — ระบบปฏิบัติการไม่อนุญาต)
 * - ส่งแล้วเห็นแค่คะแนน ไม่เห็นเฉลย
 */
export default function TakeQuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = use(params);
  const supabase = createClient();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const start = useCallback(
    async (courseId: string, title: string) => {
      setPhase({ kind: "loading" });
      const { data, error } = await supabase.rpc("quiz_start", { p_quiz: quizId });
      if (error) return setPhase({ kind: "error", message: quizErrorMessage(error.message), courseId });
      const res = data as TakePayload | SubmittedResult;
      if (res.status === "submitted") {
        return setPhase({ kind: "done", score: res.score, max: res.max_score, reason: res.reason, released: res.released, courseId, title });
      }
      setPhase({ kind: "taking", data: res, courseId });
      // บันทึกเครื่องที่ใช้ทำชุดนี้ (ครูเห็นในแท็บผลสอบ ถ้าหลายคนทำบนเครื่องเดียวกันจะมีธงเตือน)
      const device = getDeviceId();
      if (device) {
        getDeviceModel().then((model) =>
          supabase.rpc("log_device", { p_device: device, p_kind: "quiz", p_quiz: quizId, p_model: model }).then(() => undefined, () => undefined)
        );
      }
    },
    [quizId, supabase]
  );

  useEffect(() => {
    async function init() {
      const { data: quiz, error } = await supabase
        .from("quizzes")
        .select("id, course_id, title, time_limit_minutes, max_leaves")
        .eq("id", quizId)
        .maybeSingle();
      if (error || !quiz) return setPhase({ kind: "error", message: "ไม่พบแบบทดสอบนี้", courseId: null });
      const { data: mine } = await supabase.rpc("quiz_my_attempts", { p_course: quiz.course_id });
      const attempt = ((mine as MyAttempt[] | null) ?? []).find((a) => a.quiz_id === quizId);
      if (attempt?.submitted_at) {
        return setPhase({
          kind: "done",
          score: attempt.score,
          max: attempt.max_score,
          reason: attempt.submit_reason,
          released: attempt.released,
          courseId: quiz.course_id,
          title: quiz.title,
        });
      }
      // เคยเริ่มแล้ว → ทำต่อเลย (ระบบนับว่าออกจากหน้า 1 ครั้ง)
      if (attempt) return start(quiz.course_id, quiz.title);
      setPhase({ kind: "intro", title: quiz.title, minutes: quiz.time_limit_minutes, maxLeaves: quiz.max_leaves, courseId: quiz.course_id });
    }
    const timer = setTimeout(init, 0);
    return () => clearTimeout(timer);
  }, [quizId, start, supabase]);

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
            <ul className="list-disc pl-5 space-y-2 text-slate-700">
              <li>
                เวลา <span className="font-num tnum font-semibold">{phase.minutes}</span> นาที นับทันทีที่กดเริ่ม ทำได้ครั้งเดียว ส่งแล้วแก้ไม่ได้
              </li>
              <li>คำตอบบันทึกทุกครั้งที่กดเลือก หมดเวลาแล้วระบบส่งให้อัตโนมัติ</li>
              {phase.maxLeaves > 0 ? (
                <li className="text-red-700">
                  ห้ามออกจากหน้าข้อสอบ (สลับแอป เปิดแท็บอื่น พับจอ หรือรีเฟรช) — ออกครบ{" "}
                  <span className="font-num tnum font-semibold">{phase.maxLeaves}</span> ครั้ง ระบบส่งข้อสอบให้ทันที
                </li>
              ) : (
                <li>ระบบบันทึกทุกครั้งที่ออกจากหน้าข้อสอบ ครูจะเห็นจำนวนครั้ง</li>
              )}
              <li>หน้าข้อสอบมีชื่อและรหัสของคุณเป็นลายน้ำ และระบบบันทึกเครื่องที่ใช้ทำ</li>
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
          <Taking
            data={phase.data}
            onFinished={(r) =>
              setPhase({ kind: "done", score: r.score, max: r.max_score, reason: r.reason, released: r.released, courseId: phase.courseId, title: phase.data.title })
            }
          />
        )}

        {phase.kind === "done" && (
          <div className="bg-white border-2 border-porcelain rounded-sm p-6 text-center space-y-3">
            <h1 className="font-display text-xl font-semibold text-slate-800">{phase.title}</h1>
            <p className="text-slate-600">
              {phase.reason === "left_page"
                ? "ระบบส่งข้อสอบให้อัตโนมัติ เพราะออกจากหน้าข้อสอบครบกำหนด"
                : phase.reason === "time_up"
                  ? "หมดเวลา ระบบส่งคำตอบที่บันทึกไว้ให้แล้ว"
                  : "ส่งแล้ว"}
            </p>
            {phase.released ? (
              <>
                <p className="text-slate-600">คะแนนของคุณ</p>
                <p className="font-num tnum text-6xl font-bold text-slate-800">
                  {phase.score ?? "–"}
                  <span className="text-2xl text-slate-500"> / {phase.max}</span>
                </p>
              </>
            ) : (
              <p className="font-display text-lg font-semibold text-slate-800">ครูจะประกาศคะแนนภายหลัง</p>
            )}
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

/** ลายน้ำชื่อ-รหัสนักเรียน เต็มจอ เอียง ๆ จาง ๆ (คลิกทะลุได้) */
function watermark(text: string) {
  const safe = text.replace(/[<>&"]/g, "");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='170'><text x='10' y='110' transform='rotate(-22 150 85)' font-family='sans-serif' font-size='17' fill='rgb(128,136,160)' fill-opacity='0.16'>${safe}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function Taking({ data, onFinished }: { data: TakePayload; onFinished: (result: SubmittedResult) => void }) {
  const supabase = createClient();
  const [answers, setAnswers] = useState<Record<string, number>>(data.answers ?? {});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [leaves, setLeaves] = useState(data.leave_count);
  const [leaveNotice, setLeaveNotice] = useState<string | null>(null);

  // ต่างเวลาระหว่างเครื่องนักเรียนกับเซิร์ฟเวอร์ — ใช้เวลาเซิร์ฟเวอร์เป็นหลัก
  const skew = useRef(0);
  const deadline = new Date(data.deadline_at).getTime();
  const [left, setLeft] = useState(deadline - new Date(data.server_now).getTime());
  const submittedRef = useRef(false);
  // คำตอบที่กำลังบันทึกอยู่ — ตอนส่งต้องรอให้บันทึกเสร็จก่อน ไม่งั้นข้อสุดท้ายที่เพิ่งกดอาจไม่ถูกนับ
  const pendingSaves = useRef(new Set<Promise<unknown>>());
  // หน้ายืนยันก่อนส่ง (ทำในหน้าเว็บเอง — กล่อง confirm ของเบราว์เซอร์ในแอป LINE/Facebook บางเครื่องไม่แสดง แล้วส่งทันที)
  const [reviewing, setReviewing] = useState(false);

  const finish = useCallback(
    (result: SubmittedResult) => {
      submittedRef.current = true;
      onFinished(result);
    },
    [onFinished]
  );

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
    onFinished(res as SubmittedResult);
  }, [data.attempt_id, onFinished, supabase]);

  // นาฬิกา
  useEffect(() => {
    skew.current = new Date(data.server_now).getTime() - Date.now();
    const id = setInterval(() => {
      const remaining = deadline - (Date.now() + skew.current);
      setLeft(remaining);
      if (remaining <= 0) submit();
    }, 500);
    return () => clearInterval(id);
  }, [data.server_now, deadline, submit]);

  // ตรวจการออกจากหน้า: ซ่อนหน้า (สลับแอป/แท็บ/พับจอ) หรือหน้าต่างเสียโฟกัส (เปิดหน้าต่างอื่นบนคอม)
  // รายงานตอนกลับมา พร้อมระยะเวลาที่ออกไป — ออกไม่ถึง 1 วินาทีไม่นับ (เช่นแจ้งเตือนเด้งแวบเดียว)
  useEffect(() => {
    let awaySince: number | null = null;
    const away = () => {
      if (submittedRef.current || awaySince !== null) return;
      awaySince = Date.now();
    };
    const back = async () => {
      if (awaySince === null || document.visibilityState === "hidden" || !document.hasFocus()) return;
      const seconds = Math.round((Date.now() - awaySince) / 1000);
      awaySince = null;
      if (seconds < 1 || submittedRef.current) return;
      const { data: res, error: e } = await supabase.rpc("quiz_log_leave", { p_attempt: data.attempt_id, p_away: seconds });
      if (e) return;
      const r = res as { leave_count: number; max_leaves: number; submitted: boolean; released: boolean; score: number | null; max_score: number };
      setLeaves(r.leave_count);
      if (r.submitted) {
        return finish({ status: "submitted", reason: "left_page", released: r.released, score: r.score, max_score: r.max_score });
      }
      setLeaveNotice(
        r.max_leaves > 0
          ? `คุณออกจากหน้าข้อสอบไปแล้ว ${r.leave_count} ครั้ง — ครบ ${r.max_leaves} ครั้ง ระบบจะส่งข้อสอบให้ทันที`
          : `คุณออกจากหน้าข้อสอบไปแล้ว ${r.leave_count} ครั้ง ครูจะเห็นจำนวนครั้งนี้`
      );
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? away() : back());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", away);
    window.addEventListener("focus", back);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", away);
      window.removeEventListener("focus", back);
    };
  }, [data.attempt_id, finish, supabase]);

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
  const q = data.questions[index];
  const who = [data.student?.name, data.student?.code].filter(Boolean).join(" · ") || "KruKhayan Physics";

  function confirmSubmit() {
    setReviewing(true);
    window.scrollTo({ top: 0 });
  }
  const unanswered = data.questions.map((qq, i) => ({ id: qq.id, n: i + 1 })).filter((x) => answers[x.id] === undefined);


  const block = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <div
      className="relative space-y-4 select-none"
      style={{ WebkitTouchCallout: "none" }}
      onCopy={block}
      onCut={block}
      onContextMenu={block}
      onDragStart={block}
    >
      {/* ลายน้ำเต็มจอ */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-30" style={{ backgroundImage: watermark(who) }} />

      {/* แถบเวลาติดด้านบนตลอด */}
      <div className="sticky top-0 z-20 -mx-4 sm:mx-0 px-4 py-3 bg-slate-50 border-b-2 border-slate-200 flex items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate font-display font-semibold text-slate-800">{data.title}</h1>
        <span className="text-sm text-slate-600 whitespace-nowrap">
          ตอบแล้ว <span className="font-num tnum font-semibold text-slate-800">{answered}</span>/<span className="font-num tnum">{total}</span>
        </span>
        <span aria-label={`เหลือเวลา ${mm} นาที ${ss} วินาที`} className={`font-num tnum text-2xl font-bold ${urgent ? "text-red-600" : "text-slate-800"}`}>
          {mm}:{ss}
        </span>
      </div>

      {leaveNotice && (
        <p role="alert" className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-sm px-3 py-2">
          {leaveNotice}
        </p>
      )}
      {!leaveNotice && data.max_leaves > 0 && (
        <p className="text-xs text-slate-500">
          ห้ามออกจากหน้านี้ระหว่างทำ · ออกไปแล้ว <span className="font-num tnum">{leaves}</span>/<span className="font-num tnum">{data.max_leaves}</span> ครั้ง
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-300 rounded-sm px-3 py-2">
          {error}
        </p>
      )}

      {/* หน้ายืนยันก่อนส่ง */}
      {reviewing && (
        <section aria-label="ยืนยันการส่งคำตอบ" className="bg-white border-2 border-porcelain rounded-sm p-5 space-y-4">
          <h2 className="font-display text-xl font-bold text-slate-800">ตรวจก่อนส่ง</h2>
          <p className="text-slate-700">
            ตอบแล้ว <span className="font-num tnum text-2xl font-bold text-slate-800">{answered}</span> จาก{" "}
            <span className="font-num tnum font-semibold">{total}</span> ข้อ
          </p>
          {unanswered.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-amber-700">ยังไม่ได้ตอบ {unanswered.length} ข้อ — กดเลขข้อเพื่อกลับไปตอบ</p>
              <div className="flex flex-wrap gap-1.5">
                {unanswered.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => {
                      setIndex(x.n - 1);
                      setReviewing(false);
                    }}
                    className="font-num tnum h-9 min-w-9 px-2 rounded-sm border-2 border-amber-300 text-sm font-semibold text-amber-800"
                  >
                    {x.n}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-green-700">ตอบครบทุกข้อแล้ว</p>
          )}
          <p className="text-sm text-slate-600">ส่งแล้วแก้คำตอบไม่ได้</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setReviewing(false)}
              disabled={submitting}
              className="flex-1 rounded-sm border-2 border-slate-300 py-2.5 font-semibold text-slate-700 disabled:opacity-50"
            >
              กลับไปตรวจคำตอบ
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex-1 rounded-sm py-2.5 font-semibold bg-[oklch(50%_0.24_345)] text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)] disabled:opacity-50"
            >
              {submitting ? "กำลังส่ง..." : "ยืนยันส่งคำตอบ"}
            </button>
          </div>
        </section>
      )}

      {!reviewing && (
      <>
      {/* ข้อปัจจุบัน */}
      {q && (
        <section aria-label={`ข้อ ${index + 1} จาก ${total}`} className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
          <p className="text-slate-800 leading-relaxed">
            <span className="font-display font-bold mr-1.5">{index + 1}.</span>
            <QuizText text={q.prompt} />
          </p>
          {q.image && (
            // eslint-disable-next-line @next/next/no-img-element -- data URI ใช้ next/image ไม่ได้
            <img src={q.image} alt={`รูปประกอบข้อ ${index + 1}`} draggable={false} className="max-h-72 w-auto max-w-full rounded-sm border border-slate-200 bg-[oklch(100%_0_0)]" />
          )}
          <div role="radiogroup" aria-label={`ตัวเลือกข้อ ${index + 1}`} className="grid gap-2">
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
        </section>
      )}

      {/* ก่อนหน้า / ถัดไป */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex-1 rounded-sm border-2 border-slate-300 py-2.5 font-semibold text-slate-700 disabled:opacity-30"
        >
          ← ข้อก่อนหน้า
        </button>
        {index < total - 1 ? (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            className="flex-1 rounded-sm border-2 border-porcelain py-2.5 font-semibold text-slate-800"
          >
            ข้อถัดไป →
          </button>
        ) : (
          <button
            type="button"
            onClick={confirmSubmit}
            disabled={submitting}
            className="flex-1 rounded-sm py-2.5 font-semibold bg-[oklch(50%_0.24_345)] text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)] disabled:opacity-50"
          >
            {submitting ? "กำลังส่ง..." : "ส่งคำตอบ"}
          </button>
        )}
      </div>

      {/* เลขข้อทั้งหมด: กดกระโดดไปข้อนั้น · ทึบ = ตอบแล้ว */}
      <nav aria-label="เลือกข้อ" className="bg-white border border-slate-200 rounded-sm p-3 space-y-3">
        <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
          {data.questions.map((qq, i) => {
            const done = answers[qq.id] !== undefined;
            const current = i === index;
            return (
              <button
                key={qq.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`ไปข้อ ${i + 1}${done ? " (ตอบแล้ว)" : ""}`}
                aria-current={current ? "step" : undefined}
                className={`font-num tnum h-9 rounded-sm border-2 text-sm font-semibold ${
                  done ? "bg-trace-cyan border-trace-cyan text-[var(--sign-ink)]" : "border-slate-300 text-slate-600"
                } ${current ? "ring-2 ring-offset-2 ring-offset-[var(--c-white)] ring-[var(--porcelain)]" : ""}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={confirmSubmit}
          disabled={submitting}
          className="w-full rounded-sm py-2.5 text-sm font-semibold border-2 border-[oklch(50%_0.24_345)] text-slate-800 hover:bg-slate-100 disabled:opacity-50"
        >
          {submitting ? "กำลังส่ง..." : `ส่งคำตอบ (ตอบแล้ว ${answered}/${total} ข้อ)`}
        </button>
      </nav>
      </>
      )}
    </div>
  );
}
