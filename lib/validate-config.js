const BUILTIN_PLUGINS = new Set(['mock', 'tcp-check', 'http']);
const BACKGROUND_TYPES = new Set(['solid', 'gradient', 'image']);
const LINK_TYPES = new Set(['text', 'icon']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateNavLinks(links, errors) {
  if (!Array.isArray(links)) {
    errors.push('nav.links must be an array');
    return;
  }

  links.forEach((link, index) => {
    const prefix = `nav.links[${index}]`;

    if (!LINK_TYPES.has(link.type)) {
      errors.push(`${prefix}.type must be "text" or "icon"`);
    }
    if (!isNonEmptyString(link.label)) {
      errors.push(`${prefix}.label is required`);
    }
    if (!isNonEmptyString(link.href)) {
      errors.push(`${prefix}.href is required`);
    }
    if (link.type === 'icon' && !isNonEmptyString(link.icon)) {
      errors.push(`${prefix}.icon is required for icon links`);
    }
  });
}

function validateBackground(background, errors) {
  if (!background) return;

  if (!BACKGROUND_TYPES.has(background.type)) {
    errors.push('theme.background.type must be "solid", "gradient", or "image"');
  }
  if (background.type === 'image' && !isNonEmptyString(background.image)) {
    errors.push('theme.background.image is required when type is "image"');
  }
}

function validateSidebar(sidebar, errors) {
  if (!sidebar) return;

  if (sidebar.cta?.enabled && !isNonEmptyString(sidebar.cta.buttonHref)) {
    errors.push('sidebar.cta.buttonHref is required when CTA is enabled');
  }
}

function validateStatus(status, errors) {
  if (!status?.plugin) return;

  if (!BUILTIN_PLUGINS.has(status.plugin)) {
    errors.push(`status.plugin must be one of: ${[...BUILTIN_PLUGINS].join(', ')}`);
  }
  if (status.plugin === 'http' && !isNonEmptyString(status.options?.url)) {
    errors.push('status.options.url is required when status.plugin is "http"');
  }
}

function validateConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    throw new Error('Invalid config: root must be an object');
  }

  if (!isNonEmptyString(config.site?.name)) errors.push('site.name is required');
  if (!isNonEmptyString(config.site?.tagline)) errors.push('site.tagline is required');
  if (!isNonEmptyString(config.site?.url)) {
    errors.push('site.url is required (e.g. https://example.com)');
  } else if (!/^https?:\/\//i.test(config.site.url)) {
    errors.push('site.url must start with http:// or https://');
  }

  if (!config.home?.title) errors.push('home.title is required');
  if (!config.posts?.pageTitle) errors.push('posts.pageTitle is required');

  validateNavLinks(config.nav?.links, errors);
  validateBackground(config.theme?.background, errors);
  validateSidebar(config.sidebar, errors);
  validateStatus(config.status, errors);

  if (errors.length > 0) {
    throw new Error(`Invalid config:\n- ${errors.join('\n- ')}`);
  }
}

module.exports = { validateConfig };
