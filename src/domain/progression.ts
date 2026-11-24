import type { Course } from "../content/schema";
import { summarize, type Attempts } from "./session";

export type RoundKind = "lesson" | "assessment" | "review" | "mistake";
export interface Round {
  id: string;
  kind: RoundKind;
  targetId: string;
  questionIds: string[];
  index: number;
  selected: string[];
  hinted: boolean;
  feedback: boolean | null;
  attempts: Attempts;
  xp: number;
}
export interface Result {
  roundId: string;
  kind: RoundKind;
  targetId: string;
  passed: boolean;
  earned: number;
  total: number;
  xp: number;
  coverage: { id: string; earned: number; total: number }[];
}
export function unlocked(
  course: Course,
  passedIds: readonly string[],
  targetId: string,
) {
  let previous: string | undefined;
  for (const unit of course.units) {
    for (const id of [...unit.lessonIds, unit.assessmentId]) {
      if (id === targetId) {
        const target =
          course.lessons.find((l) => l.id === id) ??
          course.assessments.find((a) => a.id === id);
        return (
          target?.stage === "available" &&
          (!previous || passedIds.includes(previous))
        );
      }
      previous = id;
    }
  }
  return false;
}
export function roundResult(course: Course, round: Round): Result {
  const independent = round.questionIds.filter(
    (id) => round.attempts[id]?.correct && !round.attempts[id]?.hinted,
  );
  const lesson = course.lessons.find(
    (l) => round.kind === "lesson" && l.id === round.targetId,
  );
  const summary = lesson && summarize(lesson, course.questions, round.attempts);
  const total = round.questionIds.length;
  const allSubmitted = round.questionIds.every((id) => round.attempts[id]);
  const passed =
    summary?.passed ??
    (allSubmitted &&
      independent.length >= (round.kind === "assessment" ? 4 : 1));
  return {
    roundId: round.id,
    kind: round.kind,
    targetId: round.targetId,
    passed,
    total,
    earned: independent.length,
    coverage: summary?.coverage ?? [],
    xp: round.xp,
  };
}
