import assert from "node:assert/strict";
import test from "node:test";
import { copy, languageOptions, resultCount, sourceLineText } from "./messages.ts";
import { noteLabel } from "./notes.ts";

test("the german source line stays exact and every language names the wiki and the license", () => {
  assert.equal(
    sourceLineText(copy.de.sourceLine),
    "Daten aus dem PlayStation Wiki (Fandom), CC BY-SA 4.0, bearbeitet",
  );
  for (const { id } of languageOptions) {
    assert.match(copy[id].sourceLine, /\{wiki\}/);
    assert.match(copy[id].sourceLine, /\{license\}/);
    assert.ok(copy[id].results.other, id);
    assert.notEqual(resultCount(id, 1), "");
    assert.notEqual(resultCount(id, 2), "");
    assert.equal(resultCount(id, 1).includes("{"), false);
  }
});

test("result counts use the singular where the language has one", () => {
  assert.equal(resultCount("en", 1), "1 game");
  assert.equal(resultCount("en", 2), "2 games");
  assert.equal(resultCount("en", 0), "0 games");
  assert.equal(resultCount("de", 1), "1 Spiel");
  assert.equal(resultCount("de", 2), "2 Spiele");
  assert.equal(resultCount("fr", 0), "0 jeu");
  assert.equal(resultCount("fr", 1), "1 jeu");
  assert.equal(resultCount("fr", 2), "2 jeux");
  assert.equal(resultCount("fi", 1), "1 peli");
  assert.equal(resultCount("fi", 2), "2 peliä");
  assert.equal(resultCount("pl", 1), "1 gra");
  assert.equal(resultCount("pl", 2), "2 gry");
  assert.equal(resultCount("pl", 5), "5 gier");
  assert.equal(resultCount("pl", 22), "22 gry");
  assert.equal(resultCount("ru", 1), "1 игра");
  assert.equal(resultCount("ru", 2), "2 игры");
  assert.equal(resultCount("ru", 5), "5 игр");
  assert.equal(resultCount("ru", 21), "21 игра");
  assert.equal(resultCount("cs", 1), "1 hra");
  assert.equal(resultCount("cs", 2), "2 hry");
  assert.equal(resultCount("cs", 5), "5 her");
  assert.equal(resultCount("ro", 1), "1 joc");
  assert.equal(resultCount("ro", 2), "2 jocuri");
  assert.equal(resultCount("ro", 21), "21 de jocuri");
  assert.equal(resultCount("ja", 1), "1 本");
  assert.equal(resultCount("tr", 1), "1 oyun");
  assert.equal(resultCount("tr", 2), "2 oyun");
  assert.notEqual(resultCount("en", 1), resultCount("en", 2));
});

test("notes follow the UI language and unknown notes stay as stored", () => {
  assert.equal(noteLabel("de", "Middle East"), "Naher Osten");
  assert.equal(noteLabel("de", "Middle East and India"), "Naher Osten und Indien");
  assert.equal(noteLabel("de", "DLC only"), "nur DLC");
  assert.equal(noteLabel("de", "Spain and Portugal"), "Spanien und Portugal");
  assert.equal(noteLabel("de", "Singapore and Thailand Only"), "nur Singapur und Thailand");
  assert.equal(noteLabel("de", "Hong Kong"), "Hongkong");
  assert.equal(noteLabel("de", "Taiwan"), "Taiwan");
  assert.equal(noteLabel("fr", "DLC only"), "DLC uniquement");
  assert.equal(noteLabel("ja", "Hong Kong"), "香港");
  assert.equal(noteLabel("en", "Taiwan"), "Taiwan");
  assert.equal(noteLabel("de", "A note the table does not know"), "A note the table does not know");
  assert.equal(noteLabel("de", ""), "");
  for (const { id } of languageOptions) {
    assert.notEqual(noteLabel(id, "Middle East"), "");
  }
});
