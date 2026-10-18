/** The existing admin tables read by this public application. */
export type ContentTable =
  | 'acts'
  | 'chapters'
  | 'sections'
  | 'constitution_articles'
  | 'case_laws'
  | 'articles'
  | 'notes'
  | 'videos'
  | 'categories'
  | 'tags';

/**
 * Common display fields are normalized; all admin-owned fields are preserved.
 * The shared admin schema may contain additional legal-detail fields.
 */
export interface ContentRecord {
  id: string;
  slug: string;
  title: string;
  // Admin content has deliberately extensible detail fields.
  [key: string]: any;
}

export interface ContentOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  filters?: Record<string, unknown>;
  greaterThan?: Record<string, string | number>;
  lessThan?: Record<string, string | number>;
  orderBy?: string;
  ascending?: boolean;
  enabled?: boolean;
}

export interface ContentPage {
  items: ContentRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  configured: boolean;
}

export interface SearchResult {
  table: ContentTable;
  record: ContentRecord;
  href: string;
}

export interface SearchPage {
  items: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  configured: boolean;
}

export interface SiteSettings {
  website_name: string;
  tagline: string;
  logo_url: string;
  favicon_url: string;
  youtube_url: string;
  instagram_url: string;
  telegram_url: string;
  whatsapp_url: string;
  contact_email: string;
  homepage_heading: string;
  homepage_description: string;
  default_seo_title: string;
  default_seo_description: string;
  website_url: string;
  [key: string]: string;
}
