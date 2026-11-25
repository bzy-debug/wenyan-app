export function plainText(text: string) {
  return text.normalize("NFKC").replace(/[\p{P}\p{Cf}\s]+/gu, "");
}
