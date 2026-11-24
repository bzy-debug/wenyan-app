import { expect, test } from "@playwright/test";
import { buffer } from "node:stream/consumers";

test("作者在浏览器校稿、定位错误并试做任意课程，无需更改学习记录", async ({
  page,
}) => {
  await page.goto("./#/author");
  const editor = page.getByLabel("Markdown 原稿");
  await page
    .getByRole("combobox", { name: "课稿", exact: true })
    .selectOption("u02/04.md");
  const source = await editor.inputValue();
  await editor.fill(
    source.replace("## 正文", "## 正文\n\n**作者新增的对比例句**"),
  );
  await page.getByRole("button", { name: "更新预览" }).click();
  const reader = page.getByRole("region", { name: "课稿预览" });
  await expect(
    reader.locator("strong").filter({ hasText: "作者新增的对比例句" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "查看内容" }).selectOption("0");
  await expect(reader.getByRole("button", { name: "试答" })).toBeDisabled();
  await reader.getByRole("group").getByRole("button").first().click();
  await reader.getByRole("button", { name: "试答" }).click();
  await expect(reader.getByRole("button", { name: "重新试答" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载课稿" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("04.md");
  const draft = await buffer(await file.createReadStream());
  expect(draft.toString()).toContain("作者新增的对比例句");
  await editor.fill("# 没有课稿标记");
  await page.getByRole("button", { name: "更新预览" }).click();
  await expect(page.getByRole("alert")).toContainText("u02/04.md:1");
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "04.md", mimeType: "text/markdown", buffer: draft });
  await expect(reader.getByText("作者新增的对比例句")).toBeVisible();
  await page.getByRole("link", { name: "返回学习" }).click();
  await expect(page.getByRole("link", { name: /开始学习/ })).toBeVisible();
});
