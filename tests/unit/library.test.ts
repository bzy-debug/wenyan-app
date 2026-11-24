import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { course } from "../../src/content";
import { progress } from "../../src/storage/progress";
import { emptyProgress } from "../../src/storage/model";
import Home from "../../src/features/Home.vue";
import Path from "../../src/features/Path.vue";

vi.mock("../../src/storage/progress", async () => {
  const { shallowRef } = await import("vue");
  const { emptyProgress } = await import("../../src/storage/model");
  const { unlocked } = await import("../../src/domain/progression");
  const { course } = await import("../../src/content");
  const progress = shallowRef(emptyProgress());
  return {
    progress,
    isUnlocked: (id: string) => unlocked(course, progress.value.passedIds, id),
    dueCards: () => [],
    streak: () => 0,
  };
});

async function show(page: typeof Home | typeof Path) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:rest(.*)*", component: page }],
  });
  await router.push("/");
  render(page, { global: { plugins: [router] } });
}

beforeEach(() => {
  progress.value = emptyProgress();
});
afterEach(cleanup);

it("首页可切换教学例句，并从下一个可学关卡开始", async () => {
  await show(Home);
  expect(
    screen.getByRole("link", { name: "开始学习" }).getAttribute("href"),
  ).toBe("/learn/l1.1");
  await fireEvent.click(screen.getByRole("button", { name: "去" }));
  expect(
    screen.getByText("去", { selector: "blockquote em" }).parentElement
      ?.textContent,
  ).toBe("客辞主人而去。");
});

it("三课通过后，首页继续当前单元检查，路径暂时保留下一单元的锁", async () => {
  const unit = course.units[0];
  progress.value = { ...emptyProgress(), passedIds: [...unit.lessonIds] };
  await show(Home);
  expect(
    screen.getByRole("link", { name: "开始检查" }).getAttribute("href"),
  ).toBe("/learn/" + unit.assessmentId);
  cleanup();
  await show(Path);
  expect(screen.getAllByRole("link")).toHaveLength(4);
  expect(
    screen.getByRole("link", { name: /单元检查/ }).getAttribute("href"),
  ).toBe("/learn/" + unit.assessmentId);
  expect(
    screen
      .getByText(course.units[1].title)
      .closest("section")
      ?.querySelector("a"),
  ).toBeNull();
});

it("复习中途回首页能接着本轮学习，课程全部通过后推荐复习", async () => {
  const allIds = course.units.flatMap((unit) => [
    ...unit.lessonIds,
    unit.assessmentId,
  ]);
  const card = course.cards[0];
  progress.value = {
    ...emptyProgress(),
    passedIds: allIds,
    active: {
      id: "round",
      kind: "review",
      targetId: card.id,
      index: 0,
      questionIds: [card.questionIds[0]],
      selected: [],
      attempts: {},
      feedback: null,
      hinted: false,
      xp: 0,
    },
  };
  await show(Home);
  expect(
    screen.getByRole("link", { name: "继续练习" }).getAttribute("href"),
  ).toBe("/practice");
  progress.value = { ...progress.value, active: null };
  expect(
    (await screen.findByRole("link", { name: "前往复习" })).getAttribute(
      "href",
    ),
  ).toBe("/review");
});

it("同一字的不同义项分别有可辨识的入口", async () => {
  progress.value = { ...emptyProgress(), passedIds: ["l1.1"] };
  await show(Home);
  expect(screen.getByRole("button", { name: "书写" })).toBeDefined();
  const letter = screen.getByRole("button", { name: "书信" });
  await fireEvent.click(letter);
  expect(letter.getAttribute("aria-pressed")).toBe("true");
  expect(
    screen.getByText("书信", { selector: ".word-line span" }),
  ).toBeDefined();
});
