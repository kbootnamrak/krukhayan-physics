"use client";

import { useMemo, useState } from "react";

export type Point = { t: number; v: number };

/**
 * กราฟเส้นแบบ inline SVG — ไม่พึ่งไลบรารีกราฟ
 *
 * อุณหภูมิกับความชื้นคนละหน่วยและคนละสเกล จึงแยกเป็นคนละกราฟเสมอ
 * ไม่ใช้แกน y สองแกนซ้อนกัน เพราะจุดตัดของเส้นสองเส้นบนคนละสเกล
 * ไม่ได้มีความหมายอะไร แต่สายตาอ่านว่ามี
 */
const W = 760;
const H = 260;
const PAD = { top: 18, right: 58, bottom: 30, left: 46 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const INK = "#1e293b";
const INK_MUTED = "#64748b";
const GRID = "#e2e8f0";
const OUT_OF_RANGE = "#d03b3b";

function niceScale(lo: number, hi: number) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1, step: 1 };
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const span = hi - lo;
  const rawStep = span / 4;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * mag >= rawStep)! * mag;
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step };
}

function formatTime(ms: number, spanMs: number) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
  if (spanMs <= 36 * 60 * 60 * 1000) return time;
  const day = d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  });
  return `${day} ${time}`;
}

export default function TimeSeriesChart({
  title,
  unit,
  color,
  data,
  min,
  max,
}: {
  title: string;
  unit: string;
  color: string;
  data: Point[];
  min: number | null;
  max: number | null;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const scale = useMemo(() => {
    const values = data.map((d) => d.v);
    const bounds = [...values, ...(min !== null ? [min] : []), ...(max !== null ? [max] : [])];
    const y = niceScale(Math.min(...bounds), Math.max(...bounds));
    const t0 = data.length > 0 ? data[0].t : 0;
    const t1 = data.length > 0 ? data[data.length - 1].t : 1;
    const span = Math.max(t1 - t0, 1);
    return {
      ...y,
      t0,
      t1,
      span,
      x: (t: number) => PAD.left + ((t - t0) / span) * PLOT_W,
      yPos: (v: number) => PAD.top + (1 - (v - y.lo) / (y.hi - y.lo)) * PLOT_H,
    };
  }, [data, min, max]);

  if (data.length === 0) {
    return (
      <figure className="bg-white border border-slate-200 rounded-xl p-5">
        <figcaption className="text-sm font-medium text-slate-700">{title}</figcaption>
        <p className="py-12 text-center text-sm text-slate-400">ยังไม่มีข้อมูลในช่วงเวลานี้</p>
      </figure>
    );
  }

  const path = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${scale.x(d.t).toFixed(1)},${scale.yPos(d.v).toFixed(1)}`)
    .join(" ");

  const ticks: number[] = [];
  for (let v = scale.lo; v <= scale.hi + 1e-9; v += scale.step) ticks.push(Number(v.toFixed(4)));

  const xTickCount = Math.min(4, data.length);
  const xTicks = Array.from({ length: xTickCount }, (_, i) =>
    xTickCount === 1 ? scale.t0 : scale.t0 + (scale.span * i) / (xTickCount - 1)
  );

  const last = data[data.length - 1];
  const active = hover !== null ? data[hover] : null;
  const outOfRange = (v: number) => (max !== null && v > max) || (min !== null && v < min);

  function pick(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const xInView = ((e.clientX - box.left) / box.width) * W;
    const t = scale.t0 + ((xInView - PAD.left) / PLOT_W) * scale.span;
    let best = 0;
    for (let i = 1; i < data.length; i++) {
      if (Math.abs(data[i].t - t) < Math.abs(data[best].t - t)) best = i;
    }
    setHover(best);
  }

  return (
    <figure className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="text-sm font-medium text-slate-700">
          {title} <span className="text-slate-400 font-normal">({unit})</span>
        </figcaption>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2"
        >
          {asTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
        </button>
      </div>

      {asTable ? (
        <div className="mt-3 max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1 font-normal">เวลา</th>
                <th className="py-1 font-normal text-right">{unit}</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {[...data].reverse().map((d) => (
                <tr key={d.t} className="border-t border-slate-100">
                  <td className="py-1">{formatTime(d.t, scale.span)}</td>
                  <td className="py-1 text-right tabular-nums">
                    {d.v.toFixed(1)}
                    {outOfRange(d.v) && <span className="ml-2 text-xs text-red-600">ผิดเกณฑ์</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto mt-2 touch-none"
          role="img"
          aria-label={`${title} ล่าสุด ${last.v.toFixed(1)} ${unit}`}
          onPointerMove={pick}
          onPointerLeave={() => setHover(null)}
        >
          {/* เส้นกริดแนวนอน — จางกว่าเส้นข้อมูลเสมอ */}
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={PAD.left + PLOT_W}
                y1={scale.yPos(v)}
                y2={scale.yPos(v)}
                stroke={GRID}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={scale.yPos(v)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                fill={INK_MUTED}
              >
                {v}
              </text>
            </g>
          ))}

          {/* เกณฑ์ที่ตั้งไว้ — เส้นประสีหมึก ไม่ใช่สีของข้อมูล เพื่อไม่ให้สับสนว่าเป็นอีกชุดข้อมูล */}
          {[
            { value: max, label: "สูงสุด" },
            { value: min, label: "ต่ำสุด" },
          ].map(({ value, label }) =>
            value === null || value < scale.lo || value > scale.hi ? null : (
              <g key={label}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + PLOT_W}
                  y1={scale.yPos(value)}
                  y2={scale.yPos(value)}
                  stroke={INK_MUTED}
                  strokeWidth={1}
                  strokeDasharray="5 4"
                />
                <text
                  x={PAD.left + PLOT_W + 6}
                  y={scale.yPos(value)}
                  dominantBaseline="middle"
                  fontSize={10}
                  fill={INK_MUTED}
                >
                  {label} {value}
                </text>
              </g>
            )
          )}

          {/* แกนเวลา */}
          <line
            x1={PAD.left}
            x2={PAD.left + PLOT_W}
            y1={PAD.top + PLOT_H}
            y2={PAD.top + PLOT_H}
            stroke={GRID}
            strokeWidth={1}
          />
          {xTicks.map((t, i) => (
            <text
              key={t}
              x={scale.x(t)}
              y={H - 10}
              textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
              fontSize={11}
              fill={INK_MUTED}
            >
              {formatTime(t, scale.span)}
            </text>
          ))}

          <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* จุดที่ผิดเกณฑ์ — ย้ำด้วยสีสถานะ และมีคำอธิบายกำกับใน tooltip/ตาราง */}
          {data
            .filter((d) => outOfRange(d.v))
            .map((d) => (
              <circle
                key={d.t}
                cx={scale.x(d.t)}
                cy={scale.yPos(d.v)}
                r={3}
                fill={OUT_OF_RANGE}
                stroke="#ffffff"
                strokeWidth={2}
              />
            ))}

          {/* ค่าล่าสุด ติดป้ายไว้ตลอด ไม่ต้องเอาเมาส์ไปชี้ */}
          <circle cx={scale.x(last.t)} cy={scale.yPos(last.v)} r={4} fill={color} stroke="#ffffff" strokeWidth={2} />
          {/* ป้ายค่าล่าสุดต้องไม่ล้นเข้าไปในขอบขวา เพราะขอบขวาเป็นที่ของป้ายเส้นเกณฑ์
              ถ้าค่าล่าสุดบังเอิญอยู่ใกล้เส้นเกณฑ์ ตัวหนังสือจะทับกันจนอ่านไม่ออก */}
          <text
            x={Math.min(scale.x(last.t) + 8, PAD.left + PLOT_W)}
            y={scale.yPos(last.v) - 10}
            textAnchor="end"
            fontSize={12}
            fontWeight={600}
            fill={INK}
          >
            {last.v.toFixed(1)}
          </text>

          {active && (
            <g pointerEvents="none">
              <line
                x1={scale.x(active.t)}
                x2={scale.x(active.t)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                stroke={INK_MUTED}
                strokeWidth={1}
              />
              <circle cx={scale.x(active.t)} cy={scale.yPos(active.v)} r={5} fill={color} stroke="#ffffff" strokeWidth={2} />
              <g
                transform={`translate(${Math.min(
                  Math.max(scale.x(active.t) - 70, PAD.left),
                  PAD.left + PLOT_W - 140
                )}, ${PAD.top + 4})`}
              >
                <rect width={140} height={44} rx={6} fill="#ffffff" stroke={GRID} />
                <text x={10} y={17} fontSize={11} fill={INK_MUTED}>
                  {formatTime(active.t, scale.span)}
                </text>
                <text x={10} y={34} fontSize={13} fontWeight={600} fill={INK}>
                  {active.v.toFixed(1)} {unit}
                </text>
                {outOfRange(active.v) && (
                  <text x={130} y={34} textAnchor="end" fontSize={10} fill={OUT_OF_RANGE}>
                    ผิดเกณฑ์
                  </text>
                )}
              </g>
            </g>
          )}
        </svg>
      )}
    </figure>
  );
}
