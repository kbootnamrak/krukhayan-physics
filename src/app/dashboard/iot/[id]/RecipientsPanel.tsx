"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Recipient = {
  id: string;
  device_id: string | null;
  target_type: string;
  target_id: string;
  label: string | null;
  enabled: boolean;
};

export default function RecipientsPanel({
  deviceId,
  recipients,
  onChanged,
}: {
  deviceId: string;
  recipients: Recipient[];
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [targetId, setTargetId] = useState("");
  const [label, setLabel] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!targetId.trim()) return;
    await supabase.from("iot_line_recipients").insert({
      device_id: deviceId,
      target_type: targetId.startsWith("C") ? "group" : "user",
      target_id: targetId.trim(),
      label: label.trim() || null,
    });
    setTargetId("");
    setLabel("");
    onChanged();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        วิธีที่ง่ายที่สุดคือให้ผู้รับแจ้งเตือน <strong>แอดบอทเป็นเพื่อนแล้วทักไปหนึ่งข้อความ</strong> —
        ระบบจะบันทึกให้อัตโนมัติผ่าน webhook และจะได้รับแจ้งเตือนของทุกอุปกรณ์
        ส่วนช่องด้านล่างใช้กรณีต้องการผูกผู้รับกับอุปกรณ์เครื่องนี้เท่านั้น
      </p>

      <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {recipients.length === 0 && (
          <li className="p-4 text-sm text-slate-400">ยังไม่มีผู้รับแจ้งเตือน</li>
        )}
        {recipients.map((r) => (
          <li key={r.id} className="p-3 flex items-center justify-between gap-3 text-sm">
            <div>
              <p className="text-slate-700">{r.label ?? r.target_id}</p>
              <p className="text-xs text-slate-400 break-all">
                {r.device_id === null ? "ทุกอุปกรณ์" : "เฉพาะเครื่องนี้"} · {r.target_id}
              </p>
            </div>
            <div className="flex items-center gap-3 whitespace-nowrap">
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={async (e) => {
                    await supabase
                      .from("iot_line_recipients")
                      .update({ enabled: e.target.checked })
                      .eq("id", r.id);
                    onChanged();
                  }}
                />
                เปิด
              </label>
              <button
                onClick={async () => {
                  await supabase.from("iot_line_recipients").delete().eq("id", r.id);
                  onChanged();
                }}
                className="text-xs text-red-600 hover:underline"
              >
                ลบ
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-2 flex-wrap">
        <input
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder="LINE userId (U...) หรือ groupId (C...)"
          className="flex-1 min-w-[240px] border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ชื่อเรียก เช่น ครูเวรประจำวัน"
          className="flex-1 min-w-[180px] border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
        <button className="bg-slate-800 text-white rounded-md px-4 text-sm">เพิ่ม</button>
      </form>
    </div>
  );
}
