export function plainText(text: string) {
  return text.normalize("NFKC").replace(/[\p{P}\p{Cf}\s]+/gu, "");
}

// A whole short text or thirty consecutive characters are sufficient to
// identify a repeated excerpt in both held-out readings and teaching evidence.
export function* passageExcerpts(normalized: string) {
  const chars = Array.from(normalized);
  const length = Math.min(30, chars.length);
  for (let i = 0; i <= chars.length - length; i++) {
    yield chars.slice(i, i + length).join("");
  }
}
