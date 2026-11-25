import { buffer } from "node:stream/consumers";
import { expect, test, type Request } from "@playwright/test";
import { byId, course, firstLesson, firstQuestion, submit } from "./course";

test.use({ serviceWorkers: "block" });

test("已打开的课断网后可以结算，重开结算页不会重复发放经验", async ({
  context,
  page,
}) => {
  await page.goto("./");
  await page.getByRole("link", { name: /^开始学习 · / }).click();
  await expect(
    page.getByRole("heading", { name: firstQuestion.prompt, exact: true }),
  ).toBeVisible();

  const assets: string[] = [];
  const trackAsset = (request: Request) => {
    if (["script", "stylesheet"].includes(request.resourceType()))
      assets.push(request.url());
  };
  page.on("request", trackAsset);
  await context.setOffline(true);
  try {
    for (const [i, id] of firstLesson.questionIds.entries()) {
      await submit(page, byId(course.questions, id));
      await page
        .getByRole("button", {
          name: i === firstLesson.questionIds.length - 1 ? "完成练习" : "下一题",
        })
        .click();
    }
    await expect(page).toHaveURL(/#\/result$/);
    await expect(page.getByText("+20 XP", { exact: true })).toBeVisible();
    expect(assets).toEqual([]);
  } finally {
    page.off("request", trackAsset);
    await context.setOffline(false);
  }

  await page.reload();
  await expect(page.getByRole("heading", { name: "这节课学完了" })).toBeVisible();
  await expect(page.getByText("+20 XP", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/path$/);
  await expect(
    page.getByRole("heading", { name: "课程路径", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "设置", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份" }).click();
  const backup = await buffer(await (await downloaded).createReadStream());
  expect(JSON.parse(backup.toString()).progress).toMatchObject({
    xp: 20,
    completedIds: [firstLesson.id],
    active: null,
    lastResult: { targetId: firstLesson.id, xp: 20 },
  });
});

for (const entry of ["站内链接", "带查询的直链"] as const) {
  test(entry + "的页面资源失效后只能手动重新打开原目标", async ({ page }) => {
    const target =
      entry === "站内链接" ? "#/settings" : "#/settings?from=backup&tab=local";
    const settingsAsset = /\/assets\/Settings-[^/]+\.js$/;
    let documents = 0;
    let served404s = 0;
    page.on("request", (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame())
        documents++;
    });
    await page.route(settingsAsset, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "text/plain",
        body: "Not found",
      });
      served404s++;
    });

    if (entry === "站内链接") {
      await page.goto("./");
      await page.getByRole("link", { name: "设置", exact: true }).click();
    } else {
      await page.goto("./" + target);
    }
    const failed = page.getByRole("heading", { name: "这个页面没能打开" });
    const retry = page.getByRole("button", { name: "重新打开" });
    await expect(failed).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(served404s).toBeGreaterThan(0);
    expect(documents).toBe(1);

    const firstAttempt404s = served404s;
    await retry.click();
    await expect.poll(() => served404s).toBeGreaterThan(firstAttempt404s);
    await expect(failed).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(documents).toBe(2);
    await expect(page).toHaveURL((url) => url.hash === target);

    await page.unroute(settingsAsset);
    await retry.click();
    await expect(
      page.getByRole("heading", { name: "设置", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL((url) => url.hash === target);
    expect(documents).toBe(3);
  });
}
