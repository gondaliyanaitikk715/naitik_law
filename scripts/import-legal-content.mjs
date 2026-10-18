#!/usr/bin/env node
/**
 * Read public legal seed data as text. This script does not connect to a database
 * or execute any SQL. Only literal INSERT rows in three named tables are read.
 *
 * Usage: node scripts/import-legal-content.mjs /path/to/schema.sql [output.json]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TABLES = new Set(['acts', 'chapters', 'legal_contents']);
const SELECTED_ACTS = new Map([
  [2, { code: 'bns', slug: 'bns', shortName: 'BNS', category: 'Criminal Law' }],
  [11, { code: 'hma', slug: 'hindu-marriage-act-1955', shortName: 'HMA', category: 'Family Law' }],
]);
const NOTICE = 'Imported database excerpt. Verify the complete current provision from an official source.';
const PROVENANCE = { source: 'schema.sql', source_format: 'MySQL seed data', content_notice: NOTICE };

// Remove comments and split statements while respecting MySQL quoted strings.
// DDL, commands, settings, and unrelated INSERT statements are never executed.
function* statements(sql) {
  let statement = '';
  let quote = null;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (quote) {
      statement += char;
      if (char === '\\' && quote !== '`' && i + 1 < sql.length) {
        statement += sql[++i];
      } else if (char === quote) {
        if (sql[i + 1] === quote) statement += sql[++i];
        else quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      statement += char;
    } else if (char === '#' || (char === '-' && sql[i + 1] === '-' && /\s/.test(sql[i + 2] ?? '\n'))) {
      while (i < sql.length && sql[i] !== '\n') i++;
      statement += '\n';
    } else if (char === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) throw new Error('Unterminated SQL comment.');
      i = end + 1;
      statement += ' ';
    } else if (char === ';') {
      if (statement.trim()) yield statement.trim();
      statement = '';
    } else {
      statement += char;
    }
  }
  if (quote) throw new Error('Unterminated SQL quoted value.');
  if (statement.trim()) yield statement.trim();
}

function parseLiteralRows(input) {
  let position = 0;
  const rows = [];
  const whitespace = () => { while (/\s/.test(input[position] ?? '') && position < input.length) position++; };
  const take = (char) => {
    whitespace();
    if (input[position] !== char) throw new Error(`Expected ${char} in allowlisted INSERT values.`);
    position++;
  };
  const literal = () => {
    whitespace();
    if (input[position] === "'") {
      position++;
      let value = '';
      while (position < input.length) {
        const char = input[position++];
        if (char === "'") {
          if (input[position] === "'") { position++; value += "'"; }
          else return value;
        } else if (char === '\\') {
          if (position >= input.length) throw new Error('Unterminated SQL escape.');
          const escaped = input[position++];
          const escapes = { '0': '\0', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\x1a' };
          value += escapes[escaped] ?? escaped;
        } else value += char;
      }
      throw new Error('Unterminated SQL literal.');
    }
    const match = /^(NULL\b|[-+]?\d+(?:\.\d+)?)/i.exec(input.slice(position));
    if (!match) throw new Error('Only strings, numbers, and NULL are accepted as SQL values.');
    position += match[0].length;
    return match[0].toUpperCase() === 'NULL' ? null : Number(match[0]);
  };
  while (position < input.length) {
    take('(');
    const row = [literal()];
    whitespace();
    while (input[position] === ',') { position++; row.push(literal()); whitespace(); }
    take(')');
    rows.push(row);
    whitespace();
    if (position === input.length) break;
    take(',');
    whitespace();
    if (position === input.length) throw new Error('Missing row after comma.');
  }
  return rows;
}

function readAllowlistedRows(sql) {
  const data = { acts: [], chapters: [], legal_contents: [] };
  for (const statement of statements(sql)) {
    const tableMatch = /^INSERT\s+INTO\s+`?([a-z_]+)`?\s*/i.exec(statement);
    if (!tableMatch || !TABLES.has(tableMatch[1].toLowerCase())) continue;
    const rest = statement.slice(tableMatch[0].length);
    const insert = /^\(([^)]+)\)\s+VALUES\s+([\s\S]+)$/i.exec(rest);
    if (!insert) throw new Error('Unsupported allowlisted INSERT syntax.');
    const columns = insert[1].split(',').map((column) => {
      const match = /^\s*`?([a-z_][a-z_0-9]*)`?\s*$/i.exec(column);
      if (!match) throw new Error('Unsupported INSERT column name.');
      return match[1].toLowerCase();
    });
    if (new Set(columns).size !== columns.length) throw new Error('Duplicate INSERT column.');
    for (const values of parseLiteralRows(insert[2])) {
      if (values.length !== columns.length) throw new Error('INSERT column/value count mismatch.');
      data[tableMatch[1].toLowerCase()].push(Object.fromEntries(columns.map((column, index) => [column, values[index]])));
    }
  }
  return data;
}

function decodeEntities(text) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', bull: '•', copy: '©', reg: '®' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity) => {
    if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? whole;
    const code = entity[1].toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
  });
}

// Treat source HTML as data and emit plain text. Paragraphs and list items keep
// separate boundaries; no source HTML is shipped to an HTML renderer.
function htmlToText(html) {
  return decodeEntities(String(html)
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<\s*br\b[^>]*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6])\s*>/gi, '\n\n')
    .replace(/<\s*\/?\s*(ul|ol|li)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ''))
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n[\t ]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const slugify = (value) => String(value).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const actId = (sourceId) => `import-act-${SELECTED_ACTS.get(sourceId).code}`;
const chapterId = (sourceId) => `import-chapter-${sourceId}`;

export function importLegalContent(sql) {
  const source = readAllowlistedRows(sql);
  const selectedActs = source.acts.filter((row) => SELECTED_ACTS.has(row.id) && row.status === 1);
  if (new Set(selectedActs.map((row) => row.id)).size !== selectedActs.length) throw new Error('Duplicate selected act IDs.');
  const activeActIds = new Set(selectedActs.map((row) => row.id));
  const selectedChapters = source.chapters.filter((row) => activeActIds.has(row.act_id));
  if (new Set(selectedChapters.map((row) => row.id)).size !== selectedChapters.length) throw new Error('Duplicate chapter IDs.');
  const chaptersById = new Map(selectedChapters.map((row) => [row.id, row]));
  const acts = selectedActs.map((row) => {
    const config = SELECTED_ACTS.get(row.id);
    return { id: actId(row.id), slug: config.slug, short_name: config.shortName, title: row.title, name: row.title, year: row.year, act_number: row.act_number, description: row.description, category: config.category, status: 'published', ...PROVENANCE };
  });
  const chapters = selectedChapters.map((row) => ({
    id: chapterId(row.id), slug: `${SELECTED_ACTS.get(row.act_id).code}-${slugify(row.name)}`, act_id: actId(row.act_id), chapter_number: row.order_num, order_num: row.order_num, title: row.title, name: row.name, description: row.description, status: 'published', ...PROVENANCE,
  }));
  const sections = source.legal_contents.filter((row) => activeActIds.has(row.act_id) && row.status === 1 && row.content_type_id === 1).map((row) => {
    const match = /^Section\s+(\d+)$/.exec(row.content_number);
    if (!match) throw new Error('Unsupported section number for selected act.');
    if (row.chapter_id !== null && (!chaptersById.has(row.chapter_id) || chaptersById.get(row.chapter_id).act_id !== row.act_id)) throw new Error('Section references an unavailable or unrelated chapter.');
    const config = SELECTED_ACTS.get(row.act_id);
    const sectionNumber = Number(match[1]);
    return { id: `import-section-${config.code}-${sectionNumber}`, slug: `section-${sectionNumber}-${slugify(row.title)}`, act_id: actId(row.act_id), chapter_id: row.chapter_id === null ? null : chapterId(row.chapter_id), act_code: config.code, section_number: sectionNumber, title: row.title, section_text: htmlToText(row.content), category: config.category, status: 'published', ...PROVENANCE };
  });
  if (new Set(sections.map((row) => row.id)).size !== sections.length) throw new Error('Duplicate imported sections.');
  return {
    metadata: { ...PROVENANCE, scope: 'BNS and Family Law (Hindu Marriage Act, 1955) only', source_act_ids: selectedActs.map((row) => row.id), content_scope: 'Abbreviated sample provisions supplied by the database seed; these are not complete Acts or verified current statutory text.', counts: { acts: acts.length, chapters: chapters.length, sections: sections.length }, execution: 'Read-only text parsing; no SQL statements executed.' },
    acts,
    chapters,
    sections,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv[2];
  if (!input) throw new Error('Usage: node scripts/import-legal-content.mjs /path/to/schema.sql [output.json]');
  const output = process.argv[3] ?? fileURLToPath(new URL('../src/data/imported-legal-content.json', import.meta.url));
  const content = importLegalContent(await readFile(input, 'utf8'));
  await writeFile(output, `${JSON.stringify(content, null, 2)}\n`);
  console.log(`Imported ${content.acts.length} acts, ${content.chapters.length} chapters, and ${content.sections.length} sections into ${output}.`);
}
