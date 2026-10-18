import type { ContentOptions, ContentPage, ContentRecord, ContentTable } from '../types/content';

const importedTables = new Set<ContentTable>(['acts', 'chapters', 'sections']);
export function hasImportedContent(table?: ContentTable): boolean { return table ? importedTables.has(table) : true; }

async function dataset() {
  // Only the allowlisted public excerpt is packaged, never the uploaded SQL/admin tables.
  return (await import('../data/imported-legal-content.json')).default as unknown as {
    acts: ContentRecord[]; chapters: ContentRecord[]; sections: ContentRecord[];
  };
}

function compare(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), 'en', { numeric: true });
}

function matchesSearch(table: ContentTable, record: ContentRecord, input: string, acts: ContentRecord[]): boolean {
  const query = input.trim().toLowerCase().slice(0, 160);
  const act = table === 'acts' ? record : acts.find(item => item.id === record.act_id);
  if (table === 'sections') {
    const numeric = query.match(/^(?:(bns|hma|hindu marriage act)\s*)?(?:section\s*)?(\d+[a-z]?)$/i);
    if (numeric) return String(record.section_number).toLowerCase() === numeric[2] &&
      (!numeric[1] || (numeric[1] === 'bns' ? act?.short_name === 'BNS' : act?.short_name === 'HMA'));
  }
  const searchable = [record.title, record.name, record.short_name, record.description, record.section_text,
    record.explanation, record.section_number, act?.title, act?.short_name, act?.category].filter(value => value != null).join(' ').toLowerCase();
  return query.split(/\s+/).every(word => searchable.includes(word));
}

export async function listImported(table: ContentTable, options: ContentOptions = {}): Promise<ContentPage> {
  const page = Math.max(1, Math.floor(options.page || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize || 12)));
  const empty = { items: [], total: 0, page, pageSize, totalPages: 0, configured: hasImportedContent(table) };
  if (!hasImportedContent(table) || options.enabled === false) return empty;
  if (table === 'sections' && !options.filters?.act_id && !options.filters?.chapter_id && !options.search?.trim()) return empty;
  const data = await dataset();
  let rows = data[table as 'acts' | 'chapters' | 'sections'].filter(record => record.status === 'published');
  if (options.category && options.category !== 'All' && !options.category.startsWith('All ')) rows = rows.filter(record => record.category === options.category);
  for (const [field, value] of Object.entries(options.filters || {})) {
    if (value === undefined || value === '') continue;
    rows = rows.filter(record => Array.isArray(value) ? value.includes(record[field]) : value === null ? record[field] == null : record[field] === value);
  }
  for (const [field, value] of Object.entries(options.greaterThan || {})) rows = rows.filter(record => compare(record[field], value) > 0);
  for (const [field, value] of Object.entries(options.lessThan || {})) rows = rows.filter(record => compare(record[field], value) < 0);
  if (options.search?.trim()) rows = rows.filter(record => matchesSearch(table, record, options.search!, data.acts));
  const field = options.orderBy || 'created_at';
  const direction = options.ascending ? 1 : -1;
  rows = [...rows].sort((a, b) => compare(a[field], b[field]) * direction);
  return { ...empty, items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, totalPages: Math.ceil(rows.length / pageSize) };
}

export async function getImported(table: ContentTable, slug: string): Promise<ContentRecord | null> {
  if (!hasImportedContent(table) || !slug) return null;
  const data = await dataset();
  return data[table as 'acts' | 'chapters' | 'sections'].find(record => record.status === 'published' &&
    (record.slug === slug || (table === 'acts' && String(record.short_name).toLowerCase() === slug.toLowerCase()))) || null;
}
