declare module "html-minifier-terser" {
  export interface Options {
    collapseWhitespace?: boolean;
    conservativeCollapse?: boolean;
    removeComments?: boolean;
    removeRedundantAttributes?: boolean;
    removeScriptTypeAttributes?: boolean;
    removeStyleLinkTypeAttributes?: boolean;
    useShortDoctype?: boolean;
    minifyCSS?: boolean;
    minifyJS?: boolean;
    [key: string]: unknown;
  }

  export function minify(text: string, options?: Options): Promise<string>;
}
