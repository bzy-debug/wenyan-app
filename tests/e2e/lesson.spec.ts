import { test, expect } from "@playwright/test";
import { readCourse } from "../../src/content/node";

const course = readCourse();
const first = course.questions.find((q) => q.id === "q.1")!;
const firstWrong = first.options.find((o) => o.label === "缓步前行")!;
const firstAnswer = first.options.find((o) => o.id === first.answer[0])!;

test("从首页直接作答，讲解可选，分层反馈并完成练习", async ({ page }, info) => {
  await page.goto("./");
  const save = (name: string) =>
    page.screenshot({
      path: info.outputPath(name + ".png"),
      fullPage: name !== "home" || info.project.name !== "mobile",
    });
  await expect(page.getByRole("heading", { name: "今日学习" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await save("home");
  const current = page.locator('.track [aria-current="step"]');
  await expect(current.getByRole("link", { name: /开始学习/ })).toHaveAttribute(
    "href",
    /#\/learn\/l1\.1$/,
  );
  await page.getByRole("link", { name: "完整路径" }).click();
  await expect(page.locator(".path-grid section")).toHaveCount(4);
  await expect(page.locator(".lesson-row")).toHaveCount(12);
  await page.locator('a[href$="#/learn/l1.1"]').click();
  const guide = page.getByRole("button", { name: "本课讲解" });
  await expect(
    page.getByRole("heading", { name: first.prompt, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /关键提示/ })).toHaveCount(0);
  await guide.click();
  await expect(page.getByText(/看见狗就跑开了/)).toBeVisible();
  await page.getByRole("button", { name: "回到练习" }).click();
  const submit = page.getByRole("button", { name: "提交答案" });
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: /缓步前行/ }).click();
  await submit.click();
  await expect(
    page.getByText(firstWrong.reason, { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".correct-answer")).toContainText(
    firstAnswer.label!,
  );
  await page.reload();
  await expect(
    page.getByText(firstWrong.reason, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重试本题" }).click();
  await page.getByRole("button", { name: /奔跑/ }).click();
  await submit.click();
  const details = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "看解析" }) });
  await expect(details).toBeVisible();
  await expect(details).not.toHaveAttribute("open");
  const rationale = details.getByText(first.analysis, { exact: true });
  await expect(rationale).toBeHidden();
  await details.locator("summary").click();
  await expect(rationale).toBeVisible();
  await expect(details.getByText("句意", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "下一题" }).click();
  await page.getByRole("button", { name: "不知道", exact: true }).click();
  await expect(page.getByRole("heading", { name: "一起看答案" })).toBeVisible();
  await page.getByRole("button", { name: "下一题" }).click();
  const answers = [
    [/^钟声$/],
    [/快跑进去/],
    [/^村$/],
    [/^听见鼓声$/, /^拿起兵器$/, /^走出军营$/],
    [/^走$/],
    [/老师已离开，学生仍在堂中/],
  ];
  for (const [i, items] of answers.entries()) {
    if (i === 0) {
      await expect(
        page.getByText("童子闻钟声，乃入堂。", { exact: true }),
      ).toBeVisible();
      const evidence = page.getByRole("group", { name: "原文证据选项" });
      await expect(
        evidence.getByRole("button", { name: /^钟声$/ }),
      ).toBeEnabled();
      await expect(evidence.getByRole("button")).toHaveCount(3);
      await save("span");
    }
    for (const name of items) await page.getByRole("button", { name }).click();
    await submit.click();
    await expect(page.getByRole("heading", { name: "回答正确" })).toBeVisible();
    await page
      .getByRole("button", {
        name: i === answers.length - 1 ? "完成练习" : "下一题",
      })
      .click();
  }
  await expect(page.getByRole("heading", { name: "本课已完成" })).toBeVisible();
  await expect(page.getByText("+20 XP", { exact: true })).toBeVisible();
  await save("result");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "查看课程路径" }).click();
  await expect(page.locator('a[href$="#/learn/l1.1"]')).toContainText("已完成");
});
