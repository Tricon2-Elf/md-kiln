import { z } from "zod";
import { isValidNamedColor } from "./tags";

const nonEmptyString = z.string().trim().min(1);

const cssNamedColor = z.string().refine(isValidNamedColor, {
  message: "must be a CSS named color (e.g. steelblue, seagreen)",
});

const tagDefSchema = z.union([
  nonEmptyString,
  z
    .object({
      label: nonEmptyString,
      color: cssNamedColor.optional(),
    })
    .strict(),
]);

const postsSchema = z
  .object({
    pageTitle: nonEmptyString,
    defaultTag: nonEmptyString,
    tags: z.record(z.string(), tagDefSchema),
  })
  .passthrough()
  .superRefine((posts, ctx) => {
    const keys = Object.keys(posts.tags);
    if (keys.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "posts.tags must be a non-empty object",
        path: ["tags"],
      });
    }

    for (const key of keys) {
      if (!/^[a-z0-9-]+$/.test(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `posts.tags key "${key}" must be lowercase alphanumeric (use hyphens if needed)`,
          path: ["tags", key],
        });
      }
    }

    const defaultTag = posts.defaultTag.trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(posts.tags, defaultTag)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `posts.defaultTag "${posts.defaultTag.trim()}" must be a key in posts.tags`,
        path: ["defaultTag"],
      });
    }
  });

const themeBackgroundSchema = z
  .object({
    type: z.enum(["solid", "gradient", "image"]).optional(),
    color: z.string().optional(),
    gradientStart: z.string().optional(),
    gradientEnd: z.string().optional(),
    image: z.string().optional(),
    repeat: z.string().optional(),
    position: z.string().optional(),
    size: z.string().optional(),
  })
  .passthrough()
  .superRefine((background, ctx) => {
    if (background.type === "image" && !background.image?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'theme.background.image is required when type is "image"',
        path: ["image"],
      });
    }
  });

const textNavLinkSchema = z
  .object({
    type: z.literal("text"),
    label: nonEmptyString,
    href: nonEmptyString,
  })
  .strict();

const iconNavLinkSchema = z
  .object({
    type: z.literal("icon"),
    label: nonEmptyString,
    href: nonEmptyString,
    icon: nonEmptyString,
  })
  .strict();

const sidebarCtaSchema = z
  .object({
    enabled: z.boolean().optional(),
    heading: z.string().optional(),
    text: z.string().optional(),
    buttonText: z.string().optional(),
    buttonHref: z.string().optional(),
  })
  .passthrough()
  .superRefine((cta, ctx) => {
    if (cta.enabled && !cta.buttonHref?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sidebar.cta.buttonHref is required when enabled",
        path: ["buttonHref"],
      });
    }
  });

const statusSchema = z
  .object({
    plugin: z.enum(["mock", "tcp-check", "http", "aisp"]).optional(),
    options: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()
  .superRefine((status, ctx) => {
    if (status.plugin === "http") {
      const url = status.options?.url;
      if (typeof url !== "string" || !url.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'status.options.url is required when plugin is "http"',
          path: ["options", "url"],
        });
      }
    }
  });

const sidebarStatusSchema = z
  .object({
    enabled: z.boolean().optional(),
    heading: z.string().optional(),
    statusLabel: z.string().optional(),
    playersLabel: z.string().optional(),
  })
  .passthrough();

export const appConfigSchema = z
  .object({
    site: z
      .object({
        name: nonEmptyString,
        tagline: nonEmptyString,
        url: nonEmptyString.regex(/^https?:\/\//, {
          message: "site.url must start with http:// or https://",
        }),
        logo: z.string().optional(),
        footer: z.string().optional(),
      })
      .passthrough(),
    home: z
      .object({
        title: nonEmptyString,
        subtitle: z.string().optional(),
      })
      .passthrough(),
    posts: postsSchema,
    nav: z
      .object({
        links: z.array(z.union([textNavLinkSchema, iconNavLinkSchema])),
      })
      .passthrough(),
    theme: z
      .object({
        background: themeBackgroundSchema.optional(),
      })
      .passthrough()
      .optional(),
    sidebar: z
      .object({
        cta: sidebarCtaSchema.optional(),
        status: sidebarStatusSchema.optional(),
      })
      .passthrough()
      .optional(),
    status: statusSchema.optional(),
  })
  .passthrough();

export type AppConfig = z.infer<typeof appConfigSchema>;
export type BackgroundType = z.infer<typeof themeBackgroundSchema>["type"];
export type SiteConfig = AppConfig["site"];
export type HomeConfig = AppConfig["home"];
export type TagDef = z.infer<typeof tagDefSchema>;
export type PostsConfig = AppConfig["posts"];
export type ThemeBackground = z.infer<typeof themeBackgroundSchema>;
export type ThemeConfig = NonNullable<AppConfig["theme"]>;
export type TextNavLink = z.infer<typeof textNavLinkSchema>;
export type IconNavLink = z.infer<typeof iconNavLinkSchema>;
export type NavLink =
  | z.infer<typeof textNavLinkSchema>
  | z.infer<typeof iconNavLinkSchema>;
export type NavConfig = AppConfig["nav"];
export type SidebarCtaConfig = z.infer<typeof sidebarCtaSchema>;
export type SidebarStatusConfig = z.infer<typeof sidebarStatusSchema>;
export type SidebarConfig = NonNullable<AppConfig["sidebar"]>;
export type StatusPluginName = NonNullable<
  NonNullable<AppConfig["status"]>["plugin"]
>;

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

export interface AispStatusOptions {
  url?: string;
  timeout?: number;
}

export type StatusOptions =
  | MockStatusOptions
  | TcpCheckStatusOptions
  | HttpStatusOptions
  | AispStatusOptions
  | Record<string, unknown>;

export type StatusConfig = NonNullable<AppConfig["status"]>;

function formatIssuePath(path: PropertyKey[]): string {
  if (path.length === 0) return "config";
  return path.map(String).join(".");
}

function formatZodError(error: z.ZodError): string[] {
  return [
    ...new Set(
      error.issues.map((issue) => {
        const path = formatIssuePath(issue.path);
        if (
          issue.code === z.ZodIssueCode.invalid_type &&
          issue.received === "undefined"
        ) {
          return `${path} is required`;
        }
        if (
          path.endsWith(".type") &&
          issue.code === z.ZodIssueCode.invalid_enum_value
        ) {
          if (path === "theme.background.type") {
            return 'theme.background.type must be "solid", "gradient", or "image"';
          }
          if (path === "status.plugin") {
            return `status.plugin must be one of: ${issue.options.join(", ")}`;
          }
          if (path.endsWith(".type")) {
            return `${path} must be "text" or "icon"`;
          }
        }
        if (issue.message && path !== "config") {
          return `${path} ${issue.message}`;
        }
        return issue.message || `${path} is invalid`;
      }),
    ),
  ];
}

export function validateConfig(config: unknown): AppConfig {
  const result = appConfigSchema.safeParse(config);
  if (!result.success) {
    const messages = formatZodError(result.error);
    throw new Error(`Invalid config:\n- ${messages.join("\n- ")}`);
  }
  return result.data;
}
