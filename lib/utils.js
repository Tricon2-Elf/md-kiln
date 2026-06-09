const { marked } = require('marked');
const { minify } = require('html-minifier-terser');

marked.setOptions({ gfm: true, breaks: true });

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

const THEME_DEFAULTS = {
  type: 'gradient',
  color: '#35b2f5',
  gradientStart: '#35b2f5',
  gradientEnd: '#ffffff',
  image: '',
  repeat: 'no-repeat',
  position: 'center center',
  size: 'cover',
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function renderMarkdown(text) {
  if (!text?.trim()) return '';
  return marked.parse(text.trim());
}

async function minifyHtml(html) {
  if (process.env.MINIFY === 'false') return html;
  return minify(html, HTML_MINIFY_OPTIONS);
}

function normalizeImagePath(image) {
  if (!image) return null;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('/')) return image;
  return `/${image}`;
}

function normalizeLocalPath(value) {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return null;
  if (value.startsWith('/')) return value;
  return `/${value}`;
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(value);
}

function getSiteUrl(config) {
  const url = process.env.SITE_URL || config.site?.url || 'http://localhost:3000';
  return url.replace(/\/$/, '');
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getThemeVars(theme = {}) {
  const bg = { ...THEME_DEFAULTS, ...theme.background };
  const type = bg.type || 'gradient';

  const vars = {
    backgroundColor: bg.color,
    backgroundImage: 'none',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center center',
    backgroundSize: 'auto',
  };

  if (type === 'solid') {
    vars.backgroundColor = bg.color;
    vars.backgroundImage = 'none';
    return vars;
  }

  if (type === 'image') {
    const image = normalizeImagePath(bg.image);
    if (image) {
      vars.backgroundColor = bg.color;
      vars.backgroundImage = `url("${image}")`;
      vars.backgroundRepeat = bg.repeat;
      vars.backgroundPosition = bg.position;
      vars.backgroundSize = bg.size;
      return vars;
    }
  }

  const start = bg.gradientStart || bg.color;
  const end = bg.gradientEnd;
  vars.backgroundColor = start;
  vars.backgroundImage = `linear-gradient(to bottom, ${start}, ${end})`;
  return vars;
}

module.exports = {
  formatDate,
  renderMarkdown,
  minifyHtml,
  normalizeImagePath,
  normalizeLocalPath,
  isRemoteUrl,
  getSiteUrl,
  escapeXml,
  getThemeVars,
};
