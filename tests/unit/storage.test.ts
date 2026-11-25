import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, expect, it, vi } from "vitest";
import { byId, course } from "../../src/content";
import type { Question } from "../../src/content/schema";
import { learnCard, localDay, shiftDay } from "../../src/domain/review";
import { backupText } from "../../src/storage/backup";
import { emptyProgress } from "../../src/storage/model";
import {
  progress,
  initProgress,
  importBackup,
  exportBackup,
  validateBackup,
  startRound,
  selectAnswer,
  submitAnswer,
  retryAnswer,
  revealAnswer,
  advance,
  dueCards,
  streak,
} from "../../src/storage/progress";

const lesson = course.lessons[0],
  initial = byId(course.questions, lesson.questionIds[0]),
  card = course.cards.find((card) => card.skillId === initial.skillId)!,
  today = () => localDay();
function wrongAnswer(q: Question) {
  return q.mode === "order"
    ? [...q.answer].reverse()
    : [q.options.find((option) => !q.answer.includes(option.id))!.id];
}
beforeEach(async () => {
  await initProgress();
  await importBackup(backupText(emptyProgress()));
});
async function begin(
  kind: "lesson" | "assessment" | "review" | "mistake" = "lesson",
  targetId = lesson.id,
) {
  await startRound(kind, targetId);
  return progress.value.active!;
}
it("自由选择任意课程、检查，切课后保留选择、提示与首答", async () => {
  const last = course.lessons.at(-1)!;
  const original = await begin("lesson", last.id);
  expect(original.index).toBe(0);
  const q = byId(course.questions, original.questionIds[0]);
  await revealAnswer(original.id, q.id);
  const check = await begin("assessment", course.assessments.at(-1)!.id);
  await expect(revealAnswer(check.id, check.questionIds[0])).rejects.toThrow(
    "单元自测需要你自己作答",
  );
  const checkQ = byId(course.questions, check.questionIds[0]);
  await selectAnswer(check.id, checkQ.id, checkQ.answer);
  await expect(advance(original.id, q.id)).rejects.toThrow("已更新");
  const resume = await begin("lesson", last.id);
  expect(resume).toMatchObject({
    id: original.id,
    index: 0,
    feedback: false,
    selected: [],
    hinted: true,
    attempts: { [q.id]: { correct: false, hinted: true } },
  });
  const saved = await exportBackup();
  expect(validateBackup(saved).paused[0]).toMatchObject({
    id: check.id,
    selected: checkQ.answer,
  });
  await importBackup(saved);
  const restored = await begin("assessment", check.targetId);
  expect(restored.id).not.toBe(check.id);
  await expect(submitAnswer(check.id, checkQ.id)).rejects.toThrow();
  await submitAnswer(restored.id, checkQ.id);
  expect(progress.value.active?.feedback).toBe(true);
});
it("先求助不记为错题，重试选错才加入；只揭示订正答案不移除", async () => {
  const r = await begin(),
    q = byId(course.questions, r.questionIds[0]);
  await revealAnswer(r.id, q.id);
  expect(progress.value.mistakes).toEqual([]);
  await retryAnswer(r.id, q.id);
  await submitAnswer(r.id, q.id, wrongAnswer(q));
  expect(progress.value.mistakes).toEqual([q.id]);
  const correction = await begin("mistake", q.id);
  await revealAnswer(correction.id, q.id);
  await advance(correction.id, q.id);
  expect(progress.value.mistakes).toEqual([q.id]);
  expect(progress.value.lastResult?.xp).toBe(5);
});
it("错答后重试与备份恢复保留第一次证据，不影响奖励", async () => {
  const r = await begin();
  const q = byId(course.questions, r.questionIds[0]);
  await submitAnswer(r.id, q.id, wrongAnswer(q));
  await retryAnswer(r.id, q.id);
  await submitAnswer(r.id, q.id, q.answer);
  const saved = validateBackup(await exportBackup());
  expect(saved.active?.feedback).toBe(true);
  expect(saved.active?.attempts[q.id]).toEqual({
    correct: false,
    hinted: false,
  });
  expect(saved.mistakes).toContain(q.id);
  expect(saved.cards[card.id].due).toBe(shiftDay(today(), 1));
  expect(streak()).toBe(1);
});
it("全部求助与全部独立完成的课程各获相同 XP，并发结算仅记一次", async () => {
  for (const helped of [true, false]) {
    const r = await begin();
    for (const qid of r.questionIds) {
      const act = () =>
        helped
          ? revealAnswer(r.id, qid)
          : submitAnswer(r.id, qid, byId(course.questions, qid).answer);
      await Promise.all([act(), act()]);
      if (qid === r.questionIds.at(-1))
        await Promise.all([advance(r.id, qid), advance(r.id, qid)]);
      else await advance(r.id, qid);
    }
    expect(progress.value.xp).toBe(helped ? 20 : 40);
    expect(validateBackup(await exportBackup()).lastResult?.xp).toBe(20);
  }
  expect(progress.value.completedIds).toEqual([lesson.id]);
});
it("六题单元检查全答错仍完成并领全额经验", async () => {
  const r = await begin("assessment", course.assessments[0].id);
  for (const qid of r.questionIds) {
    const q = byId(course.questions, qid);
    await submitAnswer(r.id, qid, wrongAnswer(q));
    await advance(r.id, qid);
  }
  expect(progress.value.completedIds).toEqual([r.targetId]);
  expect(progress.value.lastResult).toMatchObject({ total: 6, xp: 30 });
});
it.each([true, false])(
  "今天要复习换语境；是否查看答案 %s 不影响 XP",
  async (helped) => {
    const p = emptyProgress(),
      prior = card.questionIds[0];
    p.cards[card.id] = learnCard(shiftDay(today(), -1), prior);
    await importBackup(backupText(p));
    expect(dueCards().map((c) => c.id)).toContain(card.id);
    const r = await begin("review", card.id),
      q = byId(course.questions, r.questionIds[0]);
    expect(q.passageId).not.toBe(byId(course.questions, prior).passageId);
    if (helped) await revealAnswer(r.id, q.id);
    else await submitAnswer(r.id, q.id, q.answer);
    await advance(r.id, q.id);
    expect(progress.value.xp).toBe(5);
    expect(progress.value.cards[card.id]).toMatchObject({
      level: helped ? 0 : 1,
      due: shiftDay(today(), helped ? 1 : 3),
    });
    expect(dueCards()).toHaveLength(0);
  },
);
it("普通关卡可使到期卡进阶；纠错重试保留首答与次日安排", async () => {
  const p = emptyProgress(),
    qid = lesson.questionIds[0];
  p.cards[card.id] = learnCard(shiftDay(today(), -1), qid);
  p.mistakes = [qid];
  await importBackup(backupText(p));
  const r = await begin();
  const q = byId(course.questions, qid);
  await submitAnswer(r.id, qid, q.answer);
  expect(progress.value.cards[card.id]).toMatchObject({
    level: 1,
    due: shiftDay(today(), 3),
  });
  const correction = await begin("mistake", qid);
  await revealAnswer(correction.id, qid);
  await retryAnswer(correction.id, qid);
  await submitAnswer(correction.id, qid, q.answer);
  await advance(correction.id, qid);
  expect(progress.value.cards[card.id]).toMatchObject({
    level: 0,
    due: shiftDay(today(), 1),
  });
  expect(progress.value.mistakes).toEqual([]);
  expect(progress.value.lastResult?.xp).toBe(5);
});
it("跨日完成记录当天学习活动", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date(2026, 2, 2, 23, 59));
    const r = await begin();
    for (const qid of r.questionIds) {
      await revealAnswer(r.id, qid);
      if (qid === r.questionIds.at(-1))
        vi.setSystemTime(new Date(2026, 2, 3, 0, 1));
      await advance(r.id, qid);
    }
    expect(progress.value.days).toEqual(["2026-03-02", "2026-03-03"]);
    expect(streak()).toBe(2);
  } finally {
    vi.useRealTimers();
  }
});
it("无效备份和其他课程备份均不覆盖原进度", async () => {
  await begin();
  const prior = await exportBackup();
  const badIndex = JSON.parse(prior);
  badIndex.progress.active.index = 100;
  const wrongCourse = { ...JSON.parse(prior), courseId: "other" };
  const obsolete = { ...JSON.parse(prior), version: 2 };
  for (const raw of [badIndex, wrongCourse, obsolete]) {
    await expect(importBackup(JSON.stringify(raw))).rejects.toThrow();
    expect(await exportBackup()).toBe(prior);
  }
});

it("同一浏览器中的另一门课程既不计入当前进度，也不被备份恢复覆盖", async () => {
  const db = new Dexie("wenyan-learning");
  db.version(1).stores({ progress: "key" });
  const row = {
    key: "another-course:v1",
    revision: 1,
    state: { ...emptyProgress(), xp: 75 },
  };
  try {
    await db.table("progress").put(row);
    await initProgress();
    expect(progress.value.xp).toBe(0);
    const round = await begin();
    for (const id of round.questionIds) {
      await submitAnswer(round.id, id, byId(course.questions, id).answer);
      await advance(round.id, id);
    }
    const saved = await exportBackup();
    await importBackup(backupText(emptyProgress()));
    await importBackup(saved);
    expect(validateBackup(await exportBackup()).xp).toBe(20);
    expect(await db.table("progress").get(row.key)).toEqual(row);
  } finally {
    db.close();
  }
});

it("题目下架后从本课首题继续，保留其余会话、复习计划和经验", async () => {
  const old = "q.story.l3.1.2";
  const target = byId(course.lessons, "l3.1");
  const affectedCard = course.cards.find(
    (entry) => entry.skillId === "skill.story.l3.1.1",
  )!;
  const check = byId(course.assessments, "check.17");
  const other = await begin();
  await selectAnswer(other.id, initial.id, initial.answer);
  const testRound = await begin("assessment", check.id);
  const practice = await begin("lesson", target.id);
  const priorDay = shiftDay(today(), -1);
  const db = new Dexie("wenyan-learning");
  db.version(1).stores({ progress: "key" });
  try {
    const records = db.table("progress");
    const row = await records.get(`${course.id}:v${course.version}`);
    const historical = validateBackup(await exportBackup());
    historical.active!.questionIds[1] = old;
    historical.active!.index = 1;
    historical.active!.attempts = {
      [practice.questionIds[0]]: { correct: true, hinted: false },
    };
    historical.paused.find((r) => r.id === testRound.id)!.questionIds[5] =
      "q.check.17.6";
    historical.paused.push({
      ...practice,
      id: "old-mistake",
      kind: "mistake",
      targetId: old,
      questionIds: [old],
    });
    historical.cards[affectedCard.id] = learnCard(priorDay, old);
    historical.paused.push({
      ...practice,
      id: "old-review",
      kind: "review",
      targetId: affectedCard.id,
      questionIds: [old],
    });
    historical.mistakes = [old, initial.id];
    historical.xp = 25;
    historical.days = [priorDay];
    historical.completedIds = [lesson.id];
    historical.lastResult = {
      kind: "mistake",
      roundId: "older-result",
      targetId: old,
      total: 1,
      xp: 5,
    };
    await records.put({
      ...row,
      revision: row.revision + 1,
      state: historical,
    });
    await initProgress();

    const restored = validateBackup(await exportBackup());
    expect(restored).toMatchObject({
      mistakes: [initial.id],
      xp: 25,
      days: [priorDay],
      completedIds: [lesson.id],
      lastResult: null,
      active: {
        kind: "lesson",
        targetId: target.id,
        questionIds: target.questionIds,
        index: 0,
        attempts: {},
      },
    });
    expect(restored.active!.id).not.toBe(practice.id);
    expect(restored.paused).toHaveLength(2);
    expect(restored.paused[0]).toMatchObject({
      id: other.id,
      selected: initial.answer,
    });
    expect(restored.paused[1]).toMatchObject({
      targetId: check.id,
      questionIds: check.questionIds,
    });
    expect(restored.cards[affectedCard.id]).toEqual({
      ...learnCard(priorDay, old),
      lastQuestionId: "",
    });
    await expect(
      submitAnswer(practice.id, practice.questionIds[0]),
    ).rejects.toThrow("已更新");
    const review = await begin("review", affectedCard.id);
    expect(affectedCard.questionIds).toContain(review.questionIds[0]);
    const corrected = await begin("mistake", initial.id);
    expect(corrected.questionIds).toEqual([initial.id]);
    const resume = await begin("lesson", target.id);
    expect(resume.id).toBe(restored.active!.id);
  } finally {
    db.close();
  }
});
