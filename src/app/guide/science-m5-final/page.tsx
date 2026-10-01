import type { Metadata } from "next";
import ThemeToggle from "@/app/dashboard/ThemeToggle";
import { ChipMark } from "@/components/PhysicsArt";

/**
 * แนวข้อสอบปลายภาค วิทยาศาสตร์กายภาพ (ฟิสิกส์) 1 (ว30122) ม.5
 * หน้าสาธารณะ ไม่ต้องล็อกอิน — ครูแชร์ลิงก์ให้นักเรียนได้เลย (proxy กันเฉพาะ /dashboard)
 * สรุปจากข้อสอบปีก่อน: บอกหัวข้อและประเด็นที่ต้องทบทวน — ไม่มีโจทย์จริงและไม่มีเฉลย
 */
export const metadata: Metadata = {
  title: "แนวข้อสอบปลายภาค วิทย์กายภาพ ม.5 · KruKhayan Physics",
  description: "หัวข้อและประเด็นที่ต้องทบทวน ก่อนสอบปลายภาค วิทยาศาสตร์กายภาพ (ฟิสิกส์) 1 (ว30122) ม.5",
};

type Topic = {
  title: string;
  count: string;
  color: string;
  points: string[];
  keywords: string[];
  warn?: string;
};

type Unit = { name: string; title: string; count: string; topics: Topic[] };

const UNITS: Unit[] = [
  {
    name: "หน่วยที่ 2",
    title: "แรงในธรรมชาติ",
    count: "15 ข้อ",
    topics: [
      {
        title: "แรงโน้มถ่วง",
        count: "~5 ข้อ",
        color: "var(--trace-cyan)",
        points: [
          "นักวิทยาศาสตร์ที่ค้นพบและอธิบายแรงโน้มถ่วง",
          "ปรากฏการณ์ที่เกิดจากแรงโน้มถ่วง ทั้งบนพื้นโลกและในอวกาศ",
          "ความเร็วหลุดพ้นของโลก: ความหมาย ค่า และหน่วย",
          "การนำความรู้เรื่องแรงโน้มถ่วงไปใช้ประโยชน์",
        ],
        keywords: ["แรงโน้มถ่วง", "การโคจร", "ความเร็วหลุดพ้น", "ดาวเทียม"],
        warn: "จำค่าความเร็วหลุดพ้นพร้อมหน่วย ดูหน่วยของตัวเลือกให้ดี",
      },
      {
        title: "แม่เหล็กและสนามแม่เหล็ก",
        count: "~5 ข้อ",
        color: "var(--trace-magenta)",
        points: [
          "ขั้วแม่เหล็กมีกี่ขั้ว เรียกว่าอะไร (อย่าสับสนกับขั้วไฟฟ้า)",
          "อ่านรูปเส้นสนามแม่เหล็กของแท่งแม่เหล็กสองแท่ง แล้วบอกขั้วแต่ละตำแหน่ง",
          "บริเวณใดของแท่งแม่เหล็กที่สนามเข้มที่สุด",
          "หลักฐานที่แสดงว่าโลกมีสนามแม่เหล็ก",
          "หลักการทำงานของมอเตอร์ และต่างจากเครื่องกำเนิดไฟฟ้าอย่างไร",
        ],
        keywords: ["ขั้วเหนือ–ขั้วใต้", "เส้นสนามแม่เหล็ก", "สนามแม่เหล็กโลก", "มอเตอร์"],
        warn: "ทบทวนทิศของเส้นสนามแม่เหล็ก: ออกจากขั้วไหน เข้าขั้วไหน",
      },
      {
        title: "แรงไฟฟ้า แรงนิวเคลียร์ และแรงพื้นฐาน",
        count: "~5 ข้อ",
        color: "var(--trace-yellow)",
        points: [
          "อนุภาคใดบ้างที่มีแรงไฟฟ้ากระทำเมื่ออยู่ในสนามไฟฟ้า (ดูว่าอนุภาคมีประจุหรือไม่)",
          "แรงเข้ม: ยึดเหนี่ยวอะไรเข้าด้วยกัน",
          "แรงอ่อน: เกี่ยวข้องกับการสลายแบบใด",
          "เลขมวล เลขอะตอม และชื่อเรียกอื่นของแต่ละตัว",
          "แรงพื้นฐานในธรรมชาติมีกี่ชนิด อะไรบ้าง และแรงใดไม่ใช่แรงพื้นฐาน",
        ],
        keywords: ["โปรตอน", "นิวตรอน", "อิเล็กตรอน", "ควาร์ก", "นิวคลีออน", "แรงเข้ม", "แรงอ่อน"],
      },
    ],
  },
  {
    name: "หน่วยที่ 3",
    title: "พลังงาน",
    count: "15 ข้อ",
    topics: [
      {
        title: "พลังงานหลักและพลังงานทดแทน",
        count: "~2 ข้อ",
        color: "var(--trace-lime)",
        points: [
          "แหล่งพลังงานหลักที่ใช้ในปัจจุบัน",
          "เหตุผลที่ต้องหาพลังงานทดแทนมาใช้แทนพลังงานหลัก",
        ],
        keywords: ["เชื้อเพลิงซากดึกดำบรรพ์", "พลังงานทดแทน", "พลังงานสะอาด"],
      },
      {
        title: "เซลล์สุริยะ",
        count: "~4 ข้อ",
        color: "var(--trace-cyan)",
        points: [
          "เซลล์สุริยะคืออะไร เปลี่ยนพลังงานรูปใดเป็นรูปใด",
          "ปัจจัยที่มีผลต่อปริมาณพลังงานไฟฟ้าที่ผลิตได้",
          "หน้าที่ของอุปกรณ์ในระบบ เช่น อินเวอร์เตอร์ แบตเตอรี่ เครื่องควบคุมการประจุ",
          "ความหมายของประสิทธิภาพของเซลล์สุริยะ",
        ],
        keywords: ["Solar cell", "อินเวอร์เตอร์", "กระแสตรง–กระแสสลับ", "ประสิทธิภาพ"],
      },
      {
        title: "พลังงานนิวเคลียร์",
        count: "~6 ข้อ",
        color: "var(--trace-magenta)",
        points: [
          "ประเภทของปฏิกิริยานิวเคลียร์ที่ให้พลังงาน",
          "ฟิชชันกับฟิวชันต่างกันอย่างไร นิวเคลียสเปลี่ยนไปแบบไหน ดูดหรือคายพลังงาน",
          "ปฏิกิริยาลูกโซ่คืออะไร",
          "หน้าที่ของเครื่องปฏิกรณ์นิวเคลียร์ และส่วนอื่นของโรงไฟฟ้านิวเคลียร์",
          "ปฏิกิริยานิวเคลียร์ที่เกิดบนดวงอาทิตย์",
          "ธาตุกัมมันตรังสีคืออะไร",
        ],
        keywords: ["ฟิชชัน", "ฟิวชัน", "ปฏิกิริยาลูกโซ่", "เครื่องปฏิกรณ์", "กัมมันตรังสี"],
        warn: "ฟิชชัน–ฟิวชันชื่อคล้ายกัน อ่านตัวเลือกให้จบก่อนตอบ",
      },
      {
        title: "เทคโนโลยีด้านพลังงาน",
        count: "~3 ข้อ",
        color: "var(--trace-yellow)",
        points: [
          "เทคโนโลยีที่เปลี่ยนพลังงานเคมีเป็นพลังงานไฟฟ้า",
          "แยกให้ออกว่าเทคโนโลยีใดใช้ในภาคอุตสาหกรรม อาคาร/ที่พักอาศัย หรือการขนส่ง",
        ],
        keywords: ["เซลล์เชื้อเพลิง", "แบตเตอรี่", "ประหยัดพลังงาน"],
      },
    ],
  },
];

const RULES = [
  "ข้อสอบปรนัยทั้งหมด ระบายคำตอบ ก ข ค ง ในกระดาษคำตอบ",
  "ห้ามทำเครื่องหมายใด ๆ ลงในข้อสอบ",
  "ไม่อนุญาตให้ใช้เครื่องคิดเลขหรือเครื่องมือสื่อสาร",
];

const TIPS = [
  "ข้อสอบเน้นความเข้าใจและความจำ ไม่มีการคำนวณ ทบทวนความหมายของคำศัพท์ให้แม่น",
  "ระวังคำถามแบบ “ข้อใดไม่ใช่…” มีหลายข้อ อ่านโจทย์ให้ครบก่อนตอบ",
  "คำที่คล้ายกันต้องแยกให้ออก: ฟิชชัน–ฟิวชัน, แรงเข้ม–แรงอ่อน, เลขมวล–เลขอะตอม, ขั้วแม่เหล็ก–ขั้วไฟฟ้า",
  "ฝึกดูรูปเส้นสนามแม่เหล็กจากหนังสือเรียน",
];

export default function ScienceM5FinalGuide() {
  return (
    <div className="flex-1">
      <header className="relative bg-slate-50 border-b border-slate-200">
        <span aria-hidden className="neon-soft route-glow absolute inset-x-0 -bottom-px h-px bg-trace-cyan text-trace-cyan opacity-60" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 whitespace-nowrap">
            <ChipMark />
            <span className="font-display font-semibold uppercase tracking-[0.06em] text-[15px] text-slate-800">
              KruKhayan Physics
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="px-4 sm:px-6 py-8 sm:py-10">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* หัวเรื่อง */}
          <section className="rounded-sm border-2 border-porcelain bg-white p-6 sm:p-8 space-y-4">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-trace-cyan">
              แนวข้อสอบ · ไม่ใช่เฉลย
            </p>
            <h1 className="font-display text-[clamp(1.9rem,6vw,2.75rem)] font-bold leading-tight text-slate-900">
              ปลายภาค วิทยาศาสตร์กายภาพ (ฟิสิกส์) 1
              <span className="block text-slate-600 text-[0.55em] font-semibold mt-1">ว30122 · มัธยมศึกษาปีที่ 5</span>
            </h1>
            <p className="text-slate-700 max-w-2xl">สรุปหัวข้อที่ออกสอบและประเด็นที่ต้องทบทวน เอาไว้เตรียมตัวก่อนสอบ</p>
            <dl className="grid grid-cols-3 gap-3 pt-2">
              {[
                ["ปรนัย", "30", "ข้อ"],
                ["คะแนนเต็ม", "20", "คะแนน"],
                ["หน่วยที่ออก", "2", "หน่วย"],
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
            <ul className="space-y-1 text-sm text-slate-600">
              {RULES.map((r) => (
                <li key={r} className="flex gap-2">
                  <span aria-hidden className="text-slate-400">–</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>

          {UNITS.map((u) => (
            <section key={u.name} className="space-y-4">
              <h2 className="font-display text-2xl font-bold text-slate-900">
                {u.name}{" "}
                <span className="text-slate-500 font-semibold">
                  · {u.title} · {u.count}
                </span>
              </h2>
              <ol className="space-y-4">
                {u.topics.map((t) => (
                  <li
                    key={t.title}
                    className="relative rounded-sm border-2 border-slate-200 bg-white p-5 sm:p-6 pl-6 sm:pl-7 space-y-3"
                  >
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: t.color }} />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="font-display text-lg sm:text-xl font-semibold text-slate-900">{t.title}</h3>
                      <span className="text-sm text-slate-500 whitespace-nowrap">{t.count}</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-slate-700 marker:text-slate-400">
                      {t.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      {t.keywords.map((k) => (
                        <span
                          key={k}
                          className="rounded-sm border border-slate-300 bg-slate-50 px-2.5 py-1 text-sm font-medium text-slate-800"
                        >
                          {k}
                        </span>
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
          ))}

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
      </main>
    </div>
  );
}
