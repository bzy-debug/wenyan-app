import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileCourse } from "../src/content/compile";
import { readSources } from "../src/content/node";
import {
  evidenceDomains,
  headingLinks,
  linkTeachingEvidence,
  validateTeachingEvidence,
} from "./teaching-evidence";

try {
  const documents = readSources(resolve("content/v1/course"));
  const course = compileCourse(documents);
  const files = readSources(resolve("docs/curriculum/evidence"));
  const { total, counts } = validateTeachingEvidence(course, files);
  const domains = Object.entries(counts)
    .map(([name, count]) => name + " " + count)
    .join("、");
  const args = process.argv.slice(2);
  const write = args.length === 1 && args[0] === "--write-links";
  if (args.length && !write) throw new Error("可选参数为 --write-links");
  const links = headingLinks(documents);
  for (const domain of evidenceDomains) {
    const file = domain + ".md";
    const linked = linkTeachingEvidence(file, files[file], links);
    if (linked === files[file]) continue;
    if (!write)
      throw new Error(
        file + " 的课稿链接需要更新，请运行 npm run evidence:links",
      );
    writeFileSync(resolve("docs/curriculum/evidence", file), linked);
  }

  console.log(
    `教材四证共 ${total} 条（${domains}）。主修卡首测、教材定位、课序与异篇原文通过校验。`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
