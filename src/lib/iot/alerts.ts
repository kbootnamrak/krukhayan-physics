import type { AlertRule, AlertState, AlertStatus, Metric } from "./types";
import { METRIC_LABEL, METRIC_UNIT } from "./types";

export type AlertEvent = {
  kind: AlertStatus | "recovered";
  metric: Metric;
  value: number;
  threshold: number | null;
  /** true = เตือนซ้ำเรื่องเดิมหลังพ้น cooldown ไม่ใช่การเข้าสู่สภาวะผิดปกติครั้งใหม่ */
  isReminder: boolean;
};

export type Evaluation = { state: AlertState; event: AlertEvent | null };

/**
 * จัดสถานะของค่าที่อ่านได้ โดยคิด hysteresis ด้วย
 *
 * hysteresis ทำให้ "การกลับสู่ปกติ" ยากกว่า "การเข้าสู่ภาวะผิดปกติ" เล็กน้อย
 * เช่นเกณฑ์สูงสุด 30 °C, hysteresis 0.5 → เตือนเมื่อเกิน 30.0 แต่จะถือว่า
 * กลับสู่ปกติก็ต่อเมื่อลดลงถึง 29.5 ค่าที่แกว่งอยู่รอบ ๆ 30 พอดีจึงไม่ยิง
 * แจ้งเตือนสลับไปมา
 */
function classify(value: number, rule: AlertRule, current: AlertStatus): AlertStatus {
  const { min_value: lo, max_value: hi, hysteresis: h } = rule;

  if (current === "high" && hi !== null && value > hi - h) return "high";
  if (current === "low" && lo !== null && value < lo + h) return "low";

  if (hi !== null && value > hi) return "high";
  if (lo !== null && value < lo) return "low";
  return "ok";
}

function thresholdFor(rule: AlertRule, status: AlertStatus) {
  if (status === "high") return rule.max_value;
  if (status === "low") return rule.min_value;
  return null;
}

/**
 * ตัดสินจากค่าที่เพิ่งอ่านได้ว่าต้องแจ้งเตือนหรือไม่ และสถานะถัดไปเป็นอย่างไร
 *
 * ฟังก์ชันนี้ไม่แตะฐานข้อมูลและไม่ส่ง LINE — รับสถานะเข้า คืนสถานะออก
 * เพื่อให้ทดสอบตรรกะการเตือนได้โดยไม่ต้องมีอุปกรณ์จริง
 */
export function evaluateRule(
  rule: AlertRule,
  state: AlertState,
  value: number,
  now: Date
): Evaluation {
  const current = state.status;
  const candidate = classify(value, rule, current);
  const nowIso = now.toISOString();

  // --- ยังอยู่ในสถานะเดิม ---
  if (candidate === current) {
    if (current === "ok") {
      return {
        state: { status: "ok", breach_count: 0, last_notified_at: state.last_notified_at },
        event: null,
      };
    }

    // ผิดเกณฑ์ต่อเนื่อง → เตือนซ้ำเมื่อพ้น cooldown เพื่อไม่ให้ลืมว่ายังมีปัญหาค้างอยู่
    const last = state.last_notified_at ? new Date(state.last_notified_at).getTime() : 0;
    const dueAt = last + rule.cooldown_minutes * 60_000;
    if (rule.cooldown_minutes > 0 && now.getTime() >= dueAt) {
      return {
        state: { status: current, breach_count: 0, last_notified_at: nowIso },
        event: {
          kind: current,
          metric: rule.metric,
          value,
          threshold: thresholdFor(rule, current),
          isReminder: true,
        },
      };
    }
    return {
      state: { status: current, breach_count: 0, last_notified_at: state.last_notified_at },
      event: null,
    };
  }

  // --- กลับสู่ปกติ ---
  if (candidate === "ok") {
    const hadNotified = state.last_notified_at !== null;
    return {
      state: { status: "ok", breach_count: 0, last_notified_at: null },
      event: hadNotified
        ? {
            kind: "recovered",
            metric: rule.metric,
            value,
            threshold: thresholdFor(rule, current),
            isReminder: false,
          }
        : null,
    };
  }

  // --- กำลังเข้าสู่ภาวะผิดปกติ: ต้องผิดติดกันครบตามที่ตั้งไว้ก่อนจึงเตือน ---
  const count = state.breach_count + 1;
  if (count < rule.consecutive_required) {
    return {
      state: { status: current, breach_count: count, last_notified_at: state.last_notified_at },
      event: null,
    };
  }

  return {
    state: { status: candidate, breach_count: 0, last_notified_at: nowIso },
    event: {
      kind: candidate,
      metric: rule.metric,
      value,
      threshold: thresholdFor(rule, candidate),
      isReminder: false,
    },
  };
}

export function describeEvent(event: AlertEvent) {
  const label = METRIC_LABEL[event.metric];
  const unit = METRIC_UNIT[event.metric];
  const value = `${event.value.toFixed(1)} ${unit}`;
  const limit = event.threshold === null ? "" : ` (เกณฑ์ ${event.threshold.toFixed(1)} ${unit})`;

  if (event.kind === "recovered") return `${label}กลับสู่ปกติแล้ว: ${value}`;
  if (event.kind === "high") return `${label}สูงเกินกำหนด: ${value}${limit}`;
  return `${label}ต่ำกว่ากำหนด: ${value}${limit}`;
}
