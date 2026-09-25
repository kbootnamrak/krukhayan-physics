"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EXAM_TRACE, unitTrace } from "@/lib/traces";
import { UnitGlyph } from "@/components/PhysicsArt";
import { createClient } from "@/lib/supabase/client";
import { calcGrade, DEFAULT_GRADE_SCALE, type GradeScale } from "@/lib/grade";
import { dbErrorMessage } from "@/lib/db-error";
import { downloadBlob } from "@/lib/download";
import { compareRoster, placeLabel } from "@/lib/students/order";
import { fmt, gradedItems, scoreLookup, summarize, type SourceType } from "@/lib/scores";

type Category = "K" | "P" | "A";
type Unit = { id: string; title: string; sort_order: number };
type Component = { id: string; unit_id: string; category: Category; max_score: number };
type Exam = { id: string; exam_type: "midterm" | "final"; max_score: number };
/**
 * การลงทะเบียน 1 แถว = นักเรียน 1 คนในวิชา
 * student_id ว่างได้ — นักเรียนที่ครูนำเข้าแล้วแต่ยังไม่เคยล็อกอิน (ครูกรอกคะแนนได้ตั้งแต่ตอนนั้น)
 */
export type Enrollment = {
  id: string;
  student_id: string | null;
  class_roster: { full_name: string; student_code: string; classroom: string | null; class_number: number | null } | null;
  profiles: { full_name: string; student_code: string | null } | null;
};
export type ScoreRow = { enrollment_id: string; source_type: SourceType; source_id: string; score: number | null };

type Column = { sourceType: SourceType; sourceId: string; max: number; label: string };

const CATEGORY_ORDER: Category[] = ["K", "P", "A"];

export default function ScoresPanel({
  units,
  components,
  exams,
  enrollments,
  scores,
  gradeScales,
  exportName,
  onScoreSaved,
}: {
  units: Unit[];
  components: Component[];
  exams: Exam[];
  enrollments: Enrollment[];
  scores: ScoreRow[];
  gradeScales: GradeScale[];
  /** ชื่อไฟล์ Excel ที่ดาวน์โหลด (ไม่ต้องมี .xlsx) */
  exportName: string;
  onScoreSaved: (row: ScoreRow) => void;
}) {
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  // ตัวกรองห้อง ("" = ทุกห้อง) และคำค้นหา (ชื่อ / รหัส / เลขที่)
  const [room, setRoom] = useState("");
  const [query, setQuery] = useState("");

  // แสดงเฉพาะช่องที่ตั้งคะแนนเต็มไว้จริง — หน่วยที่ไม่มี A ก็ไม่ต้องมีคอลัมน์ A ว่าง ๆ
  const groups = useMemo((): { title: string; color: string; exam: boolean; columns: Column[] }[] => {
    const sorted = [...units].sort((a, b) => a.sort_order - b.sort_order);
    const unitGroups = sorted
      .map((u) => ({
        title: u.title,
        columns: CATEGORY_ORDER.flatMap((cat): Column[] => {
          const c = components.find((x) => x.unit_id === u.id && x.category === cat);
          return c ? [{ sourceType: "unit_component", sourceId: c.id, max: Number(c.max_score), label: cat }] : [];
        }),
      }))
      .filter((g) => g.columns.length > 0)
      // สีของหน่วยตรงกับหน้าคะแนนของนักเรียน (หน่วยที่ 1 = สีแรก …)
      .map((g, i) => ({ ...g, color: unitTrace(i), exam: false }));

    const examColumns = (["midterm", "final"] as const).flatMap((t): Column[] => {
      const e = exams.find((x) => x.exam_type === t);
      return e
        ? [{ sourceType: "exam", sourceId: e.id, max: Number(e.max_score), label: t === "midterm" ? "กลางภาค" : "ปลายภาค" }]
        : [];
    });
    return examColumns.length > 0
      ? [...unitGroups, { title: "สอบ", color: EXAM_TRACE, exam: true, columns: examColumns }]
      : unitGroups;
  }, [units, components, exams]);

  const columns: Column[] = groups.flatMap((g) => g.columns);
  // เส้นแบ่งแนวตั้งหน้าคอลัมน์แรกของแต่ละหน่วย ให้ดูออกว่าช่องไหนอยู่หน่วยไหน
  const groupStart = (c: Column) => groups.some((g) => g.columns[0] === c);
  // พื้นจาง ๆ สีของหน่วยทั้งคอลัมน์ + เส้นคั่นหนาสีของหน่วย — ครูบอกว่าเดิมแยกหน่วยด้วยตายาก
  const groupOf = (c: Column) => groups.find((g) => g.columns.includes(c))!;
  const tint = (color: string, pct: number) => `color-mix(in oklch, ${color} ${pct}%, transparent)`;
  // หัวตารางติดอยู่ด้านบนตอนเลื่อน (มือถือ) — ต้องทึบ ไม่งั้นเห็นแถวคะแนนลอดใต้หัว
  const solid = (color: string, pct: number) => `linear-gradient(${tint(color, pct)}, ${tint(color, pct)}), var(--c-white)`;
  const cellStyle = (c: Column): React.CSSProperties => {
    const g = groupOf(c);
    return {
      background: tint(g.color, 7),
      borderLeft: groupStart(c) ? `2px solid ${tint(g.color, 70)}` : undefined,
    };
  };
  const items = useMemo(() => gradedItems(components, exams), [components, exams]);

  // ชื่อจากรายชื่อที่ครูนำเข้าก่อน (ตรงกับทะเบียนโรงเรียน) ถ้าไม่มีค่อยใช้ชื่อในโปรไฟล์
  // เรียงแบบสมุดคะแนน: ห้อง → เลขที่ → รหัส
  const students = enrollments
    .map((en) => ({
      id: en.id,
      full_name: en.class_roster?.full_name ?? en.profiles?.full_name ?? "(ไม่มีชื่อ)",
      student_code: en.class_roster?.student_code ?? en.profiles?.student_code ?? null,
      classroom: en.class_roster?.classroom ?? null,
      class_number: en.class_roster?.class_number ?? null,
      signedIn: en.student_id !== null,
    }))
    .sort(compareRoster);
  const hasPlacement = students.some((s) => s.classroom !== null || s.class_number !== null);

  // ห้องทั้งหมดที่มีในวิชานี้ เรียงแบบเดียวกับรายชื่อ พร้อมจำนวนคน
  const rooms: { name: string; count: number }[] = [];
  for (const st of students) {
    if (!st.classroom) continue;
    const r = rooms.find((x) => x.name === st.classroom);
    if (r) r.count++;
    else rooms.push({ name: st.classroom, count: 1 });
  }
  const activeRoom = rooms.some((r) => r.name === room) ? room : "";
  const inRoom = activeRoom ? students.filter((st) => st.classroom === activeRoom) : students;
  const q = query.trim().toLowerCase();
  // ค้นได้ทั้งชื่อ นามสกุล รหัสนักเรียน และเลขที่ (พิมพ์ตัวเลขล้วนแล้วตรงกับเลขที่พอดีก็เจอ)
  const visible = q
    ? inRoom.filter(
        (st) =>
          st.full_name.toLowerCase().includes(q) ||
          (st.student_code ?? "").includes(q) ||
          (/^\d+$/.test(q) && st.class_number === Number(q))
      )
    : inRoom;

  const errorCount = Object.keys(errors).length;

  // เตือนก่อนปิดแท็บถ้ายังบันทึกไม่เสร็จหรือมีช่องที่บันทึกไม่สำเร็จ
  useEffect(() => {
    if (pending === 0 && errorCount === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending, errorCount]);

  const scales = gradeScales.length ? gradeScales : DEFAULT_GRADE_SCALE;

  /**
   * ส่งออกเป็น Excel สำหรับส่งฝ่ายวัดผลปลายเทอม — คอลัมน์ตรงกับตารางบนจอ
   * ช่องที่ยังไม่ได้กรอกเว้นว่าง (ไม่ใส่ 0) และคนที่ยังไม่ครบไม่ใส่เกรด แต่บอกในหมายเหตุ
   */
  async function exportExcel() {
    setExporting(true);
    try {
      // โหลดไลบรารีเฉพาะตอนกด — ไฟล์ใหญ่ ไม่ควรให้ทุกคนที่เปิดหน้านี้ต้องโหลด
      const XLSX = await import("xlsx");
      // ห้อง/เลขที่ไว้หน้าสุดแบบสมุดคะแนน — ใส่เฉพาะเมื่อไฟล์ที่นำเข้ามีข้อมูลนี้
      const placeHeader = hasPlacement ? ["ห้อง", "เลขที่"] : [];
      const header = [
        ...placeHeader,
        "รหัสนักเรียน",
        "ชื่อ-สกุล",
        ...groups.flatMap((g) =>
          g.columns.map((c) => (g.title === "สอบ" ? `${c.label} (${fmt(c.max)})` : `${g.title} ${c.label} (${fmt(c.max)})`))
        ),
        `รวม (${fmt(items.reduce((s, i) => s + i.max, 0))})`,
        "ร้อยละ",
        "เกรด",
        "หมายเหตุ",
      ];
      // ส่งออกตามห้องที่เลือกอยู่ (ไม่สนคำค้นหา) — เลือก "ทุกห้อง" ได้ไฟล์รวมทั้งวิชา
      const rows = inRoom.map((en) => {
        const lookup = scoreLookup(scores, en.id);
        const summary = summarize(items, lookup);
        return [
          ...(hasPlacement ? [en.classroom ?? "", en.class_number ?? ""] : []),
          en.student_code ?? "",
          en.full_name,
          ...columns.map((c) => lookup(c.sourceType, c.sourceId) ?? ""),
          Math.round(summary.earned * 100) / 100,
          summary.percentFinal === null ? "" : Math.round(summary.percentFinal * 100) / 100,
          summary.complete ? calcGrade(summary.percentFinal ?? 0, scales) : "",
          summary.complete ? "" : `ยังไม่ครบ ขาด ${summary.missing} รายการ`,
        ];
      });

      const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
      const nameColumn = placeHeader.length + 1;
      sheet["!cols"] = header.map((h, i) => ({ wch: i === nameColumn ? 28 : Math.max(6, Math.min(24, h.length + 2)) }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "คะแนน");
      const data = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      downloadBlob(
        new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `${exportName}${activeRoom ? ` ${activeRoom.replace("/", "-")}` : ""}.xlsx`
      );
    } finally {
      setExporting(false);
    }
  }

  if (columns.length === 0) {
    return (
      <p className="bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-500">
        ยังไม่ได้ตั้งคะแนนเต็มของวิชานี้ — ไปตั้งที่แท็บ &quot;หน่วยการเรียนรู้&quot; ก่อน
      </p>
    );
  }

  if (students.length === 0) {
    return (
      <p className="bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-500">
        ยังไม่มีนักเรียนในวิชานี้ — นำเข้ารายชื่อที่แท็บ &quot;นักเรียน&quot; แล้วกรอกคะแนนที่นี่ได้ทันที
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap text-xs">
        <p className="text-slate-500">
          {/* มือถือไม่มีปุ่ม Enter บนแป้นตัวเลข — ใช้ปุ่ม "ถัดไป" ของแป้นพิมพ์แทน */}
          <span className="hidden sm:inline">
            กด <kbd className="px-1 border border-slate-300 rounded">Enter</kbd> เพื่อบันทึกแล้วลงไปคนถัดไป ·{" "}
          </span>
          <span className="sm:hidden">กดปุ่มถัดไปบนแป้นพิมพ์เพื่อลงไปคนถัดไป · </span>
          ช่องว่าง = ยังไม่ได้ให้คะแนน (ไม่ใช่ 0)
        </p>
        <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
          <p className={`inline-flex items-center gap-1 ${pending > 0 ? "text-slate-500" : "text-green-700"}`} aria-live="polite">
            {pending === 0 && (
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m3 8.5 3 3 7-7" />
              </svg>
            )}
            {pending > 0 ? "กำลังบันทึก..." : "บันทึกแล้วทั้งหมด"}
          </p>
          <button
            onClick={exportExcel}
            disabled={exporting || pending > 0}
            title={pending > 0 ? "รอบันทึกให้เสร็จก่อน" : undefined}
            className="min-h-11 text-sm border border-slate-300 rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:min-h-0"
          >
            {exporting ? "กำลังสร้างไฟล์..." : `ดาวน์โหลด Excel${activeRoom ? ` (${activeRoom})` : ""}`}
          </button>
        </div>
      </div>

      {/* แถบกรองห้อง + ค้นหา */}
      <div className="flex flex-wrap items-center gap-2">
        {rooms.length > 1 && (
          <div role="group" aria-label="เลือกห้อง" className="flex flex-wrap gap-1.5">
            {[{ name: "", count: students.length }, ...rooms].map((r) => {
              const on = activeRoom === r.name;
              return (
                <button
                  key={r.name || "all"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRoom(r.name)}
                  className={`min-h-11 rounded-sm border-2 px-3 py-1.5 text-sm font-display font-semibold sm:min-h-0 ${
                    on ? "border-porcelain bg-porcelain text-[var(--c-slate-50)]" : "border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800"
                  }`}
                >
                  {r.name || "ทุกห้อง"} <span className={`font-num tnum font-medium ${on ? "" : "text-slate-400"}`}>{r.count}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="relative ml-auto w-full sm:w-64">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter ในช่องค้นหา = ไปช่องคะแนนแรกของคนแรกที่เจอ กรอกต่อได้เลย
              if (e.key !== "Enter") return;
              e.preventDefault();
              const first = document.querySelector<HTMLInputElement>('[data-cell="0-0"]');
              first?.focus();
              first?.select();
            }}
            placeholder="ค้นหาชื่อ รหัส หรือเลขที่"
            aria-label="ค้นหานักเรียน"
            enterKeyHint="go"
            // ตัวอักษร 16px บนมือถือ — เล็กกว่านี้ iPhone จะซูมหน้าเองตอนแตะช่อง
            className="w-full rounded-sm border border-slate-300 bg-white py-2.5 pl-8 pr-3 text-base placeholder:text-slate-400 sm:py-1.5 sm:text-sm"
          />
        </div>
      </div>
      {(activeRoom || q) && (
        <p className="text-xs text-slate-500" aria-live="polite">
          แสดง <span className="font-num tnum">{visible.length}</span> จาก <span className="font-num tnum">{students.length}</span> คน
          {q && (
            <button type="button" onClick={() => setQuery("")} className="ml-2 underline underline-offset-2 hover:text-slate-800">
              ล้างคำค้นหา
            </button>
          )}
        </p>
      )}

      {errorCount > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-800" role="alert">
          มี {errorCount} ช่องที่ยังบันทึกไม่สำเร็จ (ช่องสีแดง) — {Object.values(errors).at(-1)}
        </div>
      )}

      {/* มือถือ: ตารางสูงไม่เกินจอ เลื่อนในกรอบ หัวหน่วย/K P A ติดอยู่ด้านบนเสมอ รู้ตลอดว่ากำลังกรอกช่องไหน */}
      <div className="max-h-[75dvh] overflow-auto overscroll-contain bg-white border border-slate-200 rounded-lg sm:max-h-none">
        <table className="text-sm border-collapse w-full">
          <thead>
            <tr className="text-left text-slate-500">
              <th rowSpan={2} className="p-2 sticky left-0 top-0 z-30 bg-white min-w-[120px] align-bottom sm:min-w-[180px]">
                นักเรียน
              </th>
              {groups.map((g) => (
                <th
                  key={g.title}
                  colSpan={g.columns.length}
                  className="sticky top-0 z-20 h-10 px-2 pt-2 pb-1.5 text-center font-display font-semibold text-slate-800 whitespace-nowrap"
                  style={{
                    background: solid(g.color, 16),
                    borderLeft: `2px solid ${tint(g.color, 70)}`,
                    borderTop: `4px solid ${g.color}`,
                  }}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    {!g.exam && (
                      <span className="shrink-0" style={{ color: g.color }}>
                        <UnitGlyph title={g.title} className="size-4" />
                      </span>
                    )}
                    {g.title}
                  </span>
                </th>
              ))}
              <th rowSpan={2} className="sticky top-0 z-20 bg-white p-2 text-center border-l border-slate-200 align-bottom">
                รวม
              </th>
              <th rowSpan={2} className="sticky top-0 z-20 bg-white p-2 text-center align-bottom">
                เกรด
              </th>
            </tr>
            <tr className="text-slate-400 text-xs">
              {columns.map((c) => (
                <th
                  key={c.sourceId}
                  className="sticky top-10 z-20 p-1 text-center font-normal"
                  style={{ ...cellStyle(c), background: solid(groupOf(c).color, 7) }}
                >
                  {c.label}
                  <span className="block text-slate-300">/{fmt(c.max)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + 3} className="p-6 text-center text-sm text-slate-500">
                  ไม่พบนักเรียนที่ตรงกับ &quot;{query}&quot;{activeRoom ? ` ใน ${activeRoom}` : ""}
                </td>
              </tr>
            )}
            {visible.map((en, row) => {
              const lookup = scoreLookup(scores, en.id);
              const summary = summarize(items, lookup);
              return (
                <tr key={en.id} className="border-t border-slate-100">
                  <td className="p-2 sticky left-0 z-10 bg-white leading-snug">
                    {en.full_name}
                    {/* มือถือ: รหัสขึ้นบรรทัดใหม่ คอลัมน์ชื่อจะได้แคบ เหลือที่ให้ช่องคะแนน */}
                    <span className="block text-slate-400 text-xs font-num tnum sm:inline sm:ml-1">
                      {en.student_code}
                      {!en.signedIn && (
                        <span
                          role="img"
                          aria-label="ยังไม่เคยเข้าระบบ"
                          title="ยังไม่เคยเข้าระบบ — กรอกคะแนนได้ นักเรียนจะเห็นหลังเข้าระบบ"
                          className="ml-1.5 inline-block size-1.5 rounded-full border border-slate-400 align-middle"
                        />
                      )}
                    </span>
                    {placeLabel(en) && <span className="block text-slate-400 text-xs">{placeLabel(en)}</span>}
                  </td>
                  {columns.map((c, col) => (
                    <td key={c.sourceId} className="p-1" style={cellStyle(c)}>
                      <ScoreCell
                        row={row}
                        col={col}
                        enrollmentId={en.id}
                        column={c}
                        initial={lookup(c.sourceType, c.sourceId)}
                        onPending={(delta) => setPending((p) => p + delta)}
                        onResult={(key, error, saved) => {
                          setErrors((prev) => {
                            const next = { ...prev };
                            if (error) next[key] = `${en.full_name} ช่อง ${c.label}: ${error}`;
                            else delete next[key];
                            return next;
                          });
                          if (saved) onScoreSaved(saved);
                        }}
                      />
                    </td>
                  ))}
                  <td className="p-2 border-l border-slate-100 text-center font-medium whitespace-nowrap">
                    {fmt(summary.earned)} / {fmt(summary.maxAll)}
                  </td>
                  <td className="p-2 text-center font-medium whitespace-nowrap">
                    {summary.complete ? (
                      calcGrade(summary.percentFinal ?? 0, scales)
                    ) : (
                      <span className="text-xs font-normal text-slate-400" title="เกรดจะขึ้นเมื่อกรอกครบทุกช่อง">
                        ขาด {summary.missing}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * ช่องกรอกคะแนนหนึ่งช่อง
 *
 * - ใช้ type="text" แทน "number" เพราะช่อง number เปลี่ยนค่าเองเวลาหมุนลูกกลิ้งเมาส์
 *   ครูที่เลื่อนหน้าจอผ่านช่องที่เลือกอยู่จะทำคะแนนนักเรียนเปลี่ยนโดยไม่รู้ตัว
 * - บันทึกเฉพาะเมื่อค่าเปลี่ยนจริง และบอกผลทุกครั้ง: เขียว = บันทึกแล้ว, แดง = ไม่สำเร็จ
 * - บันทึกเสร็จแล้วอัปเดตเฉพาะแถวนี้ ไม่โหลดข้อมูลทั้งวิชาใหม่
 */
function ScoreCell({
  row,
  col,
  enrollmentId,
  column,
  initial,
  onPending,
  onResult,
}: {
  row: number;
  col: number;
  enrollmentId: string;
  column: Column;
  initial: number | null;
  onPending: (delta: number) => void;
  onResult: (key: string, error: string | null, saved?: ScoreRow) => void;
}) {
  const supabase = createClient();
  const lastSaved = useRef<number | null>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const key = `${enrollmentId}:${column.sourceId}`;

  function fail(message: string) {
    setStatus("error");
    setError(message);
    onResult(key, message);
  }

  async function commit(input: HTMLInputElement) {
    const text = input.value.trim();
    const next = text === "" ? null : Number(text);

    if (next !== null && !Number.isFinite(next)) return fail("ไม่ใช่ตัวเลข");
    if (next !== null && next < 0) return fail("คะแนนติดลบไม่ได้");
    if (next !== null && next > column.max) return fail(`เกินคะแนนเต็ม ${fmt(column.max)}`);

    if (next === lastSaved.current) {
      // ค่าเดิม — ถ้าเคยแดงเพราะพิมพ์ผิดแล้วแก้กลับ ก็ล้างสถานะแดงออก
      if (status === "error") {
        setStatus("idle");
        setError(null);
        onResult(key, null);
      }
      return;
    }

    setStatus("saving");
    onPending(1);
    const { data, error: saveError } = await supabase
      .from("student_scores")
      .upsert(
        { enrollment_id: enrollmentId, source_type: column.sourceType, source_id: column.sourceId, score: next },
        { onConflict: "enrollment_id,source_type,source_id" }
      )
      .select("enrollment_id, source_type, source_id, score")
      .single();
    onPending(-1);

    if (saveError || !data) return fail(dbErrorMessage(saveError) || "บันทึกไม่สำเร็จ");

    lastSaved.current = next;
    setStatus("saved");
    setError(null);
    onResult(key, null, { ...(data as ScoreRow), score: data.score === null ? null : Number(data.score) });
    setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
  }

  const style =
    status === "error"
      ? "border-red-500 bg-red-50"
      : status === "saved"
        ? "border-green-600"
        : status === "saving"
          ? "border-slate-300 text-slate-400"
          : "border-slate-200";

  return (
    <input
      type="text"
      inputMode="decimal"
      enterKeyHint="next"
      data-cell={`${row}-${col}`}
      defaultValue={initial ?? ""}
      aria-label={`คะแนน ${column.label} เต็ม ${fmt(column.max)}`}
      aria-invalid={status === "error"}
      title={error ?? undefined}
      onBlur={(e) => commit(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const target = document.querySelector<HTMLInputElement>(`[data-cell="${row + (e.shiftKey ? -1 : 1)}-${col}"]`);
        if (target) {
          target.focus(); // การย้ายโฟกัสทำให้ช่องนี้ blur และบันทึกเอง
          target.select();
        } else {
          e.currentTarget.blur();
        }
      }}
      // มือถือ: ช่องสูง 40px และตัวอักษร 16px (iPhone ไม่ซูมหน้าเองตอนแตะ)
      className={`h-10 w-14 border rounded px-1 text-base text-center sm:h-auto sm:py-0.5 sm:text-sm ${style}`}
    />
  );
}
