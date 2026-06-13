import { marked } from 'marked';
import { minify, type Options as MinifyOptions } from 'html-minifier-terser';
import type { AppConfig, ThemeBackground } from './config-schema';
import type { ThemeVars } from '../types/theme';

marked.setOptions({ gfm: true, breaks: true });

const HTML_MINIFY_OPTIONS: MinifyOptions = {
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

const THEME_DEFAULTS: Required<
  Pick<
    ThemeBackground,
    'type' | 'color' | 'gradientStart' | 'gradientEnd' | 'image' | 'repeat' | 'position' | 'size'
  >
> = {
  type: 'gradient',
  color: '#35b2f5',
  gradientStart: '#35b2f5',
  gradientEnd: '#ffffff',
  image: '',
  repeat: 'no-repeat',
  position: 'center center',
  size: 'cover',
};

export function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function renderMarkdown(text: string): string {
  if (!text?.trim()) return '';
  return marked.parse(text.trim()) as string;
}

export async function minifyHtml(html: string): Promise<string> {
  if (process.env.MINIFY === 'false') return html;
  return minify(html, HTML_MINIFY_OPTIONS);
}

export function normalizeImagePath(image: string | null | undefined): string | null {
  if (!image) return null;

  try {
    const parsed = new URL(image, 'http://local.invalid');
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return image;
    }
  } catch {
    // fall through to local path handling
  }

  return image.startsWith('/') ? image : `/${image}`;
}

export function normalizeLocalPath(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return null;
    }
  } catch {
    // not an absolute URL — treat as local path
  }

  return value.startsWith('/') ? value : `/${value}`;
}

export function isRemoteUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getSiteUrl(config: AppConfig): string {
  const url = process.env.SITE_URL ?? config.site.url ?? 'http://localhost:3000';
  return new URL(url).origin;
}

export function getThemeVars(theme: AppConfig['theme'] = {}): ThemeVars {
  const bg = { ...THEME_DEFAULTS, ...theme.background };
  const type = bg.type ?? 'gradient';

  const vars: ThemeVars = {
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
