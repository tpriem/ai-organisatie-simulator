import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maakToken,
  splitsToken,
  geheimKlopt,
  hashGeheim,
  nieuweLink,
  linkActief,
  publiekeWeergave,
  schoneBestandsnaam,
  controleerBestand,
  UPLOAD_LIMIETEN,
} from "./links.js";

const KLANT = "65fe9be9-fbf7-4b44-94c6-b129b8517448";

test("een token bevat het klant-id en een geheim van 32 tekens, en is elke keer anders", () => {
  const a = maakToken(KLANT);
  const b = maakToken(KLANT);
  assert.match(a.token, new RegExp(`^${KLANT}\\.[A-Za-z0-9_-]{32}$`));
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.hash, b.hash);
  assert.equal(a.hash, hashGeheim(a.geheim));
});

test("een ongeldig klant-id levert geen token op", () => {
  assert.throws(() => maakToken("niet-een-uuid"));
  assert.throws(() => maakToken("../../etc/passwd"));
});

test("splitsToken herkent een echt token en wijst al het andere af", () => {
  const t = maakToken(KLANT);
  assert.deepEqual(splitsToken(t.token), { klantId: KLANT, geheim: t.geheim });
  for (const slecht of [
    "",
    null,
    undefined,
    42,
    KLANT,
    `${KLANT}.`,
    `${KLANT}.kort`,
    `${KLANT}.${"a".repeat(33)}`,
    `${KLANT}.${"a".repeat(31)}!`,
    `niet-een-uuid.${"a".repeat(32)}`,
    `${KLANT}.${"a".repeat(32)}.extra`,
    `../${KLANT}.${"a".repeat(32)}`,
  ]) {
    assert.equal(splitsToken(slecht), null, String(slecht));
  }
});

test("het geheim klopt alleen bij de juiste hash", () => {
  const t = maakToken(KLANT);
  assert.equal(geheimKlopt(t.geheim, t.hash), true);
  assert.equal(geheimKlopt(t.geheim + "x", t.hash), false);
  assert.equal(geheimKlopt(maakToken(KLANT).geheim, t.hash), false);
  assert.equal(geheimKlopt(t.geheim, "geen-hex"), false);
  assert.equal(geheimKlopt(null, t.hash), false);
  assert.equal(geheimKlopt(t.geheim, undefined), false);
});

test("een linkrecord bewaart de hash maar nooit het geheim, en de weergave voor de adviseur nooit de hash", () => {
  const t = maakToken(KLANT);
  const link = nieuweLink({ type: "invuller", hash: t.hash, rol: "directie", label: " CIO ", invullerId: "directie-abc", nu: new Date("2026-10-22T10:00:00Z") });
  assert.equal(link.hash, t.hash);
  assert.ok(!JSON.stringify(link).includes(t.geheim));
  assert.equal(link.label, "CIO");
  assert.equal(link.verlooptOp, "2026-12-06T10:00:00.000Z", "45 dagen");
  const zichtbaar = publiekeWeergave(link, new Date("2026-10-23T00:00:00Z"));
  assert.equal("hash" in zichtbaar, false);
  assert.equal(zichtbaar.actief, true);
});

test("een invullink hoort bij een invuller; een aanleverlink niet", () => {
  const { hash } = maakToken(KLANT);
  assert.throws(() => nieuweLink({ type: "invuller", hash, rol: "hr" }), /invuller/);
  const aanlever = nieuweLink({ type: "aanlever", hash, rol: "directie", invullerId: "x" });
  assert.equal(aanlever.rol, null);
  assert.equal(aanlever.invullerId, null);
  assert.throws(() => nieuweLink({ type: "iets-anders", hash }));
});

test("een link is niet meer bruikbaar als hij is ingetrokken of verlopen", () => {
  const { hash } = maakToken(KLANT);
  const nu = new Date("2026-10-22T10:00:00Z");
  const link = nieuweLink({ type: "aanlever", hash, nu, geldigDagen: 10 });
  assert.equal(linkActief(link, new Date("2026-10-31T10:00:00Z")), true);
  assert.equal(linkActief(link, new Date("2026-11-01T10:00:01Z")), false, "verlopen");
  assert.equal(linkActief({ ...link, ingetrokken: true }, nu), false);
  assert.equal(linkActief(null, nu), false);
});

test("bestandsnamen: geen paden, geen vreemde tekens, en de extensie blijft", () => {
  assert.equal(schoneBestandsnaam("Functie Manager.docx"), "Functie Manager.docx");
  assert.equal(schoneBestandsnaam("../../etc/passwd.csv"), "passwd.csv");
  assert.equal(schoneBestandsnaam("C:\\Users\\x\\roster.XLSX"), "roster.xlsx");
  assert.equal(schoneBestandsnaam("rooster<script>.csv"), "rooster_script_.csv");
  assert.equal(schoneBestandsnaam("a".repeat(200) + ".pdf").length, 84, "80 tekens plus .pdf");
  assert.equal(schoneBestandsnaam("zonderextensie"), null);
  assert.equal(schoneBestandsnaam(".csv"), null);
  assert.equal(schoneBestandsnaam(""), null);
  assert.equal(schoneBestandsnaam(null), null);
});

test("bestandscontrole: soort, extensie, leeg en te groot", () => {
  assert.deepEqual(controleerBestand({ soort: "roster", naam: "roster.csv", bytes: 1200 }), { ok: true, naam: "roster.csv" });
  assert.deepEqual(controleerBestand({ soort: "profiel", naam: "Manager.PDF", bytes: 5000 }), { ok: true, naam: "Manager.pdf" });
  assert.equal(controleerBestand({ soort: "roster", naam: "roster.docx", bytes: 1200 }).ok, false, "een roster is geen Word-bestand");
  assert.equal(controleerBestand({ soort: "profiel", naam: "script.exe", bytes: 100 }).ok, false);
  assert.equal(controleerBestand({ soort: "profiel", naam: "x.pdf", bytes: 0 }).ok, false);
  assert.equal(controleerBestand({ soort: "profiel", naam: "x.pdf", bytes: UPLOAD_LIMIETEN.maxBytesPerBestand + 1 }).ok, false);
  assert.equal(controleerBestand({ soort: "onbekend", naam: "x.pdf", bytes: 10 }).ok, false);
  assert.equal(controleerBestand({ soort: "profiel", naam: "", bytes: 10 }).ok, false);
});

import { inhoudKlopt } from "./links.js";

test("de inhoud moet bij de extensie passen", () => {
  const b = (...bytes) => Buffer.from(bytes);
  assert.equal(inhoudKlopt("a.pdf", Buffer.from("%PDF-1.7\n...")), true);
  assert.equal(inhoudKlopt("a.pdf", Buffer.from("MZ programma")), false, "een hernoemd programma is geen pdf");
  assert.equal(inhoudKlopt("a.docx", b(0x50, 0x4b, 3, 4)), true);
  assert.equal(inhoudKlopt("a.docx", Buffer.from("gewone tekst")), false);
  assert.equal(inhoudKlopt("a.xlsx", b(0x50, 0x4b, 3, 4)), true);
  assert.equal(inhoudKlopt("a.xls", b(0xd0, 0xcf, 0x11, 0xe0)), true);
  assert.equal(inhoudKlopt("a.csv", Buffer.from("rolnaam,fte\nManager,1\n")), true);
  assert.equal(inhoudKlopt("a.csv", b(0x50, 0x4b, 0, 0)), false, "binaire inhoud in een csv");
  assert.equal(inhoudKlopt("a.txt", Buffer.from("tekst")), true);
  assert.equal(inhoudKlopt("a.exe", Buffer.from("x")), false);
});

test("de bestandsgrens ligt onder de platformgrens van 4,5 MB", () => {
  assert.ok(UPLOAD_LIMIETEN.maxBytesPerBestand < 4.5 * 1024 * 1024);
  assert.match(controleerBestand({ soort: "profiel", naam: "x.pdf", bytes: UPLOAD_LIMIETEN.maxBytesPerBestand + 1 }).fout, /maximaal 4 MB/);
});
