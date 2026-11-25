import { expect, test } from "@playwright/test";
import { buffer } from "node:stream/consumers";
import { basename } from "node:path";
import { documentHeader } from "../../src/content/markdown";
import { readSources } from "../../src/content/node";
import { byId, course, incorrectAnswer, select } from "./course";

const lesson = course.lessons[1];
const filename = Object.entries(readSources("content/v1/course")).find(
  ([file, text]) => documentHeader(text, file).id === lesson.id,
)![0];
test("作者在浏览器校稿、定位错误并试做任意课程，无需更改学习记录", async ({
  page,
}) => {
  await page.goto("./#/author");
  const editor = page.getByLabel("Markdown 原稿");
  await page
    .getByRole("combobox", { name: "课稿", exact: true })
    .selectOption(filename);
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
  const first = byId(course.questions, lesson.questionIds[0]);
  await select(reader, first, incorrectAnswer(first));
  await reader.getByRole("button", { name: "试答" }).click();
  await expect(
    reader.getByRole("heading", { name: "再看看原句" }),
  ).toBeVisible();
  await reader.getByRole("button", { name: "重新试答" }).click();
  await select(reader, first, first.answer);
  await reader.getByRole("button", { name: "试答" }).click();
  await expect(reader.getByRole("button", { name: "重新试答" })).toBeVisible();
  await expect(reader.getByRole("heading", { name: "答对了" })).toBeVisible();
  await reader.getByText("看解析", { exact: true }).click();
  await expect(reader.locator(".translation")).toContainText(
    byId(course.passages, first.passageId).gloss,
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载课稿" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(basename(filename));
  const draft = await buffer(await file.createReadStream());
  expect(draft.toString()).toContain("作者新增的对比例句");
  await editor.fill("# 没有课稿标记");
  await page.getByRole("button", { name: "更新预览" }).click();
  await expect(page.getByRole("alert")).toContainText(filename + ":1");
  await page.locator("input[type=file]").setInputFiles({
    name: basename(filename),
    mimeType: "text/markdown",
    buffer: draft,
  });
  await expect(reader.getByText("作者新增的对比例句")).toBeVisible();
  await page.getByRole("link", { name: "返回学习" }).click();
  await expect(page.getByRole("link", { name: /开始学习/ })).toBeVisible();
});
