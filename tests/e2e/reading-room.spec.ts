import { expect, test } from "@playwright/test";

test("可自选 L5 或整篇自读，查词与自校按需打开", async ({ page }) => {
  await page.goto("./#/path?level=L5");
  const level = page.getByRole("combobox", { name: "学习等级" });
  await expect(level).toHaveValue("L5");
  await expect(page.locator(".lesson-row")).toHaveCount(12);
  await page.getByRole("link", { name: "整篇自读" }).click();
  await page.getByRole("link", { name: /亲历西陵峡/ }).click();
  await expect(page.getByRole("heading", { name: "亲历西陵峡" })).toBeVisible();
  await expect(page.getByText("登临，亲身来到。")).toBeHidden();
  await page.getByText("查词", { exact: true }).click();
  await expect(page.getByText("登临，亲身来到。")).toBeVisible();
  const prompt = page.locator(".retell details").nth(1);
  await expect(prompt.locator("blockquote")).toBeHidden();
  await prompt.locator("summary").click();
  await expect(prompt.locator("blockquote")).toContainText("山松言");
  await expect(page.getByRole("link", { name: "核对底本" })).toHaveAttribute(
    "href",
    /KR2k0058/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
