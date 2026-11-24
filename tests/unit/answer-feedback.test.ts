import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { byId, course, optionText } from "../../src/content";
import AnswerFeedback from "../../src/components/questions/AnswerFeedback.vue";

afterEach(cleanup);
const choice = course.questions.find((q) => q.mode === "choice")!;
const passage = byId(course.passages, choice.passageId);
function show(correct: boolean, selected: string[]) {
  return render(AnswerFeedback, {
    props: { course, question: choice, correct, selected },
  });
}
it("正确后先给确认，主动查看时再呈现完整解析及译文", async () => {
  const { container } = show(true, choice.answer);
  expect(screen.getByRole("heading", { name: "回答正确" })).toBeTruthy();
  expect(container.querySelector("details")?.open).toBe(false);
  expect(screen.queryByText("正确答案")).toBeNull();
  await userEvent.click(screen.getByText("看解析"));
  expect(container.querySelector("details")?.open).toBe(true);
  expect(container.querySelector("details")?.textContent).toContain(
    passage.gloss,
  );
});
it("选错时保留所选项的错因与正确答案", () => {
  const wrong = choice.options.find((o) => !choice.answer.includes(o.id))!;
  const { container } = show(false, [wrong.id]);
  expect(container.querySelector(".correct-answer")?.textContent).toContain(
    optionText(choice, choice.answer[0]),
  );
  expect(screen.getByText(wrong.reason)).toBeTruthy();
  expect(container.querySelector("details")?.open).toBe(false);
});
it("求助后提供答案及一条线索", () => {
  show(false, []);
  expect(screen.getByRole("heading", { name: "一起看答案" })).toBeTruthy();
  expect(screen.getByText(choice.hint)).toBeTruthy();
});
it("排序选错时指出第一个顺序差异", () => {
  const q = course.questions.find((q) => q.mode === "order")!;
  const { container } = render(AnswerFeedback, {
    props: {
      course,
      question: q,
      correct: false,
      selected: [...q.answer].reverse(),
    },
  });
  expect(container.textContent).toContain(
    "第 1 步应是“" + optionText(q, q.answer[0]) + "”",
  );
});
