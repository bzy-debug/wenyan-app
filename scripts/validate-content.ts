import { course } from "../src/content";
console.log(
  `内容 v${course.version} 校验通过：${course.units.length} 个单元、${course.lessons.length} 节规划课程、${course.questions.length} 道计分题。`,
);
