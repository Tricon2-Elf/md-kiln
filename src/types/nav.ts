export interface NavLinkBase {
  label: string;
  href: string;
  external: boolean;
  active: boolean;
}

export interface ResolvedTextNavLink extends NavLinkBase {
  type: 'text';
}

export interface ResolvedIconNavLink extends NavLinkBase {
  type: 'icon';
  iconSrc: string;
}

export type ResolvedNavLink = ResolvedTextNavLink | ResolvedIconNavLink;

export type IconCacheSource = 'cache' | 'download' | 'stale';

export interface CachedIconResult {
  publicPath: string;
  source: IconCacheSource;
}
