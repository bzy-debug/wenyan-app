import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, expect, it, vi } from "vitest";
import { byId, course } from "../../src/content";
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
  card = course.cards[0],
  today = () => localDay();
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
  const wrong = q.options.find((o) => !q.answer.includes(o.id))!;
  await submitAnswer(r.id, q.id, [wrong.id]);
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
  const wrong = q.options.find((o) => !q.answer.includes(o.id))!;
  await submitAnswer(r.id, q.id, [wrong.id]);
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
    const wrong =
      q.mode === "order"
        ? [...q.answer].reverse()
        : [q.options.find((o) => !q.answer.includes(o.id))!.id];
    await submitAnswer(r.id, qid, wrong);
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
  for (const raw of [badIndex, wrongCourse]) {
    await expect(importBackup(JSON.stringify(raw))).rejects.toThrow();
    expect(await exportBackup()).toBe(prior);
  }
});
it("老备份与 IndexedDB 记录可迁移，保留旧 XP、已通过关卡及上次完成的课", async () => {
  const { completedIds: _ids, paused: _paused, ...rest } = emptyProgress();
  const state = {
    ...rest,
    passedIds: [lesson.id],
    xp: 20,
    lastResult: {
      kind: "lesson",
      roundId: "r1",
      targetId: course.lessons[1].id,
      total: 8,
      earned: 0,
      passed: false,
      xp: 0,
      coverage: course.lessons[1].mainSkills.map((id) => ({
        id,
        earned: 0,
        total: 4,
      })),
    },
  };
  const text = JSON.stringify({
    format: "wenyan-progress",
    courseVersion: course.version,
    courseId: course.id,
    version: 2,
    progress: state,
  });
  expect(validateBackup(text).completedIds).toEqual([
    lesson.id,
    course.lessons[1].id,
  ]);
  const legacy = new Dexie("wenyan-learning");
  legacy.version(1).stores({ progress: "key" });
  const key = course.id + ":v" + course.version;
  try {
    const row = await legacy.table("progress").get(key);
    await legacy
      .table("progress")
      .put({ key, revision: row.revision + 1, state });
    await initProgress();
    expect(progress.value.completedIds).toEqual([
      lesson.id,
      course.lessons[1].id,
    ]);
    expect(progress.value.xp).toBe(20);
    expect(JSON.parse(await exportBackup()).version).toBe(3);
  } finally {
    legacy.close();
  }
});
