import test from "node:test";
import assert from "node:assert/strict";
import { getTrainability, isTrainbaar } from "./trainability.js";

test("kennis is met opleiding over te dragen", () => {
  assert.equal(getTrainability({ type: "knowledge", reuse: "cross-sector", cat: null }), "hoog");
});

test("beroeps- en sectorspecifieke vaardigheden zijn goed aan te leren", () => {
  assert.equal(getTrainability({ type: "competence", reuse: "occupation-specific", cat: null }), "hoog");
  assert.equal(getTrainability({ type: "competence", reuse: "sector-specific", cat: null }), "hoog");
});

test("brede vaardigheden zijn te ontwikkelen, maar niet met een cursus alleen", () => {
  assert.equal(getTrainability({ type: "competence", reuse: "cross-sector", cat: null }), "midden");
  assert.equal(getTrainability({ type: "competence", reuse: "transversal", cat: "sociaal" }), "midden");
});

test("attitudes uit de transversale groep zelfbeheer gelden als laag trainbaar", () => {
  // "zelfvertrouwen tonen" staat in ESCO als cross-sector, maar hoort via de
  // transversale collectie in groep T3. Zonder die categorie zou het ten onrechte
  // als trainbaar gelden — precies de fout die we willen voorkomen.
  assert.equal(getTrainability({ type: "competence", reuse: "cross-sector", cat: "attitudes" }), "laag");
});

test("ontbrekende metadata levert geen gok op", () => {
  assert.equal(getTrainability(null), null);
  assert.equal(getTrainability(undefined), null);
  assert.equal(getTrainability({}), null);
});

test("alleen laag trainbaar valt buiten wat te ontwikkelen is", () => {
  assert.equal(isTrainbaar("hoog"), true);
  assert.equal(isTrainbaar("midden"), true);
  assert.equal(isTrainbaar("laag"), false);
  assert.equal(isTrainbaar(null), false);
});
