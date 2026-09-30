/**
 * ธีมของเกมผจญภัย — แต่ละเกมมีโลกของตัวเอง (games.theme)
 *   cyber = เมืองนีออน (ภาพเดิมใน sprites.tsx) · ocean = ใต้สมุทร · space = อวกาศ
 * แต่ละธีมมี: ฉากไกล · สิ่งประกอบฉาก 4 แบบ (art 1–4) · ศัตรู 4 แบบ · พื้น · ชื่อฉากตั้งต้น
 * สีผูกกับตัวแปรธีมของเว็บ ธีมสว่าง/มืดเปลี่ยนตามเอง
 */
import { EnemySprite, Skyline, StageProps } from "./sprites";

export type ThemeId = "cyber" | "ocean" | "space";

export const THEMES: { id: ThemeId; name: string; line: string; scenes: string[] }[] = [
  { id: "cyber", name: "ไซเบอร์ซิตี้", line: "เมืองนีออน โดรน บล็อกกลิตช์", scenes: ["ห้องแล็บแมกซ์เวลล์", "หอคอยสัญญาณ", "สนามแม่เหล็กไฟฟ้า", "เมืองแห่งแสง"] },
  { id: "ocean", name: "ใต้สมุทร", line: "ปะการัง ถ้ำผลึก สัตว์ทะเลลึก", scenes: ["ผิวน้ำระยิบระยับ", "แนวปะการัง", "ถ้ำผลึก", "ซากเรือโบราณ"] },
  { id: "space", name: "อวกาศ", line: "ดาวเคราะห์ ยูเอฟโอ สถานีอวกาศ", scenes: ["วงแหวนดาวเคราะห์", "สถานีรับสัญญาณ", "แถบดาวเคราะห์น้อย", "สถานีอวกาศ"] },
];

export function themeOf(id: string | null | undefined): ThemeId {
  return id === "ocean" || id === "space" ? id : "cyber";
}

/** สีพื้นหลังของฉาก (บนลงล่าง) */
export function skyOf(theme: ThemeId, color: string) {
  if (theme === "ocean") return `linear-gradient(to bottom, color-mix(in oklch, var(--trace-cyan) 26%, var(--c-slate-50)), color-mix(in oklch, var(--trace-cyan) 6%, var(--c-slate-50)))`;
  if (theme === "space") return `radial-gradient(ellipse at 70% 20%, color-mix(in oklch, var(--trace-magenta) 16%, transparent), transparent 60%), var(--c-slate-50)`;
  return `linear-gradient(to bottom, color-mix(in oklch, ${color} 10%, var(--c-slate-50)), var(--c-slate-50))`;
}

/** พื้นที่ตัวละครเดิน */
export function groundOf(theme: ThemeId, color: string): { background: string; stripes: string } {
  if (theme === "ocean")
    return {
      background: "color-mix(in oklch, var(--trace-yellow) 22%, var(--c-slate-100))",
      stripes: "radial-gradient(circle at 20px 10px, color-mix(in oklch, var(--trace-yellow) 40%, transparent) 2px, transparent 3px) 0 0 / 40px 20px",
    };
  if (theme === "space")
    return {
      background: "var(--c-slate-200)",
      stripes: "radial-gradient(ellipse at 30px 12px, var(--c-slate-100) 7px, transparent 8px) 0 0 / 70px 30px",
    };
  return {
    background: "var(--c-slate-100)",
    stripes: `repeating-linear-gradient(90deg, transparent 0 38px, color-mix(in oklch, ${color} 45%, transparent) 38px 40px)`,
  };
}

// ---------------------------------------------------------------------------
// ฉากไกล (ชั้นช้า) — วาดยาว 2 ช่วงต่อกัน เลื่อนไป 50% แล้ววนซ้ำได้เนียน
// ---------------------------------------------------------------------------
export function FarLayer({ theme, color }: { theme: ThemeId; color: string }) {
  if (theme === "cyber") return <Skyline color={color} />;
  if (theme === "ocean") {
    return (
      <svg viewBox="0 0 800 200" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
        {[0, 400].map((off) => (
          <g key={off} transform={`translate(${off} 0)`}>
            {/* ลำแสงส่องลงมาจากผิวน้ำ */}
            {[40, 170, 300].map((x) => (
              <path key={x} d={`M${x} 0 L${x + 40} 0 L${x + 90} 200 L${x + 20} 200z`} fill="color-mix(in oklch, var(--trace-cyan) 12%, transparent)" />
            ))}
            {/* ผิวน้ำด้านบน */}
            <path d="M0 14 Q25 6 50 14 T100 14 T150 14 T200 14 T250 14 T300 14 T350 14 T400 14" fill="none" stroke="color-mix(in oklch, var(--trace-cyan) 55%, transparent)" strokeWidth="3" />
            {/* สันเขาใต้น้ำไกล ๆ */}
            <path d="M0 200 L0 150 Q60 110 120 140 T240 125 T400 150 L400 200z" fill="color-mix(in oklch, var(--trace-cyan) 16%, var(--c-slate-100))" />
            {[60, 200, 330].map((x, i) => (
              <circle key={x} className="sprite-bubble" cx={x} cy={170 - i * 20} r={3 + i} fill="none" stroke="color-mix(in oklch, var(--trace-cyan) 60%, transparent)" strokeWidth="1.5" style={{ animationDelay: `${i * 0.7}s` }} />
            ))}
          </g>
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 800 200" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
      {[0, 400].map((off) => (
        <g key={off} transform={`translate(${off} 0)`}>
          {Array.from({ length: 22 }, (_, i) => (
            <circle
              key={i}
              className={i % 3 === 0 ? "sprite-blink" : undefined}
              cx={(i * 97) % 400}
              cy={(i * 53) % 190}
              r={i % 4 === 0 ? 1.8 : 1}
              fill="var(--c-slate-800)"
              style={{ animationDelay: `${(i % 5) * 0.4}s` }}
            />
          ))}
          <circle cx="300" cy="60" r="26" fill="color-mix(in oklch, var(--trace-magenta) 35%, var(--c-slate-200))" />
          <ellipse cx="300" cy="60" rx="44" ry="9" fill="none" stroke="color-mix(in oklch, var(--trace-yellow) 60%, transparent)" strokeWidth="3" />
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// สิ่งประกอบฉาก (ชั้นกลาง) 4 แบบต่อธีม
// ---------------------------------------------------------------------------
export function MidLayer({ theme, art, color }: { theme: ThemeId; art: number; color: string }) {
  if (theme === "cyber") return <StageProps stage={art} color={color} />;
  const kind = ((art - 1) % 4) + 1;
  const one = theme === "ocean" ? <OceanProps kind={kind} color={color} /> : <SpaceProps kind={kind} color={color} />;
  return (
    <svg viewBox="0 0 800 200" preserveAspectRatio="xMidYMax slice" className="h-full w-full" aria-hidden>
      {one}
      <g transform="translate(400 0)">{one}</g>
    </svg>
  );
}

function OceanProps({ kind, color }: { kind: number; color: string }) {
  if (kind === 1)
    // ผิวน้ำและแสงระยิบ
    return (
      <g>
        {[30, 130, 230, 330].map((x, i) => (
          <path key={x} className="sprite-blink" d={`M${x} ${130 + (i % 2) * 22} l6 -6 l6 6 l-6 6z`} fill="var(--trace-yellow)" style={{ animationDelay: `${x / 200}s` }} />
        ))}
        {[180, 360].map((x) => (
          <circle key={x} cx={x} cy="185" r="12" fill="color-mix(in oklch, var(--trace-magenta) 40%, var(--c-slate-200))" stroke={color} strokeWidth="2" />
        ))}
        {[80, 280].map((x) => (
          <path key={x} className="sprite-sway" d={`M${x} 200 C${x - 12} 170 ${x + 12} 150 ${x} 120`} fill="none" stroke="var(--trace-lime)" strokeWidth="5" strokeLinecap="round" />
        ))}
      </g>
    );
  if (kind === 2)
    // ปะการังและสาหร่าย
    return (
      <g>
        {[50, 250].map((x) => (
          <g key={x}>
            <path d={`M${x} 200 v-40 m0 10 l-18 -22 m18 12 l16 -26 m-16 46 l-26 -12`} fill="none" stroke="var(--trace-magenta)" strokeWidth="7" strokeLinecap="round" />
            <circle cx={x + 60} cy="185" r="16" fill="color-mix(in oklch, var(--trace-yellow) 55%, var(--c-slate-200))" />
            <path className="sprite-sway" d={`M${x + 110} 200 C${x + 96} 160 ${x + 124} 130 ${x + 110} 90`} fill="none" stroke="var(--trace-lime)" strokeWidth="5" strokeLinecap="round" />
          </g>
        ))}
      </g>
    );
  if (kind === 3)
    // ถ้ำผลึก (แคลไซต์หักเหสองแนว)
    return (
      <g>
        {[70, 270].map((x) => (
          <g key={x}>
            <path d={`M${x - 30} 200 L${x - 16} 130 L${x} 110 L${x + 14} 130 L${x + 26} 200z`} fill="color-mix(in oklch, var(--trace-cyan) 30%, var(--c-slate-200))" stroke={color} strokeWidth="2" />
            <path d={`M${x + 40} 200 L${x + 50} 155 L${x + 62} 145 L${x + 70} 200z`} fill="color-mix(in oklch, var(--trace-magenta) 25%, var(--c-slate-200))" stroke={color} strokeWidth="2" />
            <path className="sprite-blink" d={`M${x - 70} 150 L${x - 10} 150 M${x + 10} 146 L${x + 60} 132 M${x + 10} 154 L${x + 60} 168`} stroke="var(--trace-yellow)" strokeWidth="2" />
          </g>
        ))}
      </g>
    );
  // ซากเรือและสมอ
  return (
    <g>
      <path d="M40 200 L60 150 L200 150 L230 200z" fill="color-mix(in oklch, var(--trace-yellow) 20%, var(--c-slate-300))" stroke={color} strokeWidth="2" />
      <path d="M120 150 V70 M120 80 L170 110 L120 110" fill="none" stroke="var(--c-slate-400)" strokeWidth="4" />
      {[80, 110, 140, 170].map((x) => (
        <circle key={x} cx={x} cy="170" r="6" fill="var(--sign-ink)" stroke={color} strokeWidth="1.5" />
      ))}
      <path d="M320 120 v60 m-18 -12 q18 22 36 0 m-18 -48 a8 8 0 1 1 0.1 0" fill="none" stroke="var(--c-slate-400)" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function SpaceProps({ kind, color }: { kind: number; color: string }) {
  if (kind === 1)
    // ดาวเคราะห์วงแหวนใกล้ ๆ
    return (
      <g>
        <circle cx="120" cy="160" r="40" fill="color-mix(in oklch, var(--trace-cyan) 30%, var(--c-slate-200))" stroke="var(--trace-cyan)" strokeWidth="2" />
        <path d="M86 150 q34 -10 68 6 M90 172 q30 8 60 -2" fill="none" stroke="color-mix(in oklch, var(--trace-cyan) 60%, transparent)" strokeWidth="4" />
        <ellipse cx="120" cy="160" rx="74" ry="13" fill="none" stroke={color} strokeWidth="3" transform="rotate(-12 120 160)" />
        <circle cx="320" cy="150" r="14" fill="color-mix(in oklch, var(--trace-yellow) 45%, var(--c-slate-200))" stroke="var(--trace-yellow)" strokeWidth="2" />
      </g>
    );
  if (kind === 2)
    // จานรับสัญญาณบนดวงจันทร์
    return (
      <g>
        {[90, 290].map((x) => (
          <g key={x}>
            <path d={`M${x} 200 L${x} 150`} stroke="var(--c-slate-400)" strokeWidth="5" />
            <path d={`M${x - 36} 110 A40 40 0 0 0 ${x + 30} 162z`} fill="var(--c-slate-300)" stroke={color} strokeWidth="2" />
            <path d={`M${x - 3} 136 L${x + 20} 112`} stroke="var(--c-slate-400)" strokeWidth="3" />
            {[14, 26, 38].map((r) => (
              <path key={r} className="sprite-blink" d={`M${x + 20 + r * 0.7} ${112 - r * 0.7} a${r} ${r} 0 0 1 ${r * 0.3} ${r * 0.9}`} fill="none" stroke={color} strokeWidth="2" style={{ animationDelay: `${r / 30}s` }} />
            ))}
          </g>
        ))}
      </g>
    );
  if (kind === 3)
    // แถบดาวเคราะห์น้อย
    return (
      <g>
        {[
          [40, 140, 16], [110, 170, 10], [170, 130, 22], [240, 175, 12], [300, 145, 18], [360, 180, 9],
        ].map(([x, y, r]) => (
          <g key={x} className="sprite-hover" style={{ animationDelay: `${x / 150}s` }}>
            <path d={`M${x - r} ${y} q${r * 0.3} ${-r} ${r} ${-r} q${r} ${r * 0.2} ${r} ${r} q${-r * 0.2} ${r} ${-r} ${r} q${-r} 0 ${-r} ${-r}z`} fill="var(--c-slate-300)" stroke="var(--c-slate-400)" strokeWidth="2" />
            <circle cx={x + r * 0.2} cy={y - r * 0.2} r={r * 0.25} fill="var(--c-slate-200)" />
          </g>
        ))}
      </g>
    );
  // สถานีอวกาศ
  return (
    <g>
      <rect x="130" y="140" width="90" height="26" rx="8" fill="var(--c-slate-300)" stroke={color} strokeWidth="2" />
      <rect x="60" y="130" width="60" height="46" fill="color-mix(in oklch, var(--trace-cyan) 35%, var(--c-slate-200))" stroke="var(--c-slate-400)" strokeWidth="2" />
      <rect x="230" y="130" width="60" height="46" fill="color-mix(in oklch, var(--trace-cyan) 35%, var(--c-slate-200))" stroke="var(--c-slate-400)" strokeWidth="2" />
      <path d="M60 153h60M230 153h60M90 130v46M260 130v46" stroke="var(--c-slate-400)" strokeWidth="1.5" />
      <circle className="sprite-blink" cx="175" cy="153" r="4" fill={color} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// ศัตรู 4 แบบต่อธีม (หันซ้าย) — บอสขยายใหญ่และมีมงกุฎ
// ---------------------------------------------------------------------------
export function ThemedEnemy({ theme, art, boss = false, className = "" }: { theme: ThemeId; art: number; boss?: boolean; className?: string }) {
  if (theme === "cyber") return <EnemySprite stage={art} boss={boss} className={className} />;
  const kind = ((art - 1) % 4) + 1;
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      {boss && <path d="M26 12 l6 8 l8 -12 l8 12 l6 -8 v10 h-28z" fill="var(--trace-yellow)" stroke="var(--c-red-500)" strokeWidth="1.5" />}
      {theme === "ocean" ? <OceanEnemy kind={kind} /> : <SpaceEnemy kind={kind} />}
    </svg>
  );
}

function OceanEnemy({ kind }: { kind: number }) {
  if (kind === 1)
    // แมงกะพรุนไฟฟ้า
    return (
      <g className="sprite-hover">
        <path d="M16 44 a24 22 0 0 1 48 0 q-6 4 -12 0 q-6 4 -12 0 q-6 4 -12 0 q-6 4 -12 0z" fill="color-mix(in oklch, var(--trace-magenta) 45%, var(--c-slate-200))" stroke="var(--trace-magenta)" strokeWidth="2" />
        <circle className="sprite-blink" cx="32" cy="34" r="3" fill="var(--c-red-500)" />
        <circle className="sprite-blink" cx="46" cy="34" r="3" fill="var(--c-red-500)" />
        {[22, 34, 46, 58].map((x) => (
          <path key={x} className="sprite-sway" d={`M${x} 46 q-5 10 0 18 q5 8 0 14`} fill="none" stroke="var(--trace-magenta)" strokeWidth="2.5" strokeLinecap="round" />
        ))}
      </g>
    );
  if (kind === 2)
    // ปลาปักเป้าพองหนาม
    return (
      <g className="sprite-hover">
        <circle cx="42" cy="42" r="22" fill="color-mix(in oklch, var(--trace-yellow) 55%, var(--c-slate-200))" stroke="var(--trace-yellow)" strokeWidth="2" />
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return <path key={i} d={`M${42 + Math.cos(a) * 21} ${42 + Math.sin(a) * 21} L${42 + Math.cos(a) * 30} ${42 + Math.sin(a) * 30}`} stroke="var(--trace-yellow)" strokeWidth="2.5" strokeLinecap="round" />;
        })}
        <circle cx="30" cy="36" r="5" fill="var(--c-slate-50)" />
        <circle className="sprite-blink" cx="29" cy="36" r="2.5" fill="var(--c-red-500)" />
        <path d="M22 48 q4 4 8 0" fill="none" stroke="var(--sign-ink)" strokeWidth="2" />
        <path d="M64 42 l12 -8 v16z" fill="color-mix(in oklch, var(--trace-yellow) 55%, var(--c-slate-200))" />
      </g>
    );
  if (kind === 3)
    // ปูก้ามใหญ่
    return (
      <g>
        <ellipse cx="42" cy="54" rx="24" ry="14" fill="color-mix(in oklch, var(--c-red-500) 60%, var(--c-slate-200))" stroke="var(--c-red-500)" strokeWidth="2" />
        <g className="sprite-sway">
          <path d="M18 48 l-8 -14 a8 8 0 1 1 12 -4 z" fill="var(--c-red-500)" />
        </g>
        <path d="M66 48 l6 -12 a6 6 0 1 0 -8 -4z" fill="var(--c-red-500)" />
        <path d="M34 42 v-8 M50 42 v-8" stroke="var(--c-red-500)" strokeWidth="2.5" />
        <circle className="sprite-blink" cx="34" cy="32" r="3.5" fill="var(--sign-ink)" />
        <circle className="sprite-blink" cx="50" cy="32" r="3.5" fill="var(--sign-ink)" />
        {[26, 36, 48, 58].map((x) => (
          <path key={x} d={`M${x} 64 l-4 10`} stroke="var(--c-red-500)" strokeWidth="2.5" strokeLinecap="round" />
        ))}
      </g>
    );
  // ปลาตกเบ็ดทะเลลึก
  return (
    <g className="sprite-hover">
      <path d="M20 26 q10 -16 22 -18" fill="none" stroke="var(--c-slate-400)" strokeWidth="2" />
      <circle className="sprite-blink" cx="18" cy="28" r="5" fill="var(--trace-yellow)" />
      <path d="M14 48 q8 -24 34 -20 q24 4 22 24 q-2 18 -28 18 q-24 0 -28 -22z" fill="color-mix(in oklch, var(--trace-cyan) 25%, var(--c-slate-300))" stroke="var(--trace-cyan)" strokeWidth="2" />
      <path d="M18 54 l6 -4 l4 5 l5 -5 l5 5 l5 -5 l4 4" fill="none" stroke="var(--c-slate-800)" strokeWidth="2" />
      <circle cx="30" cy="38" r="4" fill="var(--c-red-500)" className="sprite-blink" />
      <path d="M70 46 l8 -10 v22z" fill="color-mix(in oklch, var(--trace-cyan) 25%, var(--c-slate-300))" />
    </g>
  );
}

function SpaceEnemy({ kind }: { kind: number }) {
  if (kind === 1)
    // ยูเอฟโอ
    return (
      <g className="sprite-hover">
        <path d="M26 34 a14 12 0 0 1 28 0z" fill="color-mix(in oklch, var(--trace-cyan) 40%, transparent)" stroke="var(--trace-cyan)" strokeWidth="2" />
        <circle cx="40" cy="30" r="5" fill="var(--trace-lime)" />
        <circle className="sprite-blink" cx="38" cy="29" r="1.5" fill="var(--sign-ink)" />
        <ellipse cx="40" cy="40" rx="30" ry="9" fill="var(--c-slate-300)" stroke="var(--trace-magenta)" strokeWidth="2" />
        {[20, 32, 48, 60].map((x, i) => (
          <circle key={x} className="sprite-blink" cx={x} cy="41" r="2" fill="var(--trace-yellow)" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
        <path d="M30 50 L22 72 M50 50 L58 72" stroke="color-mix(in oklch, var(--trace-lime) 50%, transparent)" strokeWidth="3" strokeDasharray="3 3" />
      </g>
    );
  if (kind === 2)
    // ก้อนหินอุกกาบาตมีตา
    return (
      <g className="sprite-hover">
        <path d="M14 44 q2 -24 24 -28 q26 -2 28 22 q2 24 -24 28 q-26 2 -28 -22z" fill="var(--c-slate-300)" stroke="var(--c-slate-400)" strokeWidth="2.5" />
        <circle cx="52" cy="54" r="5" fill="var(--c-slate-200)" />
        <circle cx="24" cy="30" r="4" fill="var(--c-slate-200)" />
        <path d="M26 38 l8 4 M46 38 l-8 4" stroke="var(--sign-ink)" strokeWidth="2.5" strokeLinecap="round" />
        <circle className="sprite-blink" cx="31" cy="46" r="3" fill="var(--c-red-500)" />
        <circle className="sprite-blink" cx="41" cy="46" r="3" fill="var(--c-red-500)" />
        <path d="M64 30 l12 -6 M66 40 l12 0 M64 50 l12 6" stroke="var(--trace-yellow)" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      </g>
    );
  if (kind === 3)
    // เอเลี่ยนตัวเขียว
    return (
      <g>
        <path className="sprite-sway" d="M30 18 q-6 -10 -12 -8 M50 18 q6 -10 12 -8" fill="none" stroke="var(--trace-lime)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="18" cy="10" r="3" fill="var(--trace-lime)" />
        <circle cx="62" cy="10" r="3" fill="var(--trace-lime)" />
        <path d="M18 70 q-2 -30 10 -42 q12 -12 24 0 q12 12 10 42z" fill="color-mix(in oklch, var(--trace-lime) 50%, var(--c-slate-200))" stroke="var(--trace-lime)" strokeWidth="2" />
        <ellipse cx="32" cy="38" rx="6" ry="8" fill="var(--sign-ink)" />
        <ellipse cx="50" cy="38" rx="6" ry="8" fill="var(--sign-ink)" />
        <circle className="sprite-blink" cx="31" cy="36" r="2" fill="var(--trace-magenta)" />
        <circle className="sprite-blink" cx="49" cy="36" r="2" fill="var(--trace-magenta)" />
        <path d="M34 54 q6 4 12 0" fill="none" stroke="var(--sign-ink)" strokeWidth="2" />
      </g>
    );
  // หุ่นสำรวจอวกาศ
  return (
    <g>
      <rect x="18" y="28" width="44" height="30" rx="4" fill="var(--c-slate-300)" stroke="var(--trace-cyan)" strokeWidth="2" />
      <rect x="24" y="34" width="32" height="12" rx="2" fill="var(--sign-ink)" />
      <path className="sprite-blink" d="M28 40 h6 l3 -4 l4 8 l3 -4 h8" fill="none" stroke="var(--c-red-500)" strokeWidth="2" />
      <path d="M40 28 V14" stroke="var(--c-slate-400)" strokeWidth="2.5" />
      <circle className="sprite-blink" cx="40" cy="12" r="4" fill="var(--trace-magenta)" />
      {[24, 40, 56].map((x) => (
        <circle key={x} cx={x} cy="66" r="7" fill="var(--c-slate-400)" stroke="var(--sign-ink)" strokeWidth="2" />
      ))}
    </g>
  );
}
