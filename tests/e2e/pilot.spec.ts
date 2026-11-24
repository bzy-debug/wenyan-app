import { test, expect } from "@playwright/test";
import { buffer } from "node:stream/consumers";
import { readSources } from "../../src/content/node";
import { compilePilot } from "../../src/content/compilePilot";

const [before] = compilePilot(readSources("content/v1/pilot")).forms;

test("志愿试读先同意，在无标点短文标记停顿，保存、导出与删除反馈", async ({
  page,
}) => {
  await page.goto("./#/pilot");
  const start = page.getByRole("button", { name: "开始学习前试读" });
  await expect(start).toBeDisabled();
  await page.getByRole("checkbox").check();
  await start.click();
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
  await page.getByLabel("用自己的话译出或概括这句续文").fill(interpretation);
  await page.getByLabel("试读反馈（选填）").fill("第二题需要回读前句。");
  await page.getByRole("button", { name: "保存作答与反馈" }).click();
  await expect(page.getByText("试读已保存", { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "导出试读与反馈" }).click();
  const contents = await buffer(await (await download).createReadStream());
  expect(JSON.parse(contents.toString("utf8")).submissions).toMatchObject([
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
  await page.getByRole("button", { name: "删除本机试读记录" }).click();
  await page.getByRole("button", { name: "确认删除全部试读记录" }).click();
  await expect(page.getByText("本机试读记录已删除。")).toBeVisible();
  await expect(start).toBeDisabled();
});
