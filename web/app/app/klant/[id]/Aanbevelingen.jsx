"use client";

import { useRef, useState } from "react";
import { AANBEVELING_KOPPEN, isGoedgekeurd } from "../../../../../src/aanbevelingen.js";

// De bevindingen en aanbevelingen van de capaciteitsanalyse. Een taalmodel stelt ze op; de adviseur
// leest ze, past aan waar nodig en keurt ze goed. Pas daarna gaan ze mee in het rapport.

const veld =
  "block w-full rounded-md border border-slate-300 bg-card px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const LIJSTEN = [
  ["krimpendeRollen", "text-indigo-400"],
  ["groeiendeRollen", "text-emerald-400"],
  ["samenvoegKandidaten", "text-indigo-400"],
];

const datum = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
};

// Voor het bewerken: de rollen van een samenvoegkandidaat als één regel tekst.
const naarConcept = (a) => ({
  bevindingenSamenvatting: a.bevindingenSamenvatting ?? "",
  krimpendeRollen: (a.krimpendeRollen ?? []).map((r) => ({ ...r })),
  groeiendeRollen: (a.groeiendeRollen ?? []).map((r) => ({ ...r })),
  samenvoegKandidaten: (a.samenvoegKandidaten ?? []).map((s) => ({ rolnaam: (s.rollen ?? []).join(" + "), toelichting: s.toelichting ?? "" })),
  aanbevelingen: (a.aanbevelingen ?? []).map((x) => ({ ...x })),
});
const vanConcept = (c) => ({
  ...c,
  samenvoegKandidaten: c.samenvoegKandidaten.map((s) => ({
    rollen: s.rolnaam.split("+").map((x) => x.trim()).filter(Boolean),
    toelichting: s.toelichting,
  })),
});

export default function Aanbevelingen({ id, aanbevelingen, onOpgeslagen }) {
  const [concept, setConcept] = useState(null); // niet null = bewerken
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const bezigRef = useRef(false);
  const goed = isGoedgekeurd(aanbevelingen);

  async function opslaan(inhoud, goedkeuren) {
    if (bezigRef.current) return;
    bezigRef.current = true;
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch(`/api/clients/${id}/aanbevelingen`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aanbevelingen: inhoud, goedkeuren }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Opslaan mislukt.");
      onOpgeslagen(body);
      setConcept(null);
    } catch (err) {
      setFout(err.message);
    } finally {
      bezigRef.current = false;
      setBezig(false);
    }
  }

  const zet = (pad, waarde) =>
    setConcept((c) => {
      const n = structuredClone(c);
      if (pad.length === 1) n[pad[0]] = waarde;
      else n[pad[0]][pad[1]][pad[2]] = waarde;
      return n;
    });
  const verwijder = (lijst, i) => setConcept((c) => ({ ...c, [lijst]: c[lijst].filter((_, j) => j !== i) }));
  const voegToe = (lijst, leeg) => setConcept((c) => ({ ...c, [lijst]: [...c[lijst], leeg] }));

  const status = (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
        goed ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"
      }`}
    >
      <p className={`text-xs leading-relaxed ${goed ? "text-emerald-800" : "text-amber-800"}`}>
        {goed ? (
          <>
            <span className="font-semibold">Goedgekeurd</span> op {datum(aanbevelingen.goedgekeurd.op)}
            {aanbevelingen.goedgekeurd.door ? ` door ${aanbevelingen.goedgekeurd.door}` : ""}. Deze tekst staat in het rapport.
          </>
        ) : (
          <>
            <span className="font-semibold">Concept, opgesteld door AI.</span> Lees de tekst, pas aan waar nodig en keur goed. Tot dan staan de bevindingen en
            aanbevelingen niet in het rapport.
          </>
        )}
      </p>
      {!concept && (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setConcept(naarConcept(aanbevelingen))}
            disabled={bezig}
            className="rounded-md border border-slate-300 bg-card px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-300 disabled:opacity-50"
          >
            Bewerken
          </button>
          {!goed && (
            <button
              type="button"
              onClick={() => opslaan(aanbevelingen, true)}
              disabled={bezig}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {bezig ? "Bezig…" : "Goedkeuren"}
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (concept) {
    return (
      <div>
        {status}
        <label className="mb-4 block text-xs font-medium text-slate-500">
          Samenvatting van de bevindingen
          <textarea rows={5} value={concept.bevindingenSamenvatting} onChange={(e) => zet(["bevindingenSamenvatting"], e.target.value)} className={`${veld} mt-1 leading-relaxed`} />
        </label>

        {LIJSTEN.map(([sleutel]) => (
          <fieldset key={sleutel} className="mb-4">
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{AANBEVELING_KOPPEN[sleutel]}</legend>
            <ul className="space-y-2">
              {concept[sleutel].map((r, i) => (
                <li key={i} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={r.rolnaam}
                      onChange={(e) => zet([sleutel, i, "rolnaam"], e.target.value)}
                      placeholder={sleutel === "samenvoegKandidaten" ? "Functies, gescheiden door +" : "Functie"}
                      aria-label="Functie"
                      className={veld}
                    />
                    <button type="button" onClick={() => verwijder(sleutel, i)} className="shrink-0 text-xs text-red-400 hover:underline">
                      Verwijderen
                    </button>
                  </div>
                  <textarea rows={2} value={r.toelichting} onChange={(e) => zet([sleutel, i, "toelichting"], e.target.value)} aria-label="Toelichting" className={`${veld} mt-1.5`} />
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => voegToe(sleutel, { rolnaam: "", toelichting: "" })} className="mt-1.5 text-xs text-indigo-400 hover:underline">
              + Toevoegen
            </button>
          </fieldset>
        ))}

        <fieldset className="mb-4">
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Aanbevelingen</legend>
          <ul className="space-y-2">
            {concept.aanbevelingen.map((a, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-2.5">
                <div className="flex gap-2">
                  <input type="text" value={a.titel} onChange={(e) => zet(["aanbevelingen", i, "titel"], e.target.value)} placeholder="Titel" aria-label="Titel" className={`${veld} font-medium`} />
                  <button type="button" onClick={() => verwijder("aanbevelingen", i)} className="shrink-0 text-xs text-red-400 hover:underline">
                    Verwijderen
                  </button>
                </div>
                <textarea rows={3} value={a.beschrijving} onChange={(e) => zet(["aanbevelingen", i, "beschrijving"], e.target.value)} aria-label="Beschrijving" className={`${veld} mt-1.5`} />
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => voegToe("aanbevelingen", { titel: "", beschrijving: "" })} className="mt-1.5 text-xs text-indigo-400 hover:underline">
            + Toevoegen
          </button>
        </fieldset>

        {fout && <p className="mb-2 text-xs text-red-400">{fout}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => opslaan(vanConcept(concept), true)} disabled={bezig} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            {bezig ? "Opslaan…" : "Opslaan en goedkeuren"}
          </button>
          <button type="button" onClick={() => opslaan(vanConcept(concept), false)} disabled={bezig} className="rounded-md border border-slate-300 bg-card px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-300 disabled:opacity-50">
            Opslaan als concept
          </button>
          <button type="button" onClick={() => setConcept(null)} disabled={bezig} className="text-xs text-slate-500 hover:underline">
            Annuleren
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {status}
      {fout && <p className="mb-2 text-xs text-red-400">{fout}</p>}
      <p className="mb-5 text-sm text-slate-700">{aanbevelingen.bevindingenSamenvatting}</p>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {LIJSTEN.map(([sleutel, kleur]) => (
          <div key={sleutel}>
            <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${kleur}`}>{AANBEVELING_KOPPEN[sleutel]}</p>
            {aanbevelingen[sleutel]?.length > 0 ? (
              <ul className="space-y-2">
                {aanbevelingen[sleutel].map((r, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-medium text-slate-800">{r.rolnaam ?? r.rollen?.join(" + ")}</span>
                    <p className="text-slate-500">{r.toelichting}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">—</p>
            )}
          </div>
        ))}
      </div>

      {aanbevelingen.aanbevelingen?.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Aanbevelingen</p>
          <ul className="space-y-3">
            {aanbevelingen.aanbevelingen.map((a, i) => (
              <li key={i} className="rounded-lg bg-indigo-50/60 p-3">
                <p className="text-sm font-medium text-indigo-900">{a.titel}</p>
                <p className="mt-0.5 text-sm text-slate-600">{a.beschrijving}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
