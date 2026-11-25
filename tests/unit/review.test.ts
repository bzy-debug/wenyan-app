import { describe, expect, it } from "vitest";
import { byId, course } from "../../src/content";
import {
  currentStreak,
  learnCard,
  nextContext,
  reviewCard,
  shiftDay,
} from "../../src/domain/review";
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
  it("提前独立练习只更新语境，错误或受助将下次提前到明天，同日不会反复进阶", () => {
    const first = learnCard("2024-12-31", "a");
    const reviewed = reviewCard(first, "2025-01-01", "b", true);
    expect(reviewCard(reviewed, "2025-01-01", "c", true)).toEqual({
      ...reviewed,
      lastQuestionId: "c",
    });
    const early = reviewCard(reviewed, "2025-01-02", "c", false);
    expect(early).toEqual({
      due: "2025-01-03",
      lastDay: "2025-01-02",
      lastQuestionId: "c",
      level: 0,
    });
    expect(reviewCard(early, "2025-01-02", "d", true)).toMatchObject({
      level: 0,
      due: early.due,
    });
    expect(reviewCard(reviewed, "2025-01-01", "d", false)).toMatchObject({
      level: 0,
      due: "2025-01-02",
    });
    expect(reviewCard(reviewed, "2024-12-30", "c", false)).toMatchObject({
      level: 1,
      due: "2025-01-04",
    });
  });
  it("更换阅读语境，候选表末尾循环", () => {
    const card = course.cards[0];
    const passage = (qid: string) =>
      byId(course.passages, byId(course.questions, qid).passageId).text;
    for (const id of card.questionIds) {
      expect(passage(nextContext(card, id, passage))).not.toBe(passage(id));
    }
  });
  it("同文异标点的两个摘录仍算同一语境", () => {
    const card = { id: "hear", skillId: "hear", questionIds: ["a", "b", "c"] };
    const texts: Record<string, string> = {
      a: "闻声而起。",
      b: "闻声，而起！",
      c: "夜深，闻犬吠于门外。",
    };
    const passage = (id: string) => texts[id];
    expect(nextContext(card, "a", passage)).toBe("c");
    expect(nextContext(card, "c", passage)).toBe("a");
    expect(() =>
      nextContext({ ...card, questionIds: ["a", "b"] }, "a", passage),
    ).toThrow("不同语境");
  });
  it("连续记录跨年，昨天的记录到今天结束前仍有效", () => {
    const days = ["2024-12-29", "2024-12-31", "2025-01-01"];
    expect(currentStreak(days, "2025-01-01")).toBe(2);
    expect(currentStreak(days, "2025-01-02")).toBe(2);
    expect(currentStreak(days, "2025-01-03")).toBe(0);
  });
});
