# Naitik Law

A responsive public legal education website built with React, Vite, TypeScript, Tailwind CSS, React Router, Lucide and Supabase. It uses the existing Naitik Law Admin Panel database. It does not create a separate content database or include invented statutory text, judgments, videos or professional qualifications.

## Local development

Use Node.js 22.12 or newer and npm.

```bash
npm install
cp .env.example .env.local
```

Set the existing Supabase project's public credentials in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Optionally set `VITE_SITE_URL=https://YOUR_PUBLIC_DOMAIN` for the build-generated sitemap. On Netlify the generator automatically uses Netlify's `URL` variable if `VITE_SITE_URL` is absent. For this Sites publication, `site.config.json` provides the verified deployed origin as the final fallback; an explicit environment variable overrides it.

```bash
npm run dev
```

Vite prints the local development URL. Restart it after changing environment variables. Vite embeds `VITE_` values into the browser build; use only a publishable/public key. Never place a service-role key, secret key or administrative credential here.

Without credentials, the site now displays the supplied public BNS and Hindu Marriage Act database excerpts: 2 Acts, 3 chapters and 6 sections. Other libraries retain friendly empty states. See [the database import notes](docs/DATABASE-IMPORT.md) for provenance, scope and the safe extraction command. The uploaded MySQL schema is not executed or shipped; no private/admin records are imported. A configured Supabase project remains authoritative, including when its queries return empty results or errors; the snapshot is used only when Supabase is not configured. Connect the database and publish content through the existing Admin Panel to populate the library. External social and channel buttons become available when their URLs are set in `site_settings`.

## Build and validation

```bash
npm run typecheck
npm run build
npm run preview
```

The build performs TypeScript checking, produces `dist/`, then generates `dist/robots.txt` and `dist/sitemap.xml` for the configured public origin. Preview serves that production build locally. Check the home page, each library route, mobile navigation, dark mode, search, direct detail URLs and subscription feedback. Database access cannot be verified against your project until its credentials and RLS policies are configured.

## Public routes

| Route | Purpose |
| --- | --- |
| `/` | Home |
| `/bare-acts` | Searchable Act library |
| `/family-law` | Family Law Act library |
| `/family-law/:sectionSlug` | Hindu Marriage Act section excerpts |
| `/bare-acts/:actSlug` | Act, chapters and paged sections |
| `/bns`, `/bnss`, `/bsa` | Dedicated code browsers |
| `/bns/:sectionSlug`, `/bnss/:sectionSlug`, `/bsa/:sectionSlug` | Section details |
| `/constitution` | Constitution article library |
| `/constitution/:slug` | Constitution article details |
| `/case-laws`, `/case-laws/:slug` | Judgments and case details |
| `/notes` | Semester notes and published PDF links |
| `/videos` | Published video library |
| `/blog`, `/blog/:slug` | Articles and article details |
| `/search?q=...` | Universal public search |
| `/about` | Brand purpose and configured contact links |

Unrecognized URLs display the 404 page. Generic section-detail aliases are configured in `src/App.tsx`.

## Database connection

Read [the shared Supabase contract](docs/SUPABASE.md) before connecting production. It lists the exact field names used by queries and screens, public settings, subscriber constraints and required RLS behavior. If the Admin Panel uses different column names, map the public service to that existing schema; do not create competing tables.

The app reads published rows from `acts`, `chapters`, `sections`, `constitution_articles`, `case_laws`, `articles`, `notes` and `videos`, plus public `site_settings`. Newsletter signup inserts into `subscribers`; it never reads the subscriber list. The application does not read `profiles` or `activity_logs` and has no content-editing or deletion operations.

Universal search runs seven bounded server queries in parallel, with up to six results per content table per page. It filters `status = 'published'`, queries mapped fields through PostgREST, and requests counts for pagination. A query such as `BNS 103` first resolves the published BNS Act and scopes the section search to that Act. Type filters query only the selected table. It never downloads the complete database to search in the browser. Browser query results are cached for 45 seconds; errors are not cached.

## Netlify deployment

1. Push this project's source to a GitHub repository. Do not commit `.env.local`, `node_modules` or `dist`.
2. In Netlify, select **Add new project → Import an existing project → GitHub**, authorize the repository and select it.
3. If this folder is the repository root, leave the base directory blank. If it is a subdirectory, set the base directory to that folder.
4. Set **Build command** to `npm run build` and **Publish directory** to `dist`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Netlify project's environment variables. Apply them to the required deployment contexts.
6. Deploy. Changes to these variables require a new build.
7. Configure the domain and optionally set `VITE_SITE_URL` to that canonical origin. Rebuild, confirm the generated sitemap uses it, and test direct route refreshes on the resulting Netlify URL.

`netlify.toml` and `public/_redirects` both configure a `200` fallback to `/index.html`, so React Router handles deep links after refresh. Deployment is not performed automatically by this project.

## Content, SEO and accessibility

Site identity, channel/social URLs, contact details and default metadata are centralized in `site_settings`, with brand defaults when settings are unavailable. Detail pages set their own title and description. `public/robots.txt`, `public/sitemap.xml` and the bundled SVG favicon are included. `scripts/generate-seo.mjs` writes the production robots file and a sitemap for the main public routes and the active imported Act/section routes during each build, using `VITE_SITE_URL` or Netlify's automatic `URL` environment variable. An unknown/invalid domain produces a valid empty sitemap without fabricated URLs. Extend the sitemap with published detail URLs through the existing Admin Panel or deployment pipeline; the build does not download legal content or need database access for SEO files.

The responsive layout includes a mobile menu, collapsible chapter navigation, paged content, image lazy loading, skeleton/error/empty states and a saved light/dark preference. Controls have labels, focus states and keyboard support. Rich legal text is rendered as plain text rather than injected HTML.

## Project organization

- `src/components/`: shared layout, search, content cards, section navigation, newsletter and SEO.
- `src/pages/`: route-level library and detail screens.
- `src/services/content.ts`: published queries, search, public settings and safe newsletter insert.
- `src/hooks/useContent.ts`: cancellable view updates around cached data services.
- `src/context/SettingsContext.tsx`: shared public site settings.
- `src/lib/supabase.ts`: the reusable public-only client.
- `src/types/content.ts`: shared application types and query options.
- `public/`: local visual assets and hosting/SEO files.

## Remaining owner setup

Connect the existing Supabase project; confirm column mappings and RLS; add the subscriber uniqueness constraint if absent; provide public settings and valid external URLs; publish verified legal content, video records and PDF Storage URLs through the Admin Panel; configure the production site origin; then deploy to Netlify and test against the actual project. Content availability and newsletter delivery depend on those services. Subscriber capture stores an address; sending newsletters requires your separate email workflow.

The included SQL snapshot uses the existing public `acts`/`chapters`/`sections` interface after mapping MySQL `legal_contents` to sections. It does not create a second backend or insert records into Supabase. Browser reads use a lazy-loaded public-only JSON chunk while no live backend is configured.
