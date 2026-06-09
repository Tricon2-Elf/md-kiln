const { minify } = require('html-minifier-terser');

const HTML_MINIFY_OPTIONS = {
  collapseWhitespace: true,
  conservativeCollapse: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  minifyJS: true,
};

async function minifyHtml(html) {
  if (process.env.MINIFY === 'false') return html;
  return minify(html, HTML_MINIFY_OPTIONS);
}

module.exports = { minifyHtml };
