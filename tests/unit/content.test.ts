import { expect, it } from "vitest";
import raw from "../../content/v1/course.json";
import { validateCourse } from "../../src/content/validate";
it("只有完整的第一课可以学习", () => {
  const c = validateCourse(raw);
  expect(
    c.lessons
      .filter((l) => l.stage === "available")
      .map((l) => l.questionIds.length),
  ).toEqual([8]);
  expect(c.questions.every((q) => q.status === "draft")).toBe(true);
});
it.each([
  [
    "重复 ID",
    (c: typeof raw) => {
      c.questions[1].id = c.questions[0].id;
    },
  ],
  [
    "无效引用",
    (c: typeof raw) => {
      c.units[0].lessonIds[0] = "missing";
    },
  ],
  [
    "越界选段",
    (c: typeof raw) => {
      c.spans[0].end = 900;
    },
  ],
  [
    "答案不存在",
    (c: typeof raw) => {
      c.questions[0].answer = ["bad"];
    },
  ],
  [
    "排序缺项",
    (c: typeof raw) => {
      c.questions[5].answer.pop();
    },
  ],
  [
    "缺乏多语境",
    (c: typeof raw) => {
      c.cards[0].questionIds = c.cards[0].questionIds.slice(0, 1);
    },
  ],
  [
    "首课缺题",
    (c: typeof raw) => {
      c.lessons[0].questionIds!.pop();
    },
  ],
  [
    "未覆盖的主要义项",
    (c: typeof raw) => {
      c.skills.push({ ...c.skills[0], id: "extra" });
      c.lessons[0].mainSkills!.push("extra");
    },
  ],
  [
    "未经审核发布",
    (c: typeof raw) => {
      c.questions[0].status = "published";
    },
  ],
  [
    "古籍无出处",
    (c: typeof raw) => {
      c.passages[0].kind = "source";
    },
  ],
] as const)("拒绝%s", (_, mutate) => {
  const copy = structuredClone(raw);
  mutate(copy);
  expect(() => validateCourse(copy)).toThrow();
});
