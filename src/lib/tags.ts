export const DEFAULT_TAG_COLOR = 'steelblue';

const NAMED_COLOR_PATTERN = /^[a-z][a-z0-9-]*$/;
const BLOCKED_COLORS = new Set([
  'transparent',
  'currentcolor',
  'inherit',
  'initial',
  'unset',
  'revert',
]);

function normalizeNamedColor(color: string): string {
  return color.trim().toLowerCase();
}

export function isValidNamedColor(color: string): boolean {
  const name = normalizeNamedColor(color);
  return NAMED_COLOR_PATTERN.test(name) && !BLOCKED_COLORS.has(name);
}

export interface ParsedTagDef {
  label: string;
  color: string;
}

export function parseTagDef(def: unknown): ParsedTagDef | null {
  if (typeof def === 'string') {
    return { label: def, color: DEFAULT_TAG_COLOR };
  }

  if (def && typeof def === 'object' && 'label' in def) {
    const record = def as { label: unknown; color?: unknown };
    if (typeof record.label !== 'string') {
      return null;
    }

    const color =
      typeof record.color === 'string'
        ? normalizeNamedColor(record.color)
        : DEFAULT_TAG_COLOR;

    return {
      label: record.label,
      color,
    };
  }

  return null;
}
