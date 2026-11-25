import Dexie, { liveQuery, type Table, type Subscription } from "dexie";
import { shallowRef } from "vue";
import { byId, course } from "../content";
import { roundResult, type Round, type RoundKind } from "../domain/progression";
import {
  currentStreak,
  learnCard,
  localDay,
  nextContext,
  reviewCard,
} from "../domain/review";
import { grade, recordFirst } from "../domain/session";
import { backupText, validateBackup } from "./backup";
import { emptyProgress, type Progress } from "./model";

export { validateBackup };
export type { Progress };
interface Row {
  key: string;
  revision: number;
  state: Progress;
}

const db = new Dexie("wenyan-learning");
db.version(1).stores({ progress: "key" });
const records: Table<Row, string> = db.table("progress");
const key = `${course.id}:v${course.version}`;
export const progress = shallowRef<Progress>(emptyProgress());
const today = shallowRef(localDay());
let revision = -1;
let observer: Subscription | undefined;
let dateTimer: ReturnType<typeof setInterval> | undefined;
function updateDay() {
  today.value = localDay();
}
function publish(row: Row | undefined) {
  if (row && row.revision > revision) {
    revision = row.revision;
    progress.value = row.state;
  }
  updateDay();
}
export async function initProgress(): Promise<void> {
  publish(await records.get(key));
  observer ??= liveQuery(() => records.get(key)).subscribe(publish);
  if (!dateTimer && typeof window !== "undefined") {
    dateTimer = setInterval(updateDay, 30_000);
    window.addEventListener("focus", updateDay);
  }
}
async function edit(fn: (state: Progress) => void) {
  const row = await db.transaction("rw", records, async () => {
    const previous = await records.get(key);
    const state = previous?.state ?? emptyProgress();
    fn(state);
    const next: Row = { key, revision: (previous?.revision ?? -1) + 1, state };
    await records.put(next);
    return next;
  });
  publish(row);
}
export function dueCards() {
  const records = progress.value.cards;
  return course.cards
    .filter((c) => records[c.id]?.due <= today.value)
    .sort((a, b) => records[a.id].due.localeCompare(records[b.id].due));
}
export function streak(): number {
  return currentStreak(progress.value.days, today.value);
}
export async function exportBackup(): Promise<string> {
  return backupText((await records.get(key))?.state ?? emptyProgress());
}
export async function importBackup(text: string): Promise<void> {
  const parsed = validateBackup(text);
  // An open tab from before a restore must not apply an in-flight answer to
  // the restored copy of an old round.
  for (const round of [
    ...parsed.paused,
    ...(parsed.active ? [parsed.active] : []),
  ]) {
    round.id = crypto.randomUUID();
  }
  await edit((state) => Object.assign(state, parsed));
}
export async function startRound(
  kind: RoundKind,
  targetId: string,
): Promise<void> {
  await edit((state) => {
    if (state.active?.kind === kind && state.active.targetId === targetId)
      return;
    const pausedIndex = state.paused.findIndex(
      (r) => r.kind === kind && r.targetId === targetId,
    );
    if (state.active) state.paused.push(state.active);
    if (pausedIndex !== -1) {
      state.active = state.paused.splice(pausedIndex, 1)[0];
      return;
    }
    let questionIds: string[];
    if (kind === "lesson" || kind === "assessment") {
      const target =
        kind === "lesson"
          ? byId(course.lessons, targetId)
          : byId(course.assessments, targetId);
      if (target.stage !== "available" || !target.questionIds.length)
        throw new Error("这份练习尚未开放");
      questionIds = target.questionIds;
    } else if (kind === "review") {
      const card = byId(course.cards, targetId),
        schedule = state.cards[card.id];
      if (!schedule || schedule.due > localDay())
        throw new Error("这张知识卡尚未到期");
      questionIds = [
        nextContext(card, schedule.lastQuestionId, (id) => {
          const question = byId(course.questions, id);
          return byId(course.passages, question.passageId).text;
        }),
      ];
    } else {
      if (!state.mistakes.includes(targetId)) throw new Error("这道题已经订正");
      questionIds = [byId(course.questions, targetId).id];
    }
    state.active = {
      id: crypto.randomUUID(),
      kind,
      targetId,
      questionIds: [...questionIds],
      index: 0,
      attempts: {},
      selected: [],
      feedback: null,
      hinted: false,
    };
  });
}
function requireRound(state: Progress, roundId: string, qid?: string): Round {
  const round = state.active;
  if (
    !round ||
    round.id !== roundId ||
    (qid !== undefined && round.questionIds[round.index] !== qid)
  )
    throw new Error("学习进度已更新，请查看当前题目");
  return round;
}
export async function selectAnswer(
  roundId: string,
  qid: string,
  ids: string[],
) {
  const selection = [...ids];
  await edit((state) => {
    const r = requireRound(state, roundId, qid);
    if (r.feedback !== null) return;
    const q = byId(course.questions, qid);
    if (
      selection.length > q.answer.length ||
      new Set(selection).size !== selection.length ||
      !selection.every((id) => q.options.some((o) => o.id === id))
    )
      throw new Error("这个选项不在题目里");
    r.selected = selection;
  });
}
function addUnique(items: string[], id: string) {
  if (!items.includes(id)) items.push(id);
}

function recordResponse(
  state: Progress,
  round: Round,
  qid: string,
  correct: boolean,
) {
  round.feedback = correct;
  // A successful correction can retire a practice item; retries never rewrite
  // the original evidence or change a card's interval for this question.
  if (!correct && round.selected.length) addUnique(state.mistakes, qid);
  if (round.kind === "mistake" && correct)
    state.mistakes = state.mistakes.filter((id) => id !== qid);
  if (Object.hasOwn(round.attempts, qid)) return;
  round.attempts = recordFirst(round.attempts, qid, {
    correct,
    hinted: round.hinted,
  });
  const independent = correct && !round.hinted;
  const day = localDay();
  addUnique(state.days, day);
  const q = byId(course.questions, qid);
  for (const card of course.cards.filter((c) => c.skillId === q.skillId)) {
    const previous = state.cards[card.id];
    state.cards[card.id] = previous
      ? reviewCard(previous, day, qid, independent)
      : learnCard(day, qid);
  }
}

export async function revealAnswer(roundId: string, qid: string) {
  await edit((state) => {
    const r = requireRound(state, roundId, qid);
    if (r.kind === "assessment") throw new Error("单元自测需要你自己作答");
    if (r.feedback !== null) return;
    r.hinted = true;
    r.selected = [];
    recordResponse(state, r, qid, false);
  });
}

export async function submitAnswer(
  roundId: string,
  qid: string,
  ids?: string[],
) {
  const expected = progress.value.active?.selected;
  const selected = ids && [...ids];
  await edit((state) => {
    const r = requireRound(state, roundId, qid);
    if (r.feedback !== null) return;
    const q = byId(course.questions, qid);
    if (
      !selected &&
      (!expected ||
        expected.length !== r.selected.length ||
        !expected.every((id, i) => id === r.selected[i]))
    )
      throw new Error("另一个窗口改过这道题的选择。请确认后再提交。");
    const answer = selected ?? r.selected;
    if (
      answer.length !== q.answer.length ||
      new Set(answer).size !== answer.length ||
      !answer.every((id) => q.options.some((o) => o.id === id))
    )
      throw new Error("选好答案后再提交");
    r.selected = answer;
    recordResponse(state, r, qid, grade(q, answer));
  });
}
export async function retryAnswer(roundId: string, qid: string) {
  await edit((state) => {
    const r = requireRound(state, roundId, qid);
    if (r.feedback !== false) return;
    r.selected = [];
    r.feedback = null;
  });
}
export async function advance(roundId: string, qid: string) {
  await edit((state) => {
    if (state.lastResult?.roundId === roundId) return;
    const r = requireRound(state, roundId, qid);
    if (r.feedback === null) throw new Error("请先提交这道题的答案");
    if (r.index + 1 < r.questionIds.length) {
      r.index++;
      r.selected = [];
      r.hinted = false;
      r.feedback = null;
      return;
    }
    const result = roundResult(r);
    if (r.kind === "lesson" || r.kind === "assessment")
      addUnique(state.completedIds, r.targetId);
    addUnique(state.days, localDay());
    state.xp += result.xp;
    state.lastResult = result;
    state.active = null;
  });
}
