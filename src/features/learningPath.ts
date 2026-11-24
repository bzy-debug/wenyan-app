import { course } from "../content";
import type { Course } from "../content/schema";
import { progress } from "../storage/progress";

export function buildLearningPath(source: Course) {
  const lessons = source.lessons.filter(
    (lesson) => lesson.stage === "available",
  );
  const assessments = source.assessments.filter(
    (check) => check.stage === "available",
  );
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const checkById = new Map(assessments.map((check) => [check.id, check]));
  const units = source.units
    .map(({ lessonIds, assessmentId, ...unit }) => ({
      ...unit,
      lessons: lessonIds.flatMap((id) => lessonById.get(id) ?? []),
      assessment: checkById.get(assessmentId),
    }))
    .filter((unit) => unit.lessons.length || unit.assessment);
  const levels = source.levels
    .map((level) => ({
      ...level,
      units: units.filter((unit) => unit.level === level.id),
    }))
    .filter((level) => level.units.length);
  return { levels, units, lessons, assessments };
}

export const learningPath = buildLearningPath(course);
export type LearningUnit = (typeof learningPath.units)[number];

const unitByTarget = new Map<string, LearningUnit>();
for (const unit of learningPath.units) {
  for (const lesson of unit.lessons) unitByTarget.set(lesson.id, unit);
  if (unit.assessment) unitByTarget.set(unit.assessment.id, unit);
}

export function currentTarget() {
  const { active, paused, completedIds } = progress.value;
  const rounds = [active, ...paused.slice().reverse()];
  const unfinished = rounds.find(
    (round) =>
      round &&
      (round.kind === "lesson" || round.kind === "assessment") &&
      unitByTarget.has(round.targetId),
  );
  return (
    unfinished?.targetId ??
    Array.from(unitByTarget.keys()).find((id) => !completedIds.includes(id))
  );
}

export function completedCount(targets: { id: string }[]) {
  return targets.filter((target) =>
    progress.value.completedIds.includes(target.id),
  ).length;
}

export function inProgress(id: string) {
  const { active, paused } = progress.value;
  return (
    active?.targetId === id || paused.some((round) => round.targetId === id)
  );
}

export function unitOfTarget(id: string | undefined) {
  return id ? unitByTarget.get(id) : undefined;
}

export function levelOfTarget(id: string | undefined) {
  return unitOfTarget(id)?.level;
}
