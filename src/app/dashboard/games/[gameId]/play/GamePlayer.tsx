"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import QuizText from "@/components/QuizText";
import { unitTrace } from "@/lib/traces";
import {
  CHOICE_LETTERS,
  formatNumber,
  parseNumber,
  type GameFeedback,
  type GameItem,
  type GamePayload,
  type GameStage,
} from "@/lib/game";

/** ส่วนประกอบของเกมภารกิจ: หน้าเริ่ม · การ์ดโจทย์ · สรุปผล (ฉากผจญภัยอยู่ใน Adventure.tsx) */

export type IntroInfo = { title: string; description: string | null; stages: GameStage[]; courseId: string };

export function BackLink({ courseId, label = "กลับไปหน้ารายวิชา" }: { courseId: string; label?: string }) {
  return (
    <Link
      href={`/dashboard/courses/${courseId}`}
      className="inline-flex min-h-12 items-center justify-center rounded-sm border-2 border-porcelain px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 sm:min-h-0"
    >
      {label}
    </Link>
  );
}

const stageColor = (stage: number) => unitTrace(stage - 1);

// ---------------------------------------------------------------------------
// หน้าเริ่มภารกิจ
// ---------------------------------------------------------------------------
export function Intro({ phase, onStart, children }: { phase: IntroInfo; onStart: () => void; children?: React.ReactNode }) {
  return (
    <div className="space-y-5 rounded-sm border-2 border-porcelain bg-white p-5 sm:p-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-slate-800">{phase.title}</h1>
        {phase.description && <p className="text-slate-600">{phase.description}</p>}
      </div>

      {/* ด่านทั้งหมดเป็นจุดบนลายวงจร */}
      <ol className="space-y-0">
        {phase.stages.map((s, i) => (
          <li key={i} className="flex items-stretch gap-3">
            <span aria-hidden className="relative w-6 shrink-0">
              {i > 0 && <span className="absolute left-1/2 top-0 h-1/2 w-[3px] -translate-x-1/2 bg-slate-300" />}
              {i < phase.stages.length - 1 && <span className="absolute left-1/2 top-1/2 bottom-0 w-[3px] -translate-x-1/2 bg-slate-300" />}
              <span
                className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-porcelain route-glow"
                style={{ background: stageColor(i + 1), color: stageColor(i + 1) }}
              />
            </span>
            <span className="py-2.5">
              <span className="block font-display font-semibold text-slate-800">ด่าน {i + 1} · {s.title}</span>
              {s.intro && (
                <span className="block text-sm text-slate-500">
                  <QuizText text={s.intro} />
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>

      {children}

      <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
        <li>ตอบแล้วรู้ผลทันที พร้อมคำอธิบาย — <b className="text-slate-800">คะแนนนับเฉพาะคำตอบแรก</b></li>
        <li>วิ่งฝ่าด่าน เจอศัตรูต้องตอบโจทย์ ตอบถูกยิงทำลาย ตอบผิดโดนโจมตีเสียหัวใจ</li>
        <li>ตอบถูกต่อเนื่องได้คอมโบ ตอบเร็วได้โบนัส XP (หัวใจและ XP ไม่ใช่คะแนนเก็บ)</li>
        <li>ปิดหน้าแล้วกลับมาเล่นต่อจากข้อที่ค้างได้ แต่เล่นซ้ำเพื่อเอาคะแนนใหม่ไม่ได้</li>
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onStart}
          className="min-h-12 rounded-sm bg-[oklch(50%_0.24_345)] px-6 py-2.5 font-display text-lg font-bold text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)]"
        >
          เริ่มภารกิจ
        </button>
        <BackLink courseId={phase.courseId} label="ยังไม่เล่นตอนนี้" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// การ์ดโจทย์ (ใช้ในเกมผจญภัย Adventure.tsx)
// ---------------------------------------------------------------------------
export function QuestionCard({
  item,
  number,
  total,
  feedback,
  busy,
  timeLeft,
  timeTotal,
  onSubmit,
  onNext,
  isLast,
}: {
  item: GameItem;
  number: number;
  total: number;
  feedback: GameFeedback | undefined;
  busy: boolean;
  timeLeft: number;
  timeTotal: number;
  onSubmit: (choice: number | null, value: number | null) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [mantissa, setMantissa] = useState("");
  const [exponent, setExponent] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);
  const answered = !!feedback;
  const color = stageColor(item.stage);

  function submitNumeric() {
    const m = parseNumber(mantissa);
    if (m === null) return setInvalid("ใส่ตัวเลขให้ถูกรูปแบบ เช่น 2.5");
    let value = m;
    if (item.scientific) {
      const e = exponent.trim() === "" ? 0 : parseNumber(exponent);
      if (e === null || !Number.isInteger(e)) return setInvalid("เลขชี้กำลังต้องเป็นจำนวนเต็ม เช่น 8 หรือ -3");
      value = m * 10 ** e;
    }
    setInvalid(null);
    onSubmit(null, value);
  }

  const timePct = Math.max(0, Math.min(1, timeLeft / timeTotal));

  return (
    <section
      aria-label={`ข้อ ${number} จาก ${total}`}
      className={`space-y-4 rounded-sm border-2 bg-white p-4 sm:p-5 transition-shadow ${
        feedback ? (feedback.ok ? "border-green-600 answer-right" : "border-red-500 answer-wrong") : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-3 text-sm">
        <span className="font-display font-semibold" style={{ color }}>
          ข้อ {number}/{total}
        </span>
        <span className="text-slate-500">{Number(item.points)} คะแนน</span>
        {/* โบนัสเวลา: แถบหดลงตามเวลา ไม่มีผลกับคะแนน */}
        {!answered && (
          <span className="ml-auto flex items-center gap-2 text-xs text-slate-500" title="ตอบก่อนหมดแถบ ได้โบนัส XP (ไม่มีผลกับคะแนน)">
            โบนัส
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
              <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${timePct * 100}%`, background: color }} />
            </span>
          </span>
        )}
      </div>

      <p className="leading-relaxed text-slate-800">
        <QuizText text={item.prompt} />
      </p>
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element -- data URI ใช้ next/image ไม่ได้
        <img src={item.image} alt={`รูปประกอบข้อ ${number}`} className="max-h-72 w-auto max-w-full rounded-sm border border-slate-200 bg-[oklch(100%_0_0)]" />
      )}

      {item.kind === "choice" && item.choices && (
        <div role="radiogroup" aria-label={`ตัวเลือกข้อ ${number}`} className="grid gap-2">
          {item.choices.map((text, k) => {
            const isGiven = answered ? feedback!.given === k : picked === k;
            const isKey = answered && feedback!.correct_index === k;
            const cls = answered
              ? isKey
                ? "border-green-600 bg-green-50"
                : isGiven
                  ? "border-red-500 bg-red-50"
                  : "border-slate-200 opacity-60"
              : isGiven
                ? "border-trace-cyan bg-[color-mix(in_oklch,var(--trace-cyan)_14%,transparent)]"
                : "border-slate-200 hover:border-slate-400";
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={isGiven}
                disabled={answered || busy}
                onClick={() => setPicked(k)}
                className={`flex min-h-12 items-start gap-3 rounded-sm border-2 px-3 py-2.5 text-left transition-colors ${cls}`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full border-2 font-display text-sm font-semibold ${
                    isKey ? "border-green-600 bg-green-600 text-[oklch(100%_0_0)]" : isGiven ? "border-trace-cyan text-slate-800" : "border-slate-300 text-slate-500"
                  }`}
                >
                  {CHOICE_LETTERS[k]}
                </span>
                <QuizText text={text} className="pt-0.5 text-slate-800" />
              </button>
            );
          })}
        </div>
      )}

      {/* ตอบแล้วซ่อนช่องกรอก — คำตอบที่ให้และเฉลยแสดงในกล่องผลด้านล่าง */}
      {item.kind === "numeric" && !answered && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              enterKeyHint={item.scientific ? "next" : "done"}
              aria-label="คำตอบ"
              placeholder={item.scientific ? "เช่น 2.5" : "คำตอบ"}
              value={answered ? "" : mantissa}
              disabled={answered || busy}
              onChange={(e) => setMantissa(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !item.scientific) submitNumeric();
              }}
              className="h-12 w-32 rounded-sm border-2 border-slate-300 bg-white px-3 text-center font-num text-lg text-slate-800"
            />
            {item.scientific && (
              <>
                <span className="font-num text-lg text-slate-600">× 10</span>
                <span className="flex items-center gap-1 self-start">
                  <button
                    type="button"
                    disabled={answered || busy}
                    onClick={() => setExponent((x) => (x.startsWith("-") ? x.slice(1) : `-${x}`))}
                    aria-label="สลับเครื่องหมายเลขชี้กำลัง"
                    className="grid size-11 place-items-center rounded-sm border-2 border-slate-300 font-num text-lg text-slate-600"
                  >
                    ±
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    enterKeyHint="done"
                    aria-label="เลขชี้กำลังของ 10"
                    placeholder="n"
                    value={answered ? "" : exponent}
                    disabled={answered || busy}
                    onChange={(e) => setExponent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitNumeric();
                    }}
                    className="h-11 w-16 rounded-sm border-2 border-slate-300 bg-white px-2 text-center font-num text-lg text-slate-800"
                  />
                </span>
              </>
            )}
            {item.unit && <span className="font-num text-lg text-slate-700">{item.unit}</span>}
          </div>
          {invalid && <p className="text-sm text-red-700">{invalid}</p>}
        </div>
      )}

      {!answered ? (
        <button
          type="button"
          disabled={busy || (item.kind === "choice" ? picked === null : mantissa.trim() === "")}
          onClick={() => (item.kind === "choice" ? onSubmit(picked, null) : submitNumeric())}
          className="min-h-12 w-full rounded-sm bg-[oklch(50%_0.24_345)] font-display text-lg font-bold text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)] disabled:opacity-40"
        >
          {busy ? "กำลังตรวจ..." : "ยืนยันคำตอบ"}
        </button>
      ) : (
        <FeedbackPanel item={item} feedback={feedback!} onNext={onNext} isLast={isLast} />
      )}
    </section>
  );
}

function FeedbackPanel({ item, feedback, onNext, isLast }: { item: GameItem; feedback: GameFeedback; onNext: () => void; isLast: boolean }) {
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
    nextRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);
  const correctText =
    item.kind === "choice"
      ? feedback.correct_index !== null && item.choices
        ? `${CHOICE_LETTERS[feedback.correct_index]}. ${item.choices[feedback.correct_index]}`
        : null
      : feedback.answer !== null
        ? `${formatNumber(Number(feedback.answer), item.scientific)}${item.unit ? ` ${item.unit}` : ""}`
        : null;
  const givenText =
    item.kind === "numeric" && feedback.given !== null
      ? `${formatNumber(Number(feedback.given), item.scientific)}${item.unit ? ` ${item.unit}` : ""}`
      : null;

  return (
    <div className="space-y-3" aria-live="polite">
      <p className={`font-display text-xl font-bold ${feedback.ok ? "text-green-700" : "text-red-700"}`}>
        {feedback.ok ? `ถูกต้อง! +${Number(feedback.pts)} คะแนน` : "ยังไม่ถูก"}
      </p>
      {!feedback.ok && (
        <p className="text-sm text-slate-700">
          {givenText && (
            <>
              คุณตอบ <QuizText text={givenText} /> ·{" "}
            </>
          )}
          คำตอบที่ถูก: <b className="text-slate-800">{correctText && <QuizText text={correctText} />}</b>
        </p>
      )}
      {feedback.explanation && (
        <p className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
          <QuizText text={feedback.explanation} />
        </p>
      )}
      <button
        ref={nextRef}
        type="button"
        onClick={onNext}
        className="min-h-12 w-full rounded-sm border-2 border-porcelain bg-white font-display text-lg font-bold text-slate-800 hover:bg-slate-100"
      >
        {isLast ? "สรุปผลภารกิจ" : "ข้อต่อไป"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// สรุปผล
// ---------------------------------------------------------------------------
function rankOf(pct: number) {
  if (pct >= 90) return { rank: "S", note: "สุดยอด! เข้าใจครบแทบทุกเรื่อง" };
  if (pct >= 75) return { rank: "A", note: "เก่งมาก เหลืออีกนิดเดียว" };
  if (pct >= 60) return { rank: "B", note: "ผ่านภารกิจ ทบทวนข้อที่พลาดอีกครั้งนะ" };
  return { rank: "C", note: "ลองอ่านคำอธิบายข้อที่พลาดด้านล่าง แล้วถามครูได้เลย" };
}

export function Results({ data, courseId, hero }: { data: GamePayload; courseId: string; hero?: React.ReactNode }) {
  const score = Number(data.score);
  const max = Number(data.max_score);
  const pct = max ? (score / max) * 100 : 0;
  const { rank, note } = rankOf(pct);
  const right = data.items.filter((it) => data.feedback[it.id]?.ok).length;
  const [best] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem(`game:${data.play_id}`) ?? "{}") as { best?: number }).best ?? 0;
    } catch {
      return 0;
    }
  });
  const wrong = useMemo(() => data.items.filter((it) => !data.feedback[it.id]?.ok), [data]);

  return (
    <div className="space-y-5">
      <section className="stage-enter space-y-4 rounded-sm border-2 border-porcelain bg-white p-6 text-center">
        {hero}
        <h1 className="font-display text-2xl font-bold text-slate-800">ภารกิจสำเร็จ</h1>
        <p className="-mt-2 text-slate-600">{data.title}</p>
        <div className="flex items-center justify-center gap-6">
          <span
            className="grid size-20 place-items-center rounded-full border-[3px] border-trace-yellow font-display text-4xl font-bold text-trace-yellow route-glow"
            aria-label={`ระดับ ${rank}`}
          >
            {rank}
          </span>
          <p className="text-left font-num tnum">
            <span className="text-5xl font-bold text-slate-800">{score}</span>
            <span className="text-2xl text-slate-500"> / {max}</span>
            <span className="block font-sans text-sm text-slate-500">คะแนนเก็บ</span>
          </p>
        </div>
        <p className="text-slate-600">{note}</p>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-sm border border-slate-200 p-2">
            <dt className="text-xs text-slate-500">ตอบถูก</dt>
            <dd className="font-num tnum text-lg font-semibold text-slate-800">
              {right}/{data.items.length}
            </dd>
          </div>
          <div className="rounded-sm border border-slate-200 p-2">
            <dt className="text-xs text-slate-500">XP</dt>
            <dd className="font-num tnum text-lg font-semibold text-trace-cyan">{Number(data.xp).toLocaleString()}</dd>
          </div>
          <div className="rounded-sm border border-slate-200 p-2">
            <dt className="text-xs text-slate-500">คอมโบสูงสุด</dt>
            <dd className="font-num tnum text-lg font-semibold text-slate-800">{best ? `×${best}` : "–"}</dd>
          </div>
        </dl>
        <BackLink courseId={courseId} />
      </section>

      {wrong.length > 0 && (
        <section aria-label="ทบทวนข้อที่พลาด" className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-slate-800">ทบทวนข้อที่พลาด ({wrong.length} ข้อ)</h2>
          {wrong.map((it) => {
            const f = data.feedback[it.id];
            const n = data.items.indexOf(it) + 1;
            const correct =
              it.kind === "choice"
                ? f?.correct_index != null && it.choices
                  ? `${CHOICE_LETTERS[f.correct_index]}. ${it.choices[f.correct_index]}`
                  : "–"
                : f?.answer != null
                  ? `${formatNumber(Number(f.answer), it.scientific)}${it.unit ? ` ${it.unit}` : ""}`
                  : "–";
            return (
              <article key={it.id} className="space-y-2 rounded-sm border border-slate-200 bg-white p-4">
                <p className="text-sm leading-relaxed text-slate-800">
                  <span className="mr-1.5 font-display font-bold" style={{ color: stageColor(it.stage) }}>
                    ข้อ {n}
                  </span>
                  <QuizText text={it.prompt} />
                </p>
                <p className="text-sm text-slate-700">
                  คำตอบที่ถูก: <b className="text-green-700"><QuizText text={correct} /></b>
                </p>
                {f?.explanation && (
                  <p className="text-sm leading-relaxed text-slate-600">
                    <QuizText text={f.explanation} />
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
