import { expect, it } from "vitest";
import { course as raw } from "../../src/content";
import type { Course } from "../../src/content/schema";
import {
  validateCompleteness,
  validateCourse,
} from "../../src/content/validate";
it("五级阅读路径完整，每一级的课次与检查齐全，所有练习归属明确", () => {
  const course = validateCourse(raw);
  expect(() => validateCompleteness(course)).not.toThrow();
  const levels = ["L1", "L2", "L3", "L4", "L5"];
  expect(course.levels.map((level) => level.id)).toEqual(levels);
  expect(course.completeness).toEqual(
    levels.map((level) => ({
      level,
      units: 4,
      lessonsPerUnit: 3,
      lessonSize: 8,
      checkSize: 6,
      questions: 120,
    })),
  );
  expect(course.units).toHaveLength(20);
  expect(course.lessons).toHaveLength(60);
  expect(course.assessments).toHaveLength(20);
  expect(course.questions).toHaveLength(600);
  expect(new Set(course.questions.map((q) => q.mode))).toEqual(
    new Set(["choice", "span", "order"]),
  );
  for (const [index, unit] of course.units.entries()) {
    expect(unit.level).toBe(levels[Math.floor(index / 4)]);
    expect(unit.id).toBe("u." + (index + 1));
    const lessons = course.lessons.filter((lesson) =>
      unit.lessonIds.includes(lesson.id),
    );
    const check = course.assessments.find(
      (check) => check.id === unit.assessmentId,
    )!;
    const ids = new Set(
      [...lessons, check].flatMap((target) => target.questionIds),
    );
    expect(ids.size).toBe(30);
    const exercises = course.questions.filter((q) => ids.has(q.id));
    const texts = new Set(exercises.map((q) => q.passageId));
    expect(
      course.passages.some((p) => texts.has(p.id) && p.glosses.length > 0),
      unit.title + " 可在原句中查词",
    ).toBe(true);
    const cited = course.passages.filter(
      (p) => texts.has(p.id) && p.kind === "source",
    );
    expect(cited.length, unit.title + " 应让读者练读古籍原文").toBeGreaterThan(
      0,
    );
    for (const p of cited) expect(p.source?.url, p.id).toMatch(/^https:\/\//);
    for (const lesson of lessons)
      expect(lesson.body.trim(), lesson.title).not.toBe("");
    const choiceQuestions = exercises.filter((q) => q.mode === "choice");
    const positions = new Set(
      choiceQuestions.map((q) =>
        q.options.findIndex((o) => o.id === q.answer[0]),
      ),
    );
    expect(positions.size, unit.title + " 的单选正确答案位置").toBeGreaterThan(
      1,
    );
  }
});
it.each([
  [
    "重复使用计分题",
    (c: Course) => {
      c.lessons[1].questionIds[0] = c.lessons[0].questionIds[0];
    },
  ],
  [
    "单元检查混入其他单元技能",
    (c: Course) => {
      const [left, right] = c.assessments.map((a) => a.questionIds);
      [left[0], right[0]] = [right[0], left[0]];
    },
  ],
  [
    "已发布题目引用草稿原文",
    (c: Course) => {
      c.questions[0].reviewer = "测试用审核人";
      c.questions[0].status = "published";
    },
  ],
  [
    "重复 ID",
    (c: Course) => {
      c.questions[1].id = c.questions[0].id;
    },
  ],
  [
    "无效引用",
    (c: Course) => {
      c.units[0].lessonIds[0] = "missing";
    },
  ],
  [
    "越界选段",
    (c: Course) => {
      const span = c.spans[0];
      span.end =
        c.passages.find((p) => p.id === span.passageId)!.text.length + 1;
    },
  ],
  [
    "答案不存在",
    (c: Course) => {
      c.questions[0].answer = ["bad"];
    },
  ],
  [
    "排序缺项",
    (c: Course) => {
      c.questions.find((q) => q.mode === "order")!.answer.pop();
    },
  ],
  [
    "缺乏多语境",
    (c: Course) => {
      c.cards[0].questionIds = c.cards[0].questionIds.slice(0, 1);
    },
  ],
  [
    "首课缺题",
    (c: Course) => {
      c.lessons[0].questionIds.pop();
    },
  ],
  [
    "未覆盖的主要义项",
    (c: Course) => {
      c.skills.push({ ...c.skills[0], id: "extra" });
      c.lessons[0].mainSkills.push("extra");
      c.lessons[0].exampleIds.push(c.lessons[1].exampleIds[0]);
    },
  ],
  [
    "未经审核发布",
    (c: Course) => {
      c.questions[0].status = "published";
    },
  ],
  [
    "古籍无出处",
    (c: Course) => {
      delete c.passages.find((p) => p.kind === "source")!.source;
    },
  ],
] as const)("拒绝%s", (_, mutate) => {
  const copy = validateCourse(raw);
  mutate(copy);
  expect(() => validateCourse(copy)).toThrow();
});
