import { expect, test, type Page } from "@playwright/test";
import { readCourse } from "../../src/content/node";
import type { Question } from "../../src/content/schema";

const course = readCourse();
function byId<T extends { id: string }>(entries: T[], id: string) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) throw new Error("未找到题库内容 " + id);
  return entry;
}
function optionText(question: Question, id: string) {
  const option = byId(question.options, id);
  return option.spanId ? byId(course.spans, option.spanId).text : option.label!;
}

async function submit(
  page: Page,
  question: Question,
  answer: string[] = question.answer,
) {
  await expect(
    page.getByRole("heading", { name: question.prompt, exact: true }),
  ).toBeVisible();
  for (const id of answer) {
    await page
      .getByRole("button", { name: optionText(question, id), exact: true })
      .click();
  }
  await page.getByRole("button", { name: "提交答案" }).click();
}

test("从空进度逐关解锁并完成全部 120 道计分题", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("./#/learn/" + course.units[3].assessmentId);
  await expect(
    page.getByRole("heading", { name: "本关尚未解锁" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "查看课程路径" }).click();
  const ids = course.units.flatMap((unit) => [
    ...unit.lessonIds,
    unit.assessmentId,
  ]);
  let submitted = 0;
  for (const targetId of ids) {
    const lesson = course.lessons.find((l) => l.id === targetId);
    const check = course.assessments.find((a) => a.id === targetId);
    const target = lesson ?? check!;
    await page.locator('main a[href$="#/learn/' + targetId + '"]').click();
    await page.getByRole("button", { name: "开始练习" }).click();
    for (const [index, id] of target.questionIds.entries()) {
      const question = byId(course.questions, id);
      // Exercise the exact passing boundary in each unit check.
      if (check && index < 2)
        await page.getByRole("button", { name: /查看关键提示/ }).click();
      await submit(page, question);
      await expect(
        page.getByRole("heading", { name: "回答正确" }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: index === target.questionIds.length - 1 ? "查看结算" : "下一题",
        })
        .click();
      submitted++;
    }
    await expect(
      page.getByRole("heading", {
        name: lesson ? "本课已通过" : "单元检查已通过",
      }),
    ).toBeVisible();
    await expect(page.locator(".score strong")).toHaveText(
      lesson ? "8 / 8" : "4 / 6",
    );
    await expect(
      page.getByText("+" + (lesson ? 20 : 30) + " XP", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "查看课程路径" }).click();
  }
  expect(submitted).toBe(120);
  await page.reload();
  await expect(page.locator(".overview")).toContainText("12 / 12");
  await expect(page.locator(".overview")).toContainText("4 / 4");
  await page.getByRole("link", { name: "今日学习" }).click();
  await expect(page.getByText("360 XP", { exact: true })).toBeVisible();
});

test("跨日复习切换语境、错题独立订正、刷新保留间隔", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-03-01T12:00:00"));
  const first = byId(course.questions, course.lessons[0].questionIds[0]);
  await page.goto("./#/learn/" + course.lessons[0].id);
  await page.getByRole("button", { name: "开始练习" }).click();
  await submit(page, first, [
    first.options.find((o) => !first.answer.includes(o.id))!.id,
  ]);
  await expect(
    page.getByRole("heading", { name: "再读一遍原文" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "退出练习，进度已保存" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "复习" })
    .click();
  await page.getByRole("button", { name: "订正", exact: true }).click();
  await page.getByRole("button", { name: "替换并开始" }).click();
  await submit(page, first);
  await page.getByRole("button", { name: "查看结算" }).click();
  await page.getByRole("link", { name: "返回复习" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "复习", exact: true })).toBeVisible();
  await expect(page.getByText("目前没有需要订正的题目。")).toBeVisible();
  await expect(page.locator("time")).toHaveAttribute("datetime", "2026-03-02");

  await page.clock.setFixedTime(new Date("2026-03-02T12:00:00"));
  await page.reload();
  await page.getByRole("button", { name: /^复习：/ }).click();
  const title = await page.locator("h1.prompt").innerText();
  const card = course.cards.find((c) => c.skillId === first.skillId)!;
  const review = card.questionIds
    .map((id) => byId(course.questions, id))
    .find((q) => q.prompt === title)!;
  expect(review.passageId).not.toBe(first.passageId);
  await submit(page, review);
  await expect(page.getByRole("heading", { name: "回答正确" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "回答正确" })).toBeVisible();
  await page.getByRole("button", { name: "查看结算" }).click();
  await expect(page.getByText("+5 XP", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "返回复习" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "复习", exact: true })).toBeVisible();
  await expect(page.locator("time")).toHaveAttribute("datetime", "2026-03-05");
  await expect(page.getByRole("button", { name: /^复习：/ })).toHaveCount(0);

  await page.clock.setFixedTime(new Date("2026-03-05T12:00:00"));
  await page.reload();
  await page.getByRole("button", { name: /^复习：/ }).click();
  const retryTitle = await page.locator("h1.prompt").innerText();
  const next = card.questionIds
    .map((id) => byId(course.questions, id))
    .find((q) => q.prompt === retryTitle)!;
  await page.getByRole("button", { name: /查看关键提示/ }).click();
  await submit(page, next);
  await page.getByRole("button", { name: "查看结算" }).click();
  await expect(page.getByText("+0 XP", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "返回复习" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "复习", exact: true })).toBeVisible();
  await expect(page.locator("time")).toHaveAttribute("datetime", "2026-03-06");
});

test("数字键作答，回车提交与继续，键盘聚焦的其他操作保持可用", async ({
  page,
}) => {
  await page.goto("./#/learn/" + course.lessons[0].id);
  await page.getByRole("button", { name: "开始练习" }).click();
  const first = byId(course.questions, course.lessons[0].questionIds[0]);
  const correct = first.options.findIndex((o) => first.answer[0] === o.id);
  await expect(page.getByRole("heading", { name: first.prompt })).toBeFocused();
  await page.keyboard.press(String(correct + 1));
  const submitButton = page.getByRole("button", { name: "提交答案" });
  await expect(submitButton).toBeEnabled();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "回答正确" })).toBeFocused();
  await page.keyboard.press("Enter");
  const second = byId(course.questions, course.lessons[0].questionIds[1]);
  await expect(
    page.getByRole("heading", { name: second.prompt }),
  ).toBeFocused();
  const hint = page.getByRole("button", { name: /查看关键提示/ });
  await hint.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText(second.hint);
});
