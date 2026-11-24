import type { Lesson, Question } from "../content/schema";

export type FirstAttempt = Readonly<{ correct: boolean; hinted: boolean }>;
export type Attempts = Readonly<Record<string, FirstAttempt>>;
export function grade(question: Question, selected: readonly string[]) {
  return (
    question.answer.length === selected.length &&
    question.answer.every((id, i) => id === selected[i])
  );
}
export function recordFirst(
  previous: Attempts,
  id: string,
  attempt: FirstAttempt,
): Attempts {
  if (previous[id]) return previous;
  return { ...previous, [id]: { ...attempt } };
}
export function summarize(
  lesson: Lesson,
  questions: readonly Question[],
  attempts: Attempts,
) {
  const items = questions.filter((q) => lesson.questionIds.includes(q.id));
  const independent = items.filter(
    (q) => attempts[q.id]?.correct && !attempts[q.id]?.hinted,
  );
  const coverage = lesson.mainSkills.map((id) => ({
    id,
    earned: independent.filter((q) => q.skillId === id).length,
    total: items.filter((q) => q.skillId === id).length,
  }));
  const complete =
    lesson.questionIds.length > 0 &&
    lesson.questionIds.every((id) => attempts[id]);
  return {
    complete,
    earned: independent.length,
    coverage,
    passed:
      complete &&
      independent.length >= lesson.passCount &&
      coverage.every((s) => s.earned > 0),
  };
}
