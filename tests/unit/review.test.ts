import { describe, expect, it } from "vitest";
import { course } from "../../src/content";
import {
  currentStreak,
  learnCard,
  nextContext,
  reviewCard,
  shiftDay,
} from "../../src/domain/review";
import {
  roundResult,
  unlocked,
  type Round,
} from "../../src/domain/progression";

describe("知识卡调度", () => {
  it("首次安排次日；到期正确依次延长至六十日并封顶", () => {
    let card = learnCard("2024-02-28", "a");
    expect(card.due).toBe("2024-02-29");
    for (const interval of [3, 7, 14, 30, 60, 60]) {
      const day = card.due;
      card = reviewCard(card, day, "b", true);
      expect(card.due).toBe(shiftDay(day, interval));
    }
    expect(card.level).toBe(5);
  });
  it("同日重复、提前练习不改变等级；到期错答或用提示回到一天", () => {
    const first = learnCard("2024-12-31", "a");
    const reviewed = reviewCard(first, "2025-01-01", "b", true);
    expect(reviewCard(reviewed, "2025-01-01", "c", true)).toBe(reviewed);
    expect(reviewCard(reviewed, "2025-01-02", "c", false)).toBe(reviewed);
    expect(reviewCard(reviewed, "2025-01-06", "c", false)).toEqual({
      due: "2025-01-07",
      lastDay: "2025-01-06",
      lastQuestionId: "c",
      level: 0,
    });
  });
  it("更换阅读语境，候选表末尾循环", () => {
    const card = course.cards[0];
    for (const id of card.questionIds) {
      const next = nextContext(card, id, course.questions);
      const passage = (qid: string) =>
        course.questions.find((q) => q.id === qid)?.passageId;
      expect(passage(next)).not.toBe(passage(id));
    }
  });
  it("连续记录跨年，昨天的记录到今天结束前仍有效", () => {
    const days = ["2024-12-29", "2024-12-31", "2025-01-01"];
    expect(currentStreak(days, "2025-01-01")).toBe(2);
    expect(currentStreak(days, "2025-01-02")).toBe(2);
    expect(currentStreak(days, "2025-01-03")).toBe(0);
  });
});

describe("单元关卡", () => {
  it("前置单元检查控制后续单元入口", () => {
    const ready = structuredClone(course);
    ready.lessons.forEach((l) => (l.stage = "available"));
    ready.assessments.forEach((a) => (a.stage = "available"));
    const first = ready.units[0],
      next = ready.units[1].lessonIds[0];
    expect(unlocked(ready, [], next)).toBe(false);
    expect(unlocked(ready, first.lessonIds, first.assessmentId)).toBe(true);
    expect(unlocked(ready, first.lessonIds, next)).toBe(false);
    expect(
      unlocked(ready, [...first.lessonIds, first.assessmentId], next),
    ).toBe(true);
  });
  it("六题单元检查以四题独立首答为界", () => {
    const assessment = course.assessments[0];
    const ids = assessment.questionIds;
    const round: Round = {
      id: "sample",
      kind: "assessment",
      targetId: assessment.id,
      questionIds: ids,
      index: 5,
      selected: [],
      hinted: false,
      feedback: true,
      xp: 0,
      attempts: {},
    };
    const check = (independent: number) =>
      roundResult(course, {
        ...round,
        attempts: Object.fromEntries(
          ids.map((id, i) => [id, { correct: true, hinted: i >= independent }]),
        ),
      });
    expect(check(4).passed).toBe(true);
    expect(check(3).passed).toBe(false);
  });
});
