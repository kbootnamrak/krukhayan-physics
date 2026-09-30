"use client";

import { use, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { gameErrorMessage, type GamePayload, type GameStage } from "@/lib/game";
import { BackLink, Intro, Playing, Results } from "./GamePlayer";

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string; courseId: string | null }
  | { kind: "intro"; title: string; description: string | null; stages: GameStage[]; courseId: string }
  | { kind: "playing"; data: GamePayload; courseId: string }
  | { kind: "done"; data: GamePayload; courseId: string };

/**
 * หน้าเล่นเกมภารกิจของนักเรียน
 * - ด่านละตอนของใบงาน ตอบแล้วรู้ผลทันทีพร้อมคำอธิบาย คะแนนนับคำตอบแรกเท่านั้น (ตรวจฝั่งฐานข้อมูล)
 * - XP / คอมโบ / โบนัสเวลา เป็นความสนุก ไม่ใช่คะแนนเก็บ — เก็บชั่วคราวในเครื่องระหว่างเล่น
 * - ปิดหน้าแล้วกลับมาเล่นต่อจากข้อที่ค้างได้
 */
export default function PlayGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const supabase = createClient();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const start = useCallback(
    async (courseId: string) => {
      setPhase({ kind: "loading" });
      const { data, error } = await supabase.rpc("game_start", { p_game: gameId });
      if (error) return setPhase({ kind: "error", message: gameErrorMessage(error.message), courseId });
      const payload = data as GamePayload;
      setPhase(payload.finished ? { kind: "done", data: payload, courseId } : { kind: "playing", data: payload, courseId });
    },
    [gameId, supabase]
  );

  useEffect(() => {
    async function init() {
      const { data: game, error } = await supabase
        .from("games")
        .select("id, course_id, title, description, stages")
        .eq("id", gameId)
        .maybeSingle();
      if (error || !game) return setPhase({ kind: "error", message: "ไม่พบเกมนี้", courseId: null });
      const { data: mine } = await supabase.rpc("game_my_plays", { p_course: game.course_id });
      const play = ((mine as { game_id: string }[] | null) ?? []).find((p) => p.game_id === gameId);
      // เคยเริ่มแล้ว (ค้างอยู่หรือจบแล้ว) → เข้าเกมเลย
      if (play) return start(game.course_id);
      setPhase({
        kind: "intro",
        title: game.title,
        description: game.description,
        stages: (game.stages as GameStage[]) ?? [],
        courseId: game.course_id,
      });
    }
    const t = setTimeout(init, 0);
    return () => clearTimeout(t);
  }, [gameId, start, supabase]);

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-2xl mx-auto">
        {phase.kind === "loading" && <p className="text-sm text-slate-500">กำลังโหลด...</p>}

        {phase.kind === "error" && (
          <div className="space-y-4 rounded-sm border-2 border-slate-200 bg-white p-6">
            <p className="text-slate-800">{phase.message}</p>
            {phase.courseId && <BackLink courseId={phase.courseId} />}
          </div>
        )}

        {phase.kind === "intro" && <Intro phase={phase} onStart={() => start(phase.courseId)} />}

        {phase.kind === "playing" && (
          <Playing
            data={phase.data}
            onFinished={(data) => setPhase({ kind: "done", data, courseId: phase.courseId })}
          />
        )}

        {phase.kind === "done" && <Results data={phase.data} courseId={phase.courseId} />}
      </div>
    </div>
  );
}
