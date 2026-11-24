import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
import RichText from "../../src/components/RichText.vue";

afterEach(cleanup);

it("展示标题、引用、强调、列表与可访问链接", () => {
  const { container } = render(RichText, {
    props: {
      source:
        "# 阅读线索\n\n> **走** 是重要线索。\n\n1. 圈词\n2. [查辞书](https://example.org/dictionary)",
    },
  });
  expect(
    screen.getByRole("heading", { level: 2, name: "阅读线索" }),
  ).toBeTruthy();
  expect(container.querySelector("blockquote strong")?.textContent).toBe("走");
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByRole("link").getAttribute("href")).toBe(
    "https://example.org/dictionary",
  );
});

it("转义原始 HTML 并限制链接协议与外部资源", () => {
  const { container } = render(RichText, {
    props: {
      source:
        "<button>原样文字</button> [本地文件](file:///lesson.txt) ![插图](https://example.org/figure.png)",
    },
  });
  expect(container.textContent).toContain("<button>原样文字</button>");
  expect(container.querySelector("button,img,[href^=file]")).toBeNull();
});

it("行内模式不会产生额外段落", () => {
  const { container } = render(RichText, {
    props: { source: "以 *听觉* 辨义。", inline: true },
  });
  expect(container.querySelector("span em")?.textContent).toBe("听觉");
  expect(container.querySelector("p")).toBeNull();
});

it("课程正文的 Markdown 表格按表头和单元格呈现", () => {
  render(RichText, {
    props: { source: "| 字 | 义 |\n|---|---|\n| 走 | 跑 |" },
  });
  expect(screen.getByRole("columnheader", { name: "字" })).toBeTruthy();
  expect(screen.getByRole("cell", { name: "跑" })).toBeTruthy();
});
