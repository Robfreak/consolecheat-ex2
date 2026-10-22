import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { countEntries, decodeArchive, filterArchive, finderHref, visibleIds } from "./archive.ts";

const archive = decodeArchive(JSON.parse(readFileSync(new URL("../public/archive.json", import.meta.url), "utf8")));

test("cited rows from the PlayStation Blog stay attached to their month", () => {
  const october = archive.months.find((month) => month.ym === "2026-10");
  assert.ok(october);
  const names = october.entries.map((entry) => entry.name);
  assert.ok(names.some((name) => name.includes("F1 25")));
  assert.ok(names.some((name) => name.includes("Hunt: Showdown 1896")));
  assert.ok(names.some((name) => name.includes("Earth Defense Force: World Brothers 2")));
  const f1 = october.entries.find((entry) => entry.name.includes("F1 25"));
  const us = f1?.offers.find((offer) => offer.region === "US");
  assert.ok(us?.ref.includes("blog.playstation.com/2026/09/30/playstation-plus-monthly-games-for-october"));
  assert.ok(us?.page.includes("playstation.fandom.com/wiki/"));

  const january = archive.months.find((month) => month.ym === "2025-01");
  const squad = january?.entries.find((entry) => entry.name.toLowerCase().includes("suicide squad"));
  assert.ok(squad?.offers.some((offer) => offer.region === "US" && offer.ref.includes("blog.playstation.com")));
});

test("every offer cites a wiki page and only real title IDs", () => {
  assert.ok(archive.months.length >= 150);
  assert.equal(archive.coverage.JP.to, "2017-12");
  assert.equal(archive.coverage.Asia.to, "2021-09");
  assert.ok(archive.coverage.EU.holes.includes("2026-07"));
  for (const month of archive.months) {
    for (const entry of month.entries) {
      assert.ok(entry.name.trim());
      assert.equal(/[\[\]{}|]/.test(entry.name), false);
      for (const offer of entry.offers) {
        assert.match(offer.page, /^https:\/\/playstation\.fandom\.com\/wiki\//);
        if (offer.ref) assert.match(offer.ref, /^https?:\/\//);
        for (const id of offer.ids) assert.match(id, /^(CUSA|PPSA)\d{4,6}$/);
      }
    }
  }
});

test("filters and the Title-ID-Finder link use q, not id", () => {
  const filtered = filterArchive(archive, { query: "bloodborne", region: "US", platform: "PS4", year: "2018" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.ym, "2018-03");
  assert.ok(filtered[0]?.entries.some((entry) => entry.name.toLowerCase().includes("bloodborne")));
  assert.equal(countEntries(filterArchive(archive, { query: "zzzz-not-a-game", region: "all", platform: "all", year: "all" })), 0);

  const href = finderHref("CUSA07408");
  assert.match(href, /^https:\/\/robfreak\.github\.io\/consolecheat-ex1\/\?q=CUSA07408$/);
  assert.equal(href.includes("id="), false);
  const nameHref = finderHref("God of War");
  assert.match(nameHref, /\?q=God(\+|%20)of(\+|%20)War$/);

  const december = archive.months.find((month) => month.ym === "2025-12");
  const neon = december?.entries.find((entry) => entry.name === "Neon White");
  assert.equal(neon?.offers.find((offer) => offer.region === "US")?.removed, "2026-01-05");

  const july = archive.months.find((month) => month.ym === "2020-07");
  const mw2 = july?.entries.find((entry) => entry.name === "Call of Duty: Modern Warfare 2");
  assert.deepEqual(mw2?.offers.find((offer) => offer.region === "Asia")?.ids, []);
  const remaster = july?.entries.find((entry) => entry.name.includes("Campaign Remastered"));
  assert.ok(remaster?.offers.some((offer) => offer.ids.includes("CUSA09249")));

  const june = archive.months.find((month) => month.ym === "2022-06");
  const gow = june?.entries.find((entry) => entry.name === "God of War");
  assert.ok(gow?.offers.some((offer) => offer.region === "US" && offer.ids.includes("CUSA07408")));

  const octoberNames = archive.months.find((month) => month.ym === "2026-10")?.entries.map((entry) => entry.name) ?? [];
  assert.equal(octoberNames.filter((name) => name.includes("F1 25")).length, 1);
  assert.deepEqual(visibleIds([{ region: "US", platforms: ["PS4"], added: "", removed: "", ref: "", page: "https://example.com", ids: ["CUSA1", "CUSA1"] }]).length, 1);
});
