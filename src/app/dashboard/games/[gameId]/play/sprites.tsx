/**
 * ภาพในเกมภารกิจ (SVG ล้วน ไม่ต้องโหลดรูป) — ตัวละคร ศัตรู และฉากหลังของแต่ละด่าน
 * สีใช้ลายทองแดงนีออนของเว็บ (--trace-*) ธีมสว่าง/มืดเปลี่ยนตามเอง
 * การขยับ (เดิน ลอย กะพริบ) ทำด้วยคลาสใน globals.css หมวด "เกมผจญภัย"
 */

export type CharacterId = "robot" | "astronaut" | "cat";

export const CHARACTERS: { id: CharacterId; name: string; line: string }[] = [
  { id: "robot", name: "ไบต์", line: "หุ่นยนต์นีออน ยิงลำแสงเลเซอร์" },
  { id: "astronaut", name: "โนวา", line: "นักบินอวกาศ ปืนคลื่นพลาสมา" },
  { id: "cat", name: "เหมียวเฮิรตซ์", line: "แมวไซเบอร์ ปล่อยคลื่นไมโครเวฟ" },
];

/** ตัวละครมองขวา · ขา/แขนแยกกลุ่มไว้ให้ CSS แกว่งตอนเดิน */
export function CharacterSprite({ id, className = "" }: { id: CharacterId; className?: string }) {
  if (id === "astronaut") {
    return (
      <svg viewBox="0 0 64 88" className={className} aria-hidden>
        <g className="sprite-leg sprite-leg-back">
          <rect x="24" y="60" width="9" height="20" rx="4" fill="var(--c-slate-300)" />
          <rect x="22" y="76" width="13" height="7" rx="3" fill="var(--trace-cyan)" />
        </g>
        <rect x="12" y="36" width="10" height="22" rx="4" fill="var(--c-slate-400)" />
        <rect x="18" y="34" width="28" height="30" rx="9" fill="var(--c-slate-200)" stroke="var(--trace-cyan)" strokeWidth="2" />
        <rect x="26" y="44" width="12" height="8" rx="2" fill="var(--trace-magenta)" />
        <g className="sprite-leg sprite-leg-front">
          <rect x="33" y="60" width="9" height="20" rx="4" fill="var(--c-slate-200)" />
          <rect x="31" y="76" width="13" height="7" rx="3" fill="var(--trace-cyan)" />
        </g>
        <g className="sprite-arm">
          <rect x="42" y="40" width="16" height="7" rx="3.5" fill="var(--c-slate-200)" />
          <rect x="54" y="38" width="8" height="10" rx="2" fill="var(--trace-yellow)" />
        </g>
        <circle cx="32" cy="20" r="17" fill="var(--c-slate-200)" stroke="var(--trace-cyan)" strokeWidth="2" />
        <path d="M22 17a12 10 0 0 1 24 0v6a12 8 0 0 1-24 0z" fill="var(--sign-ink)" />
        <path d="M34 14h7" stroke="var(--trace-cyan)" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
      </svg>
    );
  }
  if (id === "cat") {
    return (
      <svg viewBox="0 0 72 80" className={className} aria-hidden>
        <path className="sprite-tail" d="M12 52 C2 44 4 30 10 26" fill="none" stroke="var(--trace-magenta)" strokeWidth="5" strokeLinecap="round" />
        <g className="sprite-leg sprite-leg-back">
          <rect x="18" y="58" width="8" height="16" rx="4" fill="var(--c-slate-400)" />
        </g>
        <g className="sprite-leg sprite-leg-front">
          <rect x="40" y="58" width="8" height="16" rx="4" fill="var(--c-slate-400)" />
        </g>
        <ellipse cx="32" cy="52" rx="22" ry="12" fill="var(--c-slate-300)" stroke="var(--trace-magenta)" strokeWidth="2" />
        <path d="M18 50h28" stroke="var(--trace-cyan)" strokeWidth="2" strokeDasharray="3 4" />
        <path d="M40 22 L44 6 L52 18 L60 6 L64 22" fill="var(--c-slate-300)" stroke="var(--trace-magenta)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="52" cy="30" r="15" fill="var(--c-slate-300)" stroke="var(--trace-magenta)" strokeWidth="2" />
        <rect className="sprite-eye" x="47" y="26" width="5" height="7" rx="2" fill="var(--trace-cyan)" />
        <rect className="sprite-eye" x="56" y="26" width="5" height="7" rx="2" fill="var(--trace-cyan)" />
        <path d="M54 36l2 2 2-2" fill="none" stroke="var(--c-slate-700)" strokeWidth="1.5" />
        <path d="M66 32h5M65 36h5" stroke="var(--trace-cyan)" strokeWidth="1.2" opacity=".7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 88" className={className} aria-hidden>
      <path d="M32 10V3" stroke="var(--c-slate-400)" strokeWidth="2.5" />
      <circle className="sprite-blink" cx="32" cy="3" r="3" fill="var(--trace-magenta)" />
      <g className="sprite-leg sprite-leg-back">
        <rect x="22" y="62" width="8" height="18" rx="3" fill="var(--c-slate-400)" />
        <rect x="19" y="78" width="14" height="6" rx="3" fill="var(--trace-yellow)" />
      </g>
      <rect x="14" y="36" width="36" height="28" rx="6" fill="var(--c-slate-300)" stroke="var(--trace-yellow)" strokeWidth="2" />
      <circle cx="32" cy="50" r="6" fill="var(--sign-ink)" stroke="var(--trace-yellow)" strokeWidth="2" />
      <circle className="sprite-blink" cx="32" cy="50" r="2.5" fill="var(--trace-yellow)" />
      <g className="sprite-leg sprite-leg-front">
        <rect x="34" y="62" width="8" height="18" rx="3" fill="var(--c-slate-300)" />
        <rect x="31" y="78" width="14" height="6" rx="3" fill="var(--trace-yellow)" />
      </g>
      <g className="sprite-arm">
        <rect x="46" y="42" width="14" height="7" rx="3" fill="var(--c-slate-300)" />
        <rect x="56" y="40" width="7" height="11" rx="2" fill="var(--trace-cyan)" />
      </g>
      <rect x="12" y="10" width="40" height="26" rx="8" fill="var(--c-slate-300)" stroke="var(--trace-yellow)" strokeWidth="2" />
      <rect x="18" y="16" width="30" height="12" rx="6" fill="var(--sign-ink)" />
      <rect className="sprite-eye" x="28" y="19" width="6" height="6" rx="3" fill="var(--trace-cyan)" />
      <rect className="sprite-eye" x="38" y="19" width="6" height="6" rx="3" fill="var(--trace-cyan)" />
    </svg>
  );
}

/** ศัตรูของแต่ละด่าน (หันซ้าย) — บอสใช้แบบของด่านนั้นขยายใหญ่พร้อมเขา */
export function EnemySprite({ stage, boss = false, className = "" }: { stage: number; boss?: boolean; className?: string }) {
  const kind = ((stage - 1) % 4) + 1;
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      {boss && (
        <g fill="var(--trace-magenta)">
          <path d="M22 18 L16 2 L30 14z" />
          <path d="M58 18 L64 2 L50 14z" />
        </g>
      )}
      {kind === 1 && (
        // โดรนรบกวนสัญญาณ: ลอยอยู่ มีใบพัดและตาแดง
        <g className="sprite-hover">
          <path d="M14 20h22M44 20h22" stroke="var(--c-slate-400)" strokeWidth="3" strokeLinecap="round" />
          <path className="sprite-spin" d="M8 20h12M60 20h12" stroke="var(--trace-cyan)" strokeWidth="2" strokeLinecap="round" />
          <rect x="18" y="22" width="44" height="30" rx="10" fill="var(--c-slate-300)" stroke="var(--c-red-500)" strokeWidth="2.5" />
          <circle cx="32" cy="37" r="7" fill="var(--sign-ink)" />
          <circle className="sprite-blink" cx="30" cy="37" r="3.5" fill="var(--c-red-500)" />
          <path d="M26 58l-4 10M40 58v12M54 58l4 10" stroke="var(--c-red-500)" strokeWidth="2" strokeDasharray="2 3" />
        </g>
      )}
      {kind === 2 && (
        // บล็อกกลิตช์: ก้อนพิกเซลบิดเบี้ยว
        <g className="sprite-glitch">
          <rect x="16" y="24" width="48" height="44" fill="var(--c-slate-300)" stroke="var(--trace-magenta)" strokeWidth="2.5" />
          <rect x="10" y="34" width="12" height="8" fill="var(--trace-magenta)" />
          <rect x="58" y="48" width="14" height="6" fill="var(--trace-cyan)" />
          <rect x="24" y="36" width="10" height="10" fill="var(--sign-ink)" />
          <rect x="44" y="36" width="10" height="10" fill="var(--sign-ink)" />
          <rect className="sprite-blink" x="26" y="38" width="4" height="4" fill="var(--c-red-500)" />
          <rect className="sprite-blink" x="46" y="38" width="4" height="4" fill="var(--c-red-500)" />
          <path d="M26 56h28" stroke="var(--sign-ink)" strokeWidth="4" strokeDasharray="4 3" />
        </g>
      )}
      {kind === 3 && (
        // ประตูสนามพลังงาน
        <g>
          <rect x="12" y="10" width="10" height="66" rx="2" fill="var(--c-slate-400)" />
          <rect x="58" y="10" width="10" height="66" rx="2" fill="var(--c-slate-400)" />
          <g className="sprite-field" fill="none" stroke="var(--trace-yellow)" strokeWidth="2">
            <path d="M22 20 C34 28 46 12 58 20" />
            <path d="M22 34 C34 42 46 26 58 34" />
            <path d="M22 48 C34 56 46 40 58 48" />
            <path d="M22 62 C34 70 46 54 58 62" />
          </g>
          <circle className="sprite-blink" cx="17" cy="14" r="3" fill="var(--c-red-500)" />
          <circle className="sprite-blink" cx="63" cy="14" r="3" fill="var(--c-red-500)" />
        </g>
      )}
      {kind === 4 && (
        // ป้อมล็อกรหัส: ต้องใส่ตัวเลขถูกถึงเปิด
        <g>
          <rect x="14" y="16" width="52" height="58" rx="6" fill="var(--c-slate-300)" stroke="var(--trace-lime)" strokeWidth="2.5" />
          <rect x="22" y="24" width="36" height="14" rx="2" fill="var(--sign-ink)" />
          <text x="40" y="35" textAnchor="middle" fontSize="10" fontFamily="monospace" fill="var(--trace-lime)" className="sprite-blink">
            ? ? ?
          </text>
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={24 + c * 11} y={44 + r * 9} width="8" height="6" rx="1.5" fill="var(--c-slate-400)" />)
          )}
          <circle cx="60" cy="62" r="3" fill="var(--c-red-500)" className="sprite-blink" />
        </g>
      )}
    </svg>
  );
}

/** ฉากหลังแต่ละด่าน: ตึกไกล (ชั้นช้า) + สิ่งประกอบฉากตามเนื้อหา (ชั้นกลาง) */
export const STAGE_SCENES = ["ห้องแล็บแมกซ์เวลล์", "หอคอยสัญญาณ", "สนามแม่เหล็กไฟฟ้า", "เมืองแห่งแสง"];

export function Skyline({ color }: { color: string }) {
  // วาดยาว 2 ช่วงต่อกัน เลื่อนไป 50% แล้ววนซ้ำได้เนียน
  const blocks = [
    [0, 60, 50], [55, 90, 40], [100, 40, 60], [165, 110, 35], [205, 70, 55], [265, 50, 45], [315, 95, 50], [370, 65, 40],
  ];
  return (
    <svg viewBox="0 0 800 200" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
      {[0, 400].map((off) => (
        <g key={off} transform={`translate(${off} 0)`}>
          {blocks.map(([x, h, w], i) => (
            <g key={i}>
              <rect x={x} y={200 - h} width={w} height={h} fill={`color-mix(in oklch, ${color} 14%, var(--c-slate-100))`} />
              {Array.from({ length: Math.floor(h / 18) }, (_, r) => (
                <rect key={r} x={x + 8} y={200 - h + 8 + r * 18} width={w - 16} height="3" fill={`color-mix(in oklch, ${color} 35%, transparent)`} />
              ))}
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

export function StageProps({ stage, color }: { stage: number; color: string }) {
  const kind = ((stage - 1) % 4) + 1;
  const one = (
    <g>
      {kind === 1 &&
        // ขดลวดเทสลา + ประกายไฟ
        [60, 260].map((x) => (
          <g key={x}>
            <rect x={x - 10} y="120" width="20" height="80" fill="var(--c-slate-300)" />
            <ellipse cx={x} cy="115" rx="26" ry="10" fill="var(--c-slate-300)" stroke={color} strokeWidth="2" />
            <path className="sprite-blink" d={`M${x} 105 l-8 -18 l10 -4 l-6 -20`} fill="none" stroke={color} strokeWidth="2.5" />
          </g>
        ))}
      {kind === 2 &&
        // เสาส่งสัญญาณ + คลื่นวงแหวน
        [80, 290].map((x) => (
          <g key={x}>
            <path d={`M${x - 22} 200 L${x} 70 L${x + 22} 200 M${x - 14} 150 H${x + 14} M${x - 8} 110 H${x + 8}`} fill="none" stroke="var(--c-slate-400)" strokeWidth="3" />
            <circle cx={x} cy="68" r="5" fill={color} />
            {[18, 32, 46].map((r) => (
              <path key={r} className="sprite-blink" d={`M${x + r * 0.7} ${68 - r * 0.7} a${r} ${r} 0 0 1 0 ${r * 1.4}`} fill="none" stroke={color} strokeWidth="2" opacity={1 - r / 60} />
            ))}
          </g>
        ))}
      {kind === 3 && (
        // เส้นสนามไฟฟ้า/แม่เหล็กตั้งฉากกัน
        <g fill="none" strokeWidth="2">
          <path d="M0 120 C60 70 120 170 180 120 S300 70 400 120" stroke={color} />
          <path d="M0 140 C60 190 120 90 180 140 S300 190 400 140" stroke="var(--trace-cyan)" opacity=".7" />
          {[40, 140, 240, 340].map((x) => (
            <path key={x} d={`M${x} 80v60 m-5 -55 l5 -5 l5 5`} stroke="var(--c-slate-400)" />
          ))}
        </g>
      )}
      {kind === 4 &&
        // ปริซึมหักเหแสง
        [90, 300].map((x) => (
          <g key={x}>
            <path d={`M${x} 90 L${x + 40} 170 L${x - 40} 170z`} fill="color-mix(in oklch, var(--c-slate-300) 70%, transparent)" stroke={color} strokeWidth="2" />
            <path d={`M${x - 90} 125 L${x - 18} 130`} stroke="var(--c-slate-800)" strokeWidth="2.5" />
            {["var(--trace-magenta)", "var(--trace-yellow)", "var(--trace-lime)", "var(--trace-cyan)"].map((c, i) => (
              <path key={c} d={`M${x + 18} 132 L${x + 90} ${118 + i * 10}`} stroke={c} strokeWidth="2.5" />
            ))}
          </g>
        ))}
    </g>
  );
  return (
    <svg viewBox="0 0 800 200" preserveAspectRatio="xMidYMax slice" className="h-full w-full" aria-hidden>
      {one}
      <g transform="translate(400 0)">{one}</g>
    </svg>
  );
}

export function Heart({ full }: { full: boolean }) {
  return (
    <svg viewBox="0 0 24 22" className="size-5" aria-hidden>
      <path
        d="M12 21 C5 15 1 11.5 1 7 A5.5 5.5 0 0 1 12 4.5 A5.5 5.5 0 0 1 23 7 C23 11.5 19 15 12 21Z"
        fill={full ? "var(--trace-magenta)" : "none"}
        stroke="var(--trace-magenta)"
        strokeWidth="2"
      />
    </svg>
  );
}
