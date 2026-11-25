"""Extract only entry identifiers and headwords from the provided Wang Li EPUB."""

import argparse
import difflib
import posixpath
import re
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_EPUB = ROOT / "references/王力-古代汉语.epub"
OUTPUT = ROOT / "docs/curriculum/word-index/headwords.tsv"
GROUPS = "一 二 三 四 五 六 七 八 九 十 十一 十二 十三 十四".split()
COUNTS = [60, 62, 65, 65, 63, 66, 71, 93, 91, 95, 89, 88, 96, 82]
# Known transcription error: retain both the number in the text and the position.
NUMBER_EXCEPTIONS = {(11, 785, "序"): 385}


def read_entries(epub: Path) -> str:
    rows = ["组\t顺序号\t底本号\t词头"]
    titles = {}
    with ZipFile(epub) as book:
        toc_name, = (name for name in book.namelist() if name.endswith(".ncx"))
        toc = ElementTree.fromstring(book.read(toc_name))
        for item in toc.findall(".//{*}navPoint"):
            title = item.findtext("{*}navLabel/{*}text", "")
            match = re.fullmatch(r"常用词（([一二三四五六七八九十]+)）\s*(\d+)字", title.strip())
            if not match:
                continue
            group = GROUPS.index(match[1]) + 1
            if group in titles or int(match[2]) != COUNTS[group - 1]:
                raise ValueError(f"第 {group} 组目录重复或条数与此版本不符")
            href = item.find("{*}content").attrib["src"].split("#", 1)[0]
            titles[group] = posixpath.normpath(posixpath.join(posixpath.dirname(toc_name), href))

        for group, count in enumerate(COUNTS, start=1):
            doc = ElementTree.fromstring(book.read(titles[group]))
            body = doc.find("{*}body")
            text = "".join(body.itertext())
            # No line-start anchor: 303.【吏】 follows the preceding example on the same line.
            entries = re.findall(r"(\d+)\s*[.．、]?\s*【([^【】]+?)】", text)
            if len(entries) != count:
                raise ValueError(f"第 {group} 组有 {len(entries)} 条，预期 {count}")
            for raw_number, head in entries:
                number = len(rows)
                if len(head) != 1 or int(raw_number) != NUMBER_EXCEPTIONS.get((group, number, head), number):
                    raise ValueError(f"请人工复查第 {group} 组第 {number} 条：{raw_number}【{head}】")
                rows.append(f"{group}\t{number}\t{raw_number}\t{head}")
    return "\n".join(rows) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="校对王力《古代汉语》十四组常用词的编号和词头")
    parser.add_argument("--epub", type=Path, default=DEFAULT_EPUB)
    parser.add_argument("--write", action="store_true", help="更新已提交的词头清单；默认只核对")
    args = parser.parse_args()
    expected = read_entries(args.epub)
    if args.write:
        OUTPUT.write_text(expected, encoding="utf-8")
    elif expected != OUTPUT.read_text(encoding="utf-8"):
        raise SystemExit("".join(difflib.unified_diff(
            OUTPUT.read_text(encoding="utf-8").splitlines(True), expected.splitlines(True),
            fromfile="已提交清单", tofile="本地 EPUB",
        )))
    print("已核对十四组，共 1086 个编号词条。")
