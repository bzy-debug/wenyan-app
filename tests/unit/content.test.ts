import { expect, it } from "vitest";
import { course as raw } from "../../src/content";
import type { Course } from "../../src/content/schema";
import {
  validateCompleteness,
  validateCourse,
} from "../../src/content/validate";
it("L1 四单元全部可学并有 120 道独立计分题", () => {
  const course = validateCourse(raw);
  expect(() => validateCompleteness(course)).not.toThrow();
  expect(course.units.filter((u) => u.level === "L1")).toHaveLength(4);
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
      c.spans[0].end = 900;
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
      c.questions[5].answer.pop();
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
      c.passages[0].kind = "source";
    },
  ],
] as const)("拒绝%s", (_, mutate) => {
  const copy = validateCourse(raw);
  mutate(copy);
  expect(() => validateCourse(copy)).toThrow();
});
