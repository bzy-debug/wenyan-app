import { course } from "../content";
import { isUnlocked, progress } from "../storage/progress";

export function currentTarget() {
  const round = progress.value.active;
  if (round?.kind === "lesson" || round?.kind === "assessment")
    return round.targetId;
  for (const unit of course.units) {
    const next = [...unit.lessonIds, unit.assessmentId].find(
      (id) => isUnlocked(id) && !progress.value.passedIds.includes(id),
    );
    if (next) return next;
  }
}

export const isDraftCourse = [
  ...course.lessons,
  ...course.assessments,
  ...course.questions,
].some((entry) => entry.status === "draft");
