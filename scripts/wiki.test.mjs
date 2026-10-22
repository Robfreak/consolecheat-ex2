import assert from "node:assert/strict";
import test from "node:test";
import { buildNameIndex, canonicalName, gamesOf, matchIds, matchKey, parseDate, parseSoftwareTable, repairDates } from "./build-archive.mjs";

test("parseDate reads the wiki date templates", () => {
  assert.equal(parseDate("{{dts|2014-01-07}}"), "2014-01-07");
  assert.equal(parseDate("{{dts|format=dmy|2012-11-22}}"), "2012-11-22");
  assert.equal(parseDate("{{dts|2021|01|05}}"), "2021-01-05");
  assert.equal(parseDate("{{dts|2010-10}}"), "2010-10");
  assert.equal(parseDate("January 6, 2026"), "2026-01-06");
  assert.equal(parseDate("  February 3, 2026 "), "2026-02-03");
  assert.equal(parseDate(""), null);
});

test("parseSoftwareTable keeps PS4 and PS5 rows and the blog URL", () => {
  const wiki = `
{| class="wikitable" id="softwarelist"
! rowspan="2" | {{abbr|#|Number overall}}
! rowspan="2" | Game
! colspan="3" | Platform(s)
! rowspan="2" | Date added
! rowspan="2" | Date removed
! rowspan="2" | {{abbr|Ref.|References}}
|-
! [[PlayStation 5|PS5]]
! [[PlayStation 4|PS4]]
! [[PlayStation VR|VR]]
|-
| 1
| ''[[Need For Speed Unbound]]''
| {{yes|PS5}} || {{no|}} || {{no|}}
| rowspan="2" | January 6, 2026
| rowspan="2" | February 3, 2026
| rowspan="2" | <ref>https://blog.playstation.com/2025/12/31/example/</ref>
|-
| 2
| ''[[EA Sports F1 23|F1 23]]''
| {{yes|PS5}} || {{yes|PS4}} || {{no|}}
|-
| 3
| ''[[Starblood Arena]]''
| {{no|}} || {{no|}} || {{yes|VR}}
| March 6, 2018
| April 3, 2018
| <ref>https://blog.playstation.com/vr-only/</ref>
|-
| 4
| [[Hitman 2]](CH,ENG)
| {{no|}} || {{yes|PS4}} || {{no|}}
| {{dts|2021|09|07}}
| {{dts|2021|10|04}}
| <ref>{{cite web|url=https://blog.zh-hant.playstation.com/2021/09/02/example/|title=Example}}</ref>
|}`;
  const rows = parseSoftwareTable(wiki);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], {
    name: "Need For Speed Unbound",
    alts: [],
    ps4: false,
    ps5: true,
    vr: false,
    added: "2026-01-06",
    removed: "2026-02-03",
    ref: "https://blog.playstation.com/2025/12/31/example/",
  });
  assert.equal(rows[1].name, "F1 23");
  assert.deepEqual(rows[1].alts, ["EA Sports F1 23"]);
  assert.equal(rows[1].ps4, true);
  assert.equal(rows[1].ps5, true);
  assert.equal(rows[1].added, "2026-01-06");
  assert.equal(rows[1].ref, "https://blog.playstation.com/2025/12/31/example/");
  assert.equal(rows[2].vr, true);
  assert.equal(rows[2].ps4, false);
  assert.equal(rows[3].name, "Hitman 2");
  const messy = parseSoftwareTable(`
{| class="wikitable" id="softwarelist"
! Game
! [[PlayStation 4|PS4]]
! Date added
! Date removed
! Ref.
|-
| [|[https://en.wikipedia.org/wiki/Erica_(video_game) Erica] (ENG)
| {{yes|PS4}}
| {{dts|2020|07|07}}
| {{dts|2020|08|04}}
| <ref>https://blog.playstation.com/erica/</ref>
|-
| ''{{PopupNote|[[Beyond: Two Souls]]'' {{small|(Middle East)}}|Repeat from 1 May 2018.}}
| {{yes|PS4}}
| July 2, 2019
| August 6, 2019
| <ref>https://blog.playstation.com/beyond/</ref>
|}`);
  assert.equal(messy[0].name, "Erica");
  assert.equal(messy[1].name, "Beyond: Two Souls (Middle East)");
  assert.deepEqual(messy[1].alts, ["Beyond: Two Souls"]);
  const sorted = parseSoftwareTable(`
{| class="wikitable" id="softwarelist"
! Game
! [[PlayStation 4|PS4]]
! Date added
! Ref.
|-
| ''{{sort|Five Covens|[[The Five Covens]]}}'' {{small|(Spain and Portugal)}}
| {{yes|PS4}}
| {{dts|2021-08-03}}
| <ref>https://blog.es.playstation.com/example/</ref>
|-
| [[X-Morph: Defense]](CH,ENG,JP,KR) <small>(Singapore and Thailand Only)</small>
| {{yes|PS4}}
| {{dts|2021|04|06}}
| <ref>https://blog.zh-hant.playstation.com/example/</ref>
|}`);
  assert.equal(sorted[0].name, "The Five Covens (Spain and Portugal)");
  assert.equal(sorted[1].name, "X-Morph: Defense (Singapore and Thailand Only)");
  assert.equal(rows[3].ps4, true);
  assert.equal(rows[3].added, "2021-09-07");
  assert.equal(rows[3].ref, "https://blog.zh-hant.playstation.com/2021/09/02/example/");
});

test("matchIds accepts one exact name and ignores near misses", () => {
  const index = buildNameIndex({
    titles: [
      ["God of War", null, [["CUSA07408", "US", "4"], ["CUSA07410", "EU", "4"], ["CUSA07435", "JP", "4"]]],
      ["God of War III Remastered", null, [["CUSA02300", "US", "4"]]],
      ["F1 23", ["EA Sports F1 23"], [["CUSA12345", "EU", "4"], ["PPSA12345", "EU", "5"], ["CUSA99999", "US", "4"]]],
      ["Bound", null, [["CUSA11111", "US", "4"]]],
      ["Bound", null, [["CUSA22222", "EU", "4"]]],
    ],
  });
  assert.deepEqual(matchIds(index, ["God of War"], "US", ["PS4"]), ["CUSA07408"]);
  assert.deepEqual(matchIds(index, ["God of War"], "EU", ["PS4", "PS5"]), ["CUSA07410"]);
  assert.deepEqual(matchIds(index, ["God of War"], "US", ["PS5"]), []);
  assert.deepEqual(matchIds(index, ["F1 23"], "EU", ["PS4", "PS5"]), ["CUSA12345", "PPSA12345"]);
  assert.deepEqual(matchIds(index, ["EA Sports F1 23"], "EU", ["PS5"]), ["PPSA12345"]);
  assert.deepEqual(matchIds(index, ["God of War 2"], "US", ["PS4"]), []);
  assert.deepEqual(matchIds(index, ["Bound"], "US", ["PS4"]), []);
});

test("repairDates rolls a December removal into the next January and leaves real spans", () => {
  assert.deepEqual(repairDates("2025-12-02", "2025-01-05"), {
    added: "2025-12-02",
    removed: "2026-01-05",
    correction: "2025-01-05 → 2026-01-05",
  });
  assert.equal(repairDates("2025-12-02", "2026-01-06").correction, null);
  assert.equal(repairDates("2021-06-01", "2021-08-02").removed, "2021-08-02");
  assert.equal(repairDates("2018-08-07", "2018-11-06").correction, null);
});

test("canonical names drop marks, years, and the Challanger typo", () => {
  assert.equal(canonicalName("Titanfall™ 2"), "Titanfall 2");
  assert.equal(canonicalName("EA Sports F1 25"), "EA Sports F1 25");
  assert.equal(matchKey("EA Sports F1 25"), "f1 25");
  assert.equal(canonicalName("Hitman 2 (2018)"), "Hitman 2");
  assert.equal(canonicalName("God of War (2018)"), "God of War");
  assert.equal(canonicalName("Godfall: Challanger Edition"), "Godfall: Challenger Edition");
  assert.equal(canonicalName("Twogether: Project Indigos (Spain and Portugal)"), "Twogether: Project Indigos (Spain and Portugal)");
});

test("several releases of one name get no title ID", () => {
  const index = buildNameIndex({
    titles: [
      ["Call of Duty Modern Warfare 2", null, [["CUSA53708", "Asia", "4"], ["CUSA53705", "US", "4"]]],
      ["Call of Duty: Modern Warfare 2 Campaign Remastered", null, [["CUSA11012", "Asia", "4"], ["CUSA09249", "US", "4"]]],
      ["God of War", null, [["CUSA07408", "US", "4"], ["CUSA07410", "EU", "4"]]],
      ["God of War III Remastered", null, [["CUSA01623", "US", "4"]]],
      ["Godfall", null, [["CUSA26921", "US", "4"]]],
      ["Godfall: Challenger Edition", null, [["CUSA31058", "US", "4"], ["CUSA31059", "EU", "4"]]],
      ["Fall Guys: Ultimate Knockout", null, [["CUSA17711", "US", "4"]]],
      ["Fall Guys: Ultimate Knockout", null, [["CUSA29236", "US", "4"]]],
    ],
  });
  assert.deepEqual(matchIds(index, ["Call of Duty: Modern Warfare 2"], "Asia", ["PS4"]), []);
  assert.deepEqual(matchIds(index, ["Call of Duty: Modern Warfare 2 Campaign Remastered"], "US", ["PS4"]), ["CUSA09249"]);
  assert.deepEqual(matchIds(index, ["God of War (2018)"], "US", ["PS4"]), ["CUSA07408"]);
  assert.deepEqual(matchIds(index, ["Godfall: Challanger Edition", "Godfall"], "US", ["PS4"]), ["CUSA31058"]);
  assert.deepEqual(matchIds(index, ["Fall Guys: Ultimate Knockout"], "US", ["PS4"]), []);
});

test("gamesOf reads the compact Title-ID-Finder format", () => {
  const games = gamesOf({
    format: 2,
    names: "0\tGod of War\n10\t III Remastered",
    aliases: { 0: ["God of War (2018)"] },
    skus: "C07408U4@0\n2E4@0\nP01317E5@1",
  });
  assert.equal(games[0][0], "God of War");
  assert.deepEqual(games[0][1], ["God of War (2018)"]);
  assert.deepEqual(games[0][2], [
    ["CUSA07408", "US", "4"],
    ["CUSA07410", "EU", "4"],
  ]);
  assert.equal(games[1][0], "God of War III Remastered");
  assert.deepEqual(games[1][2], [["PPSA01317", "EU", "5"]]);
  const index = buildNameIndex({
    format: 2,
    names: "0\tGod of War\n10\t III Remastered",
    aliases: { 0: ["God of War (2018)"] },
    skus: "C07408U4@0\n2E4@0\nP01317E5@1",
  });
  assert.deepEqual(matchIds(index, ["God of War (2018)"], "US", ["PS4"]), ["CUSA07408"]);
  assert.deepEqual(matchIds(index, ["God of War III Remastered"], "EU", ["PS5"]), ["PPSA01317"]);
});
