export type GradeScale = { min_percent: number; grade: string };

export const DEFAULT_GRADE_SCALE: GradeScale[] = [
  { min_percent: 80, grade: "4" },
  { min_percent: 75, grade: "3.5" },
  { min_percent: 70, grade: "3" },
  { min_percent: 65, grade: "2.5" },
  { min_percent: 60, grade: "2" },
  { min_percent: 55, grade: "1.5" },
  { min_percent: 50, grade: "1" },
  { min_percent: 0, grade: "0" },
];

export function calcGrade(percent: number, scales: GradeScale[]): string {
  const use = scales.length ? scales : DEFAULT_GRADE_SCALE;
  const sorted = [...use].sort((a, b) => b.min_percent - a.min_percent);
  for (const s of sorted) {
    if (percent >= s.min_percent) return s.grade;
  }
  return sorted[sorted.length - 1]?.grade ?? "-";
}
