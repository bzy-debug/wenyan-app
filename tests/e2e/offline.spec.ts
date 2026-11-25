import { expect, test } from "@playwright/test";
import { firstQuestion as first } from "./course";

test("子路径的生产包可安装，离线刷新后可开始学习", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "课程路径", exact: true }),
  ).toBeVisible();
  const manifest = await (
    await page.request.get("./manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(2);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  try {
    await context.setOffline(true);
    await page.reload();
    await page.getByRole("link", { name: /^开始学习 · / }).click();
    await expect(
      page.getByRole("heading", { name: first.prompt, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "提交答案" })).toBeDisabled();
    await page.reload();
    await expect(page.getByRole("button", { name: "提交答案" })).toBeDisabled();
  } finally {
    await context.setOffline(false);
  }
  expect(errors).toEqual([]);
});
