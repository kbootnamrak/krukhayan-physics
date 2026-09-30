import type { Metadata } from "next";
import Breadcrumbs from "../../Breadcrumbs";

/**
 * แนวข้อสอบปลายภาค ฟิสิกส์ 5 (ว33205) — เปิดได้หลังล็อกอิน (ลิงก์จากหน้าหลัก)
 * สรุปจากข้อสอบปีก่อน: บอกหัวข้อ สูตร และจุดที่ต้องระวัง — ไม่มีโจทย์จริงและไม่มีเฉลย
 */
export const metadata: Metadata = {
  title: "แนวข้อสอบปลายภาค ฟิสิกส์ 5 · KruKhayan Physics",
  description: "หัวข้อ สูตร และจุดที่ต้องทบทวน ก่อนสอบปลายภาค ฟิสิกส์ 5 (ว33205) ม.6",
};

type Topic = {
  title: string;
  count: string;
  color: string;
  points: string[];
  formulas: string[];
  warn?: string;
};

const TOPICS: Topic[] = [
  {
    title: "แก๊สอุดมคติและกฎของแก๊ส",
    count: "~6 ข้อ",
    color: "var(--trace-cyan)",
    points: [
      "แบบจำลองแก๊ส: ทำไมแก๊สถูกบีบอัดให้ปริมาตรลดลงได้มาก",
      "สมบัติของแก๊สอุดมคติ โดยเฉพาะลักษณะการชนของโมเลกุล",
      "ความดันแก๊สเกิดจากอะไร ทำไมปริมาตรลดแล้วความดันเพิ่ม",
      "กฎของบอยล์ (อุณหภูมิคงที่): ฝึกทั้งแบบคิดเป็น “กี่เท่า” และแบบแทนตัวเลข",
    ],
    formulas: ["PV = nRT", "P₁V₁ = P₂V₂"],
  },
  {
    title: "ทฤษฎีจลน์ของแก๊ส",
    count: "~4 ข้อ",
    color: "var(--trace-magenta)",
    points: [
      "อุณหภูมิสัมพันธ์กับอัตราเร็วและพลังงานจลน์ของโมเลกุลอย่างไร",
      "แก๊สต่างชนิดกันที่อุณหภูมิเท่ากัน พลังงานจลน์เฉลี่ยเป็นอย่างไร เพราะอะไร",
    ],
    formulas: ["Eₖ = (3/2) k_B T", "v_rms ∝ √T"],
    warn: "ต้องแปลง °C เป็น K ก่อนเสมอ (T = °C + 273)",
  },
  {
    title: "พลังงานภายใน งาน และกฎข้อที่ 1 ของอุณหพลศาสตร์",
    count: "~5 ข้อ",
    color: "var(--trace-yellow)",
    points: [
      "คำนวณพลังงานภายในที่เปลี่ยนไปของแก๊สอะตอมเดี่ยว",
      "งานที่แก๊สทำเมื่อขยายตัวที่ความดันคงที่",
      "แยกให้ออกว่า “ระบบทำงาน” กับ “ทำงานให้ระบบ” ต่างกันอย่างไร และพลังงานภายในเพิ่มหรือลด",
      "เครื่องยนต์เบนซิน 4 จังหวะ: ชื่อจังหวะและลำดับ",
    ],
    formulas: ["ΔU = (3/2) nRΔT", "W = PΔV", "Q = ΔU + W"],
    warn: "ระวังเครื่องหมายบวก/ลบของ Q, W และ ΔU",
  },
  {
    title: "สภาพยืดหยุ่น",
    count: "~4 ข้อ",
    color: "var(--trace-lime)",
    points: [
      "ความหมายของสภาพยืดหยุ่น สภาพพลาสติก ความเค้น ความเครียด และมอดุลัสของยัง",
      "คำนวณความเค้นในเส้นลวด",
    ],
    formulas: ["σ = F / A", "ε = ΔL / L₀", "Y = σ / ε"],
    warn: "แปลงพื้นที่ cm² เป็น m² ก่อน (1 cm² = 10⁻⁴ m²)",
  },
  {
    title: "ความตึงผิวและความหนืด",
    count: "~4 ข้อ",
    color: "var(--trace-cyan)",
    points: [
      "แรงตึงผิวมีทิศทางอย่างไรเมื่อเทียบกับผิวของเหลว",
      "ความยาวผิวสัมผัสของห่วงวงกลมกับแผ่นวงกลม (ห่วงมีกี่ผิวที่สัมผัสของเหลว?)",
      "ปรากฏการณ์ในชีวิตจริง เช่น แมลงเดินบนน้ำ หรือวัตถุตกในของเหลวต่างชนิดกัน เกิดจากแรงอะไร",
    ],
    formulas: ["γ = F / L"],
  },
  {
    title: "ความดันในของเหลว",
    count: "~3 ข้อ",
    color: "var(--trace-magenta)",
    points: [
      "ความดันขึ้นกับความลึก ไม่ขึ้นกับรูปทรงภาชนะ",
      "ภาชนะรูปทรงต่างกันแต่ระดับน้ำเท่ากัน: เปรียบเทียบน้ำหนักน้ำกับแรงดันที่ก้นภาชนะ",
      "ฝึกอ่านความสูง h จากรูป แล้วหาความดันและแรงดันที่ก้นภาชนะ",
    ],
    formulas: ["P = ρgh", "F = PA"],
  },
  {
    title: "ของไหลเคลื่อนที่",
    count: "~4 ข้อ",
    color: "var(--trace-yellow)",
    points: [
      "สมการความต่อเนื่อง ถ้าโจทย์ให้รัศมี ใช้ A = πr²",
      "อัตราเร็วน้ำที่ไหลออกจากรูเล็ก ๆ ใต้ถัง",
      "แรงยกปีกเครื่องบินอธิบายด้วยหลักแบร์นูลลี",
      "สมการแบร์นูลลีในท่อแนวระดับที่คอดลง",
    ],
    formulas: ["A₁v₁ = A₂v₂", "v = √(2gh)", "P₁ + ½ρv₁² = P₂ + ½ρv₂²"],
  },
];

const WRITTEN = [
  {
    title: "แรงพยุง (หลักอาร์คิมีดีส)",
    note: "วัตถุลอยน้ำ หาปริมาตรส่วนที่จม",
    formulas: ["F_B = ρ_ของเหลว · V_จม · g", "ลอยนิ่ง: F_B = mg"],
  },
  {
    title: "เครื่องอัดไฮดรอลิก (หลักปาสคาล)",
    note: "หาแรงที่ต้องกดลูกสูบเล็ก",
    formulas: ["F₁ / A₁ = F₂ / A₂"],
  },
];

const STEPS = ["ข้อมูลที่ได้จากโจทย์", "โจทย์ต้องการหา", "สูตร", "แทนค่า", "คำตอบ + หน่วย"];

const TIPS = [
  "ท่องสูตรให้ขึ้นใจ และรู้ว่าแต่ละตัวแปรใช้หน่วยอะไร",
  "จุดที่พลาดกันบ่อย: ลืมแปลง °C → K, ลืมแปลง cm² → m², เครื่องหมายของ Q / W / ΔU",
  "ข้อแนวคิด (ไม่ต้องคำนวณ) มีเกือบครึ่ง ต้องเข้าใจว่า “ทำไม” ไม่ใช่จำแค่สูตร",
  "เตรียมเครื่องเขียนและปากกาให้พร้อม",
];

function Formula({ children }: { children: string }) {
  return (
    <code className="inline-block rounded-sm border border-slate-300 bg-slate-50 px-2.5 py-1 font-num text-[17px] font-semibold text-slate-900 tnum">
      {children}
    </code>
  );
}

export default function Physics5FinalGuide() {
  return (
    <div className="px-4 sm:px-6 py-8 sm:py-10">
        <div className="max-w-4xl mx-auto space-y-8">
          <Breadcrumbs items={[{ label: "หน้าหลัก", href: "/dashboard" }, { label: "แนวข้อสอบปลายภาค ฟิสิกส์ 5" }]} />

          {/* หัวเรื่อง */}
          <section className="rounded-sm border-2 border-porcelain bg-white p-6 sm:p-8 space-y-4">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-trace-cyan">
              แนวข้อสอบ · ไม่ใช่เฉลย
            </p>
            <h1 className="font-display text-[clamp(1.9rem,6vw,2.75rem)] font-bold leading-tight text-slate-900">
              ปลายภาค ฟิสิกส์ 5
              <span className="block text-slate-600 text-[0.55em] font-semibold mt-1">ว33205 · มัธยมศึกษาปีที่ 6</span>
            </h1>
            <p className="text-slate-700 max-w-2xl">
              สรุปหัวข้อที่ออกสอบ สูตรที่ต้องใช้ และจุดที่ต้องระวัง เอาไว้ทบทวนก่อนสอบ
            </p>
            <dl className="grid grid-cols-3 gap-3 pt-2">
              {[
                ["เวลา", "1", "ชั่วโมง"],
                ["ปรนัย", "30", "ข้อ · 30 คะแนน"],
                ["อัตนัย", "2", "ข้อ · 10 คะแนน"],
              ].map(([label, n, unit]) => (
                <div key={label} className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-3">
                  <dt className="text-sm text-slate-500">{label}</dt>
                  <dd>
                    <span className="font-num text-3xl font-semibold text-slate-900 tnum">{n}</span>{" "}
                    <span className="text-sm text-slate-600">{unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-slate-500">คะแนนเต็ม 40 คะแนน</p>
          </section>

          {/* ตอนที่ 1 */}
          <section className="space-y-4">
            <h2 className="font-display text-2xl font-bold text-slate-900">
              ตอนที่ 1 <span className="text-slate-500 font-semibold">· ปรนัย 4 ตัวเลือก</span>
            </h2>
            <ol className="space-y-4">
              {TOPICS.map((t, i) => (
                <li
                  key={t.title}
                  className="relative rounded-sm border-2 border-slate-200 bg-white p-5 sm:p-6 pl-6 sm:pl-7 space-y-3"
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: t.color }} />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-display text-lg sm:text-xl font-semibold text-slate-900">
                      <span className="font-num text-slate-500 mr-2 tnum">{i + 1}.</span>
                      {t.title}
                    </h3>
                    <span className="text-sm text-slate-500 whitespace-nowrap">{t.count}</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-slate-700 marker:text-slate-400">
                    {t.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    {t.formulas.map((f) => (
                      <Formula key={f}>{f}</Formula>
                    ))}
                  </div>
                  {t.warn && (
                    <p className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      ⚠️ {t.warn}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>

          {/* ตอนที่ 2 */}
          <section className="space-y-4">
            <h2 className="font-display text-2xl font-bold text-slate-900">
              ตอนที่ 2 <span className="text-slate-500 font-semibold">· อัตนัย แสดงวิธีทำ</span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {WRITTEN.map((w) => (
                <div key={w.title} className="rounded-sm border-2 border-slate-200 bg-white p-5 space-y-3">
                  <h3 className="font-display text-lg font-semibold text-slate-900">{w.title}</h3>
                  <p className="text-slate-600">{w.note}</p>
                  <div className="flex flex-wrap gap-2">
                    {w.formulas.map((f) => (
                      <Formula key={f}>{f}</Formula>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-sm border-2 border-slate-200 bg-white p-5 space-y-3">
              <h3 className="font-display font-semibold text-slate-900">เขียนให้ครบทุกขั้น</h3>
              <ol className="flex flex-wrap items-center gap-2">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex items-center gap-2">
                    <span className="rounded-sm border border-slate-300 bg-slate-50 px-2.5 py-1 text-sm text-slate-800">
                      <span className="font-num font-semibold text-trace-cyan mr-1.5 tnum">{i + 1}</span>
                      {s}
                    </span>
                    {i < STEPS.length - 1 && <span aria-hidden className="text-slate-400">→</span>}
                  </li>
                ))}
              </ol>
              <p className="text-sm text-slate-600">
                เขียนด้วย<strong className="text-slate-800">ปากกาเท่านั้น</strong> ตัวบรรจง ตัวเลขชัดเจน
              </p>
            </div>
          </section>

          {/* เคล็ดลับ */}
          <section className="rounded-sm border-2 border-porcelain bg-white p-5 sm:p-6 space-y-3">
            <h2 className="font-display text-xl font-bold text-slate-900">เคล็ดลับเตรียมสอบ</h2>
            <ul className="space-y-2 text-slate-700">
              {TIPS.map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-trace-lime" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-center text-sm text-slate-500 pb-4">ครูขยัน · ตั้งใจทบทวน สู้ ๆ นะ 💪</p>
        </div>
    </div>
  );
}
