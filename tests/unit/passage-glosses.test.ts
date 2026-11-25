import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory, createRouter } from "vue-router";
import { readSources } from "../../src/content/node";
import { compileCourse } from "../../src/content/compile";
import { vocabularyEntries } from "../../src/content/passage-uses";
import QuestionInput from "../../src/components/questions/QuestionInput.vue";
import AnswerFeedback from "../../src/components/questions/AnswerFeedback.vue";
import LessonReading from "../../src/components/LessonReading.vue";
import PassageVocabulary from "../../src/features/PassageVocabulary.vue";

afterEach(cleanup);
const files = readSources("docs/example-course");
const withNotes = (notes: string) => ({
  ...files,
  "lesson.md": files["lesson.md"].replace(
    "> 正午 12 ℃，午后 15 ℃。",
    "> 正午 12 ℃，午后 15 ℃。\n词注：" + notes,
  ),
  "check.md": files["check.md"].replace(
    "> 山下早晨 6 ℃，中午 9 ℃。",
    "> 山下早晨 6 ℃，中午 9 ℃。\n词注：中午：一天中的正午时分。",
  ),
});
const notes = "午后：正午以后。\n  正午：一天中太阳最高的时候。";
const course = compileCourse(withNotes(notes));
const q = course.questions.find((q) => q.id === "later")!;

it("课文两条词注随段落保存；没有填写时为空，单元自测也能收词", () => {
  expect(course.passages.find((p) => p.id === "afternoon")!.glosses).toEqual([
    { term: "午后", meaning: "正午以后。" },
    { term: "正午", meaning: "一天中太阳最高的时候。" },
  ]);
  expect(course.passages.find((p) => p.id === "morning")!.glosses).toEqual([]);
  expect(
    vocabularyEntries(course).find((e) => e.term === "中午")?.links,
  ).toEqual([
    { id: "weather-check", title: "读一组新记录", kind: "assessment" },
  ]);
});
it.each([
  "未出现的词：说明。",
  "正午：",
  "：空词",
  "正午缺少冒号",
  "正午：一。\n  正午：二。",
])("拒绝错配、不全或重复的随文词注 %s", (notes) => {
  expect(() => compileCourse(withNotes(notes))).toThrow(/lesson\.md:\d+.*词注/);
});
it("选答案时不出现词注，点开答后解析和课文讲解才能查到该词", async () => {
  const props = { course, question: q, selected: [], locked: false };
  render(QuestionInput, { props });
  expect(screen.queryByText("正午以后。")).toBeNull();
  cleanup();
  const feedback = render(AnswerFeedback, {
    props: { ...props, correct: true, selected: q.answer },
  });
  expect(feedback.container.querySelector("details")!.open).toBe(false);
  await userEvent.click(screen.getByText("看解析"));
  expect(feedback.container.querySelector("details")!.open).toBe(true);
  expect(screen.getByText("正午以后。")).toBeDefined();
  cleanup();
  render(LessonReading, { props: { course, lesson: course.lessons[0] } });
  await userEvent.click(screen.getByText("本课词注"));
  expect(screen.getByText("正午以后。").closest("details")?.open).toBe(true);
});
it("可按释义找到单元自测的原句、出处与练习链接，规划中的题不列入词典", async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  });
  await router.push("/");
  render(PassageVocabulary, {
    props: { course, query: "正午时分" },
    global: { plugins: [router] },
  });
  expect(screen.getByRole("status").textContent).toContain("1 条");
  await userEvent.click(screen.getByText("一天中的正午时分。"));
  const entry = within(
    screen.getByText("一天中的正午时分。").closest("details")!,
  );
  expect(entry.getByText("山下早晨 6 ℃，中午 9 ℃。")).toBeDefined();
  expect(entry.getByText("教学例句")).toBeDefined();
  expect(
    entry.getByRole("link", { name: "读一组新记录" }).getAttribute("href"),
  ).toBe("/learn/weather-check");
  const planned = structuredClone(course);
  planned.assessments[0].stage = "planned";
  expect(vocabularyEntries(planned).some((e) => e.term === "中午")).toBe(false);
});
