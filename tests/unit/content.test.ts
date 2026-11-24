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
  const path = [
    ["L1", [1, 2, 3, 4]],
    ["L2", [5, 6, 7, 8, 29, 30, 21, 22, 23, 24, 33, 34, 35]],
    ["L3", [9, 10, 11, 12, 31, 32, 25, 26, 27, 28, 36, 37, 38]],
    ["L4", [13, 14, 15, 16]],
    ["L5", [17, 18, 19, 20]],
  ] as const;
  const levelIds = path.map(([id]) => id);
  expect(course.levels.map((l) => l.id)).toEqual(levelIds);
  expect(course.completeness.map((p) => p.level)).toEqual(levelIds);
  const steps = path.flatMap(([level, ids]) =>
    ids.map((n) => [level, "u." + n]),
  );
  expect(course.units.map((u) => [u.level, u.id])).toEqual(steps);
  expect(course.lessons).toHaveLength(114);
  expect(course.assessments).toHaveLength(38);
  expect(course.questions).toHaveLength(1140);
  for (const [id, units] of path) {
    const members = course.units.filter((u) => u.level === id);
    const lessonIds = new Set(members.flatMap((u) => u.lessonIds));
    const checkIds = new Set(members.map((u) => u.assessmentId));
    const lessons = course.lessons.filter((l) => lessonIds.has(l.id));
    const checks = course.assessments.filter((c) => checkIds.has(c.id));
    expect(
      lessons.every(
        (l) => l.stage === "available" && l.questionIds.length === 8,
      ),
    ).toBe(true);
    expect(
      checks.every(
        (c) => c.stage === "available" && c.questionIds.length === 6,
      ),
    ).toBe(true);
    const questions = [...lessons, ...checks].flatMap((t) => t.questionIds);
    expect(new Set(questions).size).toBe(units.length * 30);
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
