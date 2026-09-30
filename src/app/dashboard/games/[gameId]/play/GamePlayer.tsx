"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import QuizText from "@/components/QuizText";
import { unitTrace } from "@/lib/traces";
import {
  CHOICE_LETTERS,
  formatNumber,
  gameErrorMessage,
  parseNumber,
  type GameFeedback,
  type GameItem,
  type GamePayload,
  type GameStage,
} from "@/lib/game";

/** ส่วนประกอบของเกมภารกิจ: หน้าเริ่ม · ระหว่างเล่น · สรุปผล (หน้า play/page.tsx ต่อข้อมูลเข้าให้) */

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
export function Intro({ phase, onStart }: { phase: IntroInfo; onStart: () => void }) {
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

      <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
        <li>ตอบแล้วรู้ผลทันที พร้อมคำอธิบาย — <b className="text-slate-800">คะแนนนับเฉพาะคำตอบแรก</b></li>
        <li>ตอบถูกต่อเนื่องได้คอมโบ ตอบเร็วได้โบนัส XP (XP ไม่ใช่คะแนนเก็บ)</li>
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
// ระหว่างเล่น
// ---------------------------------------------------------------------------
type Local = { xp: number; streak: number; best: number };

function loadLocal(playId: string): Local {
  try {
    const raw = localStorage.getItem(`game:${playId}`);
    if (raw) return { xp: 0, streak: 0, best: 0, ...JSON.parse(raw) };
  } catch {}
  return { xp: 0, streak: 0, best: 0 };
}
function saveLocal(playId: string, v: Local) {
  try {
    localStorage.setItem(`game:${playId}`, JSON.stringify(v));
  } catch {}
}

export function Playing({ data, onFinished }: { data: GamePayload; onFinished: (d: GamePayload) => void }) {
  const supabase = createClient();
  const items = data.items;
  const [feedback, setFeedback] = useState<Record<string, GameFeedback>>(data.feedback ?? {});
  const [score, setScore] = useState(Number(data.score));
  const [local, setLocal] = useState<Local>({ xp: 0, streak: 0, best: 0 });
  const [index, setIndex] = useState(() => {
    const i = items.findIndex((it) => !(data.feedback ?? {})[it.id]);
    return i === -1 ? items.length : i;
  });
  const [shownStage, setShownStage] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gain, setGain] = useState<{ xp: number; key: number } | null>(null);
  const finishing = useRef(false);

  // XP ระหว่างเล่นเก็บในเครื่อง — กลับมาเล่นต่อแล้วยังอยู่
  useEffect(() => {
    const t = setTimeout(() => setLocal(loadLocal(data.play_id)), 0);
    return () => clearTimeout(t);
  }, [data.play_id]);

  const item = items[index] as GameItem | undefined;
  const fb = item ? feedback[item.id] : undefined;
  const stages = data.stages;

  // เข้าด่านใหม่ → ขึ้นป้ายด่านก่อน
  const needStageCard = !!item && !fb && shownStage !== item.stage && (index === 0 || items[index - 1]?.stage !== item.stage);

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    setBusy(true);
    const { data: res, error: e } = await supabase.rpc("game_finish", { p_play: data.play_id, p_xp: Math.round(local.xp) });
    setBusy(false);
    if (e) {
      finishing.current = false;
      return setError(gameErrorMessage(e.message));
    }
    onFinished(res as GamePayload);
  }, [data.play_id, local.xp, onFinished, supabase]);

  // ครบทุกข้อแล้ว (เช่นกลับมาหลังตอบข้อสุดท้ายแต่ยังไม่ได้กดจบ)
  useEffect(() => {
    if (index >= items.length && !finishing.current) {
      const t = setTimeout(finish, 0);
      return () => clearTimeout(t);
    }
  }, [finish, index, items.length]);

  // นาฬิกาโบนัสของข้อนี้
  const [left, setLeft] = useState(data.seconds_per_item);
  const startedAt = useRef<number>(0);
  useEffect(() => {
    if (!item || fb || needStageCard) return;
    startedAt.current = performance.now();
    const reset = setTimeout(() => setLeft(data.seconds_per_item), 0);
    const id = setInterval(() => {
      const s = data.seconds_per_item - (performance.now() - startedAt.current) / 1000;
      setLeft(Math.max(0, s));
    }, 250);
    return () => {
      clearTimeout(reset);
      clearInterval(id);
    };
  }, [item, fb, needStageCard, data.seconds_per_item]);

  async function submit(choice: number | null, value: number | null) {
    if (!item || busy) return;
    const remaining = Math.max(0, data.seconds_per_item - (performance.now() - startedAt.current) / 1000);
    setBusy(true);
    setError(null);
    const { data: res, error: e } = await supabase.rpc("game_answer", {
      p_play: data.play_id,
      p_item: item.id,
      p_choice: choice,
      p_value: value,
    });
    setBusy(false);
    if (e) return setError(gameErrorMessage(e.message));
    const f = res as GameFeedback;
    setFeedback((prev) => ({ ...prev, [item.id]: f }));
    setScore((s) => s + Number(f.pts));
    // XP: 100 ต่อคะแนน × คอมโบ + โบนัสเวลาที่เหลือ
    const streak = f.ok ? local.streak + 1 : 0;
    const combo = f.ok ? Math.min(2, 1 + (streak - 1) * 0.25) : 1;
    const xpGain = f.ok ? Math.round(100 * Number(item.points) * combo + remaining * 2) : 0;
    const next = { xp: local.xp + xpGain, streak, best: Math.max(local.best, streak) };
    setLocal(next);
    saveLocal(data.play_id, next);
    if (xpGain) setGain({ xp: xpGain, key: Date.now() });
  }

  const answeredCount = Object.keys(feedback).length;

  return (
    <div className="space-y-4">
      <Hud
        title={data.title}
        stages={stages}
        items={items}
        feedback={feedback}
        currentStage={item?.stage ?? stages.length}
        score={score}
        maxScore={Number(data.max_score)}
        xp={local.xp}
        streak={local.streak}
        gain={gain}
      />

      {error && (
        <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {item && needStageCard && (
        <StageCard
          stage={item.stage}
          info={stages[item.stage - 1]}
          count={items.filter((x) => x.stage === item.stage).length}
          onGo={() => setShownStage(item.stage)}
        />
      )}

      {item && !needStageCard && (
        <QuestionCard
          key={item.id}
          item={item}
          number={index + 1}
          total={items.length}
          feedback={fb}
          busy={busy}
          timeLeft={left}
          timeTotal={data.seconds_per_item}
          onSubmit={submit}
          onNext={() => setIndex((i) => i + 1)}
          isLast={index === items.length - 1}
        />
      )}

      {!item && (
        <p className="text-sm text-slate-500" aria-live="polite">
          {busy ? "กำลังสรุปผล..." : `ตอบครบ ${answeredCount} ข้อแล้ว`}
        </p>
      )}
    </div>
  );
}

/** แถบสถานะด้านบน: ด่านเป็นจุดบนเส้นวงจร · คะแนน · XP · คอมโบ */
function Hud({
  title,
  stages,
  items,
  feedback,
  currentStage,
  score,
  maxScore,
  xp,
  streak,
  gain,
}: {
  title: string;
  stages: GameStage[];
  items: GameItem[];
  feedback: Record<string, GameFeedback>;
  currentStage: number;
  score: number;
  maxScore: number;
  xp: number;
  streak: number;
  gain: { xp: number; key: number } | null;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 space-y-2.5 border-b-2 border-slate-200 bg-slate-50 px-4 py-3 sm:mx-0 sm:rounded-sm sm:border-2">
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate font-display font-semibold text-slate-800">{title}</h1>
        {streak >= 2 && (
          <span className="rounded-sm border-2 border-trace-yellow px-2 py-0.5 font-display text-xs font-bold text-trace-yellow route-glow" aria-label={`ตอบถูกติดกัน ${streak} ข้อ`}>
            คอมโบ ×{streak}
          </span>
        )}
        <span className="relative font-num tnum text-sm text-slate-600">
          <span className="font-semibold text-trace-cyan">{Math.round(xp).toLocaleString()}</span> XP
          {gain && (
            <span key={gain.key} aria-hidden className="xp-pop absolute -top-4 right-0 font-display text-sm font-bold text-trace-lime">
              +{gain.xp}
            </span>
          )}
        </span>
        <span className="font-num tnum text-lg font-bold text-slate-800" aria-label={`คะแนน ${score} จาก ${maxScore}`}>
          {score}
          <span className="text-sm font-normal text-slate-500">/{maxScore}</span>
        </span>
      </div>

      {/* ด่าน: แต่ละด่านเป็นเส้นทองแดง จุดบัดกรีต่อข้อ ทึบ = ตอบแล้ว (เขียว/แดง) */}
      <div className="flex items-center gap-1.5" aria-label="ความคืบหน้า">
        {stages.map((_, si) => {
          const stage = si + 1;
          const its = items.filter((x) => x.stage === stage);
          const color = stageColor(stage);
          const active = stage === currentStage;
          return (
            <div key={si} className="flex min-w-0 flex-1 items-center gap-1" style={{ flexGrow: Math.max(1, its.length) }}>
              <span
                className={`relative flex h-2.5 flex-1 items-center justify-around rounded-full ${active ? "route-glow" : ""}`}
                style={{ background: `color-mix(in oklch, ${color} ${active ? 45 : 22}%, transparent)`, color }}
              >
                {its.map((it) => {
                  const f = feedback[it.id];
                  return (
                    <span
                      key={it.id}
                      className={`size-1.5 rounded-full ${f ? (f.ok ? "bg-green-500" : "bg-red-500") : "bg-[var(--c-slate-50)]"}`}
                    />
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StageCard({ stage, info, count, onGo }: { stage: number; info: GameStage | undefined; count: number; onGo: () => void }) {
  const color = stageColor(stage);
  return (
    <section
      className="stage-enter space-y-4 rounded-sm border-2 bg-white p-6 text-center"
      style={{ borderColor: color, boxShadow: `0 6px 28px -10px color-mix(in oklch, ${color} calc(var(--glow-strength) * 120%), transparent)` }}
    >
      <h2 className="font-display text-2xl font-bold text-slate-800">
        <span style={{ color }}>ด่าน {stage}</span>
        {info?.title && <span className="block">{info.title}</span>}
      </h2>
      {info?.intro && (
        <p className="text-slate-600">
          <QuizText text={info.intro} />
        </p>
      )}
      <p className="text-sm text-slate-500">{count} ข้อ</p>
      <button
        type="button"
        onClick={onGo}
        autoFocus
        className="min-h-12 w-full rounded-sm border-2 px-6 font-display text-lg font-bold text-slate-800 sm:w-auto"
        style={{ borderColor: color }}
      >
        เข้าด่าน
      </button>
    </section>
  );
}

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

export function Results({ data, courseId }: { data: GamePayload; courseId: string }) {
  const score = Number(data.score);
  const max = Number(data.max_score);
  const pct = max ? (score / max) * 100 : 0;
  const { rank, note } = rankOf(pct);
  const right = data.items.filter((it) => data.feedback[it.id]?.ok).length;
  const [best] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem(`game:${data.play_id}`) ?? "{}") as Partial<Local>).best ?? 0;
    } catch {
      return 0;
    }
  });
  const wrong = useMemo(() => data.items.filter((it) => !data.feedback[it.id]?.ok), [data]);

  return (
    <div className="space-y-5">
      <section className="stage-enter space-y-4 rounded-sm border-2 border-porcelain bg-white p-6 text-center">
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
