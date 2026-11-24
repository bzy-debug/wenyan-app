import { describe, expect, it } from "vitest";
import { compilePilot } from "../../src/content/compilePilot";

function source(id: string, stage: string) {
  return `# 试读：编辑者试读 {#${id}}

阶段：${stage}
版本：1
状态：草稿
类型：教学自编
原文权利：自编短文
译注权利：自编释义
正文：人至门前，闻钟而止。
词注：至：到达。

## 练习：他先听见什么？ {#${id}.sound}

考点：从对象判断动作
- [x] 钟声
- [ ] 人语
解析：“闻”后面是“钟”。

## 续读：断句与译意 {#${id}.extension}

原文：钟止人行
断句：钟止／人行
参考大意：钟声停止，人继续走。
说明：上下两句各写一个动作。
`;
}
const ferry = source("before", "学习前"),
  lamp = source("after", "学习后");
function compile(first: string, second = lamp) {
  // Alphabetical filename order has no bearing on which text is presented first.
  return compilePilot({ "a.md": second, "z.md": first });
}
describe("试读 Markdown", () => {
  it("从编辑者的题干、选项、解析及顺序编译，复核多行释义", () => {
    const form = compile(
      ferry
        .replace("钟声", "听到敲钟")
        .replace("至：到达。", "至：到达。\n  留意**动词**。"),
    ).forms[0];
    expect(form.stage).toBe("学习前");
    expect(form.questions[0].options[form.questions[0].correct]).toBe(
      "听到敲钟",
    );
    expect(form.glossary).toContain("\n留意**动词**。");
  });
  it.each([
    ["多选", (s: string) => s.replace("- [ ] 人语", "- [x] 人语")],
    ["缺权利信息", (s: string) => s.replace(/^原文权利：.*\n/m, "")],
    ["断句改动原文", (s: string) => s.replace("断句：钟止", "断句：鼓止")],
    ["已审核无审核人", (s: string) => s.replace("状态：草稿", "状态：已审核")],
    [
      "古籍漏出处",
      (s: string) => s.replace("类型：教学自编", "类型：古籍原文"),
    ],
    ["试读阶段重复", (s: string) => s.replace("阶段：学习前", "阶段：学习后")],
  ] as const)("拒绝%s", (_, change) => {
    expect(() => compile(change(ferry))).toThrow();
  });
});
