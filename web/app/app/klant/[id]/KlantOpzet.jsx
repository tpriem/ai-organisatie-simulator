"use client";

import { useState } from "react";
import { ROLLEN } from "../../../../../src/volwassenheid.js";
import { useMaturiteit } from "./Maturiteit";

// Verschijnt direct nadat een klant is aangemaakt: de links voor de klant maak je meteen hier,
// zodat je ze in één keer kunt kopiëren en versturen. De links worden maar één keer getoond; deze
// lijst bewaart ze zolang je op deze pagina blijft.

const rolNaam = (id) => ROLLEN.find((r) => r.id === id)?.naam ?? id;

export default function KlantOpzet({ id, onSluit }) {
  const { maakInvullink } = useMaturiteit();
  const [links, setLinks] = useState([]); // { wie, url }
  const [rol, setRol] = useState("directie");
  const [label, setLabel] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const [gekopieerd, setGekopieerd] = useState(null);

  const heeftAanlever = links.some((l) => l.soort === "aanlever");

  async function maakAanlever() {
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch(`/api/clients/${id}/links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "aanlever" }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setFout(body.error ?? "De link kon niet worden aangemaakt.");
      else setLinks((l) => [{ soort: "aanlever", wie: "Aanleverlink (roster en functieprofielen)", url: body.url }, ...l.filter((x) => x.soort !== "aanlever")]);
    } finally {
      setBezig(false);
    }
  }

  async function maakInvuller() {
    setBezig(true);
    setFout(null);
    const uit = await maakInvullink(rol, label);
    setBezig(false);
    if (uit.fout) return setFout(uit.fout);
    setLinks((l) => [...l, { soort: "invuller", wie: `Vragenlijst: ${rolNaam(rol)}${label.trim() ? ` · ${label.trim()}` : ""}`, url: uit.url }]);
    setLabel("");
  }

  async function kopieer(tekst, sleutel) {
    try {
      await navigator.clipboard.writeText(tekst);
      setGekopieerd(sleutel);
    } catch {
      setGekopieerd(null);
    }
  }

  const alles = links.map((l) => `${l.wie}\n${l.url}`).join("\n\n");

  return (
    <section className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50/50 p-6 shadow-sm">
      <div className="mb-1 flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800">Klant aangemaakt: maak de links voor de klant</h2>
        <button type="button" onClick={onSluit} className="text-xs text-slate-500 hover:text-slate-700 hover:underline">
          Klaar, sluiten
        </button>
      </div>
      <p className="mb-4 text-xs text-slate-600">
        Controleer eerst de scope bovenaan (totale bedrijf of business unit). Maak daarna hier de links, kopieer ze en verstuur ze. Een link wordt maar één keer getoond; blijf dus op deze
        pagina tot je ze hebt verstuurd. Later kun je altijd een nieuwe link maken.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-500">1. Aanleveren</h3>
          <p className="mt-1 text-xs text-slate-500">Voor het functieoverzicht en de functieprofielen. Eén link per klant.</p>
          <button
            type="button"
            onClick={maakAanlever}
            disabled={bezig}
            className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {heeftAanlever ? "Nieuwe aanleverlink maken" : "Aanleverlink maken"}
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-500">2. Vragenlijst voor invullers</h3>
          <p className="mt-1 text-xs text-slate-500">Eén link per invuller; de antwoorden komen per rol binnen.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-[11px] text-slate-500">
              Rol
              <select value={rol} onChange={(e) => setRol(e.target.value)} className="mt-0.5 block rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                {ROLLEN.filter((r) => r.id !== "adviseur").map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.naam}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-slate-500">
              Omschrijving (geen naam)
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={60}
                placeholder="bijvoorbeeld teamleider klantenservice"
                className="mt-0.5 block w-56 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              />
            </label>
            <button type="button" onClick={maakInvuller} disabled={bezig} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
              {bezig ? "Bezig…" : "Link maken"}
            </button>
          </div>
        </div>
      </div>

      {fout && <p className="mt-3 text-xs text-red-600">{fout}</p>}

      {links.length > 0 && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-emerald-800">Te versturen ({links.length})</p>
            <button type="button" onClick={() => kopieer(alles, "alles")} className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500">
              {gekopieerd === "alles" ? "Gekopieerd" : "Kopieer alle links"}
            </button>
          </div>
          <ul className="space-y-2">
            {links.map((l, n) => (
              <li key={`${l.soort}-${n}`}>
                <p className="text-xs font-medium text-slate-700">{l.wie}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <input readOnly value={l.url} onFocus={(e) => e.target.select()} className="w-full rounded border border-emerald-200 bg-white px-2 py-1 text-xs text-slate-700" />
                  <button type="button" onClick={() => kopieer(l.url, `${l.soort}-${n}`)} className="shrink-0 rounded-md border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                    {gekopieerd === `${l.soort}-${n}` ? "Gekopieerd" : "Kopieer"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
