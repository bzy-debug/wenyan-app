import { test, expect } from "@playwright/test";
import { buffer } from "node:stream/consumers";
import { readSources } from "../../src/content/node";
import { compilePilot } from "../../src/content/compilePilot";
import { course } from "./course";

const [before, after] = compilePilot(readSources("content/v1/pilot")).forms;

test("从设置进入阅读自测，同意后作答，可保存、导出与删除反馈", async ({
  page,
}) => {
  await page.goto("./#/settings");
  await expect(page.getByRole("heading", { name: "阅读自测" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "参与试用" })).toHaveCount(0);
  await page.getByRole("link", { name: "去做自测" }).click();
  await expect(page).toHaveURL(/#\/pilot$/);
  await expect(page).toHaveTitle("阅读自测 · 文言拾阶");
  await expect(
    page.getByRole("heading", { level: 1, name: "阅读自测" }),
  ).toBeVisible();
  const start = page.getByRole("button", { name: "开始第一篇" });
  const origin = page
    .locator("section")
    .filter({ has: start })
    .locator("small");
  const sourceLabel =
    before.kind === "teaching" ? "自编教学短文" : before.attribution!;
  await expect(origin).toContainText(sourceLabel);
  const editorialStatus = /草稿|待审[核校]|已审核|已发布/u;
  await expect(origin).not.toContainText(editorialStatus);
  await expect(start).toBeDisabled();
  await expect(page.getByRole("button", { name: "开始第二篇" })).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: "我同意在本机保存这次自测的答案和自愿填写的反馈。",
    })
    .check();
  await start.click();
  const activeOrigin = page
    .locator("form small")
    .filter({ hasText: sourceLabel });
  await expect(activeOrigin).toBeVisible();
  await expect(activeOrigin).not.toContainText(editorialStatus);
  for (const [i, q] of before.questions.entries()) {
    const index = i === 0 ? (q.correct + 1) % q.options.length : q.correct;
    await page
      .locator("fieldset.question")
      .nth(i)
      .getByRole("radio")
      .nth(index)
      .check();
  }
  const text = page.getByRole("group", { name: "在无标点原文中标记停顿" });
  await expect(text).toHaveText(before.extension.text);
  await expect(text).not.toContainText(/[。，；！？、]/);
  await text.getByRole("button", { name: /^在第 1 字/ }).click();
  const interpretation = "我试着把句子中人物和动作对应起来。";
  await page.getByLabel("用自己的话说说这句话的意思").fill(interpretation);
  await page.getByLabel("阅读反馈（选填）").fill("第二题需要回读前句。");
  await page.getByRole("button", { name: "保存作答与反馈" }).click();
  await expect(page.getByText("自测记录已保存", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByText("查看作答与解析").click();
  await expect(
    page.getByText(
      "你的断句：" +
        [...before.extension.text][0] +
        "／" +
        [...before.extension.text].slice(1).join(""),
    ),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出答案和反馈" }).click();
  const contents = await buffer(await (await download).createReadStream());
  const record = JSON.parse(contents.toString("utf8"));
  expect(record).toMatchObject({
    courseId: course.id,
    courseVersion: course.version,
  });
  expect(record.submissions).toMatchObject([
    {
      formId: before.id,
      material: { id: before.id, version: before.version },
      consentVersion: 1,
      segments: [1],
      answers: before.questions.map((q, i) => ({
        questionId: q.id,
        correct: i > 0,
      })),
      interpretation,
      feedback: "第二题需要回读前句。",
    },
  ]);
  await page.getByRole("button", { name: "删除本机自测记录" }).click();
  await page.getByRole("button", { name: "确认删除全部自测记录" }).click();
  await expect(page.getByText("本机自测记录已删除。")).toBeVisible();
  await expect(start).toBeDisabled();
});

test("学习后篇也可独立进入，断句与感想留空仍可保存阅读答案", async ({
  page,
}) => {
  await page.goto("./#/pilot");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "开始第二篇" }).click();
  await expect(page.getByRole("heading", { name: after.title })).toBeVisible();
  for (const [index, question] of after.questions.entries()) {
    await page
      .locator("fieldset.question")
      .nth(index)
      .getByRole("radio")
      .nth(question.correct)
      .check();
  }
  await page.getByRole("button", { name: "保存作答与反馈" }).click();
  await expect(page.getByText("自测记录已保存", { exact: true })).toBeVisible();
  await page.reload();
  const section = page
    .locator(".pilot-section")
    .filter({ has: page.getByRole("heading", { name: after.title }) });
  await section.locator("summary").click();
  for (const question of after.questions) {
    await expect(
      section.getByText("你的选择：" + question.options[question.correct], {
        exact: true,
      }),
    ).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "开始第一篇" })).toBeVisible();
});
