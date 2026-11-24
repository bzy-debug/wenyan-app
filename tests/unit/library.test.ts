import { cleanup, render, screen, within } from "@testing-library/vue";
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

it("首页将主操作放在唯一的当前节点，后续课程保留锁定状态", async () => {
  await show(Home);
  const track = screen.getByRole("list", { name: "古今词义学习顺序" });
  expect(within(track).getAllByRole("listitem")).toHaveLength(4);
  const active = track.querySelector('[aria-current="step"]') as HTMLElement;
  expect(
    within(active)
      .getByRole("link", { name: /开始学习/ })
      .getAttribute("href"),
  ).toBe("/learn/l1.1");
  expect(within(track).getAllByRole("link")).toHaveLength(1);
  expect(
    screen.getByRole("link", { name: "完整路径" }).getAttribute("href"),
  ).toBe("/path");
});

it("三课通过后，首页继续当前单元检查，路径暂时保留下一单元的锁", async () => {
  const unit = course.units[0];
  progress.value = { ...emptyProgress(), passedIds: [...unit.lessonIds] };
  await show(Home);
  expect(
    screen.getByRole("link", { name: /开始检查/ }).getAttribute("href"),
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

it("通过首课后，已通过节点仍能重练，主操作推进到第二课", async () => {
  progress.value = { ...emptyProgress(), passedIds: ["l1.1"] };
  await show(Home);
  const track = screen.getByRole("list", { name: "古今词义学习顺序" });
  const passed = within(track).getByRole("link", { name: /已通过 · 可重练/ });
  expect(passed.getAttribute("href")).toBe("/learn/l1.1");
  const next = within(track).getByRole("link", { name: /开始学习/ });
  expect(next.getAttribute("href")).toBe("/learn/l1.2");
  expect(next.closest("li")?.getAttribute("aria-current")).toBe("step");
});
