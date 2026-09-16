"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { METRIC_LABEL, METRIC_UNIT, type AlertRule } from "@/lib/iot/types";

export default function ThresholdPanel({
  rules,
  isTeacher,
  onChanged,
}: {
  rules: AlertRule[];
  isTeacher: boolean;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [saving, setSaving] = useState<string | null>(null);

  async function save(rule: AlertRule, patch: Partial<AlertRule>) {
    setSaving(rule.id);
    await supabase.from("iot_alert_rules").update(patch).eq("id", rule.id);
    setSaving(null);
    onChanged();
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
      {rules.length === 0 && <p className="p-4 text-sm text-slate-400">ยังไม่ได้ตั้งเกณฑ์แจ้งเตือน</p>}
      {rules.map((rule) => (
        <form
          key={rule.id}
          className="p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const num = (k: string) => {
              const raw = String(form.get(k) ?? "").trim();
              return raw === "" ? null : Number(raw);
            };
            save(rule, {
              min_value: num("min"),
              max_value: num("max"),
              hysteresis: Number(form.get("hys") ?? rule.hysteresis),
              consecutive_required: Number(form.get("consec") ?? rule.consecutive_required),
              cooldown_minutes: Number(form.get("cooldown") ?? rule.cooldown_minutes),
            });
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-slate-800 text-sm">
              {METRIC_LABEL[rule.metric]}{" "}
              <span className="text-slate-400 font-normal">({METRIC_UNIT[rule.metric]})</span>
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                defaultChecked={rule.enabled}
                disabled={!isTeacher}
                onChange={(e) => save(rule, { enabled: e.target.checked })}
              />
              เปิดแจ้งเตือน
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Field name="min" label="ต่ำสุด" defaultValue={rule.min_value} disabled={!isTeacher} />
            <Field name="max" label="สูงสุด" defaultValue={rule.max_value} disabled={!isTeacher} />
            <Field
              name="hys"
              label="ค่าหน่วง"
              hint="ต้องกลับเข้ากรอบเกินเท่านี้จึงนับว่าปกติ"
              defaultValue={rule.hysteresis}
              disabled={!isTeacher}
            />
            <Field
              name="consec"
              label="ผิดติดกัน (ครั้ง)"
              hint="กันค่าสวิงชั่วขณะ"
              defaultValue={rule.consecutive_required}
              disabled={!isTeacher}
            />
            <Field
              name="cooldown"
              label="เตือนซ้ำทุก (นาที)"
              defaultValue={rule.cooldown_minutes}
              disabled={!isTeacher}
            />
          </div>

          {isTeacher && (
            <button
              disabled={saving === rule.id}
              className="bg-slate-800 text-white rounded-md px-4 py-1.5 text-sm disabled:opacity-50"
            >
              {saving === rule.id ? "กำลังบันทึก…" : "บันทึกเกณฑ์"}
            </button>
          )}
        </form>
      ))}
    </div>
  );
}

function Field({
  name,
  label,
  hint,
  defaultValue,
  disabled,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue: number | null;
  disabled: boolean;
}) {
  return (
    <label className="block" title={hint}>
      <span className="block text-xs text-slate-500 mb-1">{label}</span>
      <input
        name={name}
        type="number"
        step="0.1"
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-500"
      />
    </label>
  );
}
