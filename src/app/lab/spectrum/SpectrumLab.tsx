"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  GRATING_D,
  GRATING_LINES_PER_CM,
  HYDROGEN_LINES,
  SOURCES,
  emptyReadings,
  percentError,
  wavelengthToRgb,
  type Reading,
  type SourceId,
} from "@/lib/spectrum";
import type { SceneState, SpectrumScene, View } from "./scene";

/**
 * ห้องทดลองเสมือน กิจกรรม 19.1 การศึกษาสเปกตรัมของแก๊สร้อน
 * นักเรียนเลือกหลอด เปิดสวิตช์ มองผ่านเกรตติง เลื่อนตัวชี้ไปที่เส้นสเปกตรัมเพื่ออ่านตำแหน่งบนไม้เมตร
 * บันทึก x₁ (ซ้าย) x₂ (ขวา) แล้วคำนวณ λ เอง — ระบบบอกเฉพาะ % ความคลาดเคลื่อนของคำตอบ
 */
export default function SpectrumLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SpectrumScene | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [source, setSource] = useState<SourceId>("lamp");
  const [power, setPower] = useState(false);
  const [distance, setDistance] = useState(1);
  const [view, setView] = useState<View>("lab");
  const [zoom, setZoom] = useState(false);
  const [pointer, setPointer] = useState(0.2);
  const [roomLight, setRoomLight] = useState(true);
  const [readings, setReadings] = useState<Reading[]>(emptyReadings);
  const [row, setRow] = useState(0);


  // สร้างฉากครั้งเดียว (โหลด three.js เฉพาะหน้านี้)
  useEffect(() => {
    let disposed = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    import("./scene")
      .then(({ createSpectrumScene }) => {
        if (disposed) return;
        // ค่าเริ่มต้นของฉาก — ค่าปัจจุบันถูกส่งตามทันทีจาก effect ด้านล่างเมื่อ ready
        const initial: SceneState = { source: "lamp", power: false, distance: 1, view: "lab", zoom: false, pointer: 0.2, roomLight: true };
        sceneRef.current = createSpectrumScene(canvas, initial, (x) => setPointer(x));
        setReady(true);
      })
      .catch(() => setFailed("อุปกรณ์นี้เปิดภาพ 3 มิติไม่ได้ ลองเปิดด้วย Chrome หรือ Safari รุ่นใหม่"));
    return () => {
      disposed = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.update({ source, power, distance, view, zoom, pointer, roomLight });
  }, [source, power, distance, view, zoom, pointer, roomLight, ready]);

  const hasReadings = readings.some((r) => r.x1 !== null || r.x2 !== null);
  const scaleCm = 50 + pointer * 100;
  const side = pointer < 0 ? "ซ้าย" : "ขวา";
  const canRecord = source === "hydrogen" && power && view === "grating" && Math.abs(pointer) > 0.005;

  function nudge(mm: number) {
    setPointer((p) => Math.max(-0.5, Math.min(0.5, Math.round((p + mm / 1000) * 1000) / 1000)));
  }

  function record() {
    const x = Math.abs(pointer);
    setReadings((list) => list.map((r, i) => (i === row ? { ...r, [pointer < 0 ? "x1" : "x2"]: x } : r)));
  }

  function lookThrough() {
    setView("grating");
    if (!power) setPower(true);
  }

  const chip = (on: boolean) =>
    `min-h-11 rounded-sm border-2 px-3 text-sm font-semibold sm:min-h-9 ${
      on ? "border-trace-cyan bg-[color-mix(in_oklch,var(--trace-cyan)_14%,transparent)] text-slate-800" : "border-slate-300 text-slate-600 hover:border-slate-400"
    }`;

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:py-6">
      {/* ---------------------------------------------------------------- ฉาก */}
      <div className="space-y-3 lg:sticky lg:top-4">
        <div className="relative overflow-hidden rounded-sm border-2 border-slate-300 bg-[oklch(14%_0.03_265)]">
          <canvas
            ref={canvasRef}
            aria-label="ฉาก 3 มิติของชุดทดลองสเปกตรัม"
            className={`block h-[46dvh] min-h-[280px] w-full touch-none lg:h-[62dvh] ${view === "grating" ? "cursor-crosshair" : "cursor-grab"}`}
          />
          {/* ขอบมืดเหมือนมองผ่านช่องเกรตติง */}
          {view === "grating" && (
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 90px 30px oklch(8% 0.02 265 / 0.9)" }} />
          )}
          {!ready && !failed && <p className="absolute inset-0 grid place-items-center text-sm text-[oklch(80%_0.02_265)]">กำลังเตรียมห้องทดลอง...</p>}
          {failed && <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-[oklch(85%_0.02_265)]">{failed}</p>}

          <div className="absolute left-2 top-2 flex gap-1.5">
            <ViewButton on={view === "lab"} onClick={() => (setView("lab"), setZoom(false))}>
              มุมห้องแล็บ
            </ViewButton>
            <ViewButton on={view === "grating"} onClick={lookThrough}>
              มองผ่านเกรตติง
            </ViewButton>
          </div>
          {view === "grating" && (
            <div className="absolute right-2 top-2">
              <ViewButton on={zoom} onClick={() => setZoom((z) => !z)}>
                {zoom ? "ซูมออก" : "ซูมที่ตัวชี้"}
              </ViewButton>
            </div>
          )}
          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs text-[oklch(82%_0.02_265)]">
            {view === "lab" ? "ลากเพื่อหมุนดูรอบโต๊ะ · ถ่างนิ้วหรือหมุนล้อเมาส์เพื่อซูม" : "แตะหรือลากบนไม้เมตรเพื่อย้ายตัวชี้ไปที่เส้นสเปกตรัม"}
          </p>
        </div>

        {/* ตัวชี้อ่านตำแหน่ง */}
        <div className="space-y-2 rounded-sm border-2 border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-display font-semibold text-slate-800">ตัวชี้บนไม้เมตร</p>
            <p className="font-num tnum text-sm text-slate-600">
              ขีด <b className="text-lg text-slate-800">{scaleCm.toFixed(1)}</b> ซม. · ห่างจากหลอด{" "}
              <b className="text-lg text-slate-800">{Math.abs(pointer * 100).toFixed(1)}</b> ซม. ({side})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NudgeButton label="เลื่อนซ้าย 1 มม." onClick={() => nudge(-1)} dir="left" />
            <input
              type="range"
              aria-label="ตำแหน่งตัวชี้บนไม้เมตร"
              min={-0.5}
              max={0.5}
              step={0.001}
              value={pointer}
              onChange={(e) => setPointer(Number(e.target.value))}
              className="h-11 min-w-0 flex-1 accent-[var(--trace-cyan)]"
            />
            <NudgeButton label="เลื่อนขวา 1 มม." onClick={() => nudge(1)} dir="right" />
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- แผงควบคุม */}
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-slate-800">กิจกรรม 19.1 สเปกตรัมของแก๊สร้อน</h1>
          <p className="text-sm text-slate-600">
            ห้องทดลองเสมือน ฟิสิกส์ 6 บทที่ 19 ฟิสิกส์อะตอม · ทำตามขั้นตอนในใบกิจกรรมได้เลย
          </p>
        </header>

        <section className="space-y-3 rounded-sm border-2 border-slate-200 bg-white p-4">
          <h2 className="font-display text-lg font-semibold text-slate-800">ชุดทดลอง</h2>
          <fieldset className="min-w-0 space-y-1.5">
            <legend className="text-sm font-medium text-slate-700">แหล่งกำเนิดแสง</legend>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map((s) => (
                <button key={s.id} type="button" aria-pressed={source === s.id} onClick={() => setSource(s.id)} className={chip(source === s.id)}>
                  <span aria-hidden className="mr-1.5 inline-block size-2.5 rounded-full align-middle" style={{ background: s.glow }} />
                  {s.short}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">{SOURCES.find((s) => s.id === source)!.name}</p>
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={power} onClick={() => setPower((p) => !p)} className={chip(power)}>
              สวิตช์ชุดสเปกตรัม: {power ? "เปิด" : "ปิด"}
            </button>
            <button type="button" aria-pressed={!roomLight} onClick={() => setRoomLight((l) => !l)} className={chip(!roomLight)}>
              ไฟห้อง: {roomLight ? "เปิด" : "ปิด"}
            </button>
          </div>

          <div className="space-y-1">
            <label htmlFor="lab-d" className="flex items-baseline justify-between text-sm font-medium text-slate-700">
              ระยะเกรตติงถึงไม้เมตร D
              <span className="font-num tnum text-lg text-slate-800">{distance.toFixed(2)} m</span>
            </label>
            <input
              id="lab-d"
              type="range"
              min={0.6}
              max={1.2}
              step={0.05}
              value={distance}
              disabled={hasReadings}
              onChange={(e) => setDistance(Number(e.target.value))}
              className="h-11 w-full accent-[var(--trace-cyan)] disabled:opacity-50"
            />
            <p className="text-xs text-slate-500">
              {hasReadings
                ? "บันทึกผลแล้ว จึงล็อกระยะ D ไว้ — ล้างตารางก่อนถ้าจะเปลี่ยน"
                : `เกรตติง ${GRATING_LINES_PER_CM.toLocaleString()} เส้น/ซม. · d = 1/N = ${(GRATING_D * 1e6).toFixed(3)} × 10⁻⁶ m`}
            </p>
          </div>
        </section>

        <section className="space-y-3 rounded-sm border-2 border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-slate-800">ตารางบันทึกผล ไฮโดรเจน</h2>
            {hasReadings && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("ล้างค่าที่บันทึกไว้ทั้งหมด?")) setReadings(emptyReadings());
                }}
                className="min-h-11 rounded-sm px-2 text-sm text-slate-500 underline underline-offset-2 hover:text-slate-800 sm:min-h-0"
              >
                ล้างตาราง
              </button>
            )}
          </div>
          <p className="text-sm text-slate-600">
            เลือกแถวสี → เลื่อนตัวชี้ไปทับเส้นสีนั้นทางซ้าย กด &quot;บันทึกตำแหน่ง&quot; แล้วทำซ้ำทางขวา จากนั้นคำนวณ λ = d·x̄/√(D² + x̄²) เอง แล้วพิมพ์คำตอบ
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1.5 pr-2 font-medium">เส้น</th>
                  <th className="px-2 py-1.5 text-right font-medium">x₁ ซ้าย (m)</th>
                  <th className="px-2 py-1.5 text-right font-medium">x₂ ขวา (m)</th>
                  <th className="px-2 py-1.5 font-medium">λ ที่คำนวณ (nm)</th>
                  <th className="py-1.5 pl-2 text-right font-medium">คลาดเคลื่อน</th>
                </tr>
              </thead>
              <tbody>
                {HYDROGEN_LINES.map((line, i) => {
                  const r = readings[i];
                  const [cr, cg, cb] = wavelengthToRgb(line.nm);
                  const ans = Number(r.answer.replace(",", "."));
                  const err = r.answer.trim() && Number.isFinite(ans) && ans > 0 ? percentError(ans, line.nm) : null;
                  const on = row === i;
                  return (
                    <tr key={line.nm} className={`border-b border-slate-100 ${on ? "bg-[color-mix(in_oklch,var(--trace-cyan)_10%,transparent)]" : ""}`}>
                      <td className="py-1.5 pr-2">
                        <button type="button" aria-pressed={on} onClick={() => setRow(i)} className="flex min-h-11 items-center gap-2 text-left sm:min-h-9">
                          <span aria-hidden className="size-3.5 shrink-0 rounded-full border border-slate-300" style={{ background: `rgb(${cr * 255} ${cg * 255} ${cb * 255})` }} />
                          <span className={on ? "font-semibold text-slate-800" : "text-slate-700"}>{line.label}</span>
                        </button>
                      </td>
                      <td className="px-2 py-1.5 text-right font-num tnum text-slate-800">{r.x1 === null ? "–" : r.x1.toFixed(3)}</td>
                      <td className="px-2 py-1.5 text-right font-num tnum text-slate-800">{r.x2 === null ? "–" : r.x2.toFixed(3)}</td>
                      <td className="px-2 py-1.5">
                        <input
                          inputMode="decimal"
                          aria-label={`λ ที่คำนวณได้ของเส้น${line.label} (นาโนเมตร)`}
                          value={r.answer}
                          onChange={(e) => setReadings((list) => list.map((x, k) => (k === i ? { ...x, answer: e.target.value } : x)))}
                          className="h-10 w-24 rounded-sm border-2 border-slate-300 bg-white px-2 text-right font-num text-base text-slate-800 sm:text-sm"
                        />
                      </td>
                      <td className={`py-1.5 pl-2 text-right font-num tnum ${err === null ? "text-slate-400" : err <= 5 ? "font-semibold text-green-700" : "font-semibold text-red-700"}`}>
                        {err === null ? "–" : `${err.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            disabled={!canRecord}
            onClick={record}
            className="min-h-12 w-full rounded-sm bg-[oklch(50%_0.24_345)] px-4 font-display text-base font-bold text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)] disabled:opacity-40"
          >
            บันทึกตำแหน่ง {Math.abs(pointer).toFixed(3)} m เป็น {pointer < 0 ? "x₁ (ซ้าย)" : "x₂ (ขวา)"} ของเส้น{HYDROGEN_LINES[row].label}
          </button>
          {!canRecord && (
            <p className="text-xs text-slate-500">
              {source !== "hydrogen"
                ? "ตารางนี้ใช้กับหลอดไฮโดรเจน — เลือกแหล่งกำเนิดแสงเป็นไฮโดรเจนก่อน"
                : !power
                  ? "เปิดสวิตช์ชุดสเปกตรัมก่อน"
                  : view !== "grating"
                    ? "กด \"มองผ่านเกรตติง\" เพื่อเห็นเส้นสเปกตรัม"
                    : "เลื่อนตัวชี้ออกจากกึ่งกลางไปที่เส้นสเปกตรัม"}
            </p>
          )}
          <p className="text-xs text-slate-500">
            % ความคลาดเคลื่อนเทียบกับค่าทฤษฎีในใบกิจกรรม (410.2, 434.1, 486.1, 656.3 nm) · หลอดไส้และนีออนให้สังเกตลักษณะสเปกตรัมแล้วบันทึกลงใบกิจกรรม
          </p>
        </section>

        <p className="text-center text-sm">
          <Link href="/dashboard" className="text-slate-500 underline underline-offset-2 hover:text-slate-800">
            กลับหน้าหลัก
          </Link>
        </p>
      </div>
    </div>
  );
}

function ViewButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-sm border-2 px-3 text-sm font-semibold backdrop-blur-sm sm:min-h-9 ${
        on
          ? "border-[oklch(83%_0.14_205)] bg-[oklch(83%_0.14_205_/_0.22)] text-[oklch(97%_0.01_265)]"
          : "border-[oklch(60%_0.03_265_/_0.7)] bg-[oklch(14%_0.03_265_/_0.6)] text-[oklch(85%_0.02_265)] hover:border-[oklch(80%_0.03_265)]"
      }`}
    >
      {children}
    </button>
  );
}

function NudgeButton({ label, onClick, dir }: { label: string; onClick: () => void; dir: "left" | "right" }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-11 shrink-0 place-items-center rounded-sm border-2 border-slate-300 text-slate-700 hover:bg-slate-100">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}
