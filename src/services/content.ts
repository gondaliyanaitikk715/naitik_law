import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { ContentOptions, ContentPage, ContentRecord, ContentTable, SearchPage, SiteSettings } from '../types/content';

export const defaultSettings: SiteSettings = {
  website_name: 'NAITIK LAW',
  tagline: 'Learn Law the Simple Way',
  logo_url: '',
  favicon_url: '',
  youtube_url: '',
  instagram_url: '',
  telegram_url: '',
  whatsapp_url: '',
  contact_email: '',
  homepage_heading: 'NAITIK LAW',
  homepage_description: 'Learn Indian law through simple explanations, legal notes, judgments and educational videos.',
  default_seo_title: 'Naitik Law | Indian Law, BNS, Constitution & Case Laws Explained',
  default_seo_description: 'Learn Indian law in simple language with Naitik Law. Explore BNS 2023, BNSS, BSA, Constitution of India, Bare Acts, landmark judgments, law notes and legal awareness videos.',
  website_url: '',
};

/** Explicit shared-schema search mapping; these are database columns, not client-side full scans. */
const searchFields: Record<ContentTable, string[]> = {
  acts: ['name', 'short_name', 'description'],
  chapters: ['title'],
  sections: ['title', 'section_text', 'explanation'],
  constitution_articles: ['title', 'article_text', 'explanation'],
  case_laws: ['case_name', 'citation', 'short_summary'],
  articles: ['title', 'excerpt'],
  notes: ['title', 'subject', 'description'],
  videos: ['title', 'description'],
  categories: ['name'],
  tags: ['name'],
};

const searchableTables: ContentTable[] = ['acts', 'sections', 'constitution_articles', 'case_laws', 'articles', 'notes', 'videos'];
const cache = new Map<string, { expires: number; value: Promise<unknown> }>();
const CACHE_MS = 45_000;

function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const found = cache.get(key);
  if (found && found.expires > Date.now()) return found.value as Promise<T>;
  const value = loader().catch((error: unknown) => { cache.delete(key); throw error; });
  cache.set(key, { expires: Date.now() + CACHE_MS, value });
  // Keep a long browsing session from retaining an unbounded query history.
  if (cache.size > 150) cache.delete(cache.keys().next().value!);
  return value;
}

export function clearContentCache(): void { cache.clear(); }

/** All database-controlled links cross this boundary before reaching a component. */
export function sanitizePublicUrl(value: unknown, allowLocal = false): string {
  if (typeof value !== 'string') return '';
  const candidate = value.trim();
  if (!candidate || /[\u0000-\u001f\u007f]/.test(candidate)) return '';
  if (allowLocal && /^\/(?!\/)/.test(candidate) && !candidate.includes('\\')) return candidate;
  try {
    const url = new URL(candidate);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
    return url.href;
  } catch { return ''; }
}

export function normalizeContent(row: Record<string, any>): ContentRecord {
  const safe = { ...row };
  for (const [key, value] of Object.entries(safe)) {
    if (/_url$/.test(key) || ['url', 'featured_image', 'thumbnail', 'image'].includes(key)) {
      const isImage = /(?:image|thumbnail|logo|favicon)/.test(key);
      safe[key] = sanitizePublicUrl(value, isImage);
    }
  }
  if ('youtube_id' in safe && !/^[A-Za-z0-9_-]{11}$/.test(String(safe.youtube_id))) safe.youtube_id = '';
  if (!safe.youtube_url && safe.video_url) safe.youtube_url = safe.video_url;
  return {
    ...safe,
    id: String(row.id ?? ''),
    slug: String(row.slug ?? row.id ?? ''),
    title: String(row.title ?? row.name ?? row.case_name ?? 'Untitled'),
  };
}

function pageNumbers(options: ContentOptions) {
  return {
    page: Math.max(1, Math.floor(options.page || 1)),
    pageSize: Math.min(100, Math.max(1, Math.floor(options.pageSize || 12))),
  };
}

function safeIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/i.test(value)) throw new Error('Invalid content filter.');
  return value;
}

/** Escape PostgREST grammar and wildcard characters, while preserving normal words. */
function searchTerm(value: string): string {
  return value.replace(/[%,_()."\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}

function searchExpression(table: ContentTable, input: string): string {
  const term = searchTerm(input);
  if (!term) return '';
  const clauses = searchFields[table].map((field) => `${field}.ilike.%${term}%`);
  const sectionMatch = input.match(/^(?:(?:BNS|BNSS|BSA)\s*)?(?:section\s*)?(\d+[a-z]?)$/i);
  const articleMatch = input.match(/^(?:article\s*)?(\d+[a-z]?)$/i);
  if (table === 'sections' && sectionMatch) clauses.push(`section_number.eq.${sectionMatch[1]}`);
  if (table === 'constitution_articles' && articleMatch) clauses.push(`article_number.eq.${articleMatch[1]}`);
  return clauses.join(',');
}

export async function listPublished(table: ContentTable, options: ContentOptions = {}): Promise<ContentPage> {
  const { page, pageSize } = pageNumbers(options);
  const empty: ContentPage = { items: [], total: 0, page, pageSize, totalPages: 0, configured: isSupabaseConfigured };
  if (!supabase || options.enabled === false) return empty;

  // Sections must always have an act/chapter scope unless a bounded search is active.
  if (table === 'sections' && !options.filters?.act_id && !options.filters?.chapter_id && !options.search?.trim()) return empty;

  return cached(`list:${table}:${JSON.stringify({ ...options, page, pageSize })}`, async () => {
    let query = supabase!.from(table).select('*', { count: 'exact' }).eq('status', 'published');
    if (options.category && options.category !== 'All' && !options.category.startsWith('All ')) query = query.eq('category', options.category);
    for (const [column, value] of Object.entries(options.filters ?? {})) {
      if (value === undefined || value === '') continue;
      const field = safeIdentifier(column);
      if (value === null) query = query.is(field, null);
      else if (Array.isArray(value)) query = query.in(field, value);
      else query = query.eq(field, value);
    }
    for (const [column, value] of Object.entries(options.greaterThan ?? {})) query = query.gt(safeIdentifier(column), value);
    for (const [column, value] of Object.entries(options.lessThan ?? {})) query = query.lt(safeIdentifier(column), value);
    if (options.search?.trim()) {
      const expression = searchExpression(table, options.search);
      if (expression) query = query.or(expression);
      else return empty;
    }
    query = query.order(safeIdentifier(options.orderBy || 'created_at'), { ascending: options.ascending ?? false });
    query = query.range((page - 1) * pageSize, page * pageSize - 1);
    const { data, error, count } = await query;
    if (error) throw new Error(error.message || 'Unable to load content.');
    const total = count ?? 0;
    return { ...empty, items: (data ?? []).map(normalizeContent), total, totalPages: Math.ceil(total / pageSize) };
  });
}

export async function getPublished(table: ContentTable, slug: string): Promise<ContentRecord | null> {
  if (!supabase || !slug) return null;
  return cached(`record:${table}:${slug}`, async () => {
    let query = supabase!.from(table).select('*').eq('status', 'published');
    if (table === 'acts' && /^(bns|bnss|bsa)$/i.test(slug)) query = query.or(`slug.eq.${slug.toLowerCase()},short_name.eq.${slug.toUpperCase()}`);
    else query = query.eq('slug', slug);
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw new Error(error.message || 'Unable to load content.');
    return data ? normalizeContent(data) : null;
  });
}

export function contentHref(table: ContentTable, record: ContentRecord): string {
  const slug = encodeURIComponent(record.slug);
  const base: Partial<Record<ContentTable, string>> = {
    acts: '/bare-acts', constitution_articles: '/constitution', case_laws: '/case-laws', articles: '/blog',
  };
  if (base[table]) return `${base[table]}/${slug}`;
  if (table === 'sections') {
    const prefix = String(record.act_code ?? record.act_short_name ?? '').toLowerCase();
    return `${['bns', 'bnss', 'bsa'].includes(prefix) ? `/${prefix}` : '/sections'}/${slug}`;
  }
  return table === 'videos' ? `/videos?q=${encodeURIComponent(record.title)}` : `/notes?q=${encodeURIComponent(record.title)}`;
}

export async function searchAll(input: string, page = 1, onlyTable?: ContentTable): Promise<SearchPage> {
  const query = input.trim().slice(0, 160);
  const currentPage = Math.max(1, Math.floor(page));
  const pageSize = 6;
  const selectedTables = onlyTable ? searchableTables.filter((table) => table === onlyTable) : searchableTables;
  const empty: SearchPage = { items: [], total: 0, page: currentPage, pageSize: pageSize * selectedTables.length, totalPages: 0, configured: isSupabaseConfigured };
  if (!query || !supabase) return empty;
  return cached(`search:${query}:${currentPage}:${onlyTable ?? 'all'}`, async () => {
    // An act lookup scopes numeric searches such as BNS 103 to the correct code.
    const codeMatch = query.match(/^(BNS|BNSS|BSA)\s*(?:section\s*)?(\d+[a-z]?)$/i);
    const act = codeMatch && selectedTables.includes('sections') ? await getPublished('acts', codeMatch[1].toLowerCase()) : null;
    const pages = await Promise.all(selectedTables.map(async (table) => {
      if (table === 'sections' && codeMatch && !act) return { table, result: { ...empty, items: [] as ContentRecord[] } };
      const result = await listPublished(table, {
        page: currentPage,
        pageSize,
        search: table === 'sections' && codeMatch ? codeMatch[2] : query,
        ...(table === 'sections' && act ? { filters: { act_id: act.id } } : {}),
      });
      return { table, result };
    }));
    const total = pages.reduce((sum, item) => sum + item.result.total, 0);
    return {
      ...empty,
      total,
      totalPages: Math.max(0, ...pages.map(({ result }) => Math.ceil(result.total / pageSize))),
      items: pages.flatMap(({ table, result }) => result.items.map((record) => ({ table, record, href: contentHref(table, record) }))),
    };
  });
}

export async function subscribe(email: string): Promise<{ status: 'success' | 'duplicate'; message: string }> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) throw new Error('Please enter a valid email address.');
  if (!supabase) throw new Error('Subscriptions are not available yet. Please try again later.');
  // No SELECT: a unique constraint on lower(email) prevents duplicates without exposing subscribers.
  const { error } = await supabase.from('subscribers').insert({ email: normalized });
  if (error?.code === '23505') return { status: 'duplicate', message: 'This email is already subscribed.' };
  if (error) throw new Error('Unable to subscribe right now. Please try again later.');
  return { status: 'success', message: 'Thank you for subscribing.' };
}

export async function getSettings(): Promise<SiteSettings> {
  if (!supabase) return defaultSettings;
  return cached('settings', async () => {
    const { data, error } = await supabase!.from('site_settings').select('*').limit(50);
    if (error) throw new Error('Unable to load website settings.');
    const values: Record<string, unknown> = {};
    for (const row of data ?? []) {
      // Supports the existing admin's key/value or single settings-row representation.
      const key = row.key ?? row.setting_key;
      if (typeof key === 'string') values[key] = row.value ?? row.setting_value;
      else Object.assign(values, row);
    }
    const settings = { ...defaultSettings };
    const aliases: Record<string, string[]> = { logo_url: ['logo'], favicon_url: ['favicon'], website_name: ['site_name'], default_seo_title: ['seo_title'], default_seo_description: ['seo_description'] };
    for (const key of Object.keys(defaultSettings)) {
      const value = values[key] ?? aliases[key]?.map((alias) => values[alias]).find((item) => item !== undefined);
      if (typeof value === 'string' && value.trim()) settings[key] = value.trim();
    }
    for (const key of Object.keys(settings)) {
      if (key.endsWith('_url')) settings[key] = sanitizePublicUrl(settings[key], key === 'logo_url' || key === 'favicon_url');
    }
    if (!/^[^\s@<>?,:;\\/#%&]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(settings.contact_email) || settings.contact_email.length > 254) settings.contact_email = '';
    return settings;
  });
}
