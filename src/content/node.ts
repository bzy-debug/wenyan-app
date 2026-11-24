import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { compileCourse } from "./compile";

export function readSources(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  function visit(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        result[relative(root, path).replaceAll("\\", "/")] = readFileSync(
          path,
          "utf8",
        );
      }
    }
  }
  visit(root);
  return result;
}
export function readCourse(root = resolve("content/v1/course")) {
  return compileCourse(readSources(root));
}
