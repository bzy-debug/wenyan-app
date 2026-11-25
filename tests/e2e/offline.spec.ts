import { createServer } from "node:http";
import { once } from "node:events";
import { expect, test as base, type Page } from "@playwright/test";
import {
  byId,
  course,
  firstLesson,
  firstQuestion as first,
  submit,
} from "./course";

interface Releases {
  home: string;
  publish: (page: Page) => Promise<void>;
}

// Each browser gets its own origin and two revisions at the normal Pages URL.
// Serve the production worker and app. Only the shell's marker and its precache
// revision differ, so a controller change alone cannot pass a shell assertion.
const test = base.extend<{ releases: Releases }>({
  releases: async ({ baseURL }, use) => {
    const preview = new URL(baseURL!);
    let version = "A";
    const server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url!, preview);
        const source = await fetch(url);
        const type =
          source.headers.get("content-type") ?? "application/octet-stream";
        if (!source.ok) {
          response.writeHead(source.status).end();
          return;
        }
        let bytes: Buffer;
        if (url.pathname.endsWith("/sw.js")) {
          const worker = await source.text();
          const shell =
            /(["']?url["']?\s*:\s*["']index\.html["']\s*,\s*["']?revision["']?\s*:\s*["'])([^"']+)(["'])/u;
          if (!shell.test(worker))
            throw new Error("生产预缓存清单缺少 index.html 修订号");
          bytes = Buffer.from(
            worker.replace(shell, `$1$2-release-${version}$3`),
          );
        } else if (type.startsWith("text/html")) {
          const html = await source.text();
          bytes = Buffer.from(
            html.replace(
              "</head>",
              `<meta name="test-release" content="${version}"></head>`,
            ),
          );
        } else {
          bytes = Buffer.from(await source.arrayBuffer());
        }
        response
          .writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" })
          .end(bytes);
      } catch (error) {
        response.writeHead(500).end(String(error));
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("未取得测试端口");
    try {
      await use({
        home: `http://127.0.0.1:${address.port}${preview.pathname}`,
        async publish(page) {
          await page.waitForFunction(() =>
            Boolean(navigator.serviceWorker.controller),
          );
          version = "B";
          await page.evaluate(async () =>
            (await navigator.serviceWorker.ready).update().then(() => true),
          );
          await expect.poll(() => hasWaitingWorker(page)).toBe(true);
        },
      });
    } finally {
      const closed = once(server, "close");
      server.close();
      server.closeAllConnections();
      await closed;
    }
  },
});

function hasWaitingWorker(page: Page) {
  return page.evaluate(async () =>
    Boolean((await navigator.serviceWorker.ready).waiting),
  );
}

function shellVersion(page: Page) {
  return page.locator('meta[name="test-release"]');
}

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
      page.evaluate(
        async () => (await navigator.serviceWorker.ready).waiting?.scriptURL,
      ),
    )
    .toBe(next);
  const controlling = await page.evaluate(
    () => navigator.serviceWorker.controller?.scriptURL,
  );
  expect(controlling).toBe(original);
  await context.setOffline(true);
  try {
    await page.getByRole("link", { name: /^开始学习 · / }).click();
    await expect(
      page.getByRole("heading", { name: first.prompt }),
    ).toBeVisible();
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
        const worker = (await navigator.serviceWorker.getRegistration(url))
          ?.active;
        return worker?.state === "activated" ? worker.scriptURL : null;
      }, scope),
    )
    .toBe(next);
});

test("独占安全页的普通刷新使用新版外壳并恢复原来的练习", async ({
  page,
  releases,
}) => {
  await page.goto(releases.home + "#/learn/" + firstLesson.id);
  await submit(page, first);
  await page.getByRole("button", { name: "下一题" }).click();
  const next = byId(course.questions, firstLesson.questionIds[1]);
  await expect(
    page.getByRole("heading", { name: next.prompt, exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "退出练习，进度已保存" }).click();
  const address = releases.home + "#/path";
  await expect(page).toHaveURL(address);
  await releases.publish(page);
  await expect(shellVersion(page)).toHaveAttribute("content", "A");
  await expect(page.getByRole("button", { name: "更新并刷新" })).toHaveCount(0);

  await page.reload();
  await expect(shellVersion(page)).toHaveAttribute("content", "B");
  await expect(page).toHaveURL(address);
  await expect.poll(() => hasWaitingWorker(page)).toBe(false);
  await page.getByRole("link", { name: /^继续学习 · / }).click();
  await expect(
    page.getByRole("heading", { name: next.prompt, exact: true }),
  ).toBeVisible();
});

test("另一个同作用域页面仍开着时刷新保留旧版，关掉后再刷新才切换", async ({
  context,
  page,
  releases,
}) => {
  await page.goto(releases.home + "#/settings");
  const other = await context.newPage();
  await other.goto(releases.home + "#/path");
  await other.waitForFunction(() =>
    Boolean(navigator.serviceWorker.controller),
  );
  await releases.publish(page);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "设置", exact: true }),
  ).toBeVisible();
  await expect(shellVersion(page)).toHaveAttribute("content", "A");
  await expect(shellVersion(other)).toHaveAttribute("content", "A");
  expect(await hasWaitingWorker(page)).toBe(true);

  await other.close();
  await page.reload();
  await expect(shellVersion(page)).toHaveAttribute("content", "B");
  await expect(page).toHaveURL(releases.home + "#/settings");
});

test("单标签的答题页和作者页即使刷新也保留旧版，安全页可在刷新时接管", async ({
  page,
  releases,
}) => {
  await page.goto(releases.home + "#/learn/" + firstLesson.id);
  await expect(
    page.getByRole("heading", { name: first.prompt, exact: true }),
  ).toBeVisible();
  await releases.publish(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: first.prompt, exact: true }),
  ).toBeVisible();
  await expect(shellVersion(page)).toHaveAttribute("content", "A");
  expect(await hasWaitingWorker(page)).toBe(true);

  await page.goto(releases.home + "#/author");
  await expect(
    page.getByRole("heading", { name: "作者预览", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "作者预览", exact: true }),
  ).toBeVisible();
  await expect(shellVersion(page)).toHaveAttribute("content", "A");
  expect(await hasWaitingWorker(page)).toBe(true);

  await page.goto(releases.home + "#/today");
  await expect(shellVersion(page)).toHaveAttribute("content", "A");
  await page.reload();
  await expect(shellVersion(page)).toHaveAttribute("content", "B");
});
