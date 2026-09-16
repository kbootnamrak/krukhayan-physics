export type Metric = "temperature_c" | "humidity_pct";

export type AlertStatus = "ok" | "low" | "high";

export type AlertKind = AlertStatus | "recovered" | "offline" | "online";

export type IotDevice = {
  id: string;
  name: string;
  location: string | null;
  sample_interval_s: number;
  offline_after_s: number;
  is_active: boolean;
  last_seen_at: string | null;
};

export type Reading = {
  recorded_at: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  heat_index_c: number | null;
  rssi: number | null;
};

export type AlertRule = {
  id: string;
  device_id: string;
  metric: Metric;
  min_value: number | null;
  max_value: number | null;
  hysteresis: number;
  consecutive_required: number;
  cooldown_minutes: number;
  enabled: boolean;
};

export type AlertState = {
  status: AlertStatus;
  breach_count: number;
  last_notified_at: string | null;
};

export const METRIC_LABEL: Record<Metric, string> = {
  temperature_c: "อุณหภูมิ",
  humidity_pct: "ความชื้น",
};

export const METRIC_UNIT: Record<Metric, string> = {
  temperature_c: "°C",
  humidity_pct: "%RH",
};

/**
 * ขอบเขตที่ DHT11 วัดได้จริงตาม datasheet — ค่านอกช่วงนี้แปลว่าเซนเซอร์
 * อ่านพลาดหรือสายหลวม ไม่ใช่สภาพแวดล้อมที่เปลี่ยนจริง จึงไม่ควรบันทึก
 */
export const SENSOR_RANGE: Record<Metric, { min: number; max: number }> = {
  temperature_c: { min: -10, max: 60 },
  humidity_pct: { min: 0, max: 100 },
};
