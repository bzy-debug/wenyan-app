import MarkdownIt from "markdown-it";

// Course text is authored offline. Keep generated markup limited to Markdown's
// text formatting, without allowing embedded HTML or remote image requests.
const markdown = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
});
markdown.disable("image");
markdown.renderer.rules.table_open = () =>
  '<div class="table-scroll" role="region" aria-label="课程表格" tabindex="0"><table>';
markdown.renderer.rules.table_close = () => "</table></div>\n";
markdown.validateLink = (href) => /^https?:\/\//i.test(href);
markdown.renderer.rules.link_open = (
  tokens,
  index,
  options,
  _env,
  renderer,
) => {
  tokens[index].attrSet("rel", "noopener noreferrer");
  return renderer.renderToken(tokens, index, options);
};
markdown.renderer.rules.heading_open = (tokens, index) => {
  // The page owns h1; keep lesson sections beneath the page title.
  const level = Math.min(6, Math.max(2, Number(tokens[index].tag.slice(1))));
  return "<h" + level + ">";
};
markdown.renderer.rules.heading_close = (tokens, index) => {
  const level = Math.min(6, Math.max(2, Number(tokens[index].tag.slice(1))));
  return "</h" + level + ">\n";
};
export function renderMarkdown(source: string, inline = false) {
  return inline ? markdown.renderInline(source) : markdown.render(source);
}
