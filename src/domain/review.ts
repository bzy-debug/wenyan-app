import type { Question, ReviewCard } from "../content/schema";

export const intervals = [1, 3, 7, 14, 30, 60] as const;
export interface CardState {
  level: number;
  due: string;
  lastDay: string;
  lastQuestionId: string;
}

export function localDay(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return [year, month, String(date.getDate()).padStart(2, "0")].join("-");
}

// Stored dates represent local calendar days. UTC arithmetic keeps DST transitions
// from adding or dropping a day when computing an interval between those labels.
export function shiftDay(day: string, amount: number): string {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function learnCard(day: string, questionId: string): CardState {
  return {
    level: 0,
    due: shiftDay(day, 1),
    lastDay: day,
    lastQuestionId: questionId,
  };
}
export function reviewCard(
  previous: CardState,
  day: string,
  questionId: string,
  independent: boolean,
): CardState {
  if (previous.lastDay >= day || previous.due > day) return previous;
  const level = independent
    ? Math.min(previous.level + 1, intervals.length - 1)
    : 0;
  return {
    level,
    due: shiftDay(day, intervals[level]),
    lastDay: day,
    lastQuestionId: questionId,
  };
}
export function nextContext(
  card: ReviewCard,
  previous: string,
  questions: Question[],
): string {
  const ids = card.questionIds;
  const previousIndex = ids.indexOf(previous);
  const priorPassage = questions.find((q) => q.id === previous)?.passageId;
  for (let offset = 1; offset <= ids.length; offset++) {
    const id = ids[(previousIndex + offset) % ids.length];
    if (questions.find((q) => q.id === id)?.passageId !== priorPassage)
      return id;
  }
  throw new Error("知识卡缺少不同语境：" + card.id);
}
export function currentStreak(days: readonly string[], today: string): number {
  const studied = new Set(days);
  let date = studied.has(today) ? today : shiftDay(today, -1);
  let length = 0;
  while (studied.has(date)) {
    length++;
    date = shiftDay(date, -1);
  }
  return length;
}
