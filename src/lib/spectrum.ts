/**
 * ฟิสิกส์ของกิจกรรม 19.1 การศึกษาสเปกตรัมของแก๊สร้อน (สสวท. ฟิสิกส์ เล่ม 6)
 *
 * แสงจากหลอดผ่านเกรตติง เส้นสเปกตรัมอันดับ 1 เบนไปเป็นมุม θ โดย d·sinθ = λ
 * ผู้สังเกตมองผ่านเกรตติงเห็นเส้นสีปรากฏบนไม้เมตรห่างจากหลอด x = D·tanθ ทั้งสองข้าง
 * นักเรียนวัด x แล้วคำนวณกลับ λ = d·x/√(D² + x²)
 */

/** เกรตติงตามใบกิจกรรม: 5,300 เส้น/ซม. */
export const GRATING_LINES_PER_CM = 5300;
export const GRATING_D = 0.01 / GRATING_LINES_PER_CM; // ระยะระหว่างช่อง (เมตร)

export type SourceId = "lamp" | "hydrogen" | "neon";

export const SOURCES: { id: SourceId; name: string; short: string; glow: string }[] = [
  { id: "lamp", name: "หลอดไฟฟ้าธรรมดา (ไส้ทังสเตน)", short: "หลอดไส้", glow: "#ffd9a0" },
  { id: "hydrogen", name: "หลอดบรรจุแก๊สไฮโดรเจน", short: "ไฮโดรเจน", glow: "#ff5fb0" },
  { id: "neon", name: "หลอดบรรจุแก๊สนีออน", short: "นีออน", glow: "#ff6a2a" },
];

export type SpectralLine = { nm: number; label: string; strength: number };

/** เส้นสเปกตรัมไฮโดรเจนในช่วงที่ตามองเห็น (อนุกรมบัลเมอร์) — ค่าทฤษฎีตามใบกิจกรรม */
export const HYDROGEN_LINES: SpectralLine[] = [
  { nm: 410.2, label: "ม่วง", strength: 0.55 },
  { nm: 434.1, label: "น้ำเงิน", strength: 0.75 },
  { nm: 486.1, label: "น้ำเงินแกมเขียว", strength: 0.9 },
  { nm: 656.3, label: "แดง", strength: 1 },
];

/** เส้นเด่นของนีออนในช่วงที่ตามองเห็น — แน่นในช่วงเหลือง ส้ม แดง */
export const NEON_LINES: SpectralLine[] = [
  540.1, 585.2, 588.2, 594.5, 603.0, 607.4, 609.6, 614.3, 616.4, 621.7, 626.6, 633.4, 638.3, 640.2, 650.6, 659.9, 667.8, 671.7, 692.9, 703.2,
].map((nm) => ({ nm, label: "", strength: nm === 540.1 ? 0.45 : nm === 585.2 || nm === 640.2 || nm === 703.2 ? 1 : 0.7 }));

export const VISIBLE_MIN = 400;
export const VISIBLE_MAX = 700;

/** ระยะจากหลอดถึงเส้นสเปกตรัมบนไม้เมตร (เมตร) — null ถ้าเบนเกิน 90° */
export function lineOffset(nm: number, distance: number, d = GRATING_D): number | null {
  const s = (nm * 1e-9) / d;
  if (s >= 1) return null;
  return (distance * s) / Math.sqrt(1 - s * s);
}

/** ความยาวคลื่น (nm) จากตำแหน่งที่วัดได้ */
export function wavelengthFrom(x: number, distance: number, d = GRATING_D): number {
  return ((d * x) / Math.sqrt(distance * distance + x * x)) * 1e9;
}

/** สีโดยประมาณของแสงความยาวคลื่นหนึ่ง (0–1) สำหรับแสดงผลบนจอ */
export function wavelengthToRgb(nm: number): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / 60;
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = -(nm - 510) / 20;
  } else if (nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = -(nm - 645) / 65;
  } else if (nm <= 780) {
    r = 1;
  }
  // ตาไวน้อยลงที่ปลายสองข้างของช่วงที่มองเห็น
  const edge = nm < 420 ? 0.35 + (0.65 * (nm - 380)) / 40 : nm > 700 ? 0.35 + (0.65 * (780 - nm)) / 80 : 1;
  const f = (v: number) => Math.pow(Math.max(0, v * edge), 0.8);
  return [f(r), f(g), f(b)];
}

/** ตารางบันทึกผลของไฮโดรเจน (ตอนที่ 2 ของใบกิจกรรม) */
export type Reading = { x1: number | null; x2: number | null; answer: string };
export const emptyReadings = (): Reading[] => HYDROGEN_LINES.map(() => ({ x1: null, x2: null, answer: "" }));

export function percentError(measuredNm: number, theoryNm: number): number {
  return (Math.abs(measuredNm - theoryNm) / theoryNm) * 100;
}
