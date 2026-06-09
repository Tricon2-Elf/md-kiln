const DEFAULT_TAG_COLOR = 'steelblue';

const NAMED_COLOR_PATTERN = /^[a-z][a-z0-9-]*$/;
const BLOCKED_COLORS = new Set([
  'transparent',
  'currentcolor',
  'inherit',
  'initial',
  'unset',
  'revert',
]);

function normalizeNamedColor(color) {
  return color.trim().toLowerCase();
}

function isValidNamedColor(color) {
  const name = normalizeNamedColor(color);
  return NAMED_COLOR_PATTERN.test(name) && !BLOCKED_COLORS.has(name);
}

function parseTagDef(def) {
  if (typeof def === 'string') {
    return { label: def, color: DEFAULT_TAG_COLOR };
  }

  if (def && typeof def === 'object') {
    return {
      label: def.label,
      color: normalizeNamedColor(def.color || DEFAULT_TAG_COLOR),
    };
  }

  return null;
}

module.exports = {
  DEFAULT_TAG_COLOR,
  isValidNamedColor,
  parseTagDef,
};
