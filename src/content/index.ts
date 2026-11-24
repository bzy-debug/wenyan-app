import course from "virtual:wenyan-course";
import type { Question } from "./schema";
export { course };
export const byId = <T extends { id: string }>(
  items: readonly T[],
  id: string,
): T => {
  const item = items.find((x) => x.id === id);
  if (!item) throw new Error("缺少内容 " + id);
  return item;
};
export function optionText(q: Question, id: string, source = course) {
  const opt = byId(q.options, id);
  return opt.spanId ? byId(source.spans, opt.spanId).text : opt.label!;
}
