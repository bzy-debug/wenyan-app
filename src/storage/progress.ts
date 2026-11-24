import Dexie, { liveQuery, type Table, type Subscription } from "dexie";
import { shallowRef } from "vue";
import { byId, course } from "../content";
import {
  roundResult,
  unlocked,
  type Round,
  type RoundKind,
} from "../domain/progression";
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
const key = "learner";
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
export function isUnlocked(targetId: string): boolean {
  return unlocked(course, progress.value.passedIds, targetId);
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
  if (parsed.active) parsed.active.id = crypto.randomUUID();
  await edit((state) => Object.assign(state, parsed));
}
export async function startRound(
  kind: RoundKind,
  targetId: string,
): Promise<void> {
  await edit((state) => {
    if (state.active?.kind === kind && state.active.targetId === targetId)
      return;
    let questionIds: string[];
    if (kind === "lesson" || kind === "assessment") {
      if (!unlocked(course, state.passedIds, targetId))
        throw new Error("请先通过前一关");
      questionIds =
        kind === "lesson"
          ? byId(course.lessons, targetId).questionIds
          : byId(course.assessments, targetId).questionIds;
    } else if (kind === "review") {
      const card = byId(course.cards, targetId),
        schedule = state.cards[card.id];
      if (!schedule || schedule.due > localDay())
        throw new Error("这张知识卡尚未到期");
      questionIds = [
        nextContext(card, schedule.lastQuestionId, course.questions),
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
      index: kind === "lesson" || kind === "assessment" ? -1 : 0,
      attempts: {},
      selected: [],
      feedback: null,
      hinted: false,
      xp: 0,
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
export async function startQuestions(roundId: string) {
  await edit((state) => {
    const r = requireRound(state, roundId);
    if (r.index === -1) r.index = 0;
  });
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
      throw new Error("无效的选项");
    r.selected = selection;
  });
}
export async function showHint(roundId: string, qid: string) {
  await edit((state) => {
    const r = requireRound(state, roundId, qid);
    if (r.feedback === null) r.hinted = true;
  });
}
function addUnique(items: string[], id: string) {
  if (!items.includes(id)) items.push(id);
}
export async function submitAnswer(roundId: string, qid: string) {
  const expected = progress.value.active?.selected;
  await edit((state) => {
    const r = requireRound(state, roundId, qid);
    if (r.feedback !== null) return;
    const q = byId(course.questions, qid);
    if (r.selected.length !== q.answer.length) throw new Error("请先完成选择");
    if (
      !expected ||
      expected.length !== r.selected.length ||
      !expected.every((id, i) => id === r.selected[i])
    )
      throw new Error("选项已在其他窗口更新，请重新确认");
    const correct = grade(q, r.selected);
    r.feedback = correct;
    if (r.attempts[qid]) return;
    r.attempts = recordFirst(r.attempts, qid, { correct, hinted: r.hinted });
    const independent = correct && !r.hinted;
    const day = localDay();
    addUnique(state.days, day);
    if (!independent) addUnique(state.mistakes, qid);
    if (r.kind === "mistake" && independent)
      state.mistakes = state.mistakes.filter((id) => id !== qid);
    if (r.kind === "review") {
      const previous = state.cards[r.targetId];
      const next = reviewCard(previous, day, qid, independent);
      if (next !== previous && independent) {
        r.xp = 5;
        state.xp += r.xp;
      }
      state.cards[r.targetId] = next;
    } else {
      for (const card of course.cards.filter((c) => c.skillId === q.skillId)) {
        const previous = state.cards[card.id];
        if (previous) previous.lastQuestionId = qid;
        else state.cards[card.id] = learnCard(day, qid);
      }
    }
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
    if (!state.active && state.lastResult?.roundId === roundId) return;
    const r = requireRound(state, roundId, qid);
    if (r.feedback === null) throw new Error("请先提交本题");
    if (r.index + 1 < r.questionIds.length) {
      r.index++;
      r.selected = [];
      r.hinted = false;
      r.feedback = null;
      return;
    }
    const result = roundResult(course, r);
    if (
      (r.kind === "lesson" || r.kind === "assessment") &&
      result.passed &&
      !state.passedIds.includes(r.targetId)
    ) {
      state.passedIds.push(r.targetId);
      result.xp = r.kind === "lesson" ? 20 : 30;
      state.xp += result.xp;
    }
    state.lastResult = result;
    state.active = null;
  });
}
