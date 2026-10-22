import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  countEntries,
  decodeArchive,
  filterArchive,
  finderHref,
  visibleIds,
  type Archive,
  type Offer,
  type Region,
  type ViewFilters,
  yearsOf,
} from "./archive";
import { MailIcon, Mark, MoonIcon, SunIcon } from "./icons";
import { LegalPage } from "./legal";
import { RTL, copy, detectLang, fill, isLang, languageOptions, type Copy, type Lang } from "./messages";

type Page = "home" | "impressum" | "datenschutz";

type Theme = "light" | "dark";

const REGION_FILTERS: Region[] = ["US", "EU", "JP", "Asia"];

function readLang(): Lang {
  try {
    const stored = localStorage.getItem("consolecheat-lang");
    if (isLang(stored)) return stored;
    return detectLang(navigator.languages);
  } catch {
    return "de";
  }
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function readPage(): Page {
  const hash = location.hash.replace(/^#/, "");
  if (hash === "impressum") return "impressum";
  if (hash === "datenschutz") return "datenschutz";
  return "home";
}

function applyLang(next: Lang) {
  document.documentElement.lang = next;
  document.documentElement.dir = RTL.has(next) ? "rtl" : "ltr";
  localStorage.setItem("consolecheat-lang", next);
}

function applyTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  localStorage.setItem("consolecheat-theme", next);
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", next === "light" ? "#f4f1eb" : "#07090e");
}

function readFilters(): ViewFilters {
  const params = new URLSearchParams(location.search);
  const region = params.get("region");
  const platform = params.get("platform");
  const year = params.get("year");
  return {
    query: params.get("q") ?? "",
    region: region === "US" || region === "EU" || region === "JP" || region === "Asia" ? region : "all",
    platform: platform === "PS4" || platform === "PS5" ? platform : "all",
    year: year && /^\d{4}$/.test(year) ? year : "all",
  };
}

function regionLabel(t: Copy, region: Region): string {
  if (region === "EU") return t.regionEU;
  if (region === "US") return t.regionUS;
  if (region === "JP") return t.regionJP;
  return t.regionAsia;
}

function regionClass(region: Region): string {
  if (region === "EU") return "region-pill region-eu";
  if (region === "US") return "region-pill region-us";
  if (region === "JP") return "region-pill region-jp";
  return "region-pill region-asia";
}

function localeOf(lang: Lang): string {
  if (lang === "zh-Hant") return "zh-Hant";
  if (lang === "no") return "nb";
  return lang;
}

function formatMonth(ym: string, lang: Lang): string {
  const [year, month] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat(localeOf(lang), { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, (month ?? 1) - 1, 1)),
  );
}

function formatDay(iso: string, lang: Lang): string {
  if (iso.length === 7) return formatMonth(iso, lang);
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat(localeOf(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function safeHttp(value: string): string {
  if (value.startsWith("https://") || value.startsWith("http://")) return value;
  return "";
}

export function App() {
  const [lang, setLang] = useState<Lang>(readLang);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [page, setPage] = useState<Page>(readPage);
  const initial = readFilters();
  const [query, setQuery] = useState(initial.query);
  const [region, setRegion] = useState<ViewFilters["region"]>(initial.region);
  const [platform, setPlatform] = useState<ViewFilters["platform"]>(initial.platform);
  const [year, setYear] = useState<ViewFilters["year"]>(initial.year);
  const [archive, setArchive] = useState<Archive | null>(null);
  const [error, setError] = useState(false);
  const deferred = useDeferredValue(query);
  const t = copy[lang];

  useEffect(() => {
    applyLang(lang);
    const name = page === "impressum" ? "Impressum" : page === "datenschutz" ? "Datenschutz" : t.title;
    document.title = `${name} · ${t.brand}`;
    if (page !== "home") window.scrollTo(0, 0);
  }, [lang, page, t.brand, t.title]);

  useEffect(() => {
    const sync = () => setPage(readPage());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    const url = new URL(location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    if (region !== "all") url.searchParams.set("region", region);
    else url.searchParams.delete("region");
    if (platform !== "all") url.searchParams.set("platform", platform);
    else url.searchParams.delete("platform");
    if (year !== "all") url.searchParams.set("year", year);
    else url.searchParams.delete("year");
    if (`${url.pathname}${url.search}` !== `${location.pathname}${location.search}`) {
      history.replaceState(null, "", url);
    }
  }, [platform, query, region, year]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}archive.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<unknown>;
      })
      .then((payload) => setArchive(decodeArchive(payload)))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(true);
      });
    return () => controller.abort();
  }, []);

  const filters = useMemo<ViewFilters>(() => ({ query: deferred, region, platform, year }), [deferred, platform, region, year]);
  const months = useMemo(() => (archive ? filterArchive(archive, filters) : []), [archive, filters]);
  const years = useMemo(() => (archive ? yearsOf(archive) : []), [archive]);
  const shown = countEntries(months);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href="https://consolecheat.com" className="flex min-w-0 items-center gap-3">
            <Mark />
            <span className="truncate font-display text-lg font-semibold tracking-tight">{t.brand}</span>
          </a>
          <div className="flex items-center gap-2">
            <a
              href="https://consolecheat.com"
              title={t.mailTitle}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-fg"
            >
              <MailIcon />
              {t.mail}
            </a>
            <label className="sr-only" htmlFor="lang">
              {t.language}
            </label>
            <select
              id="lang"
              value={lang}
              onChange={(event) => {
                if (isLang(event.target.value)) setLang(event.target.value);
              }}
              className="h-11 w-28 rounded-lg border border-line bg-surface px-2 text-sm text-fg sm:w-36"
            >
              {languageOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label={theme === "dark" ? t.themeLight : t.themeDark}
              onClick={() => {
                const next = theme === "dark" ? "light" : "dark";
                setTheme(next);
                applyTheme(next);
              }}
              className="inline-flex size-11 items-center justify-center rounded-lg border border-line bg-surface text-fg"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      {page === "home" ? (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="eyebrow text-xs font-medium uppercase text-steel">{t.eyebrow}</p>
        <h1 className="display-title mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t.title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{t.lede}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <p className="panel rounded-xl px-4 py-4 text-base font-medium leading-relaxed text-fg">{t.freeClaim}</p>
          <p className="panel rounded-xl px-4 py-4 text-base font-medium leading-relaxed text-fg">{t.privacyClaim}</p>
        </div>
        <p className="mt-4 text-sm text-subtle">{t.unofficial}</p>

        <section className="mt-10 scroll-mt-28" aria-labelledby="archive-heading">
          <div className="panel rounded-xl p-5 sm:p-6">
            <h2 id="archive-heading" className="font-display text-2xl font-semibold tracking-tight">
              {t.searchLabel}
            </h2>
            <label htmlFor="q" className="sr-only">
              {t.searchLabel}
            </label>
            <div className="relative mt-2">
              <input
                id="q"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.placeholder}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                className="h-12 w-full rounded-lg border border-line bg-bg px-3 pe-12 text-base text-fg outline-none placeholder:text-subtle"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t.clear}
                  className="absolute end-1 top-1 inline-flex size-10 items-center justify-center rounded-lg text-lg text-muted"
                >
                  ×
                </button>
              ) : null}
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <FilterRow
                label={t.regionsLabel}
                value={region}
                onChange={setRegion}
                options={[
                  ["all", t.filterAll],
                  ...REGION_FILTERS.map((item) => [item, regionLabel(t, item)] as const),
                ]}
              />
              <FilterRow
                label={t.platformLabel}
                value={platform}
                onChange={setPlatform}
                options={[
                  ["all", t.filterAll],
                  ["PS4", "PS4"],
                  ["PS5", "PS5"],
                ]}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="w-28 shrink-0 text-sm text-subtle">{t.yearLabel}</span>
                <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t.yearLabel}>
                  <YearButton on={year === "all"} onClick={() => setYear("all")}>
                    {t.filterAll}
                  </YearButton>
                  {years.map((item) => (
                    <YearButton key={item} on={year === item} onClick={() => setYear(item)}>
                      {item}
                    </YearButton>
                  ))}
                </div>
              </div>
            </div>
            {archive ? (
              <p className="mt-4 text-sm text-subtle">
                {fill(t.stats, {
                  months: archive.stats.months.toLocaleString(localeOf(lang)),
                  games: archive.stats.entries.toLocaleString(localeOf(lang)),
                  ids: archive.stats.withIds.toLocaleString(localeOf(lang)),
                })}
              </p>
            ) : null}
          </div>

          {archive ? <Coverage archive={archive} t={t} lang={lang} /> : null}

          <div className="mt-4" aria-live="polite">
            {!archive && !error ? <p className="panel rounded-xl px-5 py-8 text-muted">{t.loading}</p> : null}
            {error ? <p className="panel rounded-xl px-5 py-8 text-muted">{t.loadError}</p> : null}
            {archive ? <p className="mb-3 text-sm text-subtle">{fill(t.results, { n: shown.toLocaleString(localeOf(lang)) })}</p> : null}
            {archive && shown === 0 ? <p className="panel rounded-xl px-5 py-8 text-muted">{t.empty}</p> : null}
            <div className="flex flex-col gap-8">
              {months.map((month) => (
                <section key={month.ym} aria-labelledby={`m-${month.ym}`}>
                  <h3 id={`m-${month.ym}`} className="font-display text-xl font-semibold tracking-tight">
                    {formatMonth(month.ym, lang)}
                  </h3>
                  <ul className="mt-3 flex flex-col gap-3">
                    {month.entries.map((entry) => (
                      <GameCard key={`${month.ym}:${entry.name}`} name={entry.name} offers={entry.offers} t={t} lang={lang} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </section>
      </main>
      ) : (
        <LegalPage
          page={page}
          homeHref={`${import.meta.env.BASE_URL}${location.search}`}
          onHome={(event) => {
            event.preventDefault();
            history.pushState(null, "", `${location.pathname}${location.search}`);
            setPage("home");
            window.scrollTo(0, 0);
          }}
        />
      )}

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm leading-relaxed text-subtle sm:px-6">
          <p className="text-fg">{t.brand}</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Impressum und Datenschutz">
            <a href="#impressum" className="text-steel underline-offset-4 hover:underline">
              Impressum
            </a>
            <a href="#datenschutz" className="text-steel underline-offset-4 hover:underline">
              Datenschutz
            </a>
          </nav>
          <p>{t.freeClaim}</p>
          <p>{t.privacyClaim}</p>
          <p>{t.footerNote}</p>
          {archive ? (
            <p>
              <a href={archive.list} className="text-steel underline-offset-4 hover:underline">
                PlayStation Wiki (Fandom)
              </a>
              {", Autoren · "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                className="text-steel underline-offset-4 hover:underline"
              >
                {archive.license || "CC BY-SA 4.0"}
              </a>
              {" · bearbeitet"}
              {archive.generated ? ` · ${archive.generated}` : ""}
            </p>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

function Coverage({ archive, t, lang }: { archive: Archive; t: Copy; lang: Lang }) {
  return (
    <details className="panel mt-4 rounded-xl px-5 py-4 text-sm leading-relaxed text-muted">
      <summary className="cursor-pointer font-medium text-fg">{t.coverage}</summary>
      <div className="mt-3 flex flex-col gap-2">
        {(["US", "EU", "JP", "Asia"] as const).map((region) => {
          const row = archive.coverage[region];
          return (
            <p key={region}>
              {fill(t.range, {
                region: regionLabel(t, region),
                from: formatMonth(row.from, lang),
                to: formatMonth(row.to, lang),
                n: row.months,
              })}
              {row.holes.length ? ` · ${fill(t.holes, { list: row.holes.map((hole) => formatMonth(hole, lang)).join(", ") })}` : ` · ${t.noHoles}`}
            </p>
          );
        })}
        <p>{t.noKorea}</p>
        <p>{t.oldPlatforms}</p>
        {archive.omittedVr ? <p>{fill(t.vrOmit, { n: archive.omittedVr })}</p> : null}
        {archive.coverage.EU.holes.includes("2026-07") ? <p>{t.julyQuirk}</p> : null}
      </div>
    </details>
  );
}

function GameCard({ name, offers, t, lang }: { name: string; offers: Offer[]; t: Copy; lang: Lang }) {
  const ids = visibleIds(offers);
  const open = finderHref(ids.length === 1 ? ids[0] : name);
  return (
    <li className="panel rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <a href={open} className="font-display text-xl font-semibold tracking-tight text-fg">
          {name}
        </a>
        <a
          href={open}
          className="inline-flex h-11 items-center rounded-lg border border-accent bg-accent px-4 text-sm font-medium text-accent-fg"
        >
          {t.titleId}
        </a>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {offers.map((offer) => {
          const source = safeHttp(offer.ref) || safeHttp(offer.page);
          return (
            <li key={`${offer.region}:${offer.added}:${offer.platforms.join("")}`} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={regionClass(offer.region)}>{regionLabel(t, offer.region)}</span>
                {offer.platforms.map((item) => (
                  <span key={item} className="region-pill region-int">
                    {item}
                  </span>
                ))}
                <span className="text-sm text-muted">
                  {formatDay(offer.added, lang)}
                  {offer.removed ? ` – ${formatDay(offer.removed, lang)}` : ` · ${t.noEnd}`}
                </span>
                {source ? (
                  <a href={source} className="text-sm text-steel underline-offset-4 hover:underline">
                    {t.source}
                  </a>
                ) : null}
              </div>
              {offer.ids.length ? (
                <div className="flex flex-wrap gap-2">
                  {offer.ids.map((id) => (
                    <a
                      key={id}
                      href={finderHref(id)}
                      className="inline-flex h-11 items-center rounded-lg bg-raised px-3 font-mono text-sm font-semibold tracking-wide text-fg"
                    >
                      {id}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-subtle">{t.noId}</p>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function YearButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={
        on
          ? "h-11 shrink-0 rounded-lg border border-accent bg-accent px-4 text-sm font-medium text-accent-fg"
          : "h-11 shrink-0 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-fg"
      }
    >
      {children}
    </button>
  );
}

function FilterRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="w-28 shrink-0 text-sm text-subtle">{label}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map(([id, text]) => {
          const on = value === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(id)}
              className={
                on
                  ? "h-11 rounded-lg border border-accent bg-accent px-4 text-sm font-medium text-accent-fg"
                  : "h-11 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-fg"
              }
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
