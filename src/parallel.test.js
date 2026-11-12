import test from "node:test";
import assert from "node:assert/strict";
import { parallel } from "./parallel.js";

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

test("de uitkomsten staan in de volgorde van de invoer, ook als een later item eerder klaar is", async () => {
  const uit = await parallel([30, 5, 15, 1], 4, async (ms, i) => {
    await wacht(ms);
    return `${i}:${ms}`;
  });
  assert.deepEqual(uit, ["0:30", "1:5", "2:15", "3:1"]);
});

test("er lopen nooit meer dan het opgegeven aantal tegelijk", async () => {
  let bezig = 0;
  let piek = 0;
  await parallel(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
    bezig++;
    piek = Math.max(piek, bezig);
    await wacht(2);
    bezig--;
  });
  assert.equal(piek, 3);
});

test("een fout gaat door naar de aanroeper en er worden geen nieuwe items meer gestart", async () => {
  const gestart = [];
  await assert.rejects(
    parallel([0, 1, 2, 3, 4, 5, 6, 7], 2, async (i) => {
      gestart.push(i);
      await wacht(2);
      if (i === 1) throw new Error("opslag weigert bestand");
    }),
    /opslag weigert bestand/
  );
  assert.ok(gestart.length < 8, `na de fout hoort de rest niet meer te starten (gestart: ${gestart.length})`);
});

test("een lege lijst en een te laag aantal geven geen fout", async () => {
  assert.deepEqual(await parallel([], 8, async () => 1), []);
  assert.deepEqual(await parallel([1, 2], 0, async (x) => x * 2), [2, 4]);
});
