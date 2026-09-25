"use client";

import { useSyncExternalStore } from "react";
import { calcGrade, DEFAULT_GRADE_SCALE, type GradeScale } from "@/lib/grade";
import { fmt, gradedItems, summarize, type ScoreLookup } from "@/lib/scores";
import { EXAM_TRACE, unitTrace } from "@/lib/traces";
import { UnitGlyph } from "@/components/PhysicsArt";

type Unit = { id: string; title: string; sort_order: number };
type Component = { id: string; unit_id: string; category: "K" | "P" | "A"; max_score: number };
type Exam = { id: string; exam_type: "midterm" | "final"; max_score: number };


const CATEGORY_NAME: Record<Component["category"], string> = {
  K: "ความรู้",
  P: "ทักษะกระบวนการ",
  A: "คุณลักษณะ",
};

type Station = {
  key: string;
  code: string;
  name: string;
  max: number;
  score: number | null;
  exam: boolean;
};

type Segment = { key: string; title: string; color: string; exam: boolean; stations: Station[] };

// เผื่อเศษทศนิยมจากการบวกคะแนน เช่น 0.1 + 0.2
const EPS = 1e-9;

const targetListeners = new Set<() => void>();
function subscribeTarget(cb: () => void) {
  targetListeners.add(cb);
  return () => targetListeners.delete(cb);
}
function readTarget(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memoryTargets.get(key) ?? null;
  } catch {
    return memoryTargets.get(key) ?? null;
  }
}
function writeTarget(key: string, grade: string) {
  try {
    localStorage.setItem(key, grade);
  } catch {
    // จำไม่ได้ก็ไม่เป็นไร เลือกใหม่ได้ทุกครั้ง — แต่ถ้าเขียนไม่ได้ เป้าก็จะไม่เปลี่ยน จึงเก็บสำรองไว้ในหน่วยความจำ
    memoryTargets.set(key, grade);
  }
  targetListeners.forEach((cb) => cb());
}
const memoryTargets = new Map<string, string>();

/**
 * หน้า "คะแนนของฉัน" ของนักเรียน
 * งานทั้งเทอมวาดเป็นลายวงจร: หนึ่งหน่วยหนึ่งเส้นทองแดง ชิ้นที่ตรวจแล้วเป็นจุดบัดกรีทึบ ชิ้นที่ยังไม่มีคะแนนเป็นวงกลวง
 * ปลายทางคือเกรดที่นักเรียนตั้งเป้า — ป้ายด้านข้างบอกว่าต้องได้อีกกี่คะแนน
 */
export default function StudentRoute({
  courseId,
  units,
  components,
  exams,
  myScore,
  gradeScales,
}: {
  courseId: string;
  units: Unit[];
  components: Component[];
  exams: Exam[];
  myScore: ScoreLookup;
  gradeScales: GradeScale[];
}) {
  const segments: Segment[] = [];
  [...units]
    .sort((a, b) => a.sort_order - b.sort_order)
    .forEach((u) => {
      const stations = components
        .filter((c) => c.unit_id === u.id)
        .sort((a, b) => "KPA".indexOf(a.category) - "KPA".indexOf(b.category))
        .map((c) => ({
          key: c.id,
          code: c.category,
          name: CATEGORY_NAME[c.category],
          max: Number(c.max_score),
          score: myScore("unit_component", c.id),
          exam: false,
        }));
      if (stations.length) {
        segments.push({ key: u.id, title: u.title, color: unitTrace(segments.length), exam: false, stations });
      }
    });

  const examStations: Station[] = [...exams]
    .sort((a, b) => (a.exam_type === "midterm" ? 0 : 1) - (b.exam_type === "midterm" ? 0 : 1))
    .map((e) => ({
      key: e.id,
      code: e.exam_type === "midterm" ? "MID" : "FIN",
      name: e.exam_type === "midterm" ? "สอบกลางภาค" : "สอบปลายภาค",
      max: Number(e.max_score),
      score: myScore("exam", e.id),
      exam: true,
    }));
  if (examStations.length) {
    segments.push({ key: "exams", title: "สอบ", color: EXAM_TRACE, exam: true, stations: examStations });
  }

  const summary = summarize(gradedItems(components, exams), myScore);
  const scale = [...(gradeScales.length ? gradeScales : DEFAULT_GRADE_SCALE)].sort((a, b) => b.min_percent - a.min_percent);
  const remaining = summary.maxAll - summary.maxAssessed;
  const ceilingPercent = summary.maxAll > 0 ? ((summary.earned + remaining) / summary.maxAll) * 100 : 0;
  // ตัวเลือกปลายทาง: ทุกเกรดยกเว้นขั้นต่ำสุด (ขั้น 0% ได้อยู่แล้วไม่ต้องตั้งเป้า)
  const targets = scale.filter((s) => s.min_percent > 0);
  const bestReachable = targets.find((s) => s.min_percent <= ceilingPercent + EPS) ?? null;

  // เป้าที่เลือกจำไว้ในเครื่อง อ่านผ่าน useSyncExternalStore — ฝั่งเซิร์ฟเวอร์ถือว่ายังไม่เลือก ไม่ให้ HTML สองฝั่งไม่ตรงกัน
  const storageKey = `target-grade:${courseId}`;
  const chosen = useSyncExternalStore(
    subscribeTarget,
    () => readTarget(storageKey),
    () => null
  );
  const target = targets.find((t) => t.grade === chosen) ?? bestReachable ?? targets[targets.length - 1] ?? null;

  function choose(grade: string) {
    writeTarget(storageKey, grade);
  }


  if (segments.length === 0) {
    return (
      <p className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">
        ครูยังไม่ได้ตั้งหน่วยการเรียนและคะแนนเต็มของวิชานี้ เมื่อครูตั้งแล้ว เส้นทางคะแนนจะขึ้นที่นี่
      </p>
    );
  }

  const finalGrade = summary.complete ? calcGrade(summary.percentFinal ?? 0, gradeScales) : null;
  const need = target ? (target.min_percent / 100) * summary.maxAll - summary.earned : 0;
  // สถานะของเส้นทางตามเป้าที่เลือก — เปลี่ยนเป้าแล้วรางและปลายทางบนแผนที่เปลี่ยนตาม
  const route: RouteState = summary.complete
    ? "arrived"
    : !target
      ? "reached"
      : need <= EPS
        ? "reached"
        : need > remaining + EPS
          ? "impossible"
          : "needed";

  // สัดส่วนของคะแนนที่ยังเหลือที่เป้านี้ต้องใช้ (0–1) — ใช้บอกทุกสถานีวงกลวงว่าควรได้ราวเท่าไร
  const share = route === "needed" && remaining > 0 ? need / remaining : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 items-start">
      {/* ป้ายบอกทาง: บนมือถือขึ้นก่อน บนจอกว้างอยู่ขวาและตามลงมาเวลาเลื่อน */}
      <aside className="lg:order-2 lg:sticky lg:top-6 rounded-md border-2 border-porcelain bg-white">
        <h2 className="font-display text-xl font-semibold text-slate-800 px-4 py-2.5 border-b-2 border-porcelain">
          ป้ายบอกทางของฉัน
        </h2>

        <dl className="px-4 divide-y divide-slate-200">
          <BoardRow glyph="filled" label="ได้แล้ว">
            <span className="font-num tnum text-3xl font-semibold text-slate-800 leading-none">{fmt(summary.earned)}</span>
            <span className="font-num tnum text-slate-500 ml-1">/ {fmt(summary.maxAssessed)}</span>
          </BoardRow>
          <BoardRow glyph="hollow" label="ยังไม่มีคะแนน">
            {summary.missing === 0 ? (
              <span className="text-green-700 font-medium">ครบทุกชิ้นแล้ว</span>
            ) : (
              <span className="font-num tnum text-2xl font-semibold text-amber-700 leading-none">
                {summary.missing} <span className="font-sans text-sm font-normal">ชิ้น</span>
              </span>
            )}
          </BoardRow>
          <BoardRow glyph="end" label="คะแนนเต็มทั้งวิชา">
            <span className="font-num tnum text-2xl font-semibold text-slate-700 leading-none">{fmt(summary.maxAll)}</span>
          </BoardRow>
        </dl>

        {finalGrade !== null ? (
          <div className="border-t-2 border-porcelain px-4 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-slate-800 font-medium">ถึงปลายทางแล้ว</p>
              <p className="text-sm text-slate-500 tnum">
                รวม {fmt(summary.earned)} / {fmt(summary.maxAll)} ({(summary.percentFinal ?? 0).toFixed(1)}%)
              </p>
            </div>
            <Terminus grade={finalGrade} state="arrived" size="lg" />
          </div>
        ) : (
          target && (
            <div className="border-t-2 border-porcelain px-4 pt-3 pb-4 space-y-4">
              <fieldset>
                <legend className="text-sm text-slate-600 mb-2">ตั้งเป้าเกรดไว้ที่</legend>
                {/* ตัวเลือกเป้าเป็นสถานีบนรางสั้น ๆ แนวนอน */}
                <div className="relative flex justify-between gap-1 overflow-x-auto py-0.5">
                  <span aria-hidden className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-[5px] bg-slate-300" />
                  {targets.map((t) => {
                    const on = t.grade === target.grade;
                    const reachable = t.min_percent <= ceilingPercent + EPS;
                    return (
                      <button
                        key={t.grade}
                        type="button"
                        aria-pressed={on}
                        aria-label={`ตั้งเป้าเกรด ${t.grade}${reachable ? "" : " (ไม่ทันแล้ว)"}`}
                        onClick={() => choose(t.grade)}
                        className={`relative font-num tnum shrink-0 size-10 rounded-full border-[3px] text-base font-semibold transition-colors ${
                          on
                            ? "border-porcelain bg-porcelain text-[var(--c-slate-50)]"
                            : reachable
                              ? "border-porcelain bg-white text-slate-800 hover:bg-slate-100"
                              : "border-slate-300 bg-white text-slate-400 hover:border-slate-400"
                        }`}
                      >
                        {t.grade}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <Forecast target={target} need={need} remaining={remaining} route={route} best={bestReachable} />
            </div>
          )
        )}
      </aside>

      {/* แผนผังเส้นทาง: หนึ่งหน่วยหนึ่งสาย สถานีเรียงลงมา */}
      <section aria-label="เส้นทางคะแนนทั้งเทอม" className="lg:order-1 min-w-0">
        {summary.missing > 0 && (
          <p className="mb-5 text-sm text-slate-600">
            สถานีวงกลวงคือชิ้นที่ยังไม่มีคะแนน ถ้าส่งงานไปแล้วแต่ยังไม่ขึ้น ถามครูได้เลยนะ
          </p>
        )}
        <div className="relative">
          {/* แผ่นคลุมรางสำหรับแอนิเมชันเปิดหน้า — ดู .rail-reveal ใน globals.css */}
          <span aria-hidden className="rail-reveal absolute left-0 top-0 bottom-0 w-9 z-10 bg-[var(--c-slate-50)]" />
          <ol>
            {segments.map((seg, si) => (
              <li key={seg.key}>
                {/* ป้ายชื่อสาย = ชื่อหน่วย */}
                <div className="flex items-stretch">
                  <Track color={si === 0 ? null : segments[si - 1].color} nextColor={seg.color} transfer first={si === 0} route={route} />
                  <div className={`py-3 pl-3 min-w-0 ${si === 0 ? "" : "pt-5"}`}>
                    {/* ป้ายหน่วยแบบชิปบนแผ่นวงจร: ขอบสีของสาย + ไอคอนฟิสิกส์ของหน่วย */}
                    <span
                      className="inline-flex max-w-full items-center gap-2 rounded-sm border-2 px-2.5 py-1 font-display text-[15px] font-semibold leading-snug text-slate-800"
                      style={{ borderColor: seg.color, background: `color-mix(in oklch, ${seg.color} 14%, transparent)` }}
                    >
                      {!seg.exam && (
                        <span className="shrink-0" style={{ color: seg.color }}>
                          <UnitGlyph title={seg.title} className="size-5" />
                        </span>
                      )}
                      <span className="truncate">{seg.title}</span>
                    </span>
                  </div>
                </div>

                <ol>
                  {seg.stations.map((st) => (
                    <li key={st.key} className="flex items-stretch group">
                      <Track color={seg.color} nextColor={seg.color} station={st} route={route} share={share} />
                      <div className="flex flex-1 min-w-0 items-center justify-between gap-3 py-2.5 pl-3 border-b border-slate-200 group-last:border-b-0">
                        <div className="min-w-0">
                          <p className={`leading-snug ${st.score === null ? "text-slate-600" : "text-slate-800"} ${st.exam ? "font-semibold" : ""}`}>
                            {!st.exam && <span className="font-display font-semibold mr-1.5">{st.code}</span>}
                            {st.name}
                          </p>
                          {st.score === null && (
                            <p className="text-sm text-amber-700">
                              ยังไม่มีคะแนน
                              {share !== null && (
                                <span className="text-slate-600">
                                  {" · "}เป้าเกรด {target!.grade} ควรได้ราว{" "}
                                  <span className="font-num tnum font-semibold text-slate-800">
                                    {fmt(Math.min(st.max, Math.ceil(share * st.max * 2) / 2))}
                                  </span>
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        <p className="shrink-0 font-num tnum text-right whitespace-nowrap">
                          <span className={`text-xl font-semibold ${st.score === null ? "text-slate-400" : "text-slate-800"}`}>
                            {st.score === null ? "–" : fmt(st.score)}
                          </span>
                          <span className="text-slate-500"> / {fmt(st.max)}</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </li>
            ))}

            {/* ปลายทาง: เกรดจริงเมื่อครบ หรือเกรดที่ตั้งเป้าไว้ */}
            {(finalGrade !== null || target) && (
              <li className="flex items-stretch">
                <Track color={segments[segments.length - 1].color} nextColor={null} end route={route} />
                <div className="flex items-center gap-3 pt-5 pb-2 pl-3 min-w-0">
                  <Terminus grade={finalGrade ?? target!.grade} state={route} />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">
                      {finalGrade !== null ? "ปลายทาง: เกรดของเทอมนี้" : "ปลายทางที่ตั้งเป้า"}
                    </p>
                    <p className="text-sm text-slate-600">{TERMINUS_NOTE[route](target)}</p>
                  </div>
                </div>
              </li>
            )}
          </ol>
        </div>
      </section>
    </div>
  );
}

type RouteState = "arrived" | "reached" | "needed" | "impossible";

const TERMINUS_NOTE: Record<RouteState, (t: GradeScale | null) => string> = {
  arrived: () => "ครูให้คะแนนครบทุกชิ้นแล้ว",
  reached: (t) => (t ? `ผ่านเกณฑ์เกรด ${t.grade} แล้ว ชิ้นที่เหลือไม่ต้องใช้ถึงปลายทางนี้` : ""),
  needed: (t) => (t ? `เกรด ${t.grade} ต้องได้รวมอย่างน้อย ${t.min_percent}% ของทั้งวิชา สถานีวงกลวงยังพาไปถึงได้` : ""),
  impossible: (t) => (t ? `เกรด ${t.grade} ต้องได้ ${t.min_percent}% ของทั้งวิชา สายนี้ไปไม่ถึงแล้ว` : ""),
};

/** แถวบนป้ายบอกทาง: สัญลักษณ์แบบแผนที่ + ชื่อ + ตัวเลข */
function BoardRow({ glyph, label, children }: { glyph: "filled" | "hollow" | "end"; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="flex items-center gap-2.5 text-sm text-slate-600">
        <span aria-hidden className="grid place-items-center size-4">
          {glyph === "filled" && <span className="size-3.5 rounded-full border-2 border-porcelain bg-trace-magenta" />}
          {glyph === "hollow" && <span className="size-3.5 rounded-full border-2 border-porcelain" />}
          {glyph === "end" && <span className="h-[4px] w-4 rounded-full bg-porcelain" />}
        </span>
        {label}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/** สถานีปลายสายที่มีเกรดอยู่ข้างใน — ขอบบอกสถานะของเป้า */
function Terminus({ grade, state, size = "md" }: { grade: string; state: RouteState; size?: "md" | "lg" }) {
  const ring =
    state === "impossible"
      ? "border-dashed border-red-600 text-red-700"
      : state === "reached"
        ? "border-green-600 text-green-700"
        : "border-porcelain text-slate-800";
  return (
    <span
      className={`shrink-0 grid place-items-center rounded-full border-[3px] bg-white font-num tnum font-bold ${ring} ${
        size === "lg" ? "size-16 text-2xl" : "size-12 text-lg"
      }`}
    >
      {grade}
    </span>
  );
}

function Forecast({
  target,
  need,
  remaining,
  route,
  best,
}: {
  target: GradeScale;
  need: number;
  remaining: number;
  route: RouteState;
  best: GradeScale | null;
}) {
  let headline: React.ReactNode;
  let detail: string;
  if (route === "reached") {
    headline = <span className="text-green-700">ถึงเกรด {target.grade} แล้ว</span>;
    detail = `คะแนนที่ได้ตอนนี้ผ่านเกณฑ์ ${target.min_percent}% ของเกรด ${target.grade} แล้ว ชิ้นที่เหลือได้เท่าไรก็ไม่ต่ำกว่านี้ ลองตั้งเป้าให้สูงขึ้นดูไหม`;
  } else if (route === "impossible") {
    headline = <span className="text-red-700">เกรด {target.grade} ไม่ทันแล้ว</span>;
    detail = best
      ? `ต่อให้ได้เต็มทุกชิ้นที่เหลือ ก็ยังไม่ถึงเกณฑ์ ${target.min_percent}% เป้าที่ยังไปถึงได้สูงสุดคือเกรด ${best.grade}`
      : `ต่อให้ได้เต็มทุกชิ้นที่เหลือ ก็ยังไม่ถึงเกณฑ์ ${target.min_percent}% ลองคุยกับครูเรื่องงานที่ขาดดูนะ`;
  } else {
    headline = (
      <>
        ต้องได้อีก <span className="font-num tnum text-4xl font-semibold leading-none">{fmt(Math.ceil(need * 100) / 100)}</span>{" "}
        <span className="text-slate-500 text-base font-normal">คะแนน</span>
      </>
    );
    const share = Math.round((need / remaining) * 100);
    detail = `จากคะแนนที่ยังเหลือ ${fmt(remaining)} คะแนน หรือประมาณ ${share}% ของที่เหลือ (เกณฑ์เกรด ${target.grade} คือ ${target.min_percent}%)`;
  }

  return (
    <div className="flex items-start gap-4" aria-live="polite">
      <Terminus grade={target.grade} state={route} />
      <div className="min-w-0 space-y-1">
        <p className="text-slate-800 font-medium leading-tight">{headline}</p>
        <p className="text-sm text-slate-600">{detail}</p>
      </div>
    </div>
  );
}

/**
 * คอลัมน์รางด้านซ้ายของแต่ละแถว: เส้นครึ่งบน + เส้นครึ่งล่าง + เครื่องหมายสถานี
 * ช่วงที่มีคะแนนแล้วสว่างและเรืองแสงแบบนีออน ชิ้นที่ยังไม่มีคะแนนเป็นวงกลวงสีกระเบื้องบนรางที่หรี่ลง
 * ถ้าเป้าที่เลือกยังต้องใช้คะแนนจากชิ้นเหล่านี้ รางช่วงนั้นสว่างขึ้น (ยังไม่เรือง) เพื่อบอกว่าอยู่บนเส้นทาง
 */
function Track({
  color,
  nextColor,
  station,
  transfer,
  first,
  end,
  route,
  share = null,
}: {
  color: string | null;
  nextColor: string | null;
  station?: Station;
  transfer?: boolean;
  first?: boolean;
  end?: boolean;
  route: RouteState;
  share?: number | null;
}) {
  const lit = station ? station.score !== null : true;
  const rail = lit ? (station ? "route-glow" : "") : "";
  // ชิ้นที่ยังไม่มีคะแนน: เป้ายิ่งต้องใช้คะแนนจากชิ้นนี้มาก รางยิ่งสว่าง (เปลี่ยนตามเป้าที่เลือก)
  const railStyle = lit ? undefined : { opacity: route === "needed" && share !== null ? 0.3 + 0.65 * share : 0.3 };
  return (
    <div className="relative w-9 shrink-0" aria-hidden>
      {color && (
        <span
          className={`absolute left-1/2 -translate-x-1/2 top-0 h-1/2 w-[5px] ${rail}`}
          style={{ background: color, color, ...railStyle }}
        />
      )}
      {nextColor && (
        <span
          className={`absolute left-1/2 -translate-x-1/2 top-1/2 bottom-0 w-[5px] ${rail}`}
          style={{ background: nextColor, color: nextColor, ...railStyle }}
        />
      )}
      {/* ปลายสาย: ขีดขวางแบบป้ายสถานีปลายทาง */}
      {end && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[5px] w-5 rounded-full bg-porcelain" />}
      {transfer && !first && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-3.5 rounded-full border-[3px] border-porcelain bg-[var(--c-slate-50)]" />
      )}
      {station && (
        // จุดบัดกรี (ชิ้นงาน) เป็นวงกลม · ข้อสอบเป็นชิปสี่เหลี่ยม · ทึบ = มีคะแนน, กลวง = ยังไม่มี
        <span
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center border-porcelain ${
            station.exam ? "size-6 rounded-[3px] border-[3px]" : "size-[18px] rounded-full border-[3px]"
          } ${lit ? "route-glow" : "bg-[var(--c-slate-50)]"}`}
          style={lit ? { background: station.exam ? "var(--porcelain)" : color ?? undefined, color: color ?? undefined } : undefined}
        >
          {lit && !station.exam && <span className="size-1 rounded-full bg-[var(--c-slate-50)]" />}
        </span>
      )}
    </div>
  );
}
