/**
 * เกมภารกิจ — ใบงานที่เล่นเป็นเกมและเก็บคะแนน
 * การเริ่ม ตอบ และจบเกม ทำผ่านฟังก์ชันในฐานข้อมูล (game_start / game_answer / game_finish)
 * ดูรายละเอียดความปลอดภัยใน migration ของเกมภารกิจ
 */

export type GameStage = { title: string; intro?: string };

export type Game = {
  id: string;
  course_id: string;
  unit_id: string | null;
  title: string;
  description: string | null;
  stages: GameStage[];
  seconds_per_item: number;
  created_at: string;
};

export type GameItem = {
  id: string;
  stage: number;
  kind: "choice" | "numeric";
  prompt: string;
  image: string | null;
  choices: string[] | null;
  unit: string | null;
  scientific: boolean;
  points: number;
};

/** ผลของข้อที่ตอบแล้ว — ได้จากเซิร์ฟเวอร์ รวมเฉลยและคำอธิบายของข้อนั้น */
export type GameFeedback = {
  item_id: string;
  given: number | null;
  ok: boolean;
  pts: number;
  correct_index: number | null;
  answer: number | null;
  explanation: string | null;
};

export type GamePayload = {
  play_id: string;
  title: string;
  description: string | null;
  stages: GameStage[];
  seconds_per_item: number;
  finished: boolean;
  score: number;
  max_score: number;
  xp: number;
  items: GameItem[];
  feedback: Record<string, GameFeedback>;
};

export type GamePlay = {
  id: string;
  game_id: string;
  enrollment_id: string;
  started_at: string;
  finished_at: string | null;
  answers: Record<string, { v: number; ok: boolean; pts: number; at: string }>;
  score: number;
  max_score: number;
  xp: number;
};

export type GameSession = { id: string; game_id: string; classroom: string; opened_at: string; closed_at: string | null };

export type MyGamePlay = {
  game_id: string;
  play_id: string;
  started_at: string;
  finished_at: string | null;
  score: number;
  max_score: number;
  xp: number;
  answered: number;
};

export function gameErrorMessage(message: string | undefined | null): string {
  const m = message ?? "";
  if (m.includes("not_open")) return "ครูยังไม่เปิดเกมนี้ให้ห้องของคุณ";
  if (m.includes("already_finished")) return "คุณเล่นเกมนี้จบแล้ว";
  if (m.includes("not_enrolled")) return "คุณยังไม่ได้ลงทะเบียนในวิชานี้ ถ้าคิดว่าผิดพลาด แจ้งครูผู้สอน";
  if (m.includes("no_items")) return "เกมนี้ยังไม่มีคำถาม";
  if (m.includes("game_not_found")) return "ไม่พบเกมนี้";
  if (m.includes("invalid_answer")) return "คำตอบไม่ถูกรูปแบบ ลองใหม่อีกครั้ง";
  if (m.includes("Failed to fetch") || m.includes("NetworkError")) return "เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง";
  return m || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
}

/** แสดงตัวเลขคำตอบแบบอ่านง่าย: 200000000 → "2 × 10^{8}" (ใช้กับ QuizText) */
export function formatNumber(value: number, scientific: boolean): string {
  if (!Number.isFinite(value)) return "–";
  if (!scientific || value === 0) return String(Number(value.toPrecision(6)));
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = Number((value / 10 ** exp).toPrecision(4));
  return exp === 0 ? String(mantissa) : `${mantissa} × 10^{${exp}}`;
}

/** อ่านตัวเลขที่นักเรียนพิมพ์ ยอมรับจุลภาคแทนจุดทศนิยม */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(",", ".").replace(/[−–]/g, "-");
  if (!/^-?\d*\.?\d+$/.test(t) && !/^-?\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const CHOICE_LETTERS = ["ก", "ข", "ค", "ง", "จ", "ฉ", "ช", "ซ"];
