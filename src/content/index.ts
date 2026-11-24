import raw from "../../content/v1/course.json";
import { validateCourse } from "./validate";
import type { Question } from "./schema";
export const course = validateCourse(raw);
export const byId = <T extends { id: string }>(
  items: readonly T[],
  id: string,
): T => {
  const item = items.find((x) => x.id === id);
  if (!item) throw new Error("缺少内容 " + id);
  return item;
};
export function optionText(q: Question, id: string) {
  const opt = byId(q.options, id);
  return opt.spanId ? byId(course.spans, opt.spanId).text : opt.label!;
}
