import type { Course } from "../src/content/schema";
import { passageExcerpts, plainText } from "../src/content/passage-text";

export const evidenceDomains = [
  "实词",
  "虚词",
  "句法",
  "篇章",
  "研读",
  "文化",
] as const;

const columns = [
  /^(?:具体)?读法$/u,
  /^教材定位$/u,
  /^讲解课(?:程)?ID$/iu,
  /^独立(?:计分)?题ID$/iu,
  /^异篇复现(?:题)?ID$/iu,
];

// The tables use Markdown's optional outside pipes, escaped internal pipes,
// and optional code spans for IDs. Read the raw cells so an extra or missing
// column cannot silently be swallowed by Markdown's table renderer.
function cells(line: string): string[] {
  const pieces = line.trim().split(/(?<!\\)\|/u);
  if (pieces[0] === "") pieces.shift();
  if (pieces.at(-1) === "") pieces.pop();
  return pieces.map((s) => s.replaceAll("\\|", "|").trim());
}

type Row = {
  line: number;
  action: string;
  lesson: string;
  first: string;
  later: string;
};

function parseTable(file: string, source: string): Row[] {
  const lines = source.replace(/^\uFEFF/u, "").split(/\r?\n/u);
  const rows: Row[] = [];
  const actions = new Set<string>();
  const fail = (line: number, message: string): never => {
    throw new Error(`${file}:${line}：${message}`);
  };
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].trim();
    if (!text.startsWith("|") && cells(text).length < columns.length) continue;
    const header = cells(text).map((s) => s.replace(/\s+/gu, ""));
    if (
      header.length !== columns.length ||
      !columns.every((re, j) => re.test(header[j]))
    ) {
      fail(
        i + 1,
        "表头应为读法、教材定位、讲解课 ID、独立题 ID、异篇复现题 ID",
      );
    }
    const rule = cells(lines[++i] ?? "");
    if (
      rule.length !== columns.length ||
      rule.some((s) => !/^:?-{3,}:?$/u.test(s))
    ) {
      fail(i + 1, "表头后需要五列 Markdown 分隔线");
    }
    const before = rows.length;
    for (++i; i < lines.length && lines[i].trim(); i++) {
      const row = cells(lines[i]);
      if (row.length !== columns.length || row.some((s) => !s)) {
        fail(i + 1, "证据行需要五个非空单元格。请用空行分隔表格和说明");
      }
      const [action, reference, ...rawIds] = row;
      if (/^(?:待补|未落实|无|[-—]+)$/u.test(action) || actions.has(action)) {
        fail(i + 1, "读法为空或已重复：" + action);
      }
      // Naming the textbook itself gives no way to find the passage in it.
      const locator = reference.replace(
        /《(?:古代汉语|文言文启蒙读本)(?:[（(][^》]*[）)])?》/gu,
        "",
      );
      if (
        !/[王宋杨]/u.test(reference) ||
        !/[0-9一二三四五六七八九十百]|《[^》]+》|“[^”]+”/u.test(locator)
      ) {
        fail(
          i + 1,
          "教材定位须指明王、宋、杨三种教材之一及其页、篇、通论或具体引例：" +
            reference,
        );
      }
      const ids = rawIds.map((raw) => {
        const label = raw.match(/^\[([^\]]+)\]\([^)]+\)$/u)?.[1] ?? raw;
        const id = label.replace(/^`([^`]+)`$/u, "$1");
        if (!/^[A-Za-z0-9_.-]+$/u.test(id))
          fail(i + 1, "需要一个稳定 ID：" + raw);
        return id;
      });
      actions.add(action);
      rows.push({
        line: i + 1,
        action,
        lesson: ids[0],
        first: ids[1],
        later: ids[2],
      });
    }
    if (rows.length === before) fail(i, "此表没有读法记录");
  }
  if (!rows.length) fail(1, "缺少四证表或可查的读法");
  return rows;
}

// Readers on GitHub can open any lesson or question at its heading. Authors enter
// the stable ID and regenerate links after moving a heading to another line.
export function headingLinks(documents: Record<string, string>) {
  const links = new Map<string, string>();
  for (const [file, source] of Object.entries(documents)) {
    for (const [i, line] of source.split(/\r?\n/u).entries()) {
      const id = line.match(/^#{1,2} .+\{#([A-Za-z0-9_.-]+)\}\s*$/u)?.[1];
      if (id)
        links.set(id, `../../../content/v1/course/${file}?plain=1#L${i + 1}`);
    }
  }
  return links;
}

export function linkTeachingEvidence(
  file: string,
  source: string,
  links: Map<string, string>,
) {
  const lines = source.split(/\r?\n/u);
  for (const row of parseTable(file, source)) {
    const labels = cells(lines[row.line - 1])
      .slice(0, 2)
      .map((cell) => cell.replaceAll("|", "\\|"));
    const references = [row.lesson, row.first, row.later].map((id) => {
      const href = links.get(id);
      if (!href)
        throw new Error(`${file}:${row.line}：找不到 ${id} 的课稿标题`);
      return `[${id}](${href})`;
    });
    lines[row.line - 1] = `| ${[...labels, ...references].join(" | ")} |`;
  }
  return lines.join("\n");
}

// A punctuation change, a longer quotation of the same short passage, or
// thirty shared consecutive characters does not create an independent text.
// This matches the held-out readings rule. Order by length so a complete
// short excerpt is also detected when it is part of the later, longer passage.
function repeatedExcerpt(left: string, right: string): string | undefined {
  const a = plainText(left);
  const b = plainText(right);
  const [shorter, longer] = [...a].length <= [...b].length ? [a, b] : [b, a];
  for (const excerpt of passageExcerpts(shorter)) {
    if (longer.includes(excerpt)) return excerpt;
  }
  return undefined;
}

export function validateTeachingEvidence(
  course: Course,
  files: Record<string, string>,
) {
  const lessons = new Map(course.lessons.map((lesson) => [lesson.id, lesson]));
  const checks = new Map(course.assessments.map((check) => [check.id, check]));
  const questions = new Map(course.questions.map((q) => [q.id, q]));
  const passages = new Map(course.passages.map((p) => [p.id, p]));
  const locations = new Map<
    string,
    { owner: string; slot: number; available: boolean }
  >();
  let slot = 0;
  for (const unit of course.units) {
    for (const id of [...unit.lessonIds, unit.assessmentId]) {
      const target = lessons.get(id) ?? checks.get(id);
      if (!target) throw new Error("课程清单引用了不存在的课或检查：" + id);
      for (const qid of target.questionIds) {
        locations.set(qid, {
          owner: id,
          slot,
          available: target.stage === "available",
        });
      }
      slot++;
    }
  }

  const primarySkills = new Set<string>();
  const counts: Record<string, number> = {};
  let total = 0;
  for (const name of evidenceDomains) {
    const file = name + ".md";
    const source = files[file];
    if (source === undefined) throw new Error("缺少四证表：" + file);
    const rows = parseTable(file, source);
    for (const row of rows) {
      const fail = (message: string): never => {
        throw new Error(`${file}:${row.line}：${row.action}：${message}`);
      };
      const lesson = lessons.get(row.lesson);
      if (!lesson || lesson.stage !== "available")
        fail("讲解课不存在或未开放：" + row.lesson);
      const first =
        questions.get(row.first) ?? fail("独立题不存在：" + row.first);
      primarySkills.add(first.skillId);
      const later =
        questions.get(row.later) ?? fail("异篇复现题不存在：" + row.later);
      const from =
        locations.get(first.id) ?? fail("独立题没有归属：" + first.id);
      const to = locations.get(later.id) ?? fail("复现题没有归属：" + later.id);
      if (from.owner !== row.lesson)
        fail(`独立题 ${first.id} 属于 ${from.owner}，不属于 ${row.lesson}`);
      if (!to.available) fail("复现题所属的课或检查未开放：" + to.owner);
      if (first.id === later.id || to.slot <= from.slot) {
        fail(
          `复现题 ${later.id} 应在 ${row.lesson} 之后的另一课或单元检查，目前位于 ${to.owner}`,
        );
      }
      const original =
        passages.get(first.passageId) ?? fail("原文不存在：" + first.passageId);
      const revisit =
        passages.get(later.passageId) ?? fail("原文不存在：" + later.passageId);
      const excerpt = repeatedExcerpt(original.text, revisit.text);
      if (original.id === revisit.id || excerpt !== undefined) {
        fail(
          `需要异篇原文；${first.id}（${original.id}）与 ${later.id}（${revisit.id}）重复节引「${excerpt ?? original.id}」`,
        );
      }
    }
    counts[name] = rows.length;
    total += rows.length;
  }
  const taught = new Map<string, string>();
  for (const lesson of course.lessons) {
    if (lesson.stage !== "available") continue;
    for (const skillId of lesson.mainSkills) {
      if (!taught.has(skillId)) taught.set(skillId, lesson.id);
    }
  }
  const missing = course.skills
    .filter((skill) => taught.has(skill.id) && !primarySkills.has(skill.id))
    .map(
      (skill) =>
        `${skill.area} · ${skill.id}（${skill.word}，${taught.get(skill.id)}）`,
    );
  if (missing.length) {
    throw new Error(
      `以下 ${missing.length} 张可学习知识卡缺少以本卡为主考点的独立题记录：\n${missing.join("\n")}`,
    );
  }
  return { total, counts };
}
