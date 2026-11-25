"""Index entry and section identifiers in the supplied Wang Li EPUB, without definitions."""

import argparse
import difflib
import posixpath
import re
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_EPUB = ROOT / "references/王力-古代汉语.epub"
DIRECTORY = ROOT / "docs/curriculum/word-index"
GROUPS = "一 二 三 四 五 六 七 八 九 十 十一 十二 十三 十四".split()
COUNTS = [60, 62, 65, 65, 63, 66, 71, 93, 91, 95, 89, 88, 96, 82]
# 785【序】 follows 784【赋】 but is numbered 385 in the supplied book.
NUMBER_EXCEPTIONS = {(11, 785, "序"): 385}
ENTRY = re.compile(r"(\d+)\s*[.．、]?\s*【([^【】]+?)】")
SECTION = re.compile(r"[（(]([一二三四五六七八九十]+)[）)]")
# A heading may follow the preceding example inside the same paragraph.
# Three places in this EPUB use damaged <br> markup before that heading.
AFTER_SENTENCE = re.compile(r'(?:[。！？][”"」』]?|\?b(?:r?>|>>))\s*$')
EDITORIAL_NOTE = re.compile(r"^(?:按|注意)(?:[：:]|[（(])")
# Do not manufacture a missing numbered section or conflate a repeated number.
# The left side is what is visibly numbered; the right side is the stable key.
UNUSUAL_SEQUENCES = {
    (333, "举"): (["一", "二", "二"], ["一", "二", "二（重号）"]),
    (357, "险"): (["二"], ["首段未编号", "二"]),
    (813, "网"): (["一", "三"], ["一", "三"]),
}


def section_keys(number: int, head: str, text: str) -> list[str]:
    # The comparative notes introduce their own numbered distinctions, e.g. 化
    # ends with an independently numbered pair of word comparisons.
    main = re.split(r"[［\[]辨[］\]]", text, maxsplit=1)[0]
    key = (number, head)
    labels = []
    for line in main.splitlines():
        line = line.strip()
        if EDITORIAL_NOTE.match(line):
            continue
        for match in SECTION.finditer(line):
            label = match[1]
            if match.start() and not AFTER_SENTENCE.search(line[:match.start()]):
                continue
            # 案 ends with a separate note referring back to its two senses
            # in sequence: “（四）（五）……”. Neither is a new sense.
            if SECTION.match(line, match.end()) is None:
                labels.append(label)

    if key in UNUSUAL_SEQUENCES:
        expected, keys = UNUSUAL_SEQUENCES[key]
        if labels != expected:
            raise ValueError(f"{number}【{head}】的特殊编号发生变化：{labels}")
        return keys
    if labels != GROUPS[:len(labels)]:
        raise ValueError(f"请复核 {number}【{head}】不连续的一级小项：{labels}")
    return labels or ["全条"]


def extract(epub: Path) -> tuple[str, str]:
    rows = ["组\t顺序号\t底本号\t词头"]
    sections = ["顺序号\t词头\t一级小项"]
    chapters = {}
    with ZipFile(epub) as book:
        toc_name, = (name for name in book.namelist() if name.endswith(".ncx"))
        toc = ElementTree.fromstring(book.read(toc_name))
        for item in toc.findall(".//{*}navPoint"):
            title = item.findtext("{*}navLabel/{*}text", "")
            match = re.fullmatch(r"常用词（([一二三四五六七八九十]+)）\s*(\d+)字", title.strip())
            if not match:
                continue
            group = GROUPS.index(match[1]) + 1
            if group in chapters or int(match[2]) != COUNTS[group - 1]:
                raise ValueError(f"第 {group} 组目录重复或条数与此版本不符")
            href = item.find("{*}content").attrib["src"].split("#", 1)[0]
            chapters[group] = posixpath.normpath(posixpath.join(posixpath.dirname(toc_name), href))

        for group, count in enumerate(COUNTS, start=1):
            body = ElementTree.fromstring(book.read(chapters[group])).find("{*}body")
            # Keep paragraph boundaries, even if the EPUB's formatting whitespace changes.
            text = "\n".join("".join(p.itertext()).strip() for p in body.findall(".//{*}p"))
            # 303【吏】 follows the preceding entry on the same line.
            entries = list(ENTRY.finditer(text))
            if len(entries) != count:
                raise ValueError(f"第 {group} 组有 {len(entries)} 条，预期 {count}")
            for i, entry in enumerate(entries):
                raw_number, head = entry.groups()
                number = len(rows)
                if len(head) != 1 or int(raw_number) != NUMBER_EXCEPTIONS.get((group, number, head), number):
                    raise ValueError(f"请人工复查第 {group} 组第 {number} 条：{raw_number}【{head}】")
                rows.append(f"{group}\t{number}\t{raw_number}\t{head}")
                end = entries[i + 1].start() if i + 1 < len(entries) else len(text)
                keys = section_keys(number, head, text[entry.end():end])
                sections.extend(f"{number}\t{head}\t{key}" for key in keys)
    return "\n".join(rows) + "\n", "\n".join(sections) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="从王力本核对十四组常用词的编号、词头及一级小项")
    parser.add_argument("--epub", type=Path, default=DEFAULT_EPUB)
    parser.add_argument("--write", action="store_true", help="更新两张定位清单；默认只核对")
    args = parser.parse_args()
    heads, sections = extract(args.epub)
    for name, expected in (("headwords.tsv", heads), ("sense-sections.tsv", sections)):
        path = DIRECTORY / name
        if args.write:
            if not path.exists() or path.read_text(encoding="utf-8") != expected:
                path.write_text(expected, encoding="utf-8")
        else:
            actual = path.read_text(encoding="utf-8")
            if actual != expected:
                raise SystemExit("".join(difflib.unified_diff(
                    actual.splitlines(True), expected.splitlines(True),
                    fromfile=name, tofile=f"本地 EPUB 中的 {name}",
                )))
    print(f"已核对十四组 1086 个词条，共 {len(sections.splitlines()) - 1} 个一级小项或整条定位。")
