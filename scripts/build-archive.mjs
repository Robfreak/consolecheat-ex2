/**
 * Rebuild public/archive.json from the PlayStation Wiki monthly-game lists.
 *
 * Source: the maintained public lists on https://playstation.fandom.com
 * (CC BY-SA). Each list row cites a PlayStation Blog post when the wiki has
 * one. This script does not fill gaps. Months, regions, or platforms that
 * are absent on those pages are absent here.
 *
 * Title IDs are copied only when a game name matches one entry in the
 * Title-ID-Finder dataset (exact normalized name or alias). No fuzzy match.
 *
 * Compact months tuple, newest first:
 *   [name, offers]
 *   offer = [region, platforms, added, removed, refUrlIndex, pageUrlIndex, ids]
 *   region: U | E | J | A
 *   platforms: "4" | "5" | "45"
 *   ids: comma-separated CUSA/PPSA, or ""
 *   url indexes point into the top-level "urls" array; -1 means no ref URL
 */

import { pathToFileURL } from "node:url";

const UA = "consolecheat-ex2-build/1.0 (PS Plus archive; +https://github.com/Robfreak/consolecheat-ex2)";
const API = "https://playstation.fandom.com/api.php";
const TITLES_COMMIT = "d8264e5adf8e3806c6868623ca5a6aa1829d28a1";
const TITLES_URL = `https://raw.githubusercontent.com/Robfreak/consolecheat-ex1/${TITLES_COMMIT}/public/titles.json`;
const LIST_HOME = "https://playstation.fandom.com/wiki/PlayStation_Plus";

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const REGION_LETTER = { US: "U", EU: "E", JP: "J", Asia: "A" };

export function wikiUrl(title) {
  return `https://playstation.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

const EDITION_WORDS = new Set(
  "remaster remastered remake campaign edition definitive deluxe gold goty hd enhanced collection anniversary complete ultimate director directors cut".split(" "),
);

export function norm(input) {
  return matchKey(input);
}

/** Visible title: drop marks, a trailing (year), a leading “EA Sports”, and the Challanger typo. */
export function canonicalName(input) {
  let text = String(input)
    .replace(/[™®©℠]/g, "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/\uFF1A/g, ":")
    .replace(/[’‘`´]/g, "'");
  text = text.replace(/challanger/gi, "Challenger");
  text = text.replace(/\s*\(((?:19|20)\d{2})\)\s*$/g, "");
  text = text.replace(/:(?=\S)/g, ": ");
  return text.replace(/\s+/g, " ").trim();
}

function legacyKey(input) {
  return String(input)
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

function bareKey(input) {
  return String(input)
    .replace(/[™®©℠]/g, "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Match key. Also drops a leading “EA Sports”, which the catalog sometimes omits. */
export function matchKey(input) {
  return bareKey(canonicalName(input).replace(/^(?:EA Sports)\s+/i, ""));
}

function daySpan(start, end) {
  if (!start || !end || start.length < 10 || end.length < 10) return null;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
}

function shiftYear(iso, years) {
  const [year, month, day] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(year + years, month - 1, day));
  if (next.getUTCFullYear() !== year + years || next.getUTCMonth() !== month - 1 || next.getUTCDate() !== day) return null;
  return `${next.getUTCFullYear()}-${pad(month)}-${pad(day)}`;
}

/**
 * A monthly game is added in its month and removed early the next month.
 * The known wiki typo writes that January end with the old year
 * (“January 5, 2025” on the December 2025 list). Only that one-year
 * rollover is rewritten, and only when the corrected end sits a few weeks
 * after the start. Other spans are left as the wiki printed them.
 */
export function repairDates(added, removed) {
  if (!added || !removed) return { added: added ?? "", removed: removed ?? "", correction: null };
  const span = daySpan(added, removed);
  if (span == null || (span > 0 && span <= 75)) return { added, removed, correction: null };
  if (span <= 0) {
    const bumped = shiftYear(removed, 1);
    const next = bumped ? daySpan(added, bumped) : null;
    if (bumped && next != null && next > 0 && next <= 45) {
      return { added, removed: bumped, correction: `${removed} → ${bumped}` };
    }
  }
  return { added, removed, correction: null };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function ymd(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  if (day == null || day === "") return `${y}-${pad(m)}`;
  const d = Number(day);
  if (!Number.isInteger(d) || d < 1 || d > 31) return null;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseDate(raw) {
  if (!raw) return null;
  const templates = [...String(raw).matchAll(/\{\{(?:dts|start date)\|([^{}]+)\}\}/gi)];
  for (const match of templates) {
    let inner = match[1].trim().replace(/^format\s*=\s*[^|]+\|/i, "").trim();
    const piped = inner.match(/^(\d{4})\|(\d{1,2})(?:\|(\d{1,2}))?/);
    if (piped) {
      const iso = ymd(piped[1], piped[2], piped[3]);
      if (iso) return iso;
    }
    const dashed = inner.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
    if (dashed) {
      const iso = ymd(dashed[1], dashed[2], dashed[3]);
      if (iso) return iso;
    }
  }
  const text = stripMarkup(raw).replace(/\s+/g, " ").trim();
  let match = text.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (match) return ymd(match[1], match[2], match[3]);
  match = text.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (match && MONTHS[match[1].toLowerCase()]) return ymd(match[3], MONTHS[match[1].toLowerCase()], match[2]);
  match = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (match && MONTHS[match[2].toLowerCase()]) return ymd(match[3], MONTHS[match[2].toLowerCase()], match[1]);
  return null;
}

function monthKey(iso) {
  if (!iso || iso.length < 7) return null;
  return iso.slice(0, 7);
}

function depthSplit(body, sep) {
  const parts = [];
  let depth = 0;
  let buf = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "{" || c === "[") depth++;
    else if ((c === "}" || c === "]") && depth > 0) depth--;
    if (depth === 0 && body.startsWith(sep, i)) {
      parts.push(buf);
      buf = "";
      i += sep.length - 1;
      continue;
    }
    buf += c;
  }
  parts.push(buf);
  return parts;
}

function splitAttr(part) {
  let depth = 0;
  for (let i = 0; i < part.length; i++) {
    const c = part[i];
    if (c === "{" || c === "[") depth++;
    else if ((c === "}" || c === "]") && depth > 0) depth--;
    if (c === "|" && depth === 0) {
      const left = part.slice(0, i).trim();
      if (/\b(?:rowspan|colspan|align|style|class|id|width|scope|valign|bgcolor|height|nowrap)\b/i.test(left)) {
        return { attrs: left, text: part.slice(i + 1) };
      }
    }
  }
  return { attrs: "", text: part };
}

function attrNumber(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']?(\\d+)`, "i"));
  return match ? Number(match[1]) : 1;
}

function cellsFromLine(line) {
  const header = line.startsWith("!");
  const body = line.slice(1);
  const sep = header ? "!!" : "||";
  return depthSplit(body, sep).map((part) => {
    const { attrs, text } = splitAttr(part.trim());
    return {
      header,
      text,
      rowspan: attrNumber(attrs, "rowspan"),
      colspan: attrNumber(attrs, "colspan"),
    };
  });
}

function extractTable(wikitext) {
  const quoted = wikitext.indexOf('id="softwarelist"');
  const bare = wikitext.search(/id\s*=\s*softwarelist\b/);
  const marker = quoted >= 0 ? quoted : bare;
  const start = marker >= 0 ? wikitext.lastIndexOf("{|", marker) : wikitext.indexOf("{|");
  if (start < 0) return null;
  // Table closers sit on their own line. A template such as {{no|}} also
  // contains the two characters |}, so a raw scan cannot use that pair.
  const closer = wikitext.slice(start).search(/\n\|\}/);
  if (closer < 0) return null;
  return wikitext.slice(start, start + closer + 3);
}

function tableRows(table) {
  const lines = table.split("\n");
  const rows = [];
  let current = null;
  const push = () => {
    if (current && current.length) rows.push(current);
    current = [];
  };
  for (const line of lines) {
    if (line.startsWith("{|") || line.startsWith("|+")) continue;
    if (line.startsWith("|-")) {
      push();
      continue;
    }
    if (line.startsWith("!") || line.startsWith("|")) {
      if (!current) current = [];
      current.push(...cellsFromLine(line));
      continue;
    }
    if (current && current.length && line.trim()) {
      current[current.length - 1].text += `\n${line}`;
    }
  }
  push();
  return rows.filter((row) => row.length);
}

function expandRows(rawRows) {
  const carry = [];
  const expanded = [];
  for (const cells of rawRows) {
    const row = [];
    let col = 0;
    let index = 0;
    while (index < cells.length || carry.some((item) => item && item.left > 0)) {
      if (carry[col] && carry[col].left > 0) {
        row[col] = carry[col].text;
        carry[col].left -= 1;
        col++;
        continue;
      }
      if (index >= cells.length) break;
      const cell = cells[index++];
      for (let span = 0; span < cell.colspan; span++) {
        row[col] = cell.text;
        if (cell.rowspan > 1) carry[col] = { left: cell.rowspan - 1, text: cell.text };
        else if (carry[col]) carry[col].left = 0;
        col++;
      }
    }
    expanded.push({ header: cells.every((cell) => cell.header), cells: row });
  }
  return expanded;
}

function stripMarkup(raw) {
  let text = String(raw);
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<ref\b[^>]*(?:\/>|>[\s\S]*?<\/ref>)/gi, "");
  text = text.replace(/\{\{abbr\|([^|}]+)\|([^{}]+)\}\}/gi, (_, _short, full) => full);
  text = text.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/gi, "$1");
  text = text.replace(/\[\[(?:File|Image|Category):[^\]]+\]\]/gi, "");
  text = text.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?\|([^\]]+)\]\]/g, "$2");
  text = text.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?\]\]/g, (_, target) => target.replace(/_/g, " "));
  for (let pass = 0; pass < 6; pass++) {
    const next = text
      .replace(/\{\{([^{}|]+)\|([^{}]*)\}\}/g, (_, name, body) => {
        const kind = name.trim().toLowerCase();
        if (kind === "small" || kind === "nowrap") return ` ${body} `;
        if (kind === "popupnote") return body.split("|")[0];
        if (kind === "sort") {
          const parts = body.split("|");
          return parts.length > 1 ? parts.slice(1).join("|") : parts[0];
        }
        return "";
      })
      .replace(/\{\{[^{}|]+\}\}/g, "");
    if (next === text) break;
    text = next;
  }
  text = text.replace(/'{2,}/g, "");
  text = text.replace(/<br\s*\/?>/gi, " ");
  text = text.replace(/<[^>]+>/g, "");
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0*39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\uFF1A/g, ":");
  text = text.replace(/[\u200b\uFEFF\uFFFC]/g, "");
  return text.replace(/\s+/g, " ").trim();
}

function cleanName(name) {
  return name
    .replace(/\[\|/g, "")
    .replace(/[\[\]]/g, "")
    .replace(/\s*\(([A-Z]{2,3}(?:\s*,\s*[A-Z]{2,3})*)\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function chooseName(name, alts) {
  const core = (value) => value.replace(/\([^)]*\)/g, "").replace(/[^\p{L}\p{N}]+/gu, "").trim();
  if (core(name).length >= 2) return name;
  for (const alt of alts) {
    const cleaned = cleanName(alt);
    if (core(cleaned).length >= 2) return cleaned;
  }
  return "";
}

function nameMess(name) {
  return (name.match(/[\[\]{}|]/g) ?? []).length;
}

function linkTargets(raw) {
  const targets = [];
  const re = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g;
  for (const match of raw.matchAll(re)) {
    const target = match[1].replace(/_/g, " ").trim();
    if (/^(File|Image|Category):/i.test(target)) continue;
    const plain = target.replace(/\s+\((?:video game|series|franchise)\)$/i, "").trim();
    if (plain) targets.push(plain);
  }
  return targets;
}

function firstUrl(raw) {
  if (!raw) return "";
  const match = String(raw).match(/https?:\/\/[^\s|\]}<"']+/i);
  if (!match) return "";
  return match[0].replace(/[),.;]+$/g, "");
}

function namedRefs(wikitext) {
  const map = new Map();
  const re = /<ref\b([^>]*)>([\s\S]*?)<\/ref>/gi;
  for (const match of wikitext.matchAll(re)) {
    const name = match[1].match(/\bname\s*=\s*["']?([^"'\s/>]+)/i);
    if (!name) continue;
    const url = firstUrl(match[2]);
    if (url) map.set(name[1], url);
  }
  return map;
}

function refUrl(cell, names) {
  const direct = firstUrl(cell);
  if (direct) return direct;
  const name = String(cell).match(/<ref\b[^>]*\bname\s*=\s*["']?([^"'\s/>]+)/i);
  if (name && names.has(name[1])) return names.get(name[1]);
  return "";
}

function columnKind(header) {
  const text = stripMarkup(header).toLowerCase();
  if (!text) return "other";
  if (text.includes("ps5") || text.includes("playstation 5")) return "PS5";
  if (text.includes("ps4") || text.includes("playstation 4")) return "PS4";
  if (text === "vr" || text.includes("playstation vr")) return "VR";
  if (text.includes("added")) return "added";
  if (text.includes("removed")) return "removed";
  if (text.includes("ref")) return "ref";
  if (text === "game" || text.startsWith("game ")) return "game";
  return "other";
}

function isYes(cell) {
  const text = String(cell).toLowerCase();
  if (text.includes("{{no") || text.includes("{{n/a") || text.includes("{{na|") || text.includes("{{na}}")) return false;
  return text.includes("{{yes") || text.includes("{{ya");
}

export function parseSoftwareTable(wikitext) {
  const table = extractTable(wikitext);
  if (!table) return [];
  const names = namedRefs(wikitext);
  const expanded = expandRows(tableRows(table));
  const headerRows = [];
  const dataRows = [];
  for (const row of expanded) {
    if (row.header && headerRows.length < 3 && dataRows.length === 0) headerRows.push(row.cells);
    else dataRows.push(row.cells);
  }
  const labels = headerRows.at(-1) ?? [];
  const kinds = labels.map((label) => columnKind(label ?? ""));
  const index = (kind) => kinds.indexOf(kind);
  const gameCol = index("game");
  const addedCol = index("added");
  const removedCol = index("removed");
  const refCol = index("ref");
  const ps4Col = index("PS4");
  const ps5Col = index("PS5");
  const vrCol = index("VR");
  if (gameCol < 0) return [];
  const rows = [];
  for (const cells of dataRows) {
    const rawName = cells[gameCol] ?? "";
    const alts = linkTargets(rawName);
    const name = chooseName(cleanName(stripMarkup(rawName)), alts);
    if (!name || /^\d+$/.test(name)) continue;
    rows.push({
      name,
      alts: alts.map((alt) => cleanName(alt)).filter((alt) => bareKey(alt) && bareKey(alt) !== bareKey(name)),
      ps4: ps4Col >= 0 && isYes(cells[ps4Col] ?? ""),
      ps5: ps5Col >= 0 && isYes(cells[ps5Col] ?? ""),
      vr: vrCol >= 0 && isYes(cells[vrCol] ?? ""),
      added: addedCol >= 0 ? parseDate(cells[addedCol] ?? "") : null,
      removed: removedCol >= 0 ? parseDate(cells[removedCol] ?? "") : null,
      ref: refCol >= 0 ? refUrl(cells[refCol] ?? "", names) : "",
    });
  }
  return rows;
}

function classify(title) {
  let region = null;
  if (/\(North America(?:,| \d|\))/.test(title) || title.endsWith("(North America)")) region = "US";
  else if (title.includes("(PAL region")) region = "EU";
  else if (title.endsWith("(Asia)")) region = "Asia";
  else if (title.endsWith("(Japan)")) region = "JP";
  else return null;
  const yearMatch = title.match(/, (\d{4})\)$/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const essential = title.includes("Essential monthly games");
  const monthly = title.includes("Plus monthly games") || title.includes("Essential monthly games");
  if (!monthly) return null;
  if ((region === "US" || region === "EU") && year == null && !title.endsWith(`(${region === "US" ? "North America" : "PAL region"})`)) {
    return null;
  }
  if ((region === "US" || region === "EU") && year == null) return null;
  return { title, region, year, essential };
}

function choosePages(found, currentYear) {
  const usable = found.filter(Boolean);
  const chosen = [];
  const warnings = [];
  for (const region of ["US", "EU"]) {
    const rows = usable.filter((page) => page.region === region && page.year != null);
    const years = [...new Set(rows.map((page) => page.year))].sort((a, b) => a - b);
    for (const year of years) {
      if (year < 2013 || year > currentYear + 1) continue;
      const essential = rows.find((page) => page.year === year && page.essential);
      const plus = rows.find((page) => page.year === year && !page.essential);
      const pick = year >= 2023 ? essential ?? plus : plus ?? essential;
      if (!pick) continue;
      chosen.push(pick);
      const other = pick === essential ? plus : essential;
      if (other) warnings.push(`Skipped ${other.title} in favor of ${pick.title}.`);
    }
    for (let year = 2014; year <= currentYear; year++) {
      if (!chosen.some((page) => page.region === region && page.year === year)) {
        throw new Error(`Missing a ${region} monthly-games page for ${year}.`);
      }
    }
  }
  for (const region of ["Asia", "JP"]) {
    const page = usable.find((item) => item.region === region && item.year == null);
    if (!page) throw new Error(`Missing the ${region} monthly-games page.`);
    chosen.push(page);
  }
  return { chosen, warnings };
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function listTitles(prefix) {
  const titles = [];
  let cont = "";
  do {
    const url = new URL(API);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "allpages");
    url.searchParams.set("apnamespace", "0");
    url.searchParams.set("aplimit", "500");
    url.searchParams.set("apprefix", prefix);
    url.searchParams.set("format", "json");
    if (cont) url.searchParams.set("apcontinue", cont);
    const data = await getJson(url);
    for (const page of data.query?.allpages ?? []) titles.push(page.title);
    cont = data.continue?.apcontinue ?? "";
  } while (cont);
  return titles;
}

async function redirectTitles(titles) {
  const redirects = new Set();
  for (let i = 0; i < titles.length; i += 40) {
    const slice = titles.slice(i, i + 40);
    const url = new URL(API);
    url.searchParams.set("action", "query");
    url.searchParams.set("prop", "info");
    url.searchParams.set("format", "json");
    url.searchParams.set("titles", slice.join("|"));
    const data = await getJson(url);
    for (const page of Object.values(data.query?.pages ?? {})) {
      if ("redirect" in page) redirects.add(page.title);
    }
  }
  return redirects;
}

async function fetchWikitext(title) {
  const url = new URL(API);
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", title);
  url.searchParams.set("prop", "wikitext");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("redirects", "0");
  const data = await getJson(url);
  if (data.error) throw new Error(`${data.error.code}: ${title}: ${data.error.info ?? ""}`);
  const text = typeof data.parse.wikitext === "string" ? data.parse.wikitext : data.parse.wikitext?.["*"];
  if (!text) throw new Error(`No wikitext for ${title}`);
  if (data.parse.title !== title || text.startsWith("#REDIRECT")) {
    throw new Error(`Refusing redirect for ${title} -> ${data.parse.title}`);
  }
  return text;
}

const REGION_FROM = { E: "EU", U: "US", J: "JP", H: "Asia", K: "KR", I: "INT", "?": "?" };

function decodeNameList(text) {
  const names = [];
  let prev = "";
  for (const line of text.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const keep = Number(line.slice(0, tab));
    const name = prev.slice(0, keep) + line.slice(tab + 1);
    names.push(name);
    prev = name;
  }
  return names;
}

/** Title-ID-Finder compact format 2, same layout as consolecheat-ex1 decodeTitles. */
export function gamesOf(titlesFile) {
  if (Array.isArray(titlesFile.titles)) return titlesFile.titles;
  if (titlesFile.format !== 2 || typeof titlesFile.names !== "string") {
    throw new Error("Unrecognized Title-ID-Finder file.");
  }
  const names = decodeNameList(titlesFile.names);
  const grouped = Array.from({ length: names.length }, () => []);
  let prefix = "";
  let num = 0;
  for (const line of (titlesFile.skus ?? "").split("\n")) {
    if (!line) continue;
    let i = 0;
    if (line[0] === "C" || line[0] === "P") {
      prefix = line[0];
      num = Number(line.slice(1, 6));
      i = 6;
    } else {
      let j = 0;
      while (j < line.length && line.charCodeAt(j) >= 48 && line.charCodeAt(j) <= 57) j += 1;
      num += Number(line.slice(0, j));
      i = j;
    }
    const region = REGION_FROM[line[i]] ?? "?";
    const platform = line[i + 1] === "5" ? "5" : "4";
    const at = line.indexOf("@", i + 2);
    const gi = Number(line.slice(at + 1));
    if (!grouped[gi]) continue;
    const id = `${prefix === "P" ? "PPSA" : "CUSA"}${String(num).padStart(5, "0")}`;
    grouped[gi].push([id, region, platform]);
  }
  return names.map((name, gi) => [name, titlesFile.aliases?.[String(gi)] ?? null, grouped[gi]]);
}

function editionSibling(shorter, longer) {
  if (!longer.startsWith(`${shorter} `)) return false;
  const rest = longer.slice(shorter.length + 1).split(" ");
  return rest.length > 0 && rest.every((word) => EDITION_WORDS.has(word));
}

export function buildNameIndex(titlesFile) {
  const map = new Map();
  const ambiguous = Symbol("ambiguous");
  const add = (key, game) => {
    if (!key) return;
    const prev = map.get(key);
    if (!prev) map.set(key, game);
    else if (prev !== game && prev !== ambiguous) map.set(key, ambiguous);
  };
  const primaryKeys = [];
  for (const game of gamesOf(titlesFile)) {
    const key = bareKey(game[0]);
    add(key, game);
    if (key) primaryKeys.push(key);
    for (const alias of game[1] ?? []) add(bareKey(alias), game);
  }
  const editionAmbiguous = new Set();
  const uniqueKeys = [...new Set(primaryKeys)];
  for (const key of uniqueKeys) {
    if (uniqueKeys.some((other) => editionSibling(key, other))) editionAmbiguous.add(key);
  }
  return { map, ambiguous, editionAmbiguous };
}

function idsFor(game, region, platforms) {
  const want = new Set(platforms);
  const ids = [];
  for (const sku of game[2]) {
    const id = sku[0];
    const skuRegion = sku[1];
    const platform = sku[2] === "5" ? "PS5" : sku[2] === "4" ? "PS4" : "";
    if (skuRegion !== region || !want.has(platform)) continue;
    if (!/^(?:CUSA|PPSA)\d{4,6}$/.test(id)) continue;
    if (!ids.includes(id)) ids.push(id);
  }
  ids.sort();
  return ids;
}

function lookupName(index, name) {
  const strict = bareKey(name);
  const loose = matchKey(name);
  const keys = [];
  if (strict) keys.push(strict);
  if (loose && loose !== strict) keys.push(loose);
  for (const key of keys) {
    // A base title plus “Remastered”, “Campaign Remastered”, or another edition
    // is more than one release. Two catalog rows that share a name are too.
    // Don't try a shorter key after that.
    if (index.editionAmbiguous.has(key)) return index.ambiguous;
    const hit = index.map.get(key);
    if (hit === index.ambiguous) return index.ambiguous;
    if (hit) return hit;
  }
  return null;
}

export function matchIds(index, names, region, platforms) {
  const hits = [];
  for (const name of names) {
    const hit = lookupName(index, name);
    if (hit && hit !== index.ambiguous && !hits.includes(hit)) hits.push(hit);
  }
  if (hits.length > 1) {
    const specific = hits.filter((hit) => {
      const key = bareKey(hit[0]);
      return !hits.some((other) => other !== hit && bareKey(other[0]).startsWith(`${key} `));
    });
    if (specific.length === 1) return idsFor(specific[0], region, platforms);
    return [];
  }
  if (hits.length === 1) return idsFor(hits[0], region, platforms);
  return [];
}

function platformsCode(ps4, ps5) {
  if (ps4 && ps5) return "45";
  if (ps5) return "5";
  return "4";
}

function holesBetween(months) {
  const sorted = [...months].sort();
  if (sorted.length < 2) return [];
  const has = new Set(sorted);
  const holes = [];
  let [year, month] = sorted[0].split("-").map(Number);
  const end = sorted.at(-1);
  while (`${year}-${pad(month)}` < end) {
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
    const key = `${year}-${pad(month)}`;
    if (!has.has(key)) holes.push(key);
  }
  return holes;
}

function mustFind(archive, check) {
  const month = archive.months.find((item) => item.ym === check.ym);
  const entry = month?.entries.find((item) => norm(item.name).includes(check.name));
  const offer = entry?.offers.find((item) => item.region === check.region);
  if (!entry || !offer) {
    throw new Error(`Expected ${check.region} ${check.ym} to include “${check.name}”.`);
  }
  if (check.ref && !offer.ref.includes(check.ref)) {
    throw new Error(`Expected a ${check.ref} citation for ${entry.name} (${check.region} ${check.ym}), got ${offer.ref || "none"}.`);
  }
}

async function main() {
  const currentYear = new Date().getUTCFullYear();
  const prefixes = ["List of PlayStation Plus monthly games", "List of PlayStation Essential monthly games"];
  const titles = [...new Set((await Promise.all(prefixes.map(listTitles))).flat())];
  const redirects = await redirectTitles(titles);
  const found = titles
    .filter((title) => !redirects.has(title))
    .map(classify)
    .filter(Boolean);
  const { chosen, warnings } = choosePages(found, currentYear);
  const omitted = { vrOnly: 0, otherPlatform: 0, noDate: 0 };
  const byMonth = new Map();
  const pageUrls = [];
  const dateCorrections = [];
  let deduped = 0;

  for (const page of chosen) {
    const text = await fetchWikitext(page.title);
    const parsed = parseSoftwareTable(text);
    const pageUrl = wikiUrl(page.title);
    pageUrls.push(pageUrl);
    let kept = 0;
    for (const row of parsed) {
      if (!row.ps4 && !row.ps5) {
        if (row.vr) omitted.vrOnly += 1;
        else omitted.otherPlatform += 1;
        continue;
      }
      const display = canonicalName(row.name);
      const ym = monthKey(row.added);
      if (!display || !ym) {
        omitted.noDate += 1;
        continue;
      }
      const repaired = repairDates(row.added, row.removed ?? "");
      if (repaired.correction) {
        dateCorrections.push(`${page.region} ${ym} ${display}: removed ${repaired.correction}`);
      } else if (row.removed && row.added && row.removed < row.added) {
        warnings.push(`${page.region} ${ym} ${display}: removed ${row.removed} is before added ${row.added}; left unchanged.`);
      }
      kept += 1;
      let month = byMonth.get(ym);
      if (!month) {
        month = new Map();
        byMonth.set(ym, month);
      }
      const key = matchKey(display);
      let entry = month.get(key);
      if (!entry) {
        entry = { name: display, raws: new Set([row.name]), legacy: legacyKey(row.name), alts: new Set(row.alts), offers: [] };
        month.set(key, entry);
      } else {
        const incoming = legacyKey(row.name);
        if (incoming !== entry.legacy) {
          deduped += 1;
          console.log(`Dedupe ${page.region} ${ym}: “${row.name}” → “${entry.name}”`);
        }
        const lower = (value) => (value.match(/\p{Ll}/gu) ?? []).length;
        if (lower(display) > lower(entry.name)) entry.name = display;
        const stripPublisher = (value) => value.replace(/^(?:EA Sports)\s+/i, "");
        if (stripPublisher(entry.name) === stripPublisher(display) && stripPublisher(entry.name) !== entry.name) {
          entry.name = stripPublisher(entry.name);
        }
      }
      entry.raws.add(row.name);
      for (const alt of row.alts) entry.alts.add(alt);
      const platforms = [...(row.ps4 ? ["PS4"] : []), ...(row.ps5 ? ["PS5"] : [])];
      const existing = entry.offers.find((offer) => offer.region === page.region);
      if (existing) {
        for (const platform of platforms) if (!existing.platforms.includes(platform)) existing.platforms.push(platform);
        if (!existing.ref && row.ref) existing.ref = row.ref;
        if (repaired.removed && (!existing.removed || existing.removed < existing.added)) existing.removed = repaired.removed;
        if (row.added && row.added < existing.added) existing.added = row.added;
      } else {
        entry.offers.push({
          region: page.region,
          platforms,
          added: row.added,
          removed: repaired.removed,
          ref: row.ref,
          page: pageUrl,
          ids: [],
        });
      }
    }
    if ((page.region === "US" || page.region === "EU") && page.year >= 2015 && page.year <= currentYear && kept === 0) {
      throw new Error(`${page.title} produced no PS4 or PS5 rows.`);
    }
    console.log(`${page.region} ${page.year ?? "all"}  rows ${parsed.length}  kept ${kept}  ${page.title}`);
  }

  console.log("Loading title IDs…");
  const titlesFile = await getJson(TITLES_URL);
  const index = buildNameIndex(titlesFile);
  let withIds = 0;
  let entries = 0;
  for (const month of byMonth.values()) {
    for (const entry of month.values()) {
      entries += 1;
      let matched = false;
      for (const offer of entry.offers) {
        offer.ids = matchIds(index, [...entry.raws, entry.name, ...entry.alts], offer.region, offer.platforms);
        if (offer.ids.length) matched = true;
      }
      if (matched) withIds += 1;
    }
  }

  for (const month of byMonth.values()) {
    for (const entry of month.values()) {
      if (!entry.name || nameMess(entry.name)) throw new Error(`Unreadable game name: ${entry.name}`);
    }
  }

  const months = [...byMonth.keys()].sort((a, b) => (a < b ? 1 : -1));
  const coverage = {};
  for (const region of ["US", "EU", "JP", "Asia"]) {
    const present = new Set();
    for (const [ym, games] of byMonth) {
      for (const entry of games.values()) {
        if (entry.offers.some((offer) => offer.region === region)) present.add(ym);
      }
    }
    const sorted = [...present].sort();
    coverage[region] = {
      from: sorted[0] ?? "",
      to: sorted.at(-1) ?? "",
      months: sorted.length,
      holes: holesBetween(sorted),
    };
  }

  const urls = [];
  const urlIndex = (value) => {
    if (!value) return -1;
    let index = urls.indexOf(value);
    if (index < 0) {
      index = urls.length;
      urls.push(value);
    }
    return index;
  };

  const compactMonths = months.map((ym) => {
    const games = [...byMonth.get(ym).values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
    return [
      ym,
      games.map((entry) => [
        entry.name,
        entry.offers
          .sort((a, b) => a.region.localeCompare(b.region))
          .map((offer) => [
            REGION_LETTER[offer.region],
            platformsCode(offer.platforms.includes("PS4"), offer.platforms.includes("PS5")),
            offer.added,
            offer.removed,
            urlIndex(offer.ref),
            urlIndex(offer.page),
            offer.ids.join(","),
          ]),
      ]),
    ];
  });

  const archive = {
    v: 1,
    generated: new Date().toISOString().slice(0, 10),
    license: "CC BY-SA 4.0",
    list: LIST_HOME,
    attribution: "PlayStation Wiki monthly-game lists, which cite PlayStation Blog announcements when a row has a reference.",
    ids: {
      url: TITLES_URL,
      source: titlesFile.source,
      commit: titlesFile.commit,
      license: titlesFile.license,
    },
    stats: {
      months: months.length,
      entries,
      withIds,
      urls: 0,
      dateCorrections: dateCorrections.length,
      deduped,
    },
    coverage,
    omitted,
    warnings,
    pages: chosen.map((page) => wikiUrl(page.title)),
    urls,
    m: compactMonths,
  };
  archive.stats.urls = urls.length;

  const readable = {
    months: archive.m.map(([ym, games]) => ({
      ym,
      entries: games.map(([name, offers]) => ({
        name,
        offers: offers.map(([region, platforms, added, removed, ref, page, ids]) => ({
          region,
          platforms,
          added,
          removed,
          ref: ref >= 0 ? urls[ref] : "",
          page: urls[page],
          ids: ids ? ids.split(",") : [],
        })),
      })),
    })),
  };
  const checks = [
    { region: "U", ym: "2026-10", name: "f1 25", ref: "blog.playstation.com/2026/09/30" },
    { region: "E", ym: "2026-10", name: "hunt showdown 1896", ref: "playstation.com" },
    { region: "U", ym: "2026-01", name: "need for speed unbound", ref: "blog.playstation.com" },
    { region: "U", ym: "2025-01", name: "suicide squad", ref: "blog.playstation.com" },
    { region: "U", ym: "2020-01", name: "uncharted", ref: "playstation.com" },
    { region: "U", ym: "2018-03", name: "bloodborne", ref: "playstation.com" },
    { region: "E", ym: "2024-01", name: "plague tale", ref: "playstation.com" },
    { region: "J", ym: "2017-10", name: "metal gear solid v", ref: "jp.playstation.com" },
    { region: "A", ym: "2021-01", name: "shadow of the tomb raider", ref: "playstation.com" },
  ];
  for (const check of checks) mustFind(readable, check);

  const december = readable.months.find((month) => month.ym === "2025-12");
  const neon = december?.entries.find((entry) => norm(entry.name).includes("neon white"));
  const neonUs = neon?.offers.find((offer) => offer.region === "U");
  if (neonUs?.removed !== "2026-01-05") {
    throw new Error(`December 2025 North America should end 2026-01-05, got ${neonUs?.removed ?? "missing"}.`);
  }
  const july = readable.months.find((month) => month.ym === "2020-07");
  const mw2 = july?.entries.find((entry) => entry.name.includes("Modern Warfare 2") && !entry.name.includes("Remaster"));
  const mw2Asia = mw2?.offers.find((offer) => offer.region === "A");
  if (!mw2Asia) throw new Error("Asia July 2020 Modern Warfare 2 is missing.");
  if (mw2Asia.ids.length) {
    throw new Error(`Asia July 2020 Modern Warfare 2 must have no title ID, got ${mw2Asia.ids.join(",")}.`);
  }
  const june = readable.months.find((month) => month.ym === "2022-06");
  const gow = june?.entries.find((entry) => norm(entry.name) === "god of war");
  const gowUs = gow?.offers.find((offer) => offer.region === "U");
  if (!gowUs?.ids.includes("CUSA07408")) {
    throw new Error(`God of War (2018) US should match CUSA07408, got ${gowUs?.ids.join(",") || "none"}.`);
  }

  archive.stats.urls = urls.length;
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(new URL("../public/", import.meta.url), { recursive: true });
  const target = new URL("../public/archive.json", import.meta.url);
  await writeFile(target, JSON.stringify(archive));
  const bytes = Buffer.byteLength(JSON.stringify(archive));
  console.log(
    `Wrote ${target.pathname}  ${bytes} bytes  ${months.length} months  ${entries} entries  ${withIds} with title IDs`,
  );
  console.log(`Date corrections ${dateCorrections.length}`);
  for (const line of dateCorrections) console.log(`  ${line}`);
  console.log(`Deduped rows ${deduped}`);
  console.log("Coverage", JSON.stringify(coverage));
  console.log("Omitted", JSON.stringify(omitted));
  if (warnings.length) console.log("Warnings", warnings.join(" | "));
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
