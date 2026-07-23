export interface SiteConfig {
  title: string;
  description: string;
  siteUrl: string;
  author: string;
}

export interface PostFrontmatter {
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date;
  draft?: boolean;
}

export interface PostEntry {
  id: string;
  data: PostFrontmatter;
}

export interface SEOProps {
  title: string;
  description: string;
  ogImage?: string;
  articleDate?: string;
}

export interface PostCardProps {
  title: string;
  href: string;
  date: Date;
}

export interface PostListProps {
  posts: PostEntry[];
}

export interface ReadingEntry {
  url: string;
  title: string;
  author: string | null;
  publishedDate: string | null;
  addedDate: string;
  thoughts?: string;
  rating?: number;
}

export const SITE: SiteConfig = {
  title: 'Stan Karzhev',
  description: 'Notes on machine learning, robotics, and whatever I am building.',
  siteUrl: 'https://stankarz.github.io',
  author: 'Stan Karzhev',
};
