"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import QuizText from "@/components/QuizText";
import { unitTrace } from "@/lib/traces";
import { gameErrorMessage, type GameFeedback, type GameItem, type GamePayload } from "@/lib/game";
import { BriefPanel, ExitLink, GameScreen, PanelNote, QuestionPanel, SCENE_SIZE } from "./GameScreen";
import { loadCharacter, loadLocal, saveLocal, type Local } from "./Adventure";
import { CHARACTERS, CharacterSprite, Heart, type CharacterId } from "./sprites";
import { FarLayer, skyOf, ThemedEnemy, themeOf, type ThemeId } from "./themes";

const HEARTS = 3;
const FX_MS = 1100;
const stageColor = (stage: number) => unitTrace(stage - 1);

// ชื่อบอสตั้งต้นตามธีม/แบบศัตรู (ด่านใน games.stages ใส่ "boss" เองได้)
const BOSS_NAMES: Record<ThemeId, string[]> = {
  cyber: ["โดรนจอมรบกวน", "ราชากลิตช์", "ประตูสนามทมิฬ", "ป้อมรหัสมรณะ"],
  ocean: ["ราชินีแมงกะพรุน", "ปักเป้ายักษ์", "ปูผลึกหินผา", "ปลาตกเบ็ดเงามืด"],
  space: ["ยานแม่รบกวนสัญญาณ", "อุกกาบาตคลั่ง", "เอเลี่ยนแฮกเกอร์", "หุ่นสำรวจกบฏ"],
};
const BOSS_MOVES: Record<ThemeId, string[]> = {
  cyber: ["คลื่นแทรก", "ไฟกระชาก", "สัญญาณรบกวน", "ไวรัสกลิตช์"],
  ocean: ["หนวดช็อต", "ฟองพิษ", "ก้ามหนีบ", "แสงล่อลวง"],
  space: ["ลำแสงดึงดูด", "ฝนอุกกาบาต", "คลื่นเอเลี่ยน", "เลเซอร์วงโคจร"],
};
const HERO_MOVES: Record<CharacterId, string> = { robot: "เลเซอร์ไบต์", astronaut: "ปืนพลาสมา", cat: "ไมโครเวฟเหมียว" };

/**
 * จังหวะของบอสแบทเทิล
 * intro   = บอสของด่านปรากฏตัว
 * ask     = บอสประกาศท่า โจทย์ขึ้น
 * fx      = ตอบแล้ว: เราโจมตี (ถูก) / บอสสวนกลับ (ผิด)
 * explain = ผลและคำอธิบาย
 * outro   = จบด่าน: บอสล้ม (ตอบถูกหมด) หรือบอสหนีไป
 */
type Beat = "intro" | "ask" | "fx" | "explain" | "outro";

export function Battle({ data, courseId, onFinished }: { data: GamePayload; courseId: string; onFinished: (d: GamePayload) => void }) {
  const supabase = createClient();
  const items = data.items;
  const theme = themeOf(data.theme);
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
  const [beat, setBeat] = useState<Beat>(firstOfStage ? "intro" : "ask");
  const [hearts, setHearts] = useState(HEARTS);
  const [revived, setRevived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<boolean | null>(null);
  const [hit, setHit] = useState<{ dmg: number; key: number } | null>(null);
  const finishing = useRef(false);
  const askedAt = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setCharacter(loadCharacter());
      setLocal(loadLocal(data.play_id));
      askedAt.current = performance.now();
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

  // นาฬิกาโบนัส XP
  const [left, setLeft] = useState(data.seconds_per_item);
  useEffect(() => {
    if (beat !== "ask") return;
    askedAt.current = performance.now();
    const reset = setTimeout(() => setLeft(data.seconds_per_item), 0);
    const id = setInterval(() => setLeft(Math.max(0, data.seconds_per_item - (performance.now() - askedAt.current) / 1000)), 250);
    return () => {
      clearTimeout(reset);
      clearInterval(id);
    };
  }, [beat, index, data.seconds_per_item]);

  // ด่านปัจจุบัน / ข้อมูลบอส
  const stage = item?.stage ?? items[items.length - 1]?.stage ?? 1;
  const stageInfo = data.stages[stage - 1];
  const art = stageInfo?.art ?? stage;
  const color = stageColor(stage);
  const stageItems = items.filter((x) => x.stage === stage);
  const bossMax = stageItems.reduce((s, x) => s + Number(x.points), 0);
  const dealt = stageItems.reduce((s, x) => s + (feedback[x.id]?.ok ? Number(x.points) : 0), 0);
  const bossHp = Math.max(0, bossMax - dealt);
  const bossName = stageInfo?.boss ?? BOSS_NAMES[theme][(art - 1) % 4];
  const bossMove = BOSS_MOVES[theme][(index + stage) % 4];
  const stageDone = stageItems.every((x) => feedback[x.id]);
  const bossDown = stageDone && bossHp === 0;

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
    const nextLocal = { xp: local.xp + xpGain, streak, best: Math.max(local.best, streak) };
    setLocal(nextLocal);
    saveLocal(data.play_id, nextLocal);
    setLastOk(f.ok);
    if (f.ok) setHit({ dmg: Number(item.points), key: Date.now() });
    else if (hearts - 1 <= 0) {
      // หัวใจหมด → ฟื้นพลังเต็ม เล่นต่อได้ (ใบงานต้องทำให้ครบ)
      setRevived(true);
      setHearts(HEARTS);
    } else setHearts(hearts - 1);
    setBeat("fx");
    setTimeout(() => setBeat("explain"), FX_MS);
  }

  function next() {
    setLastOk(null);
    setRevived(false);
    // ข้อสุดท้ายของด่าน → ฉากจบด่านก่อน
    const nextItem = items[index + 1];
    if (beat === "explain" && (!nextItem || nextItem.stage !== item?.stage)) return setBeat("outro");
    advance();
  }
  function advance() {
    const n = index + 1;
    const nextItem = items[n];
    setIndex(n);
    if (!nextItem) return;
    if (nextItem.stage !== item?.stage) {
      setHearts(HEARTS);
      setBeat("intro");
    } else setBeat("ask");
  }

  const heroName = CHARACTERS.find((c) => c.id === character)!.name;

  const sceneNode = (
    <div
      className={SCENE_SIZE}
      style={{ borderColor: color, background: skyOf(theme, color) }}
    >
      <div className="absolute inset-x-0 top-0 h-[60%] w-[200%] opacity-70">
        <FarLayer theme={theme} color={color} />
      </div>
      {/* แท่นของบอส (ขวาบน) และของเรา (ซ้ายล่าง) */}
      <span aria-hidden className="absolute right-[6%] top-[44%] h-[12%] w-[38%] rounded-[50%]" style={{ background: `color-mix(in oklch, ${color} 30%, var(--c-slate-200))`, boxShadow: `0 6px 18px -6px ${color}` }} />
      <span aria-hidden className="absolute bottom-[4%] left-[4%] h-[12%] w-[40%] rounded-[50%]" style={{ background: `color-mix(in oklch, var(--trace-cyan) 25%, var(--c-slate-200))` }} />

      <span className="absolute left-2 top-[max(0.5rem,env(safe-area-inset-top))]">
        <ExitLink courseId={courseId} />
      </span>

      {/* ป้ายบอส */}
      {item !== undefined || beat === "outro" ? (
        <div className="absolute left-12 top-[max(0.5rem,env(safe-area-inset-top))] w-[42%] max-w-56 rounded-sm border-2 bg-[color-mix(in_oklch,var(--c-white)_88%,transparent)] px-2 py-1.5" style={{ borderColor: color }}>
          <p className="truncate font-display text-xs font-bold text-slate-800 sm:text-sm">{bossName}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="font-display text-[10px] font-bold text-[var(--c-red-500)]">HP</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <span
                className="block h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${bossMax ? (bossHp / bossMax) * 100 : 0}%`, background: bossHp / bossMax > 0.5 ? "var(--trace-lime)" : bossHp / bossMax > 0.2 ? "var(--trace-yellow)" : "var(--c-red-500)" }}
              />
            </span>
            <span className="font-num tnum text-[10px] text-slate-600">
              {bossHp}/{bossMax}
            </span>
          </div>
        </div>
      ) : null}

      {/* บอส */}
      <div
        key={`boss-${stage}`}
        className={`absolute right-[12%] top-[10%] w-[30%] max-w-44 ${beat === "intro" ? "battle-boss-enter" : ""} ${beat === "fx" && lastOk ? "battle-boss-hit" : ""} ${
          beat === "fx" && lastOk === false ? "battle-boss-attack" : ""
        } ${beat === "outro" && bossDown ? "adv-enemy-down" : ""} ${beat === "outro" && !bossDown ? "battle-boss-flee" : ""}`}
      >
        <ThemedEnemy theme={theme} art={art} boss className="h-auto w-full" />
        {hit && beat === "fx" && lastOk && (
          <span key={hit.key} aria-hidden className="xp-pop absolute left-1/2 top-0 -translate-x-1/2 font-display text-2xl font-bold text-[var(--c-red-500)]">
            −{hit.dmg}
          </span>
        )}
      </div>

      {/* ตัวเรา */}
      <div className={`absolute bottom-[9%] left-[12%] w-[20%] max-w-28 ${beat === "fx" && lastOk === false ? "adv-hurt" : ""} ${beat === "fx" && lastOk ? "battle-hero-lunge" : ""}`}>
        <CharacterSprite id={character} className="sprite-idle h-auto w-full" />
      </div>

      {/* ป้ายของเรา */}
      <div className="absolute bottom-2 right-2 rounded-sm border-2 border-trace-cyan bg-[color-mix(in_oklch,var(--c-white)_88%,transparent)] px-2 py-1.5 text-right">
        <p className="font-display text-xs font-bold text-slate-800 sm:text-sm">{heroName}</p>
        <span className="flex justify-end">{Array.from({ length: HEARTS }, (_, i) => <Heart key={i} full={i < hearts} />)}</span>
        <p className="font-num tnum text-[11px] text-slate-600">
          <b className="text-trace-cyan">{Math.round(local.xp).toLocaleString()}</b> XP · {score}/{Number(data.max_score)}
        </p>
      </div>

      {/* กระสุน: ของเราพุ่งไปขวาบน · ของบอสพุ่งมาซ้ายล่าง */}
      {beat === "fx" && lastOk && (
        <span aria-hidden className="battle-shot absolute bottom-[26%] left-[28%] size-5 rounded-full" style={{ background: "var(--trace-cyan)", boxShadow: "0 0 16px var(--trace-cyan)" }} />
      )}
      {beat === "fx" && lastOk === false && (
        <span aria-hidden className="battle-shot-back absolute right-[26%] top-[28%] size-5 rounded-full" style={{ background: "var(--c-red-500)", boxShadow: "0 0 16px var(--c-red-500)" }} />
      )}

      {/* ประกาศท่าที่เพิ่งออก */}
      {beat === "fx" && lastOk !== null && item && (
        <p className="stage-enter absolute inset-x-3 top-[46%] text-center font-display text-sm font-bold text-slate-800" aria-live="polite">
          <span className="rounded-sm bg-[color-mix(in_oklch,var(--c-white)_88%,transparent)] px-2 py-1">
            {lastOk ? `${heroName} ใช้ “${HERO_MOVES[character]}”! บอสเสีย HP ${Number(item.points)}` : `“${bossMove}” เข้าเต็ม ๆ! เสียหัวใจ 1 ดวง`}
          </span>
        </p>
      )}

      {revived && beat === "explain" && (
        <p className="stage-enter absolute inset-x-0 top-16 text-center font-display text-sm font-bold text-trace-yellow">พลังหมด! ฟื้นพลังเต็มแล้ว สู้ต่อ</p>
      )}
    </div>
  );

  return (
    <GameScreen scene={sceneNode}>
      {error && (
        <p role="alert" className="mx-4 mt-2 shrink-0 rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {item && beat === "intro" && (
        <BriefPanel
          title={
            <>
              <span style={{ color }}>ด่าน {stage}</span> · {bossName} ปรากฏตัว!
            </>
          }
          color={color}
          action="สู้!"
          onAction={() => setBeat("ask")}
        >
          {stageInfo?.title && <b className="block text-base text-slate-800">{stageInfo.title}</b>}
          {stageInfo?.intro && <QuizText text={stageInfo.intro} />}
        </BriefPanel>
      )}

      {beat === "outro" && (
        <BriefPanel
          title={bossDown ? `ชนะ! ${bossName} ล้มแล้ว` : `${bossName} หนีไปได้!`}
          color={color}
          action={items[index + 1] ? "ด่านต่อไป" : "สรุปผลภารกิจ"}
          onAction={advance}
          primary={false}
        >
          {bossDown ? "ตอบถูกทุกข้อในด่านนี้ สุดยอด!" : `บอสเหลือ HP ${bossHp} — ข้อที่พลาดดูคำอธิบายซ้ำได้ตอนจบเกม`}
        </BriefPanel>
      )}

      {item && (beat === "ask" || beat === "fx" || beat === "explain") && (
        <QuestionPanel
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
          nextLabel="ไปต่อ"
          fireLabel="โจมตี"
          caption={`${bossName} ใช้ท่า “${bossMove}”! ตอบให้ถูกเพื่อสวนกลับ`}
        />
      )}
      {!item && beat !== "outro" && <PanelNote>{busy ? "กำลังสรุปผลภารกิจ..." : "ผ่านครบทุกด่านแล้ว"}</PanelNote>}
    </GameScreen>
  );
}
