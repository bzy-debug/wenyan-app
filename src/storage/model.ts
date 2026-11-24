import type { Round, Result } from "../domain/progression";
import type { CardState } from "../domain/review";

export interface Progress {
  passedIds: string[];
  cards: Record<string, CardState>;
  mistakes: string[];
  xp: number;
  days: string[];
  active: Round | null;
  lastResult: Result | null;
}

export function emptyProgress(): Progress {
  return {
    passedIds: [],
    cards: {},
    mistakes: [],
    xp: 0,
    days: [],
    active: null,
    lastResult: null,
  };
}
