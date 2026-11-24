// The course grammar reserves only document and section headings. Text in
// fenced code blocks and ordinary headings in a lesson body remain Markdown.
export interface Block {
  kind: string;
  title: string;
  id: string;
  file: string;
  line: number;
  lines: string[];
}

export function fail(
  block: Pick<Block, "file" | "line">,
  message: string,
): never {
  throw new Error(`${block.file}:${block.line}：${message}`);
}
const titlePattern = /^([^：:]+)[：:]\s*(.+?)\s+\{#([A-Za-z0-9_.-]+)\}\s*$/u;

export function documentHeader(source: string, file = "课程文档"): Block {
  const rows = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  const index = rows.findIndex((s) => s.trim());
  const match = rows[index]?.match(/^#\s+(.+)$/)?.[1].match(titlePattern);
  if (!match)
    fail(
      { file, line: index < 0 ? 1 : index + 1 },
      "首行应为「# 类型：标题 {#稳定ID}」",
    );
  return {
    file,
    line: index + 1,
    kind: match[1],
    title: match[2],
    id: match[3],
    lines: [],
  };
}

export function blocks(
  file: string,
  source: string,
  sectionTypes: readonly string[],
): Block[] {
  const head = documentHeader(source, file);
  const result = [head];
  let current = head;
  let fence = "";
  const rows = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let i = head.line; i < rows.length; i++) {
    const line = rows[i];
    const delim = line.match(/^ {0,3}(`{3,}|~{3,})/u)?.[1];
    if (current.kind === "正文" && (fence || delim)) {
      current.lines.push(line);
      if (!fence && delim) fence = delim;
      else if (
        delim &&
        delim[0] === fence[0] &&
        delim.length >= fence.length &&
        line.trim() === delim
      )
        fence = "";
      continue;
    }
    const heading = line.match(/^##\s+(.+)$/)?.[1];
    const entry = heading?.match(titlePattern);
    if (heading === "正文" && sectionTypes.includes("正文")) {
      current = {
        file,
        line: i + 1,
        kind: "正文",
        id: "",
        title: "",
        lines: [],
      };
    } else if (entry && sectionTypes.includes(entry[1])) {
      current = {
        file,
        line: i + 1,
        kind: entry[1],
        title: entry[2],
        id: entry[3],
        lines: [],
      };
    } else {
      const tag = heading?.split(/[：:]/)[0];
      if (
        heading &&
        (current.kind !== "正文" || (tag && sectionTypes.includes(tag)))
      )
        fail(
          { file, line: i + 1 },
          "章节标题无效，应为「## 类型：标题 {#稳定ID}」",
        );
      current.lines.push(line);
      continue;
    }
    result.push(current);
  }
  return result;
}

// Values can contain colons, braces, Markdown punctuation and continued lines.
// Callers may blank already-consumed syntax while preserving original line numbers.
export function fields(
  block: Block,
  allowed: readonly string[],
): Record<string, string> {
  const output: Record<string, string> = Object.create(null);
  let key = "";
  for (const [i, line] of block.lines.entries()) {
    if (!line.trim()) continue;
    if (line.startsWith("  ") && key) {
      output[key] += "\n" + line.slice(2);
      continue;
    }
    const m = line.match(/^([^：:]+)[：:]\s*(.*)$/);
    if (!m || !allowed.includes(m[1]))
      fail(
        { file: block.file, line: block.line + i + 1 },
        "未知字段或格式错误：" + line,
      );
    key = m[1];
    if (key in output)
      fail({ file: block.file, line: block.line + i + 1 }, "字段重复：" + key);
    output[key] = m[2];
  }
  return output;
}
export function required(
  block: Block,
  values: Record<string, string>,
  key: string,
): string {
  if (!values[key]?.trim()) fail(block, "缺少字段「" + key + "」");
  return values[key];
}
