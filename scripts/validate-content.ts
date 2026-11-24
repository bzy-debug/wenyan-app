import { resolve } from "node:path";
import { readCourse, readSources } from "../src/content/node";
import { compilePilot } from "../src/content/compilePilot";

const course = readCourse();
const pilot = compilePilot(readSources(resolve("content/v1/pilot")));
const passages = new Set(course.passages.map((p) => p.text));
for (const form of pilot.forms) {
  if (passages.has(form.passage))
    throw new Error("陌生试读文本与课程重合 " + form.id);
}
console.log(
  `${course.title} · ${course.units.length} 个单元、${course.lessons.length} 节课、${course.assessments.length} 次检查、${course.questions.length} 道计分题；${pilot.forms.length} 篇独立试读。Markdown 编译及校验通过。`,
);
