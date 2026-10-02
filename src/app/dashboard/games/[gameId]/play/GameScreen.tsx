"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import QuizText from "@/components/QuizText";
import { unitTrace } from "@/lib/traces";
import { CHOICE_LETTERS, formatNumber, parseNumber, type GameFeedback, type GameItem } from "@/lib/game";

/**
 * จอเกมเต็มหน้าจอ — ฉากอยู่บน แผงควบคุม (โจทย์/ปุ่ม) อยู่ล่าง
 * หน้าเว็บไม่เลื่อน: ถ้าโจทย์ยาวเกิน เลื่อนเฉพาะในแผงควบคุม ฉากยังอยู่กับที่
 * ทับแถบเมนูของแดชบอร์ด จึงมีปุ่มออกในฉากแทน (ออกแล้วกลับมาเล่นต่อได้)
 */
export function GameScreen({ scene, children }: { scene: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-dvh justify-center overscroll-none bg-slate-50">
      <div className="flex h-full w-full max-w-2xl flex-col sm:border-x-2 sm:border-slate-200">
        {scene}
        <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">{children}</div>
      </div>
    </div>
  );
}

/** ขนาดฉากใช้ร่วมกันทุกโหมด — สูงพอเห็นตัวละคร แต่เหลือที่ให้โจทย์บนมือถือจอเล็ก */
export const SCENE_SIZE = "relative h-[30dvh] min-h-[150px] max-h-[340px] shrink-0 overflow-hidden border-b-2";

export function ExitLink({ courseId }: { courseId: string }) {
  return (
    <Link
      href={`/dashboard/courses/${courseId}`}
      aria-label="ออกจากเกม (กลับมาเล่นต่อได้)"
      title="ออกจากเกม (กลับมาเล่นต่อได้)"
      className="grid size-8 shrink-0 place-items-center rounded-sm border-2 border-slate-300 bg-[color-mix(in_oklch,var(--c-white)_80%,transparent)] text-slate-700 hover:border-slate-500"
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
      </svg>
    </Link>
  );
}

/** แผงข้อความ + ปุ่มใหญ่ปุ่มเดียว (เข้าด่าน / จบด่าน) */
export function BriefPanel({
  title,
  color,
  children,
  action,
  onAction,
  primary = true,
}: {
  title: React.ReactNode;
  color: string;
  children?: React.ReactNode;
  action: string;
  onAction: () => void;
  primary?: boolean;
}) {
  return (
    <div className="stage-enter flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pt-4 text-center">
        <h2 className="font-display text-xl font-bold text-slate-800">{title}</h2>
        <div className="text-sm leading-relaxed text-slate-600">{children}</div>
      </div>
      <div className="shrink-0 px-4 py-3">
        <button
          type="button"
          autoFocus
          onClick={onAction}
          className={`min-h-14 w-full rounded-sm px-6 font-display text-xl font-bold ${
            primary ? "text-[oklch(100%_0_0)]" : "border-2 border-porcelain bg-white text-slate-800 hover:bg-slate-100"
          }`}
          style={primary ? { background: `color-mix(in oklch, ${color} 70%, black)` } : undefined}
        >
          {action}
        </button>
      </div>
    </div>
  );
}

export function PanelNote({ children }: { children: React.ReactNode }) {
  return <p className="grid flex-1 place-items-center px-4 text-center text-sm text-slate-500">{children}</p>;
}

// ---------------------------------------------------------------------------
// แผงโจทย์: โจทย์ (เลื่อนได้ในตัว) + ปุ่มตอบ
// ตัวเลือก: แตะเพื่อเล็ง แตะซ้ำเพื่อยิง — ไม่ต้องเลื่อนหาปุ่มยืนยัน และกันแตะพลาด (คะแนนนับคำตอบแรก)
// ตัวเลข: แป้นกดในเกม ไม่เรียกคีย์บอร์ดมือถือขึ้นมาบังจอ (พิมพ์จากคีย์บอร์ดจริงได้)
// ---------------------------------------------------------------------------
const KEYS = ["7", "8", "9", "back", "4", "5", "6", "sign", "1", "2", "3", ".", "0"] as const;
type Key = (typeof KEYS)[number];

export function QuestionPanel({
  item,
  number,
  total,
  feedback,
  busy,
  timeLeft,
  timeTotal,
  onSubmit,
  onNext,
  nextLabel,
  fireLabel,
  caption,
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
  nextLabel: string;
  fireLabel: string;
  caption?: React.ReactNode;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [mantissa, setMantissa] = useState("");
  const [exponent, setExponent] = useState("");
  const [field, setField] = useState<"m" | "e">("m");
  const [invalid, setInvalid] = useState<string | null>(null);
  const answered = !!feedback;
  const color = unitTrace(item.stage - 1);
  const numeric = item.kind === "numeric";
  const locked = answered || busy;

  const submitNumeric = useCallback(() => {
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
  }, [exponent, item.scientific, mantissa, onSubmit]);

  const press = useCallback(
    (k: Key) => {
      const edit = field === "m" ? setMantissa : setExponent;
      setInvalid(null);
      edit((v) => {
        if (k === "back") return v.slice(0, -1);
        if (k === "sign") return v.startsWith("-") ? v.slice(1) : `-${v}`;
        if (k === ".") return field === "e" || v.includes(".") ? v : `${v === "" || v === "-" ? `${v}0` : v}.`;
        return v.replace("-", "").length >= (field === "m" ? 9 : 3) ? v : v + k;
      });
    },
    [field]
  );

  // คีย์บอร์ดจริง (คอมพิวเตอร์): พิมพ์ตัวเลขได้เลย Enter = ยิง
  useEffect(() => {
    if (!numeric || locked) return;
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key) || e.key === ".") press(e.key as Key);
      else if (e.key === "-") press("sign");
      else if (e.key === "Backspace") press("back");
      else if (e.key === "Tab" && item.scientific) setField((f) => (f === "m" ? "e" : "m"));
      else if (e.key === "Enter" && mantissa !== "") submitNumeric();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item.scientific, locked, mantissa, numeric, press, submitNumeric]);

  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (answered) nextRef.current?.focus({ preventScroll: true });
  }, [answered]);

  const timePct = Math.max(0, Math.min(1, timeLeft / timeTotal));
  const choices = item.kind === "choice" ? (item.choices ?? []) : [];
  // ตัวเลือกสั้นทุกข้อ → วาง 2 คอลัมน์ ประหยัดความสูง
  const twoCols = choices.length > 0 && choices.every((c) => c.length <= 22);

  const correctText = !feedback
    ? null
    : item.kind === "choice"
      ? feedback.correct_index !== null && item.choices
        ? `${CHOICE_LETTERS[feedback.correct_index]}. ${item.choices[feedback.correct_index]}`
        : null
      : feedback.answer !== null
        ? `${formatNumber(Number(feedback.answer), item.scientific)}${item.unit ? ` ${item.unit}` : ""}`
        : null;
  const givenText = !feedback
    ? null
    : item.kind === "choice"
      ? feedback.given !== null && item.choices
        ? `${CHOICE_LETTERS[Number(feedback.given)]}. ${item.choices[Number(feedback.given)]}`
        : null
      : feedback.given !== null
        ? `${formatNumber(Number(feedback.given), item.scientific)}${item.unit ? ` ${item.unit}` : ""}`
        : null;

  return (
    <section aria-label={`ข้อ ${number} จาก ${total}`} className="stage-enter flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 px-4 pt-2.5 text-sm">
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

      {/* ---------- ส่วนที่เลื่อนได้ในตัว ---------- */}
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-4 pb-3 pt-1.5">
        {!answered ? (
          <>
            {caption && (
              <p className="font-display text-sm font-semibold" style={{ color }} aria-live="polite">
                {caption}
              </p>
            )}
            <p className="text-[15px] leading-normal text-slate-800 sm:text-base">
              <QuizText text={item.prompt} />
            </p>
            {item.image && (
              // eslint-disable-next-line @next/next/no-img-element -- data URI ใช้ next/image ไม่ได้
              <img src={item.image} alt={`รูปประกอบข้อ ${number}`} className="max-h-40 w-auto max-w-full rounded-sm border border-slate-200 bg-[oklch(100%_0_0)]" />
            )}

            {choices.length > 0 && (
              <div role="radiogroup" aria-label={`ตัวเลือกข้อ ${number}`} className={`grid gap-2 pt-1 ${twoCols ? "grid-cols-2" : ""}`}>
                {choices.map((text, k) => {
                  const on = picked === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={on ? `${CHOICE_LETTERS[k]}. ${text} — แตะอีกครั้งเพื่อ${fireLabel}` : undefined}
                      disabled={busy}
                      onClick={() => (on ? onSubmit(k, null) : setPicked(k))}
                      className={`relative flex min-h-11 items-start gap-2.5 rounded-sm border-2 px-2.5 py-1.5 text-left text-[15px] leading-snug transition-colors disabled:opacity-60 ${
                        on ? "border-trace-cyan bg-[color-mix(in_oklch,var(--trace-cyan)_16%,transparent)]" : "border-slate-200 bg-white hover:border-slate-400"
                      }`}
                    >
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-full border-2 font-display text-sm font-semibold ${
                          on ? "border-trace-cyan bg-trace-cyan text-[var(--sign-ink)]" : "border-slate-300 text-slate-500"
                        }`}
                      >
                        {CHOICE_LETTERS[k]}
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5 text-slate-800">
                        <QuizText text={text} />
                        {on && (
                          <span className="absolute -top-2.5 right-2 rounded-sm bg-[oklch(50%_0.24_345)] px-2 py-0.5 font-display text-xs font-bold text-[oklch(100%_0_0)]">
                            {busy ? "กำลังตรวจ..." : `แตะอีกครั้งเพื่อ${fireLabel}`}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className={`space-y-2.5 rounded-sm border-2 p-3 ${feedback!.ok ? "border-green-600 answer-right" : "border-red-500 answer-wrong"}`} aria-live="polite">
            <p className={`font-display text-xl font-bold ${feedback!.ok ? "text-green-700" : "text-red-700"}`}>
              {feedback!.ok ? `ถูกต้อง! +${Number(feedback!.pts)} คะแนน` : "ยังไม่ถูก"}
            </p>
            {!feedback!.ok && givenText && (
              <p className="text-sm text-slate-600">
                คุณตอบ: <QuizText text={givenText} />
              </p>
            )}
            {correctText && (
              <p className="text-sm text-slate-700">
                คำตอบที่ถูก: <b className="text-slate-800"><QuizText text={correctText} /></b>
              </p>
            )}
            {feedback!.explanation && (
              <p className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
                <QuizText text={feedback!.explanation} />
              </p>
            )}
          </div>
        )}
      </div>

      {/* ---------- ส่วนที่ติดขอบล่างเสมอ ---------- */}
      {numeric && !answered && (
        <div className="shrink-0 space-y-2 border-t border-slate-200 px-4 py-2.5">
          <div className="flex items-center justify-center gap-2 font-num text-lg">
            <FieldBox label="คำตอบ" value={mantissa} placeholder={item.scientific ? "2.5" : "คำตอบ"} active={field === "m"} onClick={() => setField("m")} wide />
            {item.scientific && (
              <>
                <span className="text-slate-600">× 10</span>
                <span className="-ml-1 self-start">
                  <FieldBox label="เลขชี้กำลังของ 10" value={exponent} placeholder="n" active={field === "e"} onClick={() => setField("e")} />
                </span>
              </>
            )}
            {item.unit && <span className="text-slate-700">{item.unit}</span>}
          </div>
          {invalid && <p className="text-center text-sm text-red-700">{invalid}</p>}
          <div className="grid grid-cols-4 gap-1.5">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                disabled={busy}
                onClick={() => press(k)}
                aria-label={k === "back" ? "ลบ" : k === "sign" ? "สลับเครื่องหมายบวกลบ" : k === "." ? "จุดทศนิยม" : undefined}
                className="grid h-11 place-items-center rounded-sm border-2 border-slate-200 bg-white font-num text-xl font-semibold text-slate-800 hover:border-slate-400 active:bg-slate-100 disabled:opacity-60"
              >
                {k === "back" ? (
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 5h11v14H9l-6-7z" />
                    <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
                  </svg>
                ) : k === "sign" ? (
                  "+/−"
                ) : (
                  k
                )}
              </button>
            ))}
            <button
              type="button"
              disabled={busy || mantissa.replace("-", "") === ""}
              onClick={submitNumeric}
              className="col-span-3 h-11 rounded-sm bg-[oklch(50%_0.24_345)] font-display text-lg font-bold text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)] disabled:opacity-40"
            >
              {busy ? "กำลังตรวจ..." : `${fireLabel}!`}
            </button>
          </div>
        </div>
      )}

      {answered && (
        <div className="shrink-0 px-4 py-3">
          <button
            ref={nextRef}
            type="button"
            onClick={onNext}
            className="min-h-14 w-full rounded-sm border-2 border-porcelain bg-white font-display text-xl font-bold text-slate-800 hover:bg-slate-100"
          >
            {nextLabel}
          </button>
        </div>
      )}
    </section>
  );
}

function FieldBox({
  label,
  value,
  placeholder,
  active,
  onClick,
  wide,
}: {
  label: string;
  value: string;
  placeholder: string;
  active: boolean;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value || "ยังไม่ได้ใส่"}`}
      aria-pressed={active}
      className={`grid place-items-center rounded-sm border-2 bg-white px-2 font-num tnum ${wide ? "h-11 min-w-28" : "h-9 min-w-12 text-base"} ${
        active ? "border-trace-cyan" : "border-slate-300"
      }`}
    >
      {value ? <span className="text-slate-800">{value}</span> : <span className="text-slate-400">{placeholder}</span>}
    </button>
  );
}
