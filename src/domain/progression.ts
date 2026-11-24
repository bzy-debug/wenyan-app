import type { Attempts } from "./session";

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
  /** XP already credited by an older app before this round finished. */
  xp: number;
}
export interface Result {
  roundId: string;
  kind: RoundKind;
  targetId: string;
  total: number;
  xp: number;
}

const reward: Record<RoundKind, number> = {
  lesson: 20,
  assessment: 30,
  review: 5,
  mistake: 5,
};

export function roundResult(round: Round): Result {
  if (
    !round.questionIds.length ||
    !round.questionIds.every((id) => Object.hasOwn(round.attempts, id))
  ) {
    throw new Error("请先完成本轮题目");
  }
  return {
    roundId: round.id,
    kind: round.kind,
    targetId: round.targetId,
    total: round.questionIds.length,
    xp: reward[round.kind],
  };
}
