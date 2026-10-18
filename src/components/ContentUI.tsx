import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, FileText, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ContentRecord, ContentTable } from '../types/content';

export function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('\n');
  if (typeof value === 'object') return text((value as Record<string, unknown>).name || (value as Record<string, unknown>).title || (value as Record<string, unknown>).text);
  return '';
}

export function first(record: ContentRecord | null | undefined, ...keys: string[]) {
  if (!record) return '';
  for (const key of keys) {
    const value = text(record[key]);
    if (value) return value;
  }
  return '';
}

export function plain(value: unknown): string {
  return text(value).replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
}

export function safeUrl(value: unknown) {
  try {
    const url = new URL(text(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

export function formatDate(value: unknown) {
  const date = new Date(text(value));
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function recordHref(table: ContentTable | string, record: ContentRecord, actCode?: string) {
  const slug = encodeURIComponent(first(record, 'slug', 'id'));
  if (table === 'acts') return `/bare-acts/${slug}`;
  if (table === 'sections') {
    const code = (actCode || first(record, 'act_code', 'act_short_name')).toLowerCase();
    return `${code === 'hma' ? '/family-law' : ['bns', 'bnss', 'bsa'].includes(code) ? `/${code}` : '/sections'}/${slug}`;
  }
  if (table === 'constitution_articles') return `/constitution/${slug}`;
  if (table === 'case_laws') return `/case-laws/${slug}`;
  if (table === 'articles') return `/blog/${slug}`;
  if (table === 'notes') return '/notes';
  if (table === 'videos') return '/videos';
  return '/search';
}

export function PageIntro({ eyebrow = 'THE NAITIK LAW LIBRARY', title, description, children }: { eyebrow?: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-intro"><div className="eyebrow"><span />{eyebrow}</div><h1>{title}</h1><p>{description}</p>{children}</div>;
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link>{items.map((item, i) => <span key={i}><ChevronRight size={13} aria-hidden="true" />{item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</span>)}</nav>;
}

export function SearchField({ value, onChange, placeholder = 'Search the library...', label = 'Search content' }: { value: string; onChange: (value: string) => void; placeholder?: string; label?: string }) {
  return <div className="library-search"><Search size={19} aria-hidden="true" /><label className="sr-only" htmlFor={`search-${label.replace(/\s/g, '-')}`}>{label}</label><input id={`search-${label.replace(/\s/g, '-')}`} type="search" className="input" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></div>;
}

export function Filters({ options, value, onChange, label = 'Filter content' }: { options: string[]; value: string; onChange: (value: string) => void; label?: string }) {
  return <div className="filter-row" role="group" aria-label={label}>{options.map(option => <button key={option} type="button" className={`filter-chip ${option === value ? 'active' : ''}`} aria-pressed={option === value} onClick={() => onChange(option)}>{option}</button>)}</div>;
}

export function LoadingCards({ count = 6 }: { count?: number }) {
  return <div className="content-grid" aria-label="Loading content" aria-busy="true">{Array.from({ length: count }, (_, i) => <div key={i} className="content-card loading-card"><div className="skeleton skeleton-icon" /><div className="skeleton skeleton-title" /><div className="skeleton" /><div className="skeleton skeleton-short" /></div>)}</div>;
}

export function ContentState({ loading, error, configured = true, empty = false, noun = 'content', onRetry, searched = false, unavailable = false }: { loading?: boolean; error?: unknown; configured?: boolean; empty?: boolean; noun?: string; onRetry?: () => void; searched?: boolean; unavailable?: boolean }) {
  if (loading) return <LoadingCards />;
  if (!error && !empty && configured) return null;
  return <div className="empty-state" role={error ? 'alert' : 'status'}><span className="empty-icon"><BookOpen size={32} strokeWidth={1.5} aria-hidden="true" /></span><h2>{error ? 'Unable to load content.' : !configured ? 'A growing library. A simpler way to learn.' : unavailable ? 'Content unavailable.' : searched ? 'No results found.' : `No ${noun} have been published yet.`}</h2><p>{error ? 'We couldn’t reach the library. Please try again in a moment.' : !configured ? `Published ${noun} will appear here when the Naitik Law content library is connected.` : unavailable ? 'This item may have moved or may not be published yet. Explore the library for more learning resources.' : searched ? 'Try a different keyword or adjust your filters to explore more of the library.' : 'Explore another part of the library or check back for new learning resources.'}</p>{error && onRetry ? <button type="button" className="button button-gold" onClick={onRetry}>Try again <ArrowRight size={16} /></button> : <Link to="/" className="button button-gold">Explore Naitik Law <ArrowRight size={16} /></Link>}</div>;
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return <nav className="pagination" aria-label="Pagination"><button type="button" className="button" disabled={page <= 1} onClick={() => onChange(page - 1)}><ArrowLeft size={16} /> Previous</button><span>Page <strong>{page}</strong> of {totalPages}</span><button type="button" className="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next <ArrowRight size={16} /></button></nav>;
}

export function LibraryCard({ record, table, href }: { record: ContentRecord; table: ContentTable; href?: string }) {
  const image = safeUrl(first(record, 'featured_image_url', 'featured_image', 'thumbnail_url', 'thumbnail', 'image_url'));
  const title = first(record, 'title', 'name', 'case_name');
  const excerpt = plain(first(record, 'excerpt', 'short_summary', 'summary', 'description'));
  const category = first(record, 'category_name', 'category', 'subject');
  const date = formatDate(first(record, 'published_at', 'publication_date', 'created_at'));
  return <Link className={`content-card library-card library-card-${table}`} to={href || recordHref(table, record)}>{image && <img className="library-card-image" src={image} alt="" loading="lazy" />}<div className="library-card-body">{!image && <span className="library-card-icon"><BookOpen size={25} strokeWidth={1.6} /></span>}<div className="card-topline">{category && <span className="badge">{category}</span>}{first(record, 'year') && <span className="muted">{first(record, 'year')}</span>}</div><h2>{title}</h2>{first(record, 'short_name') && first(record, 'short_name') !== title && <p className="card-short-name">{first(record, 'short_name')}</p>}{first(record, 'citation', 'court') && <p className="card-citation">{[first(record, 'citation'), first(record, 'court')].filter(Boolean).join(' · ')}</p>}{excerpt && <p className="card-excerpt">{excerpt}</p>}<div className="card-bottom">{date ? <span className="muted">{date}</span> : <span className="muted">Explore the resource</span>}<ArrowRight size={18} aria-hidden="true" /></div></div></Link>;
}

export function ReadingBlock({ title, value, empty = 'An explanation will be available when this content is published.', verbatim = false }: { title?: string; value: unknown; empty?: string; verbatim?: boolean }) {
  const content = verbatim ? text(value) : plain(value);
  return <section className="reading-block">{title && <h2>{title}</h2>}{content ? <div className={`reading-copy${verbatim ? ' reading-copy-verbatim' : ''}`}>{verbatim ? <p>{content}</p> : content.split(/\n\s*\n/).filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div> : <p className="muted">{empty}</p>}</section>;
}

export function DetailTabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (tab: string) => void }) {
  return <div className="tabs" role="tablist" aria-label="Reading sections">{tabs.map((tab, index) => <button type="button" key={tab} id={`tab-${tab.replace(/\s/g, '-')}`} aria-controls="reading-panel" aria-selected={active === tab} tabIndex={active === tab ? 0 : -1} role="tab" className={`tab ${active === tab ? 'active' : ''}`} onClick={() => onChange(tab)} onKeyDown={event => { const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0; if (!direction && event.key !== 'Home' && event.key !== 'End') return; event.preventDefault(); const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : tabs[(index + direction + tabs.length) % tabs.length]; onChange(next); document.getElementById(`tab-${next.replace(/\s/g, '-')}`)?.focus(); }}>{tab}</button>)}</div>;
}

export function SourceNotice({ record }: { record: ContentRecord }) {
  if (!first(record, 'content_notice')) return null;
  return <aside className="source-notice" aria-label="Content source notice"><FileText size={21} aria-hidden="true" /><div><h2>Database excerpt</h2><p>This supplied excerpt may be abridged. Check the complete current provision against an official source.</p></div></aside>;
}

export function LearningNote() {
  return <div className="learning-note"><ShieldCheck size={21} aria-hidden="true" /><p>For learning and awareness. Always verify legal provisions and current developments from official sources.</p></div>;
}

export function RelatedLinks({ title, value, table }: { title: string; value: unknown; table?: ContentTable }) {
  const entries = (Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []).filter(entry => typeof entry !== 'object' || (entry !== null && entry.status === 'published'));
  return <section className="reading-block"><h2>{title}</h2>{entries.length ? <ul className="related-list">{entries.map((entry, i) => {
    if (typeof entry === 'object' && entry !== null && table) return <li key={i}><Link to={recordHref(table, entry as ContentRecord)}>{first(entry as ContentRecord, 'title', 'name', 'case_name', 'slug')} <ArrowRight size={15} /></Link></li>;
    return <li key={i}>{plain(entry)}</li>;
  })}</ul> : <p className="muted">Related resources will appear here as they are published.</p>}</section>;
}

export function ResourceCount({ total, noun }: { total: number; noun: string }) {
  return <div className="resource-count"><FileText size={15} aria-hidden="true" /><span>{total} {noun}{total === 1 ? '' : 's'}</span><span className="muted">Published resources only</span></div>;
}
