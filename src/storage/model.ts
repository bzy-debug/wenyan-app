import type { Round, Result } from "../domain/progression";
import type { CardState } from "../domain/review";

export interface Progress {
  completedIds: string[];
  cards: Record<string, CardState>;
  mistakes: string[];
  xp: number;
  days: string[];
  active: Round | null;
  paused: Round[];
  lastResult: Result | null;
}

export function emptyProgress(): Progress {
  return {
    completedIds: [],
    cards: {},
    mistakes: [],
    xp: 0,
    days: [],
    active: null,
    paused: [],
    lastResult: null,
  };
}
