import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  Choice,
  SelectSpan,
  Order,
} from "../../src/components/questions/Inputs";
import { course } from "../../src/content";
import type { Question } from "../../src/content/schema";
afterEach(cleanup);
function Input({ mode }: { mode: Question["mode"] }) {
  const [selected, change] = useState<string[]>([]);
  const question = course.questions.find((q) => q.mode === mode)!;
  const Component = { choice: Choice, span: SelectSpan, order: Order }[mode];
  return <Component {...{ question, selected, change, locked: false }} />;
}
it.each(["choice", "span"] as const)(
  "%s supports keyboard selection and replacement",
  async (mode) => {
    const user = userEvent.setup();
    render(<Input mode={mode} />);
    const [a, b] = screen.getAllByRole("button");
    await user.tab();
    await user.keyboard("{Enter}");
    expect(a.getAttribute("aria-pressed")).toBe("true");
    await user.click(b);
    expect(a.getAttribute("aria-pressed")).toBe("false");
    expect(b.getAttribute("aria-pressed")).toBe("true");
  },
);
it("排序可以撤回，不会重复添加动作", async () => {
  const user = userEvent.setup();
  render(<Input mode="order" />);
  const hear = screen.getByRole("button", {
    name: "听见鼓声",
  }) as HTMLButtonElement;
  await user.click(hear);
  expect(hear.disabled).toBe(true);
  await user.click(screen.getByRole("button", { name: "撤回上一步" }));
  expect(hear.disabled).toBe(false);
});
