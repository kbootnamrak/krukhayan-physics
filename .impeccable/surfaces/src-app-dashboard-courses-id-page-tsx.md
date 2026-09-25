---
version: 1
slug: "src-app-dashboard-courses-id-page-tsx"
primary_target: "src/app/dashboard/courses/[id]/page.tsx"
related_targets: []
---

# Surface: หน้าคะแนนของนักเรียน (แท็บ "คะแนนของฉัน" ใน /dashboard/courses/[id])

Mode: Operate. Audience: นักเรียน ม.ปลาย ส่วนใหญ่บนมือถือ ตอนเย็นหรือระหว่างคาบ. Job: รู้ว่าขาดงานชิ้นไหน, ได้กี่คะแนนแล้ว, ต้องได้อีกเท่าไรถึงเกรดที่ตั้งเป้า. Constraints: ตัวเลขคะแนนต้องอ่านชัดกว่าเดิม, หน้ากรอกคะแนนของครูต้องไม่ช้าลง, เกรดจริงแสดงเมื่อครบเท่านั้น. Pinned by the teacher: dark enamel ground with neon light (from their design.md), dark default with a light toggle.

## Direction contract

THESIS: The term is a rail line the student rides. Every graded piece is a station; the ride ends at the grade they are aiming for. Refuses the category default of summary cards, percentage rings and progress bars.

OWN-WORLD: Midnight enamel ground, porcelain ink, four line inks (scarlet, cobalt, amber, green) assigned to units in order, the student's route lit brightest with a soft neon bleed. Stations are filled discs when graded and hollow porcelain rings when not, always paired with words. Exams are interchange rings. Labels are a condensed transit sans with tabular figures; Thai rides a humanist Thai sans. Lines bend only at 45 and 90 degrees. No glass, no blur, no gradients.

STORY: The student sees where they are on the line, which stations are still unlit, and how many points the remaining stations must supply to reach the terminus they chose. They pick a target grade and chase the unlit stations.

FIRST VIEWPORT: Mobile: course name and term as a line sign; a departure-board readout (points so far as large tabular numerals, pieces missing, target-grade selector as terminus chips, "ต้องได้อีก" readout); the vertical strip map begins beneath with the first unit's line. Desktop: strip map left, readout board sticky right.

FORM: Midnight transit diagram (catalog challenger, chosen by the teacher over assigned list position 7); seed key 074954b4. Signature interaction: choosing a terminus re-lights the route and recomputes the needed points; the line draws in once on load, numbers never move.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Reach

Global tokens remap the existing Tailwind slate/white/status colours so every other page inherits the enamel world at once; teacher pages get their own passes later.

## Unresolved

Other surfaces (teacher score entry, IoT) keep their current layouts for now.
