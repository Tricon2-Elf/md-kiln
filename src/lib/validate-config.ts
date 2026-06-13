import Ajv, { type ErrorObject, type KeywordDefinition } from 'ajv';
import { isValidNamedColor } from './tags';
import type { AppConfig, PostsConfig } from '../types/config';
import schema from './config.schema.json';

const ajv = new Ajv({ allErrors: true, strict: false });

const nonEmptyStringKeyword: KeywordDefinition = {
  keyword: 'nonEmptyString',
  type: 'string',
  schemaType: 'boolean',
  validate(enabled: boolean, data: unknown): boolean {
    return !enabled || (typeof data === 'string' && data.trim().length > 0);
  },
  error: { message: 'must not be empty' },
};

const cssNamedColorKeyword: KeywordDefinition = {
  keyword: 'cssNamedColor',
  type: 'string',
  schemaType: 'boolean',
  validate(enabled: boolean, data: unknown): boolean {
    return !enabled || (typeof data === 'string' && isValidNamedColor(data));
  },
  error: { message: 'must be a CSS named color (e.g. steelblue, seagreen)' },
};

const validDefaultTagKeyword: KeywordDefinition = {
  keyword: 'validDefaultTag',
  type: 'object',
  schemaType: 'boolean',
  validate(enabled: boolean, posts: unknown): boolean {
    if (!enabled || !posts || typeof posts !== 'object') return true;
    const postsConfig = posts as PostsConfig;
    const defaultTag = postsConfig.defaultTag?.trim().toLowerCase();
    if (!defaultTag) return false;
    return Boolean(postsConfig.tags && Object.prototype.hasOwnProperty.call(postsConfig.tags, defaultTag));
  },
  error: { message: 'must reference a key in posts.tags' },
};

ajv.addKeyword(nonEmptyStringKeyword);
ajv.addKeyword(cssNamedColorKeyword);
ajv.addKeyword(validDefaultTagKeyword);

const validate = ajv.compile(schema);

function jsonPath(instancePath: string): string {
  return instancePath.replace(/^\//, '').replace(/\//g, '.') || 'config';
}

function formatError(err: ErrorObject): string {
  const path = jsonPath(err.instancePath);
  const data = err.data as Record<string, unknown> | undefined;

  if (err.keyword === 'nonEmptyString') {
    return `${path} is required`;
  }

  if (err.keyword === 'cssNamedColor') {
    return `${path} must be a CSS named color (e.g. steelblue, seagreen)`;
  }

  if (err.keyword === 'validDefaultTag') {
    const tag = String(data?.defaultTag ?? '').trim();
    return `posts.defaultTag "${tag}" must be a key in posts.tags`;
  }

  if (err.keyword === 'pattern' && path === 'site.url') {
    return 'site.url must start with http:// or https://';
  }

  if (err.keyword === 'required') {
    const missing = err.params.missingProperty as string;
    return `${path ? `${path}.` : ''}${missing} is required`;
  }

  if (err.keyword === 'enum' && path.endsWith('.type')) {
    if (path === 'theme.background.type') {
      return 'theme.background.type must be "solid", "gradient", or "image"';
    }
    if (path === 'status.plugin') {
      const allowedValues = err.params.allowedValues as string[];
      return `status.plugin must be one of: ${allowedValues.join(', ')}`;
    }
    const allowedValues = err.params.allowedValues as string[] | undefined;
    if (path.endsWith('.type') && allowedValues?.includes('text')) {
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

export function validateConfig(config: unknown): asserts config is AppConfig {
  if (!validate(config)) {
    const errors = validate.errors ?? [];
    const messages = [...new Set(errors.map(formatError))];
    throw new Error(`Invalid config:\n- ${messages.join('\n- ')}`);
  }
}
