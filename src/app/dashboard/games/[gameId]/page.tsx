"use client";

import { Fragment, use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import { downloadBlob } from "@/lib/download";
import { compareRoster } from "@/lib/students/order";
import { unitTrace } from "@/lib/traces";
import QuizText from "@/components/QuizText";
import { CHOICE_LETTERS, formatNumber, type Game, type GameItem, type GamePlay, type GameSession } from "@/lib/game";
import Breadcrumbs from "../../Breadcrumbs";

type Tab = "items" | "sessions" | "results";
type Key = { item_id: string; correct_index: number | null; answer: number | null; tolerance: number; explanation: string | null };
type Enrollment = {
  id: string;
  student_id: string | null;
  class_roster: { full_name: string; student_code: string; classroom: string | null; class_number: number | null } | null;
};

const th = new Intl.Collator("th", { numeric: true });

/** หน้าจัดการเกมภารกิจของครู: ดูคำถามและเฉลย · เปิด/ปิดให้เล่นทีละห้อง · ดูผล */
export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [courseName, setCourseName] = useState("");
  const [items, setItems] = useState<GameItem[]>([]);
  const [keys, setKeys] = useState<Record<string, Key>>({});
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [plays, setPlays] = useState<GamePlay[]>([]);
  const [tab, setTab] = useState<Tab>("items");

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { data: me } = await supabase.from("profiles").select("role").eq("id", userData.user?.id ?? "").maybeSingle();
    if (me?.role !== "teacher") {
      router.replace(`/dashboard/games/${gameId}/play`);
      return;
    }
    const { data: g, error: gErr } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
    if (gErr || !g) {
      setError(gErr ? dbErrorMessage(gErr) : "ไม่พบเกมนี้ อาจถูกลบไปแล้ว");
      setLoading(false);
      return;
    }
    const [courseRes, itemRes, sRes, enRes, pRes] = await Promise.all([
      supabase.from("courses").select("subjects(name)").eq("id", g.course_id).maybeSingle(),
      supabase.from("game_items").select("*").eq("game_id", gameId).order("stage").order("position"),
      supabase.from("game_sessions").select("*").eq("game_id", gameId).order("opened_at"),
      supabase.from("enrollments").select("id, student_id, class_roster(full_name, student_code, classroom, class_number)").eq("course_id", g.course_id),
      supabase.from("game_plays").select("*").eq("game_id", gameId),
    ]);
    const ids = ((itemRes.data as GameItem[]) ?? []).map((x) => x.id);
    const keyRes = ids.length ? await supabase.from("game_keys").select("*").in("item_id", ids) : { data: [], error: null };
    const firstErr = [courseRes.error, itemRes.error, sRes.error, enRes.error, pRes.error, keyRes.error].find(Boolean);
    setError(firstErr ? `โหลดข้อมูลบางส่วนไม่สำเร็จ: ${dbErrorMessage(firstErr)}` : null);
    setGame(g as Game);
    setCourseName((courseRes.data as unknown as { subjects: { name: string } | null } | null)?.subjects?.name ?? "");
    setItems((itemRes.data as GameItem[]) ?? []);
    setKeys(Object.fromEntries(((keyRes.data as Key[]) ?? []).map((k) => [k.item_id, k])));
    setSessions((sRes.data as GameSession[]) ?? []);
    setEnrollments((enRes.data as unknown as Enrollment[]) ?? []);
    setPlays((pRes.data as GamePlay[]) ?? []);
    setLoading(false);
  }, [gameId, router, supabase]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (loading) return <div className="px-6 py-10 text-sm text-slate-500">กำลังโหลด...</div>;

  if (!game) {
    return (
      <div className="px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-4">
          <Breadcrumbs items={[{ label: "หน้าหลัก", href: "/dashboard" }, { label: "รายวิชาของฉัน", href: "/dashboard/courses" }, { label: "ไม่พบเกม" }]} />
          <p className="rounded-sm border border-slate-200 bg-white p-6 text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const maxScore = items.reduce((s, x) => s + Number(x.points), 0);
  const openCount = sessions.filter((s) => !s.closed_at).length;
  const finished = plays.filter((p) => p.finished_at).length;
  const tabs: { key: Tab; label: string; badge?: string }[] = [
    { key: "items", label: "คำถามและเฉลย", badge: `${items.length} ข้อ` },
    { key: "sessions", label: "เปิดให้เล่น", badge: openCount ? `เปิด ${openCount} ห้อง` : undefined },
    { key: "results", label: "ผลการเล่น", badge: plays.length ? `เล่นแล้ว ${plays.length}` : undefined },
  ];

  return (
    <div className="px-4 sm:px-6 py-8 sm:py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-2">
          <Breadcrumbs
            items={[
              { label: "หน้าหลัก", href: "/dashboard" },
              { label: courseName || "รายวิชา", href: `/dashboard/courses/${game.course_id}` },
              { label: game.title },
            ]}
          />
          <h1 className="font-display text-3xl font-bold text-slate-800">{game.title}</h1>
          <p className="text-sm text-slate-500">
            {[`${game.stages.length} ด่าน`, `${items.length} ข้อ`, `คะแนนเต็ม ${maxScore}`, "ตอบแล้วรู้ผลทันที นับคำตอบแรก", `เล่นจบแล้ว ${finished} คน`].join(" · ")}
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200" style={{ "--neon": "var(--trace-magenta)" } as React.CSSProperties}>
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px whitespace-nowrap border-b-[3px] px-4 py-2.5 text-sm ${
                tab === t.key ? "border-trace-magenta font-medium text-slate-800" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
              {t.badge && <span className="ml-1.5 text-xs text-slate-400">{t.badge}</span>}
            </button>
          ))}
        </div>

        {tab === "items" && <ItemsView game={game} items={items} keys={keys} />}
        {tab === "sessions" && <SessionsView gameId={gameId} sessions={sessions} enrollments={enrollments} plays={plays} ready={items.length > 0} onChanged={load} />}
        {tab === "results" && <ResultsView game={game} items={items} keys={keys} enrollments={enrollments} plays={plays} onChanged={load} />}
      </div>
    </div>
  );
}

function answerText(item: GameItem, key: Key | undefined) {
  if (!key) return "ยังไม่มีเฉลย";
  if (item.kind === "choice") return key.correct_index === null || !item.choices ? "–" : `${CHOICE_LETTERS[key.correct_index]}. ${item.choices[key.correct_index]}`;
  return key.answer === null ? "–" : `${formatNumber(Number(key.answer), item.scientific)}${item.unit ? ` ${item.unit}` : ""} (ยอมรับ ±${Math.round(Number(key.tolerance) * 100)}%)`;
}

// ---------------------------------------------------------------------------
function ItemsView({ game, items, keys }: { game: Game; items: GameItem[]; keys: Record<string, Key> }) {
  return (
    <div className="space-y-6">
      {game.stages.map((stage, si) => {
        const its = items.filter((x) => x.stage === si + 1);
        const color = unitTrace(si);
        return (
          <section key={si} className="space-y-2">
            <h2 className="font-display text-lg font-semibold text-slate-800">
              <span style={{ color }}>ด่าน {si + 1}</span> · {stage.title}
              <span className="ml-2 text-sm font-normal text-slate-500">{its.reduce((s, x) => s + Number(x.points), 0)} คะแนน</span>
            </h2>
            <ol className="space-y-2">
              {its.map((it) => {
                const k = keys[it.id];
                return (
                  <li key={it.id} className="space-y-2 rounded-sm border border-slate-200 bg-white p-4" style={{ borderTop: `3px solid ${color}` }}>
                    <p className="text-sm leading-relaxed text-slate-800">
                      <span className="mr-1.5 font-display font-bold">{items.indexOf(it) + 1}.</span>
                      <QuizText text={it.prompt} />
                      <span className="ml-2 text-xs text-slate-500">({Number(it.points)} คะแนน)</span>
                    </p>
                    {it.kind === "choice" && it.choices && (
                      <ul className="grid gap-1 text-sm sm:grid-cols-2">
                        {it.choices.map((c, i) => (
                          <li key={i} className={i === k?.correct_index ? "font-semibold text-green-700" : "text-slate-600"}>
                            {CHOICE_LETTERS[i]}. <QuizText text={c} />
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-sm text-slate-700">
                      เฉลย: <b className="text-green-700"><QuizText text={answerText(it, k)} /></b>
                    </p>
                    {k?.explanation && (
                      <p className="text-sm text-slate-500">
                        <QuizText text={k.explanation} />
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      <p className="text-xs text-slate-500">ตอนนี้ยังแก้คำถามของเกมในหน้าเว็บไม่ได้ — ถ้าต้องการแก้ แจ้งผู้ช่วยให้แก้ให้</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
function SessionsView({
  gameId,
  sessions,
  enrollments,
  plays,
  ready,
  onChanged,
}: {
  gameId: string;
  sessions: GameSession[];
  enrollments: Enrollment[];
  plays: GamePlay[];
  ready: boolean;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [busyRoom, setBusyRoom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rooms = [...new Set(enrollments.map((e) => e.class_roster?.classroom).filter((r): r is string => !!r))].sort(th.compare);

  async function toggle(room: string, open: GameSession | undefined) {
    setBusyRoom(room);
    const { error: e } = open
      ? await supabase.from("game_sessions").update({ closed_at: new Date().toISOString() }).eq("id", open.id)
      : await supabase.from("game_sessions").insert({ game_id: gameId, classroom: room });
    setBusyRoom(null);
    if (e) return setError(dbErrorMessage(e));
    setError(null);
    onChanged();
  }

  if (!rooms.length) return <p className="rounded-sm border border-slate-200 bg-white p-6 text-sm text-slate-500">วิชานี้ยังไม่มีรายชื่อนักเรียนที่ระบุห้อง</p>;

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <ul className="divide-y divide-slate-200 rounded-sm border border-slate-200 bg-white">
        {rooms.map((room) => {
          const open = sessions.find((s) => s.classroom === room && !s.closed_at);
          const inRoom = enrollments.filter((e) => e.class_roster?.classroom === room);
          const ids = new Set(inRoom.map((e) => e.id));
          const started = plays.filter((p) => ids.has(p.enrollment_id));
          const done = started.filter((p) => p.finished_at).length;
          return (
            <li key={room} className="flex flex-wrap items-center gap-3 p-4">
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-semibold text-slate-800">{room}</span>
                <span className="block text-sm text-slate-500">
                  เล่นจบ <span className="font-num tnum">{done}</span> · กำลังเล่น <span className="font-num tnum">{started.length - done}</span> · ทั้งห้อง{" "}
                  <span className="font-num tnum">{inRoom.length}</span> คน
                </span>
              </span>
              {open ? (
                <span className="flex items-center gap-2 text-sm font-semibold text-green-700">
                  <span aria-hidden className="size-2.5 rounded-full bg-green-600 text-green-600 route-glow" />
                  เปิดอยู่ ตั้งแต่ {new Date(open.opened_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                </span>
              ) : (
                <span className="text-sm text-slate-400">ปิดอยู่</span>
              )}
              <button
                type="button"
                disabled={busyRoom === room || (!open && !ready)}
                onClick={() => toggle(room, open)}
                className={`min-h-11 rounded-sm px-4 text-sm font-semibold disabled:opacity-40 sm:min-h-9 ${
                  open ? "border-2 border-red-300 text-red-700 hover:bg-red-50" : "bg-slate-800 text-white"
                }`}
              >
                {busyRoom === room ? "..." : open ? "ปิดเกม" : "เปิดให้เล่น"}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate-500">
        เปิดทิ้งไว้เป็นการบ้านได้ ปิดแล้วคนที่ยังไม่จบจะเล่นต่อไม่ได้ (คะแนนข้อที่ตอบไปแล้วยังอยู่) · คนที่เล่นจบแล้วดูผลย้อนหลังได้เสมอ
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
function ResultsView({
  game,
  items,
  keys,
  enrollments,
  plays,
  onChanged,
}: {
  game: Game;
  items: GameItem[];
  keys: Record<string, Key>;
  enrollments: Enrollment[];
  plays: GamePlay[];
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [room, setRoom] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rooms = [...new Set(enrollments.map((e) => e.class_roster?.classroom).filter((r): r is string => !!r))].sort(th.compare);
  const maxScore = items.reduce((s, x) => s + Number(x.points), 0);

  const rows = enrollments
    .map((e) => ({
      id: e.id,
      full_name: e.class_roster?.full_name ?? "(ไม่มีชื่อ)",
      student_code: e.class_roster?.student_code ?? null,
      classroom: e.class_roster?.classroom ?? null,
      class_number: e.class_roster?.class_number ?? null,
      play: plays.find((p) => p.enrollment_id === e.id) ?? null,
    }))
    .filter((r) => !room || r.classroom === room)
    .sort(compareRoster);
  const done = rows.filter((r) => r.play?.finished_at);
  const avg = done.length ? done.reduce((s, r) => s + Number(r.play!.score), 0) / done.length : null;

  function minutesUsed(p: GamePlay) {
    const end = p.finished_at ? new Date(p.finished_at).getTime() : null;
    if (!end) return null;
    const sec = Math.round((end - new Date(p.started_at).getTime()) / 1000);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  }

  async function reset(enrollmentId: string, name: string) {
    if (!window.confirm(`ให้ ${name} เล่นเกมนี้ใหม่?\nคำตอบและคะแนนเดิมจะถูกลบ`)) return;
    setBusy(true);
    const { error: e } = await supabase.from("game_plays").delete().eq("game_id", game.id).eq("enrollment_id", enrollmentId);
    setBusy(false);
    if (e) return setError(dbErrorMessage(e));
    setError(null);
    onChanged();
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const header = ["ห้อง", "เลขที่", "รหัสนักเรียน", "ชื่อ-สกุล", `คะแนน (เต็ม ${maxScore})`, "สถานะ", "XP", "เวลาที่ใช้", ...items.map((_, i) => `ข้อ ${i + 1}`)];
    const body = rows.map((r) => [
      r.classroom ?? "",
      r.class_number ?? "",
      r.student_code ?? "",
      r.full_name,
      r.play ? Number(r.play.score) : "",
      !r.play ? "ยังไม่เล่น" : r.play.finished_at ? "เล่นจบ" : "เล่นค้าง",
      r.play ? r.play.xp : "",
      r.play ? minutesUsed(r.play) ?? "" : "",
      ...items.map((it) => {
        const a = r.play?.answers?.[it.id];
        return a ? (a.ok ? "✓" : "✗") : "";
      }),
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "ผลการเล่น");
    const data = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    downloadBlob(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${game.title}${room ? ` ${room.replace("/", "-")}` : ""}.xlsx`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {rooms.length > 1 && (
          <div role="group" aria-label="เลือกห้อง" className="flex flex-wrap gap-1.5">
            {["", ...rooms].map((r) => (
              <button
                key={r || "all"}
                type="button"
                aria-pressed={room === r}
                onClick={() => setRoom(r)}
                className={`min-h-11 rounded-sm border-2 px-3 py-1.5 font-display text-sm font-semibold sm:min-h-0 ${
                  room === r ? "border-porcelain bg-porcelain text-[var(--c-slate-50)]" : "border-slate-300 text-slate-600 hover:border-slate-400"
                }`}
              >
                {r || "ทุกห้อง"}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={exportExcel} className="ml-auto min-h-11 rounded-sm border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-100 sm:min-h-9">
          ดาวน์โหลด Excel{room ? ` (${room})` : ""}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <p className="text-sm text-slate-600">
        เล่นจบ <span className="font-num tnum font-semibold text-slate-800">{done.length}</span> จาก <span className="font-num tnum">{rows.length}</span> คน
        {avg !== null && (
          <>
            {" "}· เฉลี่ย <span className="font-num tnum font-semibold text-slate-800">{avg.toFixed(2)}</span> / {maxScore}
          </>
        )}
      </p>

      <div className="overflow-x-auto rounded-sm border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="p-2 font-medium">นักเรียน</th>
              <th className="p-2 font-medium">สถานะ</th>
              <th className="p-2 text-right font-medium">XP</th>
              <th className="p-2 text-right font-medium">เวลาที่ใช้</th>
              <th className="p-2 text-right font-medium">คะแนน</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = r.play;
              return (
                <Fragment key={r.id}>
                  <tr className="border-t border-slate-100">
                    <td className="p-2">
                      <button type="button" disabled={!p} aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)} className="text-left disabled:cursor-default">
                        <span className="text-slate-800">{r.full_name}</span>
                        <span className="block text-xs text-slate-400">
                          {[r.classroom, r.class_number != null ? `เลขที่ ${r.class_number}` : null, r.student_code].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                    </td>
                    <td className={`p-2 ${!p ? "text-slate-400" : p.finished_at ? "text-green-700" : "text-amber-700"}`}>
                      {!p ? "ยังไม่เล่น" : p.finished_at ? "เล่นจบ" : `เล่นค้าง (${Object.keys(p.answers ?? {}).length}/${items.length})`}
                    </td>
                    <td className="p-2 text-right font-num tnum text-trace-cyan">{p ? p.xp.toLocaleString() : "–"}</td>
                    <td className="p-2 text-right font-num tnum text-slate-600">{p ? minutesUsed(p) ?? "–" : "–"}</td>
                    <td className="whitespace-nowrap p-2 text-right font-num tnum">
                      {p ? (
                        <>
                          <span className="text-lg font-semibold text-slate-800">{Number(p.score)}</span>
                          <span className="text-slate-500"> / {Number(p.max_score)}</span>
                        </>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {p && (
                        <button type="button" disabled={busy} onClick={() => reset(r.id, r.full_name)} className="text-xs text-slate-500 hover:text-red-700 hover:underline">
                          ให้เล่นใหม่
                        </button>
                      )}
                    </td>
                  </tr>
                  {open === r.id && p && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={6} className="px-2 pb-3 pt-1">
                        <ol className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-1.5">
                          {items.map((it, i) => {
                            const a = p.answers?.[it.id];
                            const k = keys[it.id];
                            const given =
                              a == null ? "–" : it.kind === "choice" ? CHOICE_LETTERS[Number(a.v)] ?? "?" : formatNumber(Number(a.v), it.scientific).replace(/\^\{(-?\d+)\}/, "^$1");
                            return (
                              <li
                                key={it.id}
                                title={a && !a.ok ? `เฉลย ${answerText(it, k).replace(/\^\{(-?\d+)\}/g, "^$1")}` : undefined}
                                className={`rounded-sm border-2 px-1 py-1 text-center ${
                                  !a ? "border-slate-200 bg-white" : a.ok ? "border-green-600/60 bg-green-50" : "border-red-500/60 bg-red-50"
                                }`}
                              >
                                <span className="block font-num text-[11px] leading-none text-slate-500">ข้อ {i + 1}</span>
                                <span className={`block truncate font-display text-sm font-bold ${!a ? "text-slate-400" : a.ok ? "text-green-700" : "text-red-700"}`}>{given}</span>
                              </li>
                            );
                          })}
                        </ol>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
