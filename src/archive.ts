export type Region = "US" | "EU" | "JP" | "Asia";
export type Platform = "PS4" | "PS5";

export const REGIONS: Region[] = ["US", "EU", "JP", "Asia"];

export type Offer = {
  region: Region;
  platforms: Platform[];
  added: string;
  removed: string;
  ref: string;
  page: string;
  ids: string[];
};

export type Entry = {
  name: string;
  note: string;
  offers: Offer[];
};

export type Month = {
  ym: string;
  entries: Entry[];
};

export type Coverage = {
  from: string;
  to: string;
  months: number;
  holes: string[];
};

export type Archive = {
  generated: string;
  license: string;
  list: string;
  attribution: string;
  idsUrl: string;
  stats: { months: number; entries: number; withIds: number };
  coverage: Record<Region, Coverage>;
  omittedVr: number;
  months: Month[];
};

export type ViewFilters = {
  query: string;
  region: "all" | Region;
  platform: "all" | Platform;
  year: "all" | string;
};

export const FINDER_ORIGIN = "https://robfreak.github.io/consolecheat-ex1/";

const LETTER: Record<string, Region> = { U: "US", E: "EU", J: "JP", A: "Asia" };
const ID_RE = /^(?:CUSA|PPSA)\d{4,6}$/;

function isHttp(value: unknown): value is string {
  return typeof value === "string" && (value.startsWith("https://") || value.startsWith("http://"));
}

function platformsOf(code: string): Platform[] {
  if (code === "45") return ["PS4", "PS5"];
  if (code === "5") return ["PS5"];
  if (code === "4") return ["PS4"];
  throw new Error(`platform ${code}`);
}

export function norm(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[™®©]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function decodeArchive(raw: unknown): Archive {
  if (!raw || typeof raw !== "object") throw new Error("archive");
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.urls) || !data.urls.every(isHttp)) throw new Error("urls");
  const urls = data.urls as string[];
  const urlAt = (index: unknown, optional = false): string => {
    if (index === -1 && optional) return "";
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= urls.length) {
      throw new Error("url index");
    }
    return urls[index] ?? "";
  };
  if (!Array.isArray(data.m)) throw new Error("months");
  const months: Month[] = data.m.map((month) => {
    if (!Array.isArray(month) || typeof month[0] !== "string" || !Array.isArray(month[1])) throw new Error("month");
    const entries: Entry[] = month[1].map((entry: unknown) => {
      if (!Array.isArray(entry) || typeof entry[0] !== "string") throw new Error("entry");
      const noted = typeof entry[1] === "string";
      const note = noted ? entry[1] : "";
      const offerRows = noted ? entry[2] : entry[1];
      if (typeof note !== "string" || !Array.isArray(offerRows)) throw new Error("entry");
      const offers: Offer[] = offerRows.map((offer: unknown) => {
        if (!Array.isArray(offer)) throw new Error("offer");
        const region = LETTER[String(offer[0])];
        if (!region) throw new Error("region");
        const ids = String(offer[6] ?? "")
          .split(",")
          .filter(Boolean);
        if (ids.some((id) => !ID_RE.test(id))) throw new Error(`id ${offer[6]}`);
        return {
          region,
          platforms: platformsOf(String(offer[1])),
          added: String(offer[2] ?? ""),
          removed: String(offer[3] ?? ""),
          ref: urlAt(offer[4], true),
          page: urlAt(offer[5]),
          ids,
        };
      });
      return { name: entry[0], note, offers };
    });
    return { ym: month[0], entries };
  });

  const coverage = {} as Record<Region, Coverage>;
  const rawCoverage = data.coverage as Record<string, Coverage> | undefined;
  for (const region of REGIONS) {
    const row = rawCoverage?.[region];
    if (!row || typeof row.from !== "string" || !Array.isArray(row.holes)) throw new Error("coverage");
    coverage[region] = {
      from: row.from,
      to: row.to,
      months: row.months,
      holes: row.holes,
    };
  }
  const stats = data.stats as Archive["stats"];
  const ids = data.ids as { url?: string } | undefined;
  const omitted = data.omitted as { vrOnly?: number } | undefined;
  return {
    generated: String(data.generated ?? ""),
    license: String(data.license ?? ""),
    list: String(data.list ?? ""),
    attribution: String(data.attribution ?? ""),
    idsUrl: String(ids?.url ?? ""),
    stats: {
      months: Number(stats?.months ?? months.length),
      entries: Number(stats?.entries ?? 0),
      withIds: Number(stats?.withIds ?? 0),
    },
    coverage,
    omittedVr: Number(omitted?.vrOnly ?? 0),
    months,
  };
}

export function filterArchive(archive: Archive, filters: ViewFilters, noteOf: (note: string) => string = (note) => note): Month[] {
  const tokens = norm(filters.query).split(" ").filter(Boolean);
  const months: Month[] = [];
  for (const month of archive.months) {
    if (filters.year !== "all" && !month.ym.startsWith(`${filters.year}-`)) continue;
    const entries: Entry[] = [];
    for (const entry of month.entries) {
      const name = norm(`${entry.name} ${entry.note} ${noteOf(entry.note)}`);
      if (tokens.length && !tokens.every((token) => name.includes(token))) continue;
      const offers = entry.offers.filter((offer) => {
        if (filters.region !== "all" && offer.region !== filters.region) return false;
        if (filters.platform !== "all" && !offer.platforms.includes(filters.platform)) return false;
        return true;
      });
      if (offers.length) entries.push({ name: entry.name, note: entry.note, offers });
    }
    if (entries.length) months.push({ ym: month.ym, entries });
  }
  return months;
}

export function visibleIds(offers: Offer[]): string[] {
  const ids: string[] = [];
  for (const offer of offers) {
    for (const id of offer.ids) if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function finderHref(query: string): string {
  const url = new URL(FINDER_ORIGIN);
  url.searchParams.set("q", query);
  return url.toString();
}

export function yearsOf(archive: Archive): string[] {
  const years = new Set<string>();
  for (const month of archive.months) years.add(month.ym.slice(0, 4));
  return [...years].sort((a, b) => (a < b ? 1 : -1));
}

export function countEntries(months: Month[]): number {
  return months.reduce((sum, month) => sum + month.entries.length, 0);
}
