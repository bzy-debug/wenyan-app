import { buffer } from "node:stream/consumers";
import { expect, test } from "@playwright/test";

import { readCourse } from "../../src/content/node";

const first = readCourse().questions.find((q) => q.id === "q.1")!;
const mistakenOption = first.options.find((o) => o.label === "缓步前行")!;

test("错题订正后可从真实备份恢复，并保留刷新前的首答", async ({ page }) => {
  await page.goto("./#/learn/l1.1");
  await page.getByRole("button", { name: /缓步前行/ }).click();
  await page.getByRole("button", { name: "提交答案" }).click();
  await expect(
    page.getByText(mistakenOption.reason, { exact: true }),
  ).toBeVisible();

  await page.goto("./#/settings");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份" }).click();
  const download = await downloaded;
  const contents = await buffer(await download.createReadStream());
  const snapshot = JSON.parse(contents.toString("utf8"));
  expect(snapshot.progress.active.attempts["q.1"]).toEqual({
    correct: false,
    hinted: false,
  });

  await page.goto("./#/review");
  await page.getByRole("button", { name: "订正", exact: true }).click();
  await page.getByRole("button", { name: /奔跑/ }).click();
  await page.getByRole("button", { name: "提交答案" }).click();
  await page.getByRole("button", { name: "完成练习" }).click();
  await expect(
    page.getByRole("heading", { name: "订正完了" }),
  ).toBeVisible();
  await page.goto("./#/review");
  await expect(page.getByText("没有待订正的错题。")).toBeVisible();

  await page.goto("./#/settings");
  const upload = page.getByLabel("选择备份文件");
  await upload.setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.getByRole("alert")).toContainText("读不了这个文件");
  await expect(page.getByRole("button", { name: "确认恢复" })).toHaveCount(0);
  await page.goto("./#/review");
  await expect(page.getByText("没有待订正的错题。")).toBeVisible();

  await page.goto("./#/settings");
  await upload.setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/json",
    buffer: contents,
  });
  await page.getByRole("button", { name: "确认恢复" }).click();
  await expect(page.getByText("学习进度已恢复。")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "设置", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "复习", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "订正", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "继续上次练习" }).click();
  await expect(
    page.getByText(mistakenOption.reason, { exact: true }),
  ).toBeVisible();
});

test("次日到期的知识卡更换语境，独立答对后间隔三天", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-03-10T12:00:00Z"));
  await page.goto("./#/learn/l1.1");
  await page.getByRole("button", { name: /奔跑/ }).click();
  await page.getByRole("button", { name: "提交答案" }).click();
  await expect(page.getByRole("heading", { name: "答对了" })).toBeVisible();
  await page.goto("./#/review");
  await expect(page.getByRole("button", { name: /^复习：/ })).toHaveCount(0);
  await page.clock.setFixedTime(new Date("2026-03-11T12:00:00Z"));
  await page.reload();
  await page.getByRole("button", { name: "复习：走 · 跑" }).click();
  await expect(page.getByText("雨骤至，行人疾走入亭。")).toBeVisible();
  await page.getByRole("button", { name: /快跑进去/ }).click();
  await page.getByRole("button", { name: "提交答案" }).click();
  await page.getByRole("button", { name: "完成练习" }).click();
  await expect(
    page.getByRole("heading", { name: "复习完了" }),
  ).toBeVisible();
  await page.goto("./#/review");
  await expect(page.getByRole("button", { name: /^复习：/ })).toHaveCount(0);
  await expect(page.locator("time")).toHaveAttribute("datetime", "2026-03-14");
});
