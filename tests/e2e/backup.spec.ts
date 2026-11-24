import { buffer } from "node:stream/consumers";
import { expect, test } from "@playwright/test";

test("错题订正后可从真实备份恢复，并保留刷新前的首答", async ({ page }) => {
  await page.goto("./#/learn/l1.1");
  await page.getByRole("button", { name: "开始练习" }).click();
  await page.getByRole("button", { name: /缓步前行/ }).click();
  await page.getByRole("button", { name: "提交答案" }).click();
  await expect(page.getByText(/缓行不合情境/)).toBeVisible();

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
  await page.getByRole("button", { name: "替换并开始" }).click();
  await page.getByRole("button", { name: /奔跑/ }).click();
  await page.getByRole("button", { name: "提交答案" }).click();
  await page.getByRole("button", { name: "查看结算" }).click();
  await expect(page.getByRole("heading", { name: "本题已订正" })).toBeVisible();
  await page.goto("./#/review");
  await expect(page.getByText("目前没有需要订正的题目。")).toBeVisible();

  await page.goto("./#/settings");
  const upload = page.getByLabel("选择备份文件");
  await upload.setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.getByRole("alert")).toContainText("无法读取此备份");
  await expect(page.getByRole("button", { name: "确认恢复" })).toHaveCount(0);
  await page.goto("./#/review");
  await expect(page.getByText("目前没有需要订正的题目。")).toBeVisible();

  await page.goto("./#/settings");
  await upload.setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/json",
    buffer: contents,
  });
  await page.getByRole("button", { name: "确认恢复" }).click();
  await expect(page.getByText("学习进度已恢复。")).toBeVisible();
  await page.reload();
  await page.goto("./#/review");
  await expect(
    page.getByRole("button", { name: "订正", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "继续上次练习" }).click();
  await expect(page.getByText(/缓行不合情境/)).toBeVisible();
});

test("次日到期的知识卡更换语境，独立答对后间隔三天", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-03-10T12:00:00Z"));
  await page.goto("./#/learn/l1.1");
  await page.getByRole("button", { name: "开始练习" }).click();
  await page.getByRole("button", { name: /奔跑/ }).click();
  await page.getByRole("button", { name: "提交答案" }).click();
  await expect(page.getByRole("heading", { name: "回答正确" })).toBeVisible();
  await page.goto("./#/review");
  await expect(page.getByRole("button", { name: /^复习：/ })).toHaveCount(0);
  await page.clock.setFixedTime(new Date("2026-03-11T12:00:00Z"));
  await page.reload();
  await page.getByRole("button", { name: "复习：走 · 跑" }).click();
  await page.getByRole("button", { name: "替换并开始" }).click();
  await expect(page.getByText("雨骤至，行人疾走入亭。")).toBeVisible();
  await page.getByRole("button", { name: /快跑进去/ }).click();
  await page.getByRole("button", { name: "提交答案" }).click();
  await page.getByRole("button", { name: "查看结算" }).click();
  await expect(
    page.getByRole("heading", { name: "本次复习完成" }),
  ).toBeVisible();
  await page.goto("./#/review");
  await expect(page.getByRole("button", { name: /^复习：/ })).toHaveCount(0);
  await expect(page.locator("time")).toHaveAttribute("datetime", "2026-03-14");
});
