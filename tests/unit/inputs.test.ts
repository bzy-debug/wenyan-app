import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { defineComponent, ref } from "vue";
import { course } from "../../src/content";
import type { Question } from "../../src/content/schema";
import QuestionInput from "../../src/components/questions/QuestionInput.vue";

afterEach(cleanup);

function show(mode: Question["mode"], locked = false) {
  const question = course.questions.find((q) => q.mode === mode)!;
  render(
    defineComponent({
      components: { QuestionInput },
      setup() {
        const selected = ref<string[]>([]);
        return { course, question, selected, locked };
      },
      template:
        '<QuestionInput :course="course" :question="question" :selected="selected" :locked="locked" @select="selected = $event" />',
    }),
  );
  return question;
}

it.each(["choice", "span"] as const)("%s 支持键盘选择和替换", async (mode) => {
  const user = userEvent.setup();
  show(mode);
  const [first, second] = screen.getAllByRole("button");
  await user.tab();
  await user.keyboard("{Enter}");
  expect(first.getAttribute("aria-pressed")).toBe("true");
  await user.click(second);
  expect(first.getAttribute("aria-pressed")).toBe("false");
  expect(second.getAttribute("aria-pressed")).toBe("true");
});

it("排序可以撤回，不允许重复添加动作", async () => {
  const user = userEvent.setup();
  const question = show("order");
  const action = question.options[0].label!;
  const selected = screen.getByRole("button", {
    name: action,
  }) as HTMLButtonElement;
  await user.click(selected);
  expect(selected.disabled).toBe(true);
  expect(screen.getAllByRole("listitem")[0].textContent).toContain(action);
  await user.click(screen.getByRole("button", { name: "撤回上一步" }));
  expect(selected.disabled).toBe(false);
  expect(screen.getAllByRole("listitem")[0].textContent).toContain("待选");
});

it.each(["choice", "span", "order"] as const)("%s 提交后锁定输入", (mode) => {
  show(mode, true);
  for (const button of screen.getAllByRole<HTMLButtonElement>("button"))
    expect(button.disabled).toBe(true);
});

it("从当前预览文档读取选段与原文", () => {
  const preview = structuredClone(course);
  const question = preview.questions.find((q) => q.mode === "span")!;
  const passage = preview.passages.find((p) => p.id === question.passageId)!;
  const option = question.options[0];
  const span = preview.spans.find((s) => s.id === option.spanId)!;
  const replacement = "客".repeat(span.text.length);
  passage.text =
    passage.text.slice(0, span.start) +
    replacement +
    passage.text.slice(span.end);
  span.text = replacement;
  render(QuestionInput, {
    props: { course: preview, question, selected: [], locked: false },
  });
  const source = screen.getByText(passage.text, { selector: "blockquote" });
  expect(source.textContent).toBe(passage.text);
  expect(within(source).queryAllByRole("button")).toHaveLength(0);
  const evidence = screen.getByRole("group", { name: "原文证据选项" });
  expect(
    within(evidence).getByRole("button", { name: replacement }),
  ).toBeTruthy();
  const buttons = within(evidence).getAllByRole("button");
  expect(buttons).toHaveLength(question.options.length);
  expect(buttons.every((button) => !button.classList.contains("correct"))).toBe(
    true,
  );
});
