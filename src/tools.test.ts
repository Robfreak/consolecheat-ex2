import assert from "node:assert/strict";
import test from "node:test";
import { copy, languageOptions } from "./messages.ts";
import { OTHER_TOOLS } from "./tools.ts";

const EXPECTED: readonly (readonly [string, string])[] = [
  ["https://robfreak.github.io/consolecheat-ex1/", "Title-ID-Finder"],
  ["https://robfreak.github.io/consolecheat-ex3/", "Controller-Tester"],
  ["https://robfreak.github.io/consolecheat-ex4/", "Save-Info-Leser"],
  ["https://robfreak.github.io/consolecheat-ex5/", "Fehlercode-Nachschlager"],
  ["https://robfreak.github.io/consolecheat-ex6/", "Spiele-Merkliste"],
  ["https://robfreak.github.io/consolecheat-ex6/bildschirm/", "Bildschirm-Test"],
];

test("the footer links to every other tool and not to this archive", () => {
  assert.deepEqual(
    OTHER_TOOLS.map((tool) => [tool.href, tool.label]),
    EXPECTED,
  );
  const hrefs = OTHER_TOOLS.map((tool) => tool.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.equal(hrefs.some((href) => href.includes("consolecheat-ex2")), false);
  assert.equal(hrefs.some((href) => href === "https://consolecheat.com" || href === "https://consolecheat.com/"), false);
  for (const href of hrefs) {
    const url = new URL(href);
    assert.equal(url.protocol, "https:");
    assert.equal(url.host, "robfreak.github.io");
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
  }
});

test("the tools heading is German and English, and present in every language", () => {
  assert.equal(copy.de.moreTools, "Weitere Werkzeuge");
  assert.equal(copy.en.moreTools, "More tools");
  for (const { id } of languageOptions) {
    assert.ok(copy[id].moreTools.trim(), id);
    assert.equal(copy[id].moreTools.includes("{"), false, id);
  }
});
