import { course } from "../src/content";
import { validateCompleteL1 } from "../src/content/validate";
import { pilot } from "../src/content/pilot";

validateCompleteL1(course);
const passages = new Set(course.passages.map((p) => p.text));
for (const form of pilot.forms) {
  if (passages.has(form.passage))
    throw new Error("陌生试读文本与课程重合 " + form.id);
}
console.log(
  `内容 v${course.version} 校验通过：${course.units.length} 个单元、${course.lessons.length} 节课、${course.assessments.length} 个单元检查、${course.questions.length} 道计分题；${pilot.forms.length} 篇独立试读。`,
);
