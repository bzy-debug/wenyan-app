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

test("新版离线包等旧页离开后才接管，旧页仍能打开未读关卡", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "课程路径" })).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const { scope, original, next } = await page.evaluate(async () => {
    const current = await navigator.serviceWorker.ready;
    const original = current.active!.scriptURL;
    // A different script URL installs a second copy of the production worker.
    const next = original + "?release=2";
    await navigator.serviceWorker.register(next, { scope: current.scope });
    return { scope: current.scope, original, next };
  });
  await expect
    .poll(() =>
      page.evaluate(async () => (await navigator.serviceWorker.ready).waiting?.scriptURL),
    )
    .toBe(next);
  const controlling = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
  expect(controlling).toBe(original);
  await context.setOffline(true);
  try {
    await page.getByRole("link", { name: /^开始学习 · / }).click();
    await expect(page.getByRole("heading", { name: first.prompt })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }

  // Observe activation from the same origin, outside the worker's scope.
  const observer = new URL("/observe-worker", scope).href;
  await page.route(observer, (route) =>
    route.fulfill({ contentType: "text/html", body: "Observer" }),
  );
  await page.goto(observer);
  await expect
    .poll(() =>
      page.evaluate(async (url) => {
        const worker = (await navigator.serviceWorker.getRegistration(url))?.active;
        return worker?.state === "activated" ? worker.scriptURL : null;
      }, scope),
    )
    .toBe(next);
});
