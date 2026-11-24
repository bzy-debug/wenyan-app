import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
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
        return { question, selected, locked };
      },
      template:
        '<QuestionInput :question="question" :selected="selected" :locked="locked" @select="selected = $event" />',
    }),
  );
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
  show("order");
  const hear = screen.getByRole("button", {
    name: "听见鼓声",
  }) as HTMLButtonElement;
  await user.click(hear);
  expect(hear.disabled).toBe(true);
  expect(screen.getAllByRole("listitem")[0].textContent).toContain("听见鼓声");
  await user.click(screen.getByRole("button", { name: "撤回上一步" }));
  expect(hear.disabled).toBe(false);
  expect(screen.getAllByRole("listitem")[0].textContent).toContain("待选择");
});

it.each(["choice", "span", "order"] as const)("%s 提交后锁定输入", (mode) => {
  show(mode, true);
  for (const button of screen.getAllByRole<HTMLButtonElement>("button"))
    expect(button.disabled).toBe(true);
});
