const { marked } = require('marked');

marked.setOptions({ gfm: true, breaks: true });

function renderMarkdown(text) {
  if (!text?.trim()) return '';
  return marked.parse(text.trim());
}

module.exports = { renderMarkdown };
