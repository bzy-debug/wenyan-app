import type { Question } from "../content/schema";

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
