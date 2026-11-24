import { test, expect } from "@playwright/test";
test("从首页到结算，重试与关键提示保留首答", async ({ page }, info) => {
  await page.goto("./");
  const save = (name: string) =>
    page.screenshot({ path: info.outputPath(name + ".png"), fullPage: true });
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
  await page.locator("a.lesson-row").click();
  await expect(page.getByText("教学例句 · 看见狗就跑开了。")).toBeVisible();
  await page.getByRole("button", { name: "开始练习" }).click();
  const submit = page.getByRole("button", { name: "提交答案" });
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: /缓步前行/ }).click();
  await submit.click();
  await expect(page.getByText(/缓行不合情境/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/缓行不合情境/)).toBeVisible();
  await page.getByRole("button", { name: "重试本题" }).click();
  await page.getByRole("button", { name: /奔跑/ }).click();
  await submit.click();
  await page.getByRole("button", { name: "下一题" }).click();
  await page.getByRole("button", { name: /查看关键提示/ }).click();
  const answers = [
    [/离开岸边/],
    [/^钟声$/],
    [/快跑进去/],
    [/^村$/],
    [/^听见鼓声$/, /^拿起兵器$/, /^走出军营$/],
    [/^走$/],
    [/老师已离开，学生仍在堂中/],
  ];
  for (const [i, items] of answers.entries()) {
    if (i === 1) {
      await expect(page.getByRole("button", { name: /^钟声$/ })).toBeEnabled();
      await save("span");
    }
    for (const name of items) await page.getByRole("button", { name }).click();
    await submit.click();
    await expect(page.getByRole("heading", { name: "回答正确" })).toBeVisible();
    await page
      .getByRole("button", {
        name: i === answers.length - 1 ? "查看结算" : "下一题",
      })
      .click();
  }
  await expect(page.getByRole("heading", { name: "本课已通过" })).toBeVisible();
  await expect(page.locator(".score strong")).toHaveText("6 / 8");
  await save("result");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "查看课程路径" }).click();
  await expect(page.getByText(/已通过 · 可重练/)).toBeVisible();
});
