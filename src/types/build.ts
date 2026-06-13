import type { AppConfig } from "./config";
import type { PostSummary } from "./content";
import type { ResolvedNavLink } from "./nav";
import type { ThemeVars } from "./theme";

export interface BuildResult {
  count: number;
  rawBytes: number;
  outBytes: number;
  minified: boolean;
}

export interface BuildTrigger {
  label: string;
  file?: string;
}

export interface WriteFileResult {
  outFile: string;
  rawBytes: number;
  outBytes: number;
}

export interface WriteFileOptions {
  minify?: boolean;
}

export interface TemplateLocals {
  config: AppConfig;
  formatDate: (iso: string) => string;
  hasSidebar: boolean;
  theme: ThemeVars;
  navLinks: ResolvedNavLink[];
  activePath?: string | null;
  posts?: PostSummary[];
  article?: import("./content").Post | import("./content").ContentPage;
  showMeta?: boolean;
  title?: string;
}
