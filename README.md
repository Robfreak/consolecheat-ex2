# PS-Plus-Archiv

Monthly games for PlayStation Plus Essential, and the monthly PS Plus games from before that rename. German is the primary language. The page uses the same cards, type, light and dark theme, and language list as [consolecheat](https://github.com/Robfreak/consolecheat) and the [Title-ID-Finder](https://github.com/Robfreak/consolecheat-ex1/pull/1).

No account, no tracking, nothing uploaded. The list stays in the browser tab. Language and theme are the only things kept locally, under the same keys as the hub (`consolecheat-lang`, `consolecheat-theme`).

Expected site: <https://robfreak.github.io/consolecheat-ex2/>

## What it does

- Lists the monthly games newest month first.
- Filters by region (North America, Europe/PAL, Japan, Asia) and by platform (PS4, PS5), plus a year and a name search.
- Each game opens in the Title-ID-Finder. The link is `https://robfreak.github.io/consolecheat-ex1/?q=` plus the game name, or plus one CUSA/PPSA when that region and platform have exactly one matching ID. Every matched ID is also its own link.
- The Title-ID-Finder on branch `cursor/title-id-finder-0ef2` reads `?q` for a name and for a title ID. It does not read a separate `?id` parameter. This archive does not use `?id`.

## Data

`public/archive.json` is built by `scripts/build-archive.mjs`. The script reads the monthly-game tables on the [PlayStation Wiki](https://playstation.fandom.com/wiki/PlayStation_Plus) (CC BY-SA) and keeps a row only when that table marks PS4 or PS5. The citation URL on the row is kept with it. See `THIRD_PARTY_NOTICES.md`.

Pages the script asks for:

- North America and PAL, 2013 through the current UTC year. Through 2022 the page title is “PlayStation Plus monthly games”. From 2023 it is “PlayStation Essential monthly games”.
- [Asia](https://playstation.fandom.com/wiki/List_of_PlayStation_Plus_monthly_games_(Asia)), one page.
- [Japan](https://playstation.fandom.com/wiki/List_of_PlayStation_Plus_monthly_games_(Japan)), one page.

A year page from 2014 through the current year must exist and must contain at least one PS4 or PS5 row, or the script stops. It does not invent a month to fill a hole.

Title IDs come from the Title-ID-Finder file `public/titles.json` at commit `d8264e5adf8e3806c6868623ca5a6aa1829d28a1` of `cursor/title-id-finder-0ef2` (compact format 2). That file is built from andshrew/PlayStation-Titles. Before the comparison the script strips ™/®, a leading “EA Sports”, a trailing `(year)`, an availability suffix such as `(Middle East)` or `(DLC only)`, and the typo Challanger → Challenger. The suffix is kept as the entry’s `note` and shown under the title. A name matches only when that cleaned key is exactly one game. If the dataset has several releases of that name (the base title and a remaster, campaign, or other edition, or two records with the same name), the row gets no ID. The ID’s region and platform still have to be the ones on the monthly row. Unknown-region IDs are not copied.

A removal date that falls before the add date is moved forward one year when that lands within 45 days, which is the December-to-January typo (December 2025 North America was “January 5, 2025” on the wiki). Every correction is printed by the script. Longer spans the wiki actually printed, including the June 2026 PAL rows, are left as they are.

The same normalized key merges duplicate rows inside one month, so “Titanfall™ 2” and “Titanfall 2”, or “F1 25” and “EA Sports F1 25”, become one game.

```bash
npm run data     # refresh public/archive.json
npm test         # parser fixtures and the checks below
npm run build    # refresh, typecheck, Vite build (base /consolecheat-ex2/)
```

The build checks these rows against the fetched wiki text before it writes the file:

| Region | Month | Name contains | Citation contains |
| --- | --- | --- | --- |
| North America | 2026-10 | F1 25 | `blog.playstation.com/2026/09/30` |
| PAL | 2026-10 | Hunt: Showdown 1896 | `playstation.com` |
| North America | 2026-01 | Need for Speed Unbound | `blog.playstation.com` |
| North America | 2025-01 | Suicide Squad | `blog.playstation.com` |
| North America | 2020-01 | Uncharted | `playstation.com` |
| North America | 2018-03 | Bloodborne | `playstation.com` |
| PAL | 2024-01 | A Plague Tale | `playstation.com` |
| Japan | 2017-10 | Metal Gear Solid V | `jp.playstation.com` |
| Asia | 2021-01 | Shadow of the Tomb Raider | `playstation.com` |

The generated file is compact JSON, about 150 KB. Counts from the latest run of the script are in the file’s `stats` and `coverage` fields and are shown on the page.

### What the source does not have

Left out on purpose, because the tables do not mark them as PS4 or PS5:

- PS3, PSP, Vita, and PlayStation TV rows.
- Rows that are only PlayStation VR.

Not in the source, so not in the archive:

- Korea has no monthly list of its own.
- Japan’s page has a PS4 column and no PS5 column. The PS4 rows it does mark all fall in 2017. There is nothing later.
- Asia’s page runs from December 2013 through September 2021.
- North America has no PS4/PS5 row for December 2013.
- PAL has no PS4/PS5 row for December 2013 or May 2014.
- PAL July 2026 is empty as a month because the wiki dates Call of Duty: Modern Warfare III, For the King II, and CrossCode to 2 June 2026 (removed 3 August 2026). The citation on those rows is the July announcement (`…de-julio-…`). The archive keeps the date printed in the table.

A regional or availability suffix such as “(Spain and Portugal)”, “(Middle East)”, or “(DLC only)” is stored in `note` and shown under the title. It is not a separate region filter. Asia’s February 2021 cell `[[Biped]]（Taiwan）[[Shio]]（Hong Kong）` is two games: Biped (Taiwan) and Shio (Hong Kong).

## Footer

The footer matches the Title-ID-Finder at `d8264e5`: the name, then Impressum and Datenschutz, the free line, the privacy line, and the “not Sony” line. Those two links are `#impressum` and `#datenschutz` on this site, the same hash pages that project uses. The Impressum is the same placeholder text. No name, address, or contact is filled in. The privacy page describes this archive (static files, no cookies, self-hosted fonts, the wiki list) and points at the same GitHub privacy statement.

The source line is “Daten aus dem PlayStation Wiki (Fandom), CC BY-SA 4.0, bearbeitet”, with [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) linked. Fonts are the fontsource files with the `.woff` fallback removed, same as the Title-ID-Finder, so the build ships only `.woff2`.

## GitHub Pages

`.github/workflows/pages.yml` runs on every push to `main` (and on `workflow_dispatch`). It tests, rebuilds the JSON, builds the site, and pushes `dist/` to the orphan branch `gh-pages` (`peaceiris/actions-gh-pages`, Jekyll off).

Vite `base` is `/consolecheat-ex2/`, which matches a project site at `https://robfreak.github.io/consolecheat-ex2/`.

The workflow does not run on a pull request, and this change is not merged. The Actions token can update `gh-pages` only when Actions has write permission. It often cannot turn Pages on. Until both of these are done, the URL stays down:

1. Merge the pull request into `main` so the workflow runs.
2. **Settings → Actions → General → Workflow permissions → Read and write permissions.** Save.
3. **Settings → Pages → Build and deployment → Source: Deploy from a branch.**
4. **Branch: `gh-pages`, folder: `/ (root)`.** Save.

The first deploy can take a minute after that.
