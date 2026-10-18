# BNS and Family Law database import

The website includes public legal content extracted from the supplied `schema.sql` attachment. The file is MySQL schema and seed data, so this import reads its text locally; it does not run SQL, change any database, or require credentials. The entire attachment is deliberately excluded from the application and source download.

## Included content

| Act | Source act ID | Chapters | Sections |
| --- | --- | --- | --- |
| Bharatiya Nyaya Sanhita, 2023 | 2 | Chapter I: Preliminary; Chapter II: Of Punishments | 1, 2, 4 |
| Hindu Marriage Act, 1955 | 11 | Chapter I: Preliminary | 1, 2, 5 |

Total: **2 acts, 3 chapters, 6 sections**. Family Law in this attachment consists of the Hindu Marriage Act records above. No additional Family Law statutes or provisions have been invented.

**The attachment labels these provisions as sample seed content. Several provisions are abbreviated. These records are database excerpts, not complete Acts or verified current statutory text.** Each imported record carries this notice for display: “Imported database excerpt. Verify the complete current provision from an official source.” No simple explanations, case citations, or examples have been generated for them.

## Reproduce the import

From the project directory, run:

```sh
node scripts/import-legal-content.mjs /path/to/schema.sql
```

An optional second argument selects a different output JSON path. The default output is `src/data/imported-legal-content.json`. Generation is deterministic; no current timestamps are added.

The parser accepts literal `INSERT INTO` values only in the `acts`, `chapters`, and `legal_contents` tables. It handles quoted strings, escaped/doubled quotes, SQL comments, and semicolons inside string values without evaluating code. Expressions and unsupported syntax in allowlisted INSERTs fail the import. DDL, DROP statements, and all other tables are ignored. Only active (`status = 1`) selected acts and their active section rows are included; chapter visibility follows the selected parent act. Section/chapter relationships are checked before writing. The script does not import users, credentials, settings, subscribers, analytics, or any other private/admin data.

## Field mapping

- Acts receive stable IDs (`import-act-bns`, `import-act-hma`), slugs (`bns`, `hindu-marriage-act-1955`), source titles, year, act number, description, short name, and website category.
- Chapters receive stable IDs (`import-chapter-5`, `import-chapter-6`, `import-chapter-21`); `order_num` supplies both the numeric `chapter_number` and display order. Source chapter name, title, and description are retained.
- Sections receive stable IDs (`import-section-bns-1`, for example), a title-based slug, mapped act/chapter IDs, numeric section number, and `section_text`.
- Source HTML is converted to plain text with paragraph and list boundaries, with HTML entity decoding. Source legal wording is retained; application rendering must treat this field as text.
- Every imported record has `status: published` and explicit source provenance and excerpt notice. The JSON `metadata` object records scope and counts.

The bundled content is a public website snapshot. It does not establish a live connection to the supplied MySQL database or create records in a Supabase admin database. Future supplied snapshots can be regenerated with the same command.

## Import verification

The supplied attachment produced the exact counts and section numbers in the table above. Verification also checked deterministic output, valid act/chapter references, plain-text conversion, preservation of source legal phrases, HTML entity decoding, escaped and doubled quotes, comments and semicolons inside strings, omission of unrelated private tables, omission of inactive rows and inactive parent acts, and rejection of executable expressions in allowlisted INSERT values. The parser passed Node's syntax check.
