import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("志愿试读先同意，记录独立首答、译意与反馈，可导出及删除", async ({
  page,
}) => {
  await page.goto("./#/pilot");
  const start = page.getByRole("button", { name: "开始学习前试读" });
  await expect(start).toBeDisabled();
  await page.getByRole("checkbox").check();
  await start.click();
  await page.getByRole("radio", { name: "听见湍急的水声" }).check();
  await page.getByRole("radio", { name: "船夫", exact: true }).check();
  await page.getByRole("radio", { name: "水流渐缓，船夫示意可渡" }).check();
  await page.getByRole("button", { name: "在第 3 字「暮」后断句" }).click();
  await page
    .getByLabel("用自己的话译出或概括这句续文")
    .fill("天晚了，船夫送完人，系好船回家。");
  await page.getByLabel("试读反馈（选填）").fill("第二题需要回读前句。");
  await page.getByRole("button", { name: "保存首答与反馈" }).click();
  await expect(page.getByText("独立首答 2 / 3")).toBeVisible();
  await page.reload();
  await page.getByText("查看首答与解析").click();
  await expect(
    page.getByText("你的断句：日已暮／众人渡毕舟子系舟而归"),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出试读与反馈" }).click();
  const filename = await (await download).path();
  expect(
    JSON.parse(await readFile(filename!, "utf8")).submissions,
  ).toMatchObject([
    {
      formId: "pilot.ferry",
      consentVersion: 1,
      segments: [3],
      answers: [{ correct: true }, { correct: false }, { correct: true }],
      interpretation: "天晚了，船夫送完人，系好船回家。",
      feedback: "第二题需要回读前句。",
    },
  ]);
  await page.getByRole("button", { name: "删除本机试读记录" }).click();
  await page.getByRole("button", { name: "确认删除全部试读记录" }).click();
  await expect(page.getByText("本机试读记录已删除。")).toBeVisible();
  await expect(start).toBeDisabled();
});
