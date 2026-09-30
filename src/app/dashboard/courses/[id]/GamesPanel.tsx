"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import type { Game, GameSession, MyGamePlay } from "@/lib/game";

/**
 * แท็บ "เกม" ในหน้ารายวิชา
 * ครู: รายการเกมภารกิจ ห้องที่เปิดอยู่ จำนวนคนเล่นจบ → กดเข้าไปเปิดให้เล่น/ดูผล
 * นักเรียน: เกมที่เปิดให้ห้องตัวเอง หรือเคยเล่นแล้ว พร้อมคะแนน
 */
export default function GamesPanel({
  courseId,
  isTeacher,
  myClassroom,
}: {
  courseId: string;
  isTeacher: boolean;
  myClassroom: string | null;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [mine, setMine] = useState<MyGamePlay[]>([]);
  const [finishedCount, setFinishedCount] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const { data: g, error: gErr } = await supabase.from("games").select("*").eq("course_id", courseId).order("created_at");
    const ids = (g ?? []).map((x) => x.id);
    const [sRes, mRes, pRes] = await Promise.all([
      ids.length ? supabase.from("game_sessions").select("*").in("game_id", ids) : Promise.resolve({ data: [], error: null }),
      !isTeacher ? supabase.rpc("game_my_plays", { p_course: courseId }) : Promise.resolve({ data: [], error: null }),
      isTeacher && ids.length ? supabase.from("game_plays").select("game_id, finished_at").in("game_id", ids) : Promise.resolve({ data: [], error: null }),
    ]);
    const firstErr = [gErr, sRes.error, mRes.error, pRes.error].find(Boolean);
    setError(firstErr ? dbErrorMessage(firstErr) : null);
    setGames((g as Game[]) ?? []);
    setSessions((sRes.data as GameSession[]) ?? []);
    setMine((mRes.data as MyGamePlay[]) ?? []);
    const counts: Record<string, number> = {};
    for (const p of (pRes.data as { game_id: string; finished_at: string | null }[]) ?? []) if (p.finished_at) counts[p.game_id] = (counts[p.game_id] ?? 0) + 1;
    setFinishedCount(counts);
    setLoading(false);
  }, [courseId, isTeacher, supabase]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const openRooms = (gameId: string) => sessions.filter((s) => s.game_id === gameId && !s.closed_at).map((s) => s.classroom);

  if (loading) return <p className="text-sm text-slate-500">กำลังโหลด...</p>;
  if (error) {
    return (
      <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
        {error}
      </p>
    );
  }

  if (isTeacher) {
    if (!games.length) {
      return (
        <p className="rounded-sm border border-slate-200 bg-white p-6 text-sm text-slate-500">
          ยังไม่มีเกมภารกิจในวิชานี้ — ส่งใบงานให้ผู้ช่วยแปลงเป็นเกมได้
        </p>
      );
    }
    return (
      <ul className="divide-y divide-slate-200 rounded-sm border border-slate-200 bg-white">
        {games.map((g) => {
          const rooms = openRooms(g.id);
          return (
            <li key={g.id}>
              <Link href={`/dashboard/games/${g.id}`} className="group flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-slate-100">
                <GameIcon />
                <span className="min-w-0 flex-1">
                  <span className="block font-display font-semibold text-slate-800">{g.title}</span>
                  <span className="block text-sm text-slate-500">
                    {g.stages.length} ด่าน · เล่นจบแล้ว {finishedCount[g.id] ?? 0} คน
                  </span>
                </span>
                {rooms.length > 0 ? (
                  <span className="text-sm font-medium text-green-700">เปิดอยู่: {rooms.join(", ")}</span>
                ) : (
                  <span className="text-sm text-slate-400">ยังไม่เปิดให้เล่น</span>
                )}
                <svg viewBox="0 0 24 24" className="size-5 text-slate-400 group-hover:text-slate-700" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  const visible = games
    .map((g) => ({ g, play: mine.find((m) => m.game_id === g.id) ?? null, open: !!myClassroom && openRooms(g.id).includes(myClassroom) }))
    .filter((x) => x.open || x.play);

  if (!visible.length) {
    return <p className="rounded-sm border border-slate-200 bg-white p-6 text-sm text-slate-500">ตอนนี้ยังไม่มีเกมที่เปิดให้เล่น เมื่อครูเปิดเกม จะขึ้นที่นี่</p>;
  }

  return (
    <ul className="space-y-3">
      {visible.map(({ g, play, open }) => {
        const done = !!play?.finished_at;
        return (
          <li key={g.id} className="flex flex-wrap items-center gap-3 rounded-sm border-2 border-slate-200 bg-white p-4">
            <GameIcon />
            <span className="min-w-0 basis-[calc(100%-3rem)] sm:basis-0 sm:flex-1">
              <span className="block font-display text-lg font-semibold text-slate-800">{g.title}</span>
              <span className="block text-sm text-slate-500">
                {done
                  ? `เล่นจบแล้ว · ${Number(play!.xp).toLocaleString()} XP`
                  : play
                    ? `เล่นค้างไว้ ${play.answered} ข้อ`
                    : `${g.stages.length} ด่าน · ตอบแล้วรู้ผลทันที`}
              </span>
            </span>
            {done && (
              <span className="font-num tnum text-2xl font-semibold text-slate-800">
                {Number(play!.score)} <span className="text-base text-slate-500">/ {Number(play!.max_score)}</span>
              </span>
            )}
            {(done || open) && (
              <Link
                href={`/dashboard/games/${g.id}/play`}
                className={`ml-auto inline-flex min-h-12 items-center justify-center rounded-sm px-5 py-2 text-sm font-semibold sm:ml-0 sm:min-h-0 ${
                  done ? "border-2 border-porcelain text-slate-800 hover:bg-slate-100" : "bg-[oklch(50%_0.24_345)] text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)]"
                }`}
              >
                {done ? "ดูผล" : play ? "เล่นต่อ" : "เริ่มภารกิจ"}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function GameIcon() {
  return (
    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-sm border-2 border-trace-yellow/60 text-trace-yellow">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 12h4M8 10v4" />
        <circle cx="15" cy="11" r="1" fill="currentColor" />
        <circle cx="17.5" cy="13.5" r="1" fill="currentColor" />
        <path d="M7.5 6h9A4.5 4.5 0 0 1 21 10.5v3A4.5 4.5 0 0 1 16.5 18c-1.6 0-2.4-1-3-2h-3c-.6 1-1.4 2-3 2A4.5 4.5 0 0 1 3 13.5v-3A4.5 4.5 0 0 1 7.5 6Z" />
      </svg>
    </span>
  );
}
