export type BackgroundType = 'solid' | 'gradient' | 'image';

export interface SiteConfig {
  name: string;
  tagline: string;
  url: string;
  logo?: string;
  footer?: string;
}

export interface HomeConfig {
  title: string;
  subtitle?: string;
}

export type TagDef = string | { label: string; color?: string };

export interface PostsConfig {
  pageTitle: string;
  defaultTag: string;
  tags: Record<string, TagDef>;
}

export interface ThemeBackground {
  type?: BackgroundType;
  color?: string;
  gradientStart?: string;
  gradientEnd?: string;
  image?: string;
  repeat?: string;
  position?: string;
  size?: string;
}

export interface ThemeConfig {
  background?: ThemeBackground;
}

export interface TextNavLink {
  type: 'text';
  label: string;
  href: string;
}

export interface IconNavLink {
  type: 'icon';
  label: string;
  href: string;
  icon: string;
}

export type NavLink = TextNavLink | IconNavLink;

export interface NavConfig {
  links: NavLink[];
}

export interface SidebarCtaConfig {
  enabled?: boolean;
  heading?: string;
  text?: string;
  buttonText?: string;
  buttonHref?: string;
}

export interface SidebarStatusConfig {
  enabled?: boolean;
  heading?: string;
  statusLabel?: string;
  playersLabel?: string;
}

export interface SidebarConfig {
  cta?: SidebarCtaConfig;
  status?: SidebarStatusConfig;
}

export type StatusPluginName = 'mock' | 'tcp-check' | 'http';

export interface MockStatusOptions {
  online?: boolean;
  players?: number;
}

export interface TcpCheckStatusOptions {
  host?: string;
  port?: number;
  timeout?: number;
  playersWhenOnline?: number;
}

export interface HttpStatusOptions {
  url: string;
  onlineField?: string;
  playersField?: string;
  timeout?: number;
}

export type StatusOptions =
  | MockStatusOptions
  | TcpCheckStatusOptions
  | HttpStatusOptions
  | Record<string, unknown>;

export interface StatusConfig {
  plugin?: StatusPluginName;
  options?: StatusOptions;
}

export interface AppConfig {
  site: SiteConfig;
  home: HomeConfig;
  posts: PostsConfig;
  nav: NavConfig;
  theme?: ThemeConfig;
  sidebar?: SidebarConfig;
  status?: StatusConfig;
}
