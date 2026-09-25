---
version: 1
slug: "src-app-dashboard-courses-id-page-tsx"
primary_target: "src/app/dashboard/courses/[id]/page.tsx"
related_targets: []
---

# Surface: หน้าคะแนนของนักเรียน (แท็บ "คะแนนของฉัน" ใน /dashboard/courses/[id])

Mode: Operate. Audience: นักเรียน ม.ปลาย ส่วนใหญ่บนมือถือ ตอนเย็นหรือระหว่างคาบ. Job: รู้ว่าขาดงานชิ้นไหน, ได้กี่คะแนนแล้ว, ต้องได้อีกเท่าไรถึงเกรดที่ตั้งเป้า. Constraints: ตัวเลขคะแนนต้องอ่านชัดกว่าเดิม, หน้ากรอกคะแนนของครูต้องไม่ช้าลง, เกรดจริงแสดงเมื่อครบเท่านั้น. Pinned by the teacher: physics + cyberpunk, circuit-board form, intense on first-view pages and light on working pages; dark default with a light toggle.

## Direction contract

THESIS: The term is a circuit the student powers up. Each unit is a copper trace in its own neon ink, every graded piece is a soldered pad, and the circuit closes at the grade they are aiming for. Refuses summary cards, percentage rings and progress bars.

OWN-WORLD: Night-navy PCB ground with a faint copper-trace pattern, porcelain ink, four neon trace inks (magenta, cyan, yellow, lime) assigned to units in order and shared with the teacher's score table. Scored pieces are filled solder pads with a drill hole and a soft neon bleed; unscored are empty porcelain rings with words; exams are IC-chip squares; unit changes are vias. Unit headers are chip labels with a physics glyph per unit. Headings in Chakra Petch; figures in Barlow Semi Condensed tabular; Thai body in Anuphan. No glass, no blur.

STORY: The student sees which pads are still unsoldered and how many points the remaining pieces must supply to reach the terminus they chose. They pick a target grade and chase the empty pads.

FIRST VIEWPORT: Mobile: course chip label and term; the readout board (points so far, pieces missing, target-grade selector, "ต้องได้อีก"); the vertical trace begins beneath. Desktop: trace left, board sticky right.

FORM: Neon circuit board, pinned by the teacher (replaces the earlier transit diagram, seed key 074954b4 superseded by the teacher's explicit pick). Signature: choosing a target re-weights the empty pads ("ควรได้ราว N") and their trace brightness; the trace reveals once on load; numbers never move.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Reach

Global tokens remap the existing Tailwind slate/white/status colours so every other page inherits the enamel world at once; teacher pages get their own passes later.

## Unresolved

Other surfaces (teacher score entry, IoT) keep their current layouts for now.
