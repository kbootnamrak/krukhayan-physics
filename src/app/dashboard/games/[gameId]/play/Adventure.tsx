"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import QuizText from "@/components/QuizText";
import { unitTrace } from "@/lib/traces";
import { gameErrorMessage, type GameFeedback, type GameItem, type GamePayload, type GameStage } from "@/lib/game";
import { QuestionCard } from "./GamePlayer";
import { CHARACTERS, CharacterSprite, EnemySprite, Heart, Skyline, StageProps, STAGE_SCENES, type CharacterId } from "./sprites";

const HEARTS = 3;
const WALK_MS = 1600;
const FX_MS = 1000;

const stageColor = (stage: number) => unitTrace(stage - 1);

// ---------------------------------------------------------------------------
// ตัวละครที่เลือก — จำไว้ในเครื่อง (ของตกแต่ง ไม่ต้องเก็บในฐานข้อมูล)
// ---------------------------------------------------------------------------
export function loadCharacter(): CharacterId {
  try {
    const v = localStorage.getItem("game:character");
    if (v === "robot" || v === "astronaut" || v === "cat") return v;
  } catch {}
  return "robot";
}
function saveCharacter(id: CharacterId) {
  try {
    localStorage.setItem("game:character", id);
  } catch {}
}

export function CharacterPicker({ value, onChange }: { value: CharacterId; onChange: (id: CharacterId) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-display font-semibold text-slate-800">เลือกตัวละคร</legend>
      <div role="radiogroup" className="grid grid-cols-3 gap-2">
        {CHARACTERS.map((c) => {
          const on = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                saveCharacter(c.id);
                onChange(c.id);
              }}
              className={`flex flex-col items-center gap-1 rounded-sm border-2 px-2 pb-2 pt-3 text-center transition-colors ${
                on ? "border-trace-cyan bg-[color-mix(in_oklch,var(--trace-cyan)_12%,transparent)]" : "border-slate-200 hover:border-slate-400"
              }`}
            >
              <CharacterSprite id={c.id} className={`h-16 w-auto ${on ? "sprite-walking" : ""}`} />
              <span className="font-display text-sm font-semibold text-slate-800">{c.name}</span>
              <span className="text-[11px] leading-tight text-slate-500">{c.line}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// เกมผจญภัย: ตัวละครวิ่งไปทางขวา เจอศัตรู 1 ตัวต่อ 1 ข้อ
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

/**
 * จังหวะของแต่ละข้อ
 * stage   = ป้ายเข้าด่านใหม่ (ฉากหยุด)
 * walk    = ตัวละครวิ่ง ฉากเลื่อน ศัตรูเข้ามาจากขวา
 * ask     = ศัตรูยืนขวาง โจทย์ขึ้นด้านล่าง
 * fx      = ตอบแล้ว: ยิงลำแสง/โดนโจมตี (รอเล่นภาพให้จบ)
 * explain = แสดงผลและคำอธิบาย รอกด "ไปต่อ"
 */
type Beat = "stage" | "walk" | "ask" | "fx" | "explain";

export function Adventure({ data, onFinished }: { data: GamePayload; onFinished: (d: GamePayload) => void }) {
  const supabase = createClient();
  const items = data.items;
  const [character, setCharacter] = useState<CharacterId>("robot");
  const [feedback, setFeedback] = useState<Record<string, GameFeedback>>(data.feedback ?? {});
  const [score, setScore] = useState(Number(data.score));
  const [local, setLocal] = useState<Local>({ xp: 0, streak: 0, best: 0 });
  const [index, setIndex] = useState(() => {
    const i = items.findIndex((it) => !(data.feedback ?? {})[it.id]);
    return i === -1 ? items.length : i;
  });
  const item = items[index] as GameItem | undefined;
  const firstOfStage = !!item && (index === 0 || items[index - 1]?.stage !== item.stage);
  const [beat, setBeat] = useState<Beat>(firstOfStage ? "stage" : "walk");
  const [hearts, setHearts] = useState(HEARTS);
  const [rebooted, setRebooted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gain, setGain] = useState<{ xp: number; key: number } | null>(null);
  const [lastOk, setLastOk] = useState<boolean | null>(null);
  const finishing = useRef(false);
  const askedAt = useRef(0);

  // ค่าที่จำในเครื่อง: ตัวละคร และ XP ระหว่างเล่น
  useEffect(() => {
    const t = setTimeout(() => {
      setCharacter(loadCharacter());
      setLocal(loadLocal(data.play_id));
    }, 0);
    return () => clearTimeout(t);
  }, [data.play_id]);

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

  useEffect(() => {
    if (index >= items.length && !finishing.current) {
      const t = setTimeout(finish, 0);
      return () => clearTimeout(t);
    }
  }, [finish, index, items.length]);

  // วิ่งจนถึงศัตรูแล้วหยุด
  useEffect(() => {
    if (beat !== "walk") return;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => {
      askedAt.current = performance.now();
      setBeat("ask");
    }, reduce ? 50 : WALK_MS);
    return () => clearTimeout(t);
  }, [beat, index]);

  // นาฬิกาโบนัส (เฉพาะตอนโจทย์ขึ้น)
  const [left, setLeft] = useState(data.seconds_per_item);
  useEffect(() => {
    if (beat !== "ask") return;
    const reset = setTimeout(() => setLeft(data.seconds_per_item), 0);
    const id = setInterval(() => setLeft(Math.max(0, data.seconds_per_item - (performance.now() - askedAt.current) / 1000)), 250);
    return () => {
      clearTimeout(reset);
      clearInterval(id);
    };
  }, [beat, data.seconds_per_item]);

  async function submit(choice: number | null, value: number | null) {
    if (!item || busy) return;
    const remaining = Math.max(0, data.seconds_per_item - (performance.now() - askedAt.current) / 1000);
    setBusy(true);
    setError(null);
    const { data: res, error: e } = await supabase.rpc("game_answer", { p_play: data.play_id, p_item: item.id, p_choice: choice, p_value: value });
    setBusy(false);
    if (e) return setError(gameErrorMessage(e.message));
    const f = res as GameFeedback;
    setFeedback((prev) => ({ ...prev, [item.id]: f }));
    setScore((s) => s + Number(f.pts));
    const streak = f.ok ? local.streak + 1 : 0;
    const combo = f.ok ? Math.min(2, 1 + (streak - 1) * 0.25) : 1;
    const xpGain = f.ok ? Math.round(100 * Number(item.points) * combo + remaining * 2) : 0;
    const next = { xp: local.xp + xpGain, streak, best: Math.max(local.best, streak) };
    setLocal(next);
    saveLocal(data.play_id, next);
    setLastOk(f.ok);
    if (xpGain) setGain({ xp: xpGain, key: Date.now() });
    if (!f.ok) {
      // หัวใจหมด → รีบูตเต็มหลอด เล่นต่อได้ (คะแนนไม่หาย ใบงานต้องทำให้ครบ)
      if (hearts - 1 <= 0) {
        setRebooted(true);
        setHearts(HEARTS);
      } else {
        setHearts(hearts - 1);
      }
    }
    setBeat("fx");
    setTimeout(() => setBeat("explain"), FX_MS);
  }

  function next() {
    const n = index + 1;
    const nextItem = items[n];
    setLastOk(null);
    setRebooted(false);
    setIndex(n);
    if (!nextItem) return;
    if (nextItem.stage !== item?.stage) {
      setHearts(HEARTS);
      setBeat("stage");
    } else {
      setBeat("walk");
    }
  }

  const stage = item?.stage ?? data.stages.length;
  const stageInfo = data.stages[stage - 1];
  // แต่ละเกมกำหนดชื่อฉากและภาพฉากของด่านเองได้ (ไม่กำหนด = ตามลำดับด่าน)
  const art = stageInfo?.art ?? stage;
  const sceneName = stageInfo?.scene ?? STAGE_SCENES[(stage - 1) % STAGE_SCENES.length];
  const color = stageColor(stage);
  const isBoss = index === items.length - 1;
  const stageItems = items.filter((x) => x.stage === stage);
  const posInStage = item ? stageItems.indexOf(item) + 1 : stageItems.length;

  return (
    <div className="space-y-3">
      {/* ---------- ฉาก ---------- */}
      <div
        className={`adv-scene relative -mx-4 h-[34vh] min-h-[210px] max-h-[380px] sm:h-[44vh] overflow-hidden border-y-2 sm:mx-0 sm:rounded-sm sm:border-2 ${beat === "walk" ? "is-walking" : ""}`}
        style={{ borderColor: color, background: `linear-gradient(to bottom, color-mix(in oklch, ${color} 10%, var(--c-slate-50)), var(--c-slate-50))` }}
      >
        {/* ชั้นไกล/กลาง/พื้น เลื่อนต่างความเร็ว */}
        <div className="adv-layer adv-far absolute inset-x-0 bottom-[22%] h-[55%] w-[200%] opacity-80">
          <Skyline color={color} />
        </div>
        <div className="adv-layer adv-mid absolute inset-x-0 bottom-[20%] h-[50%] w-[200%]">
          <StageProps stage={art} color={color} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[20%] border-t-2" style={{ borderColor: color, background: "var(--c-slate-100)" }}>
          <div className="adv-layer adv-ground h-full w-[200%]" style={{ backgroundImage: `repeating-linear-gradient(90deg, transparent 0 38px, color-mix(in oklch, ${color} 45%, transparent) 38px 40px)` }} />
        </div>

        {/* HUD */}
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 py-2">
          <span className="flex">{Array.from({ length: HEARTS }, (_, i) => <Heart key={i} full={i < hearts} />)}</span>
          <span className="min-w-0 flex-1 truncate font-display text-xs font-semibold text-slate-700 sm:text-sm">
            ด่าน {stage} · {sceneName} · {posInStage}/{stageItems.length}
          </span>
          {local.streak >= 2 && <span className="rounded-sm border-2 border-trace-yellow px-1.5 font-display text-xs font-bold text-trace-yellow">×{local.streak}</span>}
          <span className="relative font-num tnum text-xs text-slate-600 sm:text-sm">
            <b className="text-trace-cyan">{Math.round(local.xp).toLocaleString()}</b> XP
            {gain && (
              <span key={gain.key} aria-hidden className="xp-pop absolute -bottom-5 right-0 font-display text-sm font-bold text-trace-lime">
                +{gain.xp}
              </span>
            )}
          </span>
          <span className="font-num tnum text-base font-bold text-slate-800" aria-label={`คะแนน ${score} จาก ${Number(data.max_score)}`}>
            {score}
            <span className="text-xs font-normal text-slate-500">/{Number(data.max_score)}</span>
          </span>
        </div>

        {/* ตัวละคร */}
        <div className={`absolute bottom-[19%] left-[10%] w-[18%] max-w-24 ${beat === "fx" && lastOk === false ? "adv-hurt" : ""}`}>
          <CharacterSprite id={character} className={`h-auto w-full ${beat === "walk" ? "sprite-walking" : "sprite-idle"}`} />
        </div>

        {/* ศัตรู / บอส */}
        {item && beat !== "stage" && (
          <div
            key={item.id}
            className={`absolute bottom-[19%] right-[10%] ${isBoss ? "w-[30%] max-w-40" : "w-[20%] max-w-28"} ${beat === "walk" ? "adv-enemy-enter" : ""} ${
              (beat === "fx" || beat === "explain") && lastOk ? "adv-enemy-down" : ""
            } ${beat === "fx" && lastOk === false ? "adv-enemy-attack" : ""}`}
          >
            {isBoss && beat !== "walk" && (
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-sm bg-[var(--c-red-500)] px-1.5 font-display text-xs font-bold text-[oklch(100%_0_0)]">บอส</span>
            )}
            <EnemySprite stage={art} boss={isBoss} className="h-auto w-full" />
          </div>
        )}

        {/* ลำแสงจากตัวละครไปศัตรู / ระเบิด */}
        {beat === "fx" && lastOk && (
          <>
            <span aria-hidden className="adv-beam absolute bottom-[34%] left-[26%] right-[22%] h-1.5 origin-left rounded-full" style={{ background: `linear-gradient(90deg, var(--trace-cyan), ${color})`, boxShadow: `0 0 12px ${color}` }} />
            <span aria-hidden className="adv-burst absolute bottom-[26%] right-[14%] size-20">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="absolute left-1/2 top-1/2 size-2.5 rounded-full" style={{ background: i % 2 ? color : "var(--trace-yellow)", transform: `rotate(${i * 45}deg) translateX(0)`, ["--a" as string]: `${i * 45}deg` }} />
              ))}
            </span>
          </>
        )}
        {beat === "fx" && lastOk === false && (
          <span aria-hidden className="adv-zap absolute bottom-[30%] left-[24%] right-[24%] h-1 origin-right rounded-full bg-[var(--c-red-500)]" />
        )}

        {/* ป้ายเข้าด่าน */}
        {beat === "stage" && item && (
          <div className="stage-enter absolute inset-x-4 top-1/2 mx-auto max-w-sm -translate-y-1/2 space-y-3 rounded-sm border-2 bg-[color-mix(in_oklch,var(--c-white)_92%,transparent)] p-4 text-center" style={{ borderColor: color }}>
            <h2 className="font-display text-xl font-bold text-slate-800">
              <span style={{ color }}>ด่าน {stage}</span> · {sceneName}
            </h2>
            <StageBrief info={data.stages[stage - 1]} count={stageItems.length} />
            <button
              type="button"
              autoFocus
              onClick={() => setBeat("walk")}
              className="min-h-12 w-full rounded-sm px-6 font-display text-lg font-bold text-[oklch(100%_0_0)]"
              style={{ background: `color-mix(in oklch, ${color} 70%, black)` }}
            >
              ลุย!
            </button>
          </div>
        )}

        {rebooted && beat === "explain" && (
          <p className="stage-enter absolute inset-x-0 top-10 text-center font-display text-sm font-bold text-trace-yellow">พลังหมด! รีบูตระบบ หัวใจเต็มแล้ว ลุยต่อ</p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* ---------- โจทย์ ---------- */}
      {item && (beat === "ask" || beat === "fx" || beat === "explain") && (
        <div className="stage-enter">
          <QuestionCard
            key={item.id}
            item={item}
            number={index + 1}
            total={items.length}
            feedback={beat === "explain" ? feedback[item.id] : undefined}
            busy={busy || beat === "fx"}
            timeLeft={left}
            timeTotal={data.seconds_per_item}
            onSubmit={submit}
            onNext={next}
            isLast={index === items.length - 1}
          />
        </div>
      )}
      {item && beat === "walk" && <p className="text-center text-sm text-slate-500">กำลังวิ่งไปข้างหน้า...</p>}
      {!item && <p className="text-center text-sm text-slate-500">{busy ? "กำลังสรุปผลภารกิจ..." : "ผ่านครบทุกด่านแล้ว"}</p>}
    </div>
  );
}

function StageBrief({ info, count }: { info: GameStage | undefined; count: number }) {
  return (
    <p className="text-sm text-slate-600">
      {info?.title && <b className="block text-slate-800">{info.title}</b>}
      {info?.intro && <QuizText text={info.intro} />} · ศัตรู {count} ตัว
    </p>
  );
}
