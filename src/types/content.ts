export interface ParsedTag {
  key: string;
  label: string;
  color: string;
}

export interface PostSummary {
  slug: string;
  title: string;
  date: string;
  tag: string;
  tagKey: string;
  tagColor: string;
  excerpt: string;
  image: string | null;
}

export interface Post extends PostSummary {
  body: string;
  html: string;
}

export interface ContentPage {
  slug: string;
  title: string;
  image: string | null;
  body: string;
  html: string;
}
