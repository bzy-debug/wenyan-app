import { z } from "zod";
import { blocks, fail, fields, readGlosses, required } from "./markdown";

import { glossSchema } from "./schema";

const text = z.string().trim().min(1);
const readingSchema = z.object({
  id: text,
  title: text,
  genre: text,
  period: text,
  work: text,
  author: text,
  edition: text,
  source: z.url({ protocol: /^https$/ }),
  textRights: text,
  glossRights: text,
  status: z.enum(["草稿", "已审核", "已发布"]),
  reviewer: text.optional(),
  passage: text,
  glosses: z.array(glossSchema).min(1),
  prompts: z
    .array(z.object({ title: text, response: text, evidence: text }))
    .min(1),
});
export type Reading = z.infer<typeof readingSchema>;

export function compileReadings(files: Record<string, string>): Reading[] {
  const ids = new Set<string>();
  return Object.entries(files)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([file, source]) => {
      const [head, ...parts] = blocks(file, source, ["正文", "自校"]);
      if (head.kind !== "自读") fail(head, "课稿应以「# 自读」开头");
      if (ids.has(head.id)) fail(head, "自读篇目 ID 重复");
      ids.add(head.id);
      const meta = fields(head, [
        "文体",
        "时代",
        "出处",
        "作者",
        "版本",
        "底本链接",
        "原文权利",
        "译注权利",
        "状态",
        "审核人",
        "词注",
      ]);
      const bodies = parts.filter((p) => p.kind === "正文");
      if (bodies.length !== 1) fail(head, "每篇自读须有一段正文");
      const passage = bodies[0].lines.join("\n").trim();
      const glosses = readGlosses(head, passage, required(head, meta, "词注"));
      const prompts = parts
        .filter((p) => p.kind === "自校")
        .map((p) => {
          if (ids.has(p.id)) fail(p, "自校 ID 重复");
          ids.add(p.id);
          const values = fields(p, ["读法", "证据"]);
          const evidence = required(p, values, "证据");
          if (!passage.includes(evidence)) fail(p, "证据须逐字引自本篇");
          return {
            title: p.title,
            response: required(p, values, "读法"),
            evidence,
          };
        });
      if (meta.状态 !== "草稿" && !meta.审核人) fail(head, "请填写审核人");
      const result = readingSchema.safeParse({
        id: head.id,
        title: head.title,
        genre: meta.文体,
        period: meta.时代,
        work: meta.出处,
        author: meta.作者,
        edition: meta.版本,
        source: meta.底本链接,
        textRights: meta.原文权利,
        glossRights: meta.译注权利,
        status: meta.状态,
        reviewer: meta.审核人,
        passage,
        glosses,
        prompts,
      });
      if (!result.success)
        fail(
          head,
          result.error.issues
            .map((i) => i.path.join(".") + " " + i.message)
            .join("，"),
        );
      return result.data;
    });
}
