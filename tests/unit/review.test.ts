import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { byId, course } from "../../src/content";
import { compileCourse } from "../../src/content/compile";
import { readSources } from "../../src/content/node";
import { plainText } from "../../src/content/passage-text";
import {
  currentStreak,
  learnCard,
  nextContext,
  reviewCard,
  shiftDay,
} from "../../src/domain/review";
import { backupText } from "../../src/storage/backup";
import { emptyProgress } from "../../src/storage/model";
import { importBackup, progress, startRound } from "../../src/storage/progress";
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
  it("只有完成对应的回读课才加入它的题；直接先学回读课仍可从基础题复习", () => {
    const card = {
      id: "card",
      skillId: "skill",
      questionIds: ["base-a", "base-b", "later-c", "later-d"],
      requiredLessonByQuestion: {
        "later-c": "lesson-c",
        "later-d": "lesson-d",
      },
    };
    const text = (id: string) => id;
    expect(nextContext(card, "base-b", text, [])).toBe("base-a");
    expect(nextContext(card, "later-c", text, [])).toBe("base-a");
    expect(nextContext(card, "base-b", text, ["lesson-d"])).toBe("later-d");
    expect(nextContext(card, "base-b", text, ["lesson-c"])).toBe("later-c");
    expect(nextContext(card, "later-c", text, ["lesson-c"])).toBe("base-a");
  });
  it("原课显式选用的跨课题保持可用；自动追加的回读题不能凑够基础语境", () => {
    const docs = readSources("docs/example-course");
    docs["unit.md"] = docs["unit.md"].replace(
      "课序：rise",
      "课序：rise revisit",
    );
    docs["revisit.md"] = `# 课文：再次测温 {#revisit}
简介：比较另一处的早晚记录。
回读：increase coast
## 正文
看看海边的记录。
## 原文：教学例句 {#coast}
> 岸边早晨 9 ℃，傍晚 12 ℃。
译文：海边一天内升温。
## 单选：傍晚气温怎样变化？ {#coast-change}
考点：increase
语境：coast
- [x] 升高
- [ ] 降低
  理由：傍晚较暖。
提示：比较早晚的数值。
解析：十二大于九。`;
    const original = docs["lesson.md"];
    docs["lesson.md"] = original.replace(
      "例句：morning",
      "例句：morning\n复习题：warmer coast-change",
    );
    const [explicit] = compileCourse(docs).cards;
    expect(nextContext(explicit, "warmer", (id) => id, [])).toBe(
      "coast-change",
    );

    docs["lesson.md"] = original.replace(
      "例句：morning",
      "例句：morning\n复习题：warmer",
    );
    expect(() => compileCourse(docs)).toThrow("至少两种无需完成回读课");
  });
  it("每张已编课知识卡在首次接触时已可轮换至少两段不同的基础原文", () => {
    const passages = new Map(
      course.passages.map((p) => [p.id, plainText(p.text)]),
    );
    const texts = new Map(
      course.questions.map((q) => [q.id, passages.get(q.passageId)!]),
    );
    for (const card of course.cards) {
      const base = card.questionIds.filter(
        (id) => !Object.hasOwn(card.requiredLessonByQuestion ?? {}, id),
      );
      const differentTexts = new Set(base.map((id) => texts.get(id)));
      expect(differentTexts.size, card.id).toBeGreaterThanOrEqual(2);
    }
  });
  it("从本地进度发起到期复习时，读过相应一课才会抽到回读题", async () => {
    const card = course.cards.find((c) => c.requiredLessonByQuestion)!;
    const required = card.requiredLessonByQuestion!;
    const base = card.questionIds.filter((id) => !Object.hasOwn(required, id));
    const [firstRevisit] = card.questionIds.filter((id) =>
      Object.hasOwn(required, id),
    );
    for (const completed of [false, true]) {
      const saved = emptyProgress();
      saved.cards[card.id] = learnCard("2020-01-01", base.at(-1)!);
      if (completed) saved.completedIds.push(required[firstRevisit]);
      await importBackup(backupText(saved));
      await startRound("review", card.id);
      const [drawn] = progress.value.active!.questionIds;
      if (completed) expect(drawn).toBe(firstRevisit);
      else expect(base).toContain(drawn);
    }
  });
  it("连续记录跨年，昨天的记录到今天结束前仍有效", () => {
    const days = ["2024-12-29", "2024-12-31", "2025-01-01"];
    expect(currentStreak(days, "2025-01-01")).toBe(2);
    expect(currentStreak(days, "2025-01-02")).toBe(2);
    expect(currentStreak(days, "2025-01-03")).toBe(0);
  });
});
