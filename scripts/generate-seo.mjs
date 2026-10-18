import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = loadEnv('production', projectRoot, ['VITE_', 'URL']);
const config = JSON.parse(await readFile(join(projectRoot, 'site.config.json'), 'utf8'));
const candidate = process.env.VITE_SITE_URL || env.VITE_SITE_URL || process.env.URL || env.URL || config.canonicalOrigin || '';

function canonicalOrigin(value) {
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.origin;
  } catch { return ''; }
}

function xml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const origin = canonicalOrigin(candidate);
const routes = ['/', '/bare-acts', '/bns', '/bnss', '/bsa', '/constitution', '/case-laws', '/notes', '/videos', '/blog', '/about', '/search', '/family-law'];
const liveSource = Boolean((process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL) && (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY));
if (!liveSource) {
  const imported = JSON.parse(await readFile(join(projectRoot, 'src/data/imported-legal-content.json'), 'utf8'));
  for (const act of imported.acts.filter(record => record.status === 'published')) routes.push(`/bare-acts/${encodeURIComponent(act.slug)}`);
  for (const section of imported.sections.filter(record => record.status === 'published')) routes.push(`${section.act_code === 'bns' ? '/bns' : '/family-law'}/${encodeURIComponent(section.slug)}`);
}
const entries = origin ? routes.map((path) => `  <url><loc>${xml(`${origin}${path}`)}</loc></url>`).join('\n') : '';
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}${entries ? '\n' : ''}</urlset>\n`;
const robots = `User-agent: *\nAllow: /\n${origin ? `\nSitemap: ${origin}/sitemap.xml\n` : ''}`;
const dist = join(projectRoot, 'dist');
await mkdir(dist, { recursive: true });
await writeFile(join(dist, 'sitemap.xml'), sitemap);
await writeFile(join(dist, 'robots.txt'), robots);
console.log(origin ? `SEO files generated for ${origin} (${routes.length} public routes).` : 'SEO files generated without a domain. Set VITE_SITE_URL or the Netlify URL environment variable to populate the sitemap.');
