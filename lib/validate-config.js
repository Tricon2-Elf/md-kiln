const Ajv = require('ajv');
const { isValidNamedColor } = require('./tags');
const schema = require('./config.schema.json');

const ajv = new Ajv({ allErrors: true, strict: false });

ajv.addKeyword({
  keyword: 'nonEmptyString',
  type: 'string',
  schemaType: 'boolean',
  validate(enabled, data) {
    return !enabled || (typeof data === 'string' && data.trim().length > 0);
  },
  error: { message: 'must not be empty' },
});

ajv.addKeyword({
  keyword: 'cssNamedColor',
  type: 'string',
  schemaType: 'boolean',
  validate(enabled, data) {
    return !enabled || isValidNamedColor(data);
  },
  error: { message: 'must be a CSS named color (e.g. steelblue, seagreen)' },
});

ajv.addKeyword({
  keyword: 'validDefaultTag',
  type: 'object',
  schemaType: 'boolean',
  validate(enabled, posts) {
    if (!enabled || !posts) return true;
    const defaultTag = posts.defaultTag?.trim().toLowerCase();
    if (!defaultTag) return false;
    return posts.tags && Object.prototype.hasOwnProperty.call(posts.tags, defaultTag);
  },
  error: { message: 'must reference a key in posts.tags' },
});

const validate = ajv.compile(schema);

function jsonPath(instancePath) {
  return instancePath.replace(/^\//, '').replace(/\//g, '.') || 'config';
}

function formatError(err) {
  const path = jsonPath(err.instancePath);

  if (err.keyword === 'nonEmptyString') {
    return `${path} is required`;
  }

  if (err.keyword === 'cssNamedColor') {
    return `${path} must be a CSS named color (e.g. steelblue, seagreen)`;
  }

  if (err.keyword === 'validDefaultTag') {
    const tag = (err.data?.defaultTag || '').trim();
    return `posts.defaultTag "${tag}" must be a key in posts.tags`;
  }

  if (err.keyword === 'pattern' && path === 'site.url') {
    return 'site.url must start with http:// or https://';
  }

  if (err.keyword === 'required') {
    const missing = err.params.missingProperty;
    return `${path ? `${path}.` : ''}${missing} is required`;
  }

  if (err.keyword === 'enum' && path.endsWith('.type')) {
    if (path === 'theme.background.type') {
      return 'theme.background.type must be "solid", "gradient", or "image"';
    }
    if (path === 'status.plugin') {
      return `status.plugin must be one of: ${err.params.allowedValues.join(', ')}`;
    }
    if (path.endsWith('.type') && err.params.allowedValues?.includes('text')) {
      return `${path} must be "text" or "icon"`;
    }
  }

  if (err.keyword === 'minProperties' && path === 'posts.tags') {
    return 'posts.tags must be a non-empty object';
  }

  if (err.keyword === 'patternProperties' && path.startsWith('posts.tags.')) {
    const key = path.slice('posts.tags.'.length);
    return `posts.tags key "${key}" must be lowercase alphanumeric (use hyphens if needed)`;
  }

  if (err.keyword === 'oneOf' && path.startsWith('nav.links')) {
    return `${path} must be a valid text or icon link`;
  }

  const label = path || 'config';
  return `${label} ${err.message}`;
}

function validateConfig(config) {
  if (!validate(config)) {
    const messages = [...new Set(validate.errors.map(formatError))];
    throw new Error(`Invalid config:\n- ${messages.join('\n- ')}`);
  }
}

module.exports = { validateConfig };
