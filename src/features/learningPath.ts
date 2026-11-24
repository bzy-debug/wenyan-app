import { course } from "../content";
import { progress } from "../storage/progress";

const targets = new Map(
  [...course.lessons, ...course.assessments].map((target) => [
    target.id,
    target,
  ]),
);
const pathIds = course.units.flatMap((unit) => [
  ...unit.lessonIds,
  unit.assessmentId,
]);

export function currentTarget() {
  const { active, paused, completedIds } = progress.value;
  const rounds = [active, ...paused.slice().reverse()];
  const unfinished = rounds.find(
    (round) =>
      round &&
      (round.kind === "lesson" || round.kind === "assessment") &&
      targets.get(round.targetId)?.stage === "available",
  );
  return (
    unfinished?.targetId ??
    pathIds.find(
      (id) =>
        targets.get(id)?.stage === "available" && !completedIds.includes(id),
    )
  );
}

export function inProgress(id: string) {
  const { active, paused } = progress.value;
  return (
    active?.targetId === id || paused.some((round) => round.targetId === id)
  );
}

export const isDraftCourse = [
  ...course.lessons,
  ...course.assessments,
  ...course.questions,
].some((entry) => entry.status === "draft");
