# Shared Supabase contract

This application connects to the same Supabase project as the Naitik Law Admin Panel. No table-creation migration is included, and the public site does not create, edit or delete legal content. Align these mappings with the existing admin schema before production. Do not create a second data model to satisfy a naming difference.

## Credentials and access

Set only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Browser credentials are visible to visitors. RLS, database privileges and Storage policies provide authorization; a hidden button or a client-side filter does not replace them.

The reusable client in `src/lib/supabase.ts` disables session persistence, token refresh and URL session detection because the public site has no admin login. It refuses obvious `sb_secret_` keys and legacy JWTs whose role is `service_role`. This runtime check cannot prevent Vite from embedding a mistakenly supplied build variable, so only use the public publishable key when building. Missing or invalid client configuration produces empty states. Network or schema failures produce error states.

## Common content columns

The public query service expects these columns on the content tables it reads:

| Column | Contract |
| --- | --- |
| `id` | Existing primary key; UUID/string or numeric values are normalized to strings for rendering. |
| `slug` | Stable, unique, URL-safe slug for Act, section, Constitution article, case and blog detail routes. |
| `status` | Published rows use the exact value `published`. All public content queries filter this column. |
| `created_at` | Timestamp used for descending order unless the caller supplies another ordering column. |
| `published_at` | Optional publication timestamp displayed when present. |
| `category` | Optional text category used by library filters; see values below. |

The normalization layer supplies the display `title` from `title`, then `name`, then `case_name`, while preserving the other admin fields. Detail content may be stored as plain strings or simple arrays. HTML is shown as plain readable text and is not executed.

## Table and field mapping

Fields in **Query columns** are referenced by server queries and must exist with the documented names, or be mapped in `src/services/content.ts` and the relevant page. Other display fields are optional; missing values use an empty state or omit the relevant detail.

| Shared table | Query columns in addition to common fields | Display/detail fields |
| --- | --- | --- |
| `acts` | `name`, `short_name`, `description`, `category` | `year`, `icon`, `image_url`, `summary` |
| `chapters` | `act_id`, `chapter_number`, `title` | `name`, `description` |
| `sections` | `act_id`, `chapter_id`, `section_number`, `title`, `section_text`, `explanation` | `act_code`, `summary`, `key_points`, `examples`, `classification`, `punishment`, `related_sections`, `related_case_laws` |
| `constitution_articles` | `article_number`, `title`, `article_text`, `explanation`, `part` | `part_number`, `key_points`, `importance`, `landmark_judgments`, `related_articles`, `related_case_laws` |
| `case_laws` | `case_name`, `citation`, `short_summary`, `category` | `court`, `year`, `judgment_date`, `judges`, `facts`, `issues`, `arguments`, `judgment`, `legal_principle`, `importance`, `exam_notes`, `related_acts`, `related_sections`, `related_articles` |
| `articles` | `title`, `excerpt`, `category` | `content`, `featured_image_url` or `featured_image`, `author`, `seo_title`, `seo_description` |
| `notes` | `title`, `subject`, `description`, `semester` | `thumbnail_url` or `thumbnail`, `pdf_url`, `file_url`, `download_url` |
| `videos` | `title`, `description`, `category` | `youtube_url` or `video_url`, `thumbnail_url`, `duration`, `views` |
| `site_settings` | See public settings below. | Only public site configuration. |
| `subscribers` | INSERT only: `email`. | No subscriber information is selected by this app. |

`act_id` and `chapter_id` refer to the existing `acts.id` and `chapters.id`. Chapter queries are Act-scoped; section browsing is Act-scoped, optionally chapter-scoped, and paginated. Section queries without an Act/chapter filter or explicit search are refused by the service. Section text/search is limited to the current page. Chapter pages contain at most 50 rows; section pages contain 20. The service caps all content pages at 100 rows.

Dedicated `/bns`, `/bnss` and `/bsa` routes resolve an Act whose `slug` is respectively `bns`, `bnss`, `bsa`, **or** whose `short_name` is exactly `BNS`, `BNSS`, `BSA`. Keep `short_name` equal to the code even if the canonical slug contains its year. Optionally set `sections.act_code` to the corresponding lowercase code for preferred section URLs. Generic section links also work without this field.

`chapter_number` and `section_number` must sort in the intended legal order in Postgres. Previous/next navigation compares `section_number` within the same Act using `lt`/`gt`, so numeric database columns are appropriate for these numbered codes. If the existing admin represents alphanumeric provisions or alternative ordering, map the browser and neighbor queries to its existing numeric ordering column; do not rely on lexicographic text ordering.

The generic service also recognizes `categories` and `tags` with `name`, `slug`, `status` and `created_at`, but the current public screens use category filters and do not fetch those tables. `article_tags` and `media` are not queried directly; admin-managed media and PDFs are consumed through public URLs stored on the associated records. The app never queries `profiles` or `activity_logs`.

### Filter values

Filters use equality against the admin's stored value; adapt these labels to the existing admin values if they differ.

- Acts: `Criminal Law`, `Civil Law`, `Constitutional Law`, `Family Law`, `Other Laws`.
- Cases: `Constitutional`, `Criminal`, `Civil`, `Family`, `Contract`, `Tort`.
- Notes: semester values `1` through `6`.
- Videos: `BNS Series`, `BNSS Series`, `Constitution Series`, `Case Laws`, `Legal Awareness`, `Law Student Tips`.
- Blog categories are selected in the article library; the `category` column must use matching strings.
- Constitution part choices use matching strings such as `Part III`; article ordering uses `article_number`. Adapt ordering to an existing numeric sort column if that value is stored as alphanumeric text.

“All” choices omit a category/semester predicate. An empty category is not used as a filter.

## Public website settings

`site_settings` must contain **public settings only**, with a public SELECT policy restricted to those records. Never store API secrets, SMTP credentials, admin-only preferences or private information in publicly readable settings rows. The browser reads up to 50 existing settings rows; keys it does not use are ignored in the UI but still must be safe for public access.

The loader accepts the existing admin's `key`/`value` rows, `setting_key`/`setting_value` rows, or a singleton row containing these columns. Values must be strings.

| Key | Purpose/default |
| --- | --- |
| `website_name` | `NAITIK LAW` |
| `tagline` | `Learn Law the Simple Way` |
| `logo_url` | Optional public logo URL; alias `logo` is accepted. |
| `favicon_url` | Optional public favicon URL; alias `favicon` is accepted. |
| `youtube_url` | Actual channel URL; empty until configured. |
| `instagram_url` | Actual profile URL; empty until configured. |
| `telegram_url` | Actual channel URL; empty until configured. |
| `whatsapp_url` | Actual channel/contact URL; empty until configured. |
| `contact_email` | Public contact address; empty until configured. |
| `homepage_heading` | `NAITIK LAW` |
| `homepage_description` | Brand-purpose description. |
| `default_seo_title` | Homepage/default document title. |
| `default_seo_description` | Homepage/default meta description. |
| `website_url` | Optional production origin for canonical metadata. |

`site_name`, `seo_title` and `seo_description` are also accepted as aliases. The data service validates external settings/content links as HTTP or HTTPS, rejects embedded credentials and control characters, and empties unsafe values such as `javascript:` URLs before components receive them. Root-relative logo, favicon and image paths are allowed. Invalid favicon values retain the bundled asset. Contact email is checked before being used in a `mailto:` link. YouTube IDs used to derive URLs must have the standard 11-character form.

Related-resource objects embedded in published records must themselves include `status: 'published'`; the public UI omits structured records without that status. Keep curated plain-string references within the parent's published explanatory content. A reference does not grant access to a linked draft: its detail query and RLS must still enforce published status.

## Search behavior and indexes

`searchAll(query, page)` runs paginated server queries across `acts`, `sections`, `constitution_articles`, `case_laws`, `articles`, `notes` and `videos`, with at most six rows per table for each page. Searches use `ilike` on the mapped name/title/summary fields. Numeric `Section 103` and `Article 21` queries also use equality on their number columns. `BNS 103`, `BNSS 103` and `BSA 103` resolve and constrain the correct Act before requesting sections. Searches are bounded, inputs are normalized for PostgREST filter grammar, and results are never filtered by downloading a complete table.

Create or confirm indexes in the existing admin-managed database as appropriate to its size: `slug`, `status`, `act_id`, `chapter_id`, numeric ordering columns, and the actual fields used for category filters. Substring `ilike` searches benefit from Postgres trigram indexes on the searched text columns. Apply these through the existing database migration process. The public project does not install extensions or change the database.

List results and settings are cached in memory for 45 seconds. A failed request is removed from the cache; retry controls clear cached queries. Unmounting a screen prevents an older response from updating that screen.

## Required RLS and Storage behavior

Confirm RLS is enabled on all shared tables. For the anonymous browser role:

1. Allow SELECT on content rows only when `status = 'published'`, and grant access only to fields that are intended for public display. Drafts remain inaccessible even if a visitor bypasses the client filters.
2. Allow SELECT only on public `site_settings` rows. Keep private configuration in protected records or tables managed by the existing admin.
3. Do not allow content INSERT, UPDATE or DELETE.
4. Do not grant SELECT on `subscribers`, `profiles`, `activity_logs` or other private admin data.
5. Allow a constrained subscriber INSERT policy **or** route signup through an existing trusted server function. Do not allow arbitrary updates/deletes or expose the subscriber list to detect duplicates.
6. Serve published note PDFs and public images through suitable Supabase Storage read policies/public buckets. If notes are private, generate signed URLs in a trusted backend rather than putting private credentials in the browser.

The app requests `select('*')` for public content. Tables containing private admin columns must therefore restrict public column privileges or expose only their existing public fields through the shared contract; map the service projection accordingly before connecting them. RLS protects rows, not individual columns.

### Newsletter safety and duplicates

Signup trims and lowercases the email, validates it, and issues exactly one INSERT containing only `{email}`. It does not perform a SELECT or request returned subscriber rows. The database must enforce uniqueness on the normalized email; an existing equivalent unique constraint is sufficient. For mixed-case legacy data, a unique index on `lower(email)` is appropriate. Check existing records/constraints through the Admin Panel's migration process before adding it; do not remove subscriber data automatically.

A Postgres unique violation (`23505`) shows “This email is already subscribed.” Other failures show a general retry message. Database/server-side validation must also enforce valid length and basic email shape, since browser validation can be bypassed.

For a public production signup, use an existing trusted function or rate-limited edge endpoint with abuse protection and, where appropriate, confirmed opt-in. If you choose that route, replace the single insert inside `subscribe()` in `src/services/content.ts` with the existing endpoint call. This application captures subscriber addresses; it does not send email or start a newsletter campaign.

## Connection checklist

Confirm the field mappings against the existing Admin Panel, apply the existing project's RLS/Storage policies, configure the two public environment variables, set the public settings URLs, and publish verified content through the Admin Panel. Then check loading, empty database, missing-content, revoked-access and network failure behavior against the real project. No live database verification is possible without the owner's project configuration.
