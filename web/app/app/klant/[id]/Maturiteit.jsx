"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MODEL,
  DIMENSIES,
  INDICATOREN,
  ANTWOORDEN,
  berekenProfiel,
  vergelijkMetingen,
  practiceSleutel,
} from "../../../../../src/aiMaturity.js";

// Tabblad "AI Maturity": de beoordeling volgens The AI Adoption Maturity Model v1.0 (CMU SEI
// en Accenture). De teksten zijn die van het model (Engels) en de score is de standaardmethode
// uit hoofdstuk 5. Dit tabblad staat los van de analyse van functies: er wordt hier niets
// uit de rest van de tool in meegerekend. Het werkdocument wordt automatisch bewaard;
// "Meting vastleggen" legt een moment vast voor een herhaalmeting.

const NIVEAU_KLEUR = ["bg-slate-300", "bg-sky-400", "bg-sky-500", "bg-indigo-500", "bg-indigo-600", "bg-emerald-500"];
const INDICATOR_NAAM = { accountability: "Accountability", planning: "Planning", resourcing: "Resourcing" };

function datum(iso) {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function ProfielRegel({ d, onOpen }) {
  const gemeten = d.niveau !== null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-[minmax(0,13rem)_1fr_auto] items-center gap-3 rounded-md py-1.5 text-left hover:bg-slate-50"
    >
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-700">{d.naam}</p>
        <p className="text-[10px] text-slate-400">
          {d.telling.beantwoord}/{d.telling.totaal} practices beantwoord
        </p>
      </div>
      <div
        className="h-3 rounded-full bg-slate-100"
        role="img"
        aria-label={`${d.naam}: niveau ${d.niveau ?? "niet gemeten"} van 5`}
      >
        {gemeten && (
          <div className={`h-3 rounded-full ${NIVEAU_KLEUR[d.niveau]}`} style={{ width: `${Math.max(d.niveau, 0.15) * 20}%` }} />
        )}
      </div>
      <div className="w-48 text-right text-xs">
        {gemeten ? (
          <>
            <span className="font-semibold text-slate-800">
              {d.niveau} · {d.niveauNaam}
            </span>
            {d.onvolledig && <span className="ml-1.5 text-[10px] text-amber-600">onvolledig</span>}
          </>
        ) : (
          <span className="text-slate-400">nog niet ingevuld</span>
        )}
      </div>
    </button>
  );
}

function Beperkingen({ dimensie }) {
  if (!dimensie.gemeten || dimensie.volgendNiveau === null) return null;
  if (dimensie.beperkend.length === 0) {
    return null;
  }
  return (
    <div className="mb-3 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-900">
      <p className="mb-1 font-semibold">Wat houdt deze dimensie nog op niveau {dimensie.niveau}? (voor niveau {dimensie.volgendNiveau})</p>
      <ul className="list-disc space-y-0.5 pl-4">
        {dimensie.beperkend.map((b) => (
          <li key={b.capabilityAreaId}>
            <span className="font-medium">{b.capabilityArea}</span>:{" "}
            {b.soort === "goals"
              ? `${b.openPractices} practice${b.openPractices === 1 ? "" : "s"} nog niet voldaan (goal ${b.openGoals.join(", ")})`
              : `maturity indicator${b.indicatoren.length === 1 ? "" : "s"} ${b.indicatoren.map((i) => INDICATOR_NAAM[i]).join(", ")} te laag`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PracticeRij({ goalNummer, practice, onZet }) {
  return (
    <li className="flex flex-col gap-1.5 border-t border-slate-100 py-2 first:border-t-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <p className="text-xs text-slate-700">
        <span className="mr-1.5 font-semibold text-slate-400">
          {goalNummer}.{practice.nummer}
        </span>
        {practice.tekst}
      </p>
      <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={`Practice ${goalNummer}.${practice.nummer}`}>
        {ANTWOORDEN.map((a) => (
          <button
            key={a.waarde}
            type="button"
            role="radio"
            aria-checked={practice.antwoord === a.waarde}
            onClick={() => onZet(practice.antwoord === a.waarde ? null : a.waarde)}
            className={`rounded border px-2 py-0.5 text-[11px] transition-colors ${
              practice.antwoord === a.waarde
                ? a.waarde === "ja"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : a.waarde === "niet"
                    ? "border-red-500 bg-red-500 text-white"
                    : a.waarde === "deels"
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-slate-500 bg-slate-500 text-white"
                : "border-slate-300 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
    </li>
  );
}

function CapabilityAreaPaneel({ ca, bron, onPractice, onIndicator, onNotitie }) {
  const t = ca.telling;
  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">
            {ca.naam}
            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-500">
              positioned at level {ca.positioneringsNiveau}
            </span>
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-slate-400">
          {t.beantwoord}/{t.totaal} · {ca.doelenBehaald ? <span className="text-emerald-600">goals behaald</span> : "goals open"}
        </span>
      </summary>
      <div className="border-t border-slate-100 px-4 py-3">
        <p className="mb-3 text-xs italic text-slate-500">{ca.beschrijving}</p>

        {ca.goals.map((g) => (
          <div key={g.nummer} className="mb-3">
            <p className="text-xs font-semibold text-slate-800">
              Goal {g.nummer}
              {g.behaald && <span className="ml-2 text-[10px] font-normal text-emerald-600">behaald</span>}
            </p>
            <p className="mb-1 text-xs text-slate-600">{g.tekst}</p>
            <ul>
              {g.practices.map((p) => (
                <PracticeRij key={p.nummer} goalNummer={g.nummer} practice={p} onZet={(w) => onPractice(ca.id, practiceSleutel(g.nummer, p.nummer), w)} />
              ))}
            </ul>
          </div>
        ))}

        <div className="mt-4 rounded-md bg-slate-50 px-3 py-2">
          <p className="mb-1 text-xs font-semibold text-slate-700">
            Maturity indicators{" "}
            <span className="font-normal text-slate-400">— kies per indicator het niveau dat de huidige situatie het best beschrijft</span>
          </p>
          {INDICATOREN.map((ind) => (
            <div key={ind.id} className="py-1.5">
              <p className="mb-1 text-[11px] text-slate-500">{ind.naam}</p>
              <div className="grid gap-1 sm:grid-cols-5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={ca.indicatoren[ind.id] === n}
                    onClick={() => onIndicator(ca.id, ind.id, ca.indicatoren[ind.id] === n ? null : n)}
                    title={ind.niveaus[n]}
                    className={`rounded border px-2 py-1 text-left text-[10px] leading-snug transition-colors ${
                      ca.indicatoren[ind.id] === n
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:border-indigo-300"
                    }`}
                  >
                    <span className="block font-semibold">Level {n}</span>
                    {ind.niveaus[n]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {bron.artifacts?.length > 0 && (
          <p className="mt-3 text-[11px] text-slate-500">
            <span className="font-semibold">Example artifacts (evidence):</span> {bron.artifacts.join(" · ")}
          </p>
        )}
        <label className="mt-3 block text-xs text-slate-500">
          Onderbouwing / opmerking
          <textarea
            value={ca.notitie}
            onChange={(e) => onNotitie(ca.id, e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Welke documenten, cijfers of gesprekken liggen onder deze beoordeling?"
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>
      </div>
    </details>
  );
}

export default function Maturiteit({ id }) {
  const [huidig, setHuidig] = useState(null);
  const [metingen, setMetingen] = useState([]);
  const [status, setStatus] = useState("laden"); // laden | klaar | opslaan | opgeslagen | fout
  const [vastleggen, setVastleggen] = useState(false);
  const [melding, setMelding] = useState(null);
  const [geopend, setGeopend] = useState(null);
  const timer = useRef(null);
  const wacht = useRef(null);
  const dimensieRefs = useRef({});

  useEffect(() => {
    let actief = true;
    fetch(`/api/clients/${id}/maturiteit`)
      .then((r) => r.json())
      .then((d) => {
        if (!actief) return;
        setHuidig(d.huidig);
        setMetingen(d.metingen ?? []);
        setStatus("klaar");
      })
      .catch(() => actief && setStatus("fout"));
    return () => {
      actief = false;
      // Wisselt de gebruiker van tabblad terwijl er nog een wijziging wacht, dan toch opslaan.
      if (wacht.current) {
        clearTimeout(timer.current);
        fetch(`/api/clients/${id}/maturiteit`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(wacht.current),
          keepalive: true,
        });
      }
    };
  }, [id]);

  function bewaar(volgende) {
    setHuidig(volgende);
    wacht.current = volgende;
    setStatus("opslaan");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const teSturen = wacht.current;
      try {
        const res = await fetch(`/api/clients/${id}/maturiteit`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(teSturen),
        });
        if (!res.ok) throw new Error();
        if (wacht.current === teSturen) wacht.current = null;
        setStatus("opgeslagen");
      } catch {
        setStatus("fout");
      }
    }, 700);
  }

  function zetPractice(caId, sleutel, waarde) {
    const rij = { ...(huidig.practices?.[caId] ?? {}) };
    if (waarde === null) delete rij[sleutel];
    else rij[sleutel] = waarde;
    bewaar({ ...huidig, practices: { ...huidig.practices, [caId]: rij } });
  }
  function zetIndicator(caId, indicatorId, niveau) {
    const rij = { ...(huidig.indicatoren?.[caId] ?? {}) };
    if (niveau === null) delete rij[indicatorId];
    else rij[indicatorId] = niveau;
    bewaar({ ...huidig, indicatoren: { ...huidig.indicatoren, [caId]: rij } });
  }
  const zetNotitie = (caId, tekst) => bewaar({ ...huidig, notities: { ...huidig.notities, [caId]: tekst } });

  const profiel = useMemo(() => (huidig ? berekenProfiel(huidig) : null), [huidig]);
  const vergelijking = useMemo(() => {
    if (!profiel || metingen.length === 0) return null;
    return vergelijkMetingen(berekenProfiel(metingen[0]), profiel);
  }, [profiel, metingen]);

  async function leggVast() {
    setVastleggen(true);
    setMelding(null);
    try {
      if (wacht.current) {
        clearTimeout(timer.current);
        await fetch(`/api/clients/${id}/maturiteit`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(wacht.current),
        });
        wacht.current = null;
      }
      const res = await fetch(`/api/clients/${id}/maturiteit`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Vastleggen mislukt");
      setMetingen(body.metingen);
      setStatus("opgeslagen");
      setMelding({ soort: "ok", tekst: "Meting vastgelegd." });
    } catch (err) {
      setMelding({ soort: "fout", tekst: err.message });
    } finally {
      setVastleggen(false);
    }
  }

  function openDimensie(dimId) {
    setGeopend(dimId);
    requestAnimationFrame(() => dimensieRefs.current[dimId]?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  if (status === "laden") return <p className="py-8 text-center text-sm text-slate-400">Laden…</p>;
  if (!huidig) return <p className="py-8 text-center text-sm text-red-600">De meting kon niet worden geladen.</p>;

  return (
    <div>
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-base">🧭</span>
            {MODEL.naam} v{MODEL.versie} — profiel
          </h2>
          <span className="text-xs text-slate-400" aria-live="polite">
            {status === "opslaan" ? "Opslaan…" : status === "opgeslagen" ? "Opgeslagen" : status === "fout" ? "Opslaan mislukt" : ""}
          </span>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Beoordeling volgens het model van het Software Engineering Institute (Carnegie Mellon University) en Accenture. Dit is een
          losse score: er wordt niets uit de analyse van functies in meegerekend. Het model kent een niveau per dimensie en geen
          totaalscore.
        </p>
        <label className="mb-4 block text-xs text-slate-500">
          Scope van de beoordeling (organisatieonderdeel)
          <input
            type="text"
            value={huidig.scope ?? ""}
            onChange={(e) => bewaar({ ...huidig, scope: e.target.value })}
            maxLength={200}
            placeholder="Bijvoorbeeld: hele organisatie, of business unit Klantenservice"
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>

        {profiel.dimensies.map((d) => (
          <ProfielRegel key={d.id} d={d} onOpen={() => openDimensie(d.id)} />
        ))}

        <p className="mt-3 text-[11px] text-slate-500">
          Scoring (standaardmethode van het model): een practice telt als voldaan of niet van toepassing; een goal is behaald als alle
          toepasselijke practices voldaan zijn; een capability area krijgt het laagste niveau van zijn drie maturity indicators, ook
          als alle goals behaald zijn; een dimensie wordt beoordeeld naar zijn laagst scorende capability area (Table 2 van het model).
          Wat niet is beantwoord telt als niet voldaan.
        </p>
        {profiel.gemeten > 0 && profiel.telling.beantwoord < profiel.telling.totaal && (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-800">
            {profiel.telling.beantwoord} van {profiel.telling.totaal} practices beantwoord. Het profiel is een ondergrens zolang niet alles is
            beantwoord.
          </p>
        )}
      </div>

      <div className="mb-5 space-y-3">
        {profiel.dimensies.map((d, i) => (
          <details
            key={d.id}
            ref={(el) => (dimensieRefs.current[d.id] = el)}
            open={geopend === d.id}
            onToggle={(e) => e.currentTarget.open && setGeopend(d.id)}
            className="rounded-xl border border-slate-200 bg-slate-50/60"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{d.naam}</p>
                <p className="text-xs text-slate-500">{d.beschrijving}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-500">
                {d.niveau === null ? "—" : `Level ${d.niveau}`}
              </span>
            </summary>
            <div className="space-y-2 px-4 pb-4">
              <Beperkingen dimensie={d} />
              {d.capabilityAreas.map((ca, k) => (
                <CapabilityAreaPaneel
                  key={ca.id}
                  ca={ca}
                  bron={DIMENSIES[i].capabilityAreas[k]}
                  onPractice={zetPractice}
                  onIndicator={zetIndicator}
                  onNotitie={zetNotitie}
                />
              ))}
            </div>
          </details>
        ))}
      </div>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800">Metingen in de tijd</h2>
          <button
            onClick={leggVast}
            disabled={vastleggen || profiel.gemeten === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40"
          >
            {vastleggen && (
              <span aria-hidden="true" className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {vastleggen ? "Vastleggen…" : "Meting vastleggen"}
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Leg een meting vast om later opnieuw te meten en te zien wat er is verbeterd. Het profiel hierboven is het werkdocument; een
          vastgelegde meting verandert niet meer.
        </p>
        {melding && <p className={`mb-2 text-xs ${melding.soort === "ok" ? "text-emerald-700" : "text-red-600"}`}>{melding.tekst}</p>}
        {vergelijking && (
          <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Sinds de laatste meting ({datum(metingen[0].op)}):{" "}
            <span className="font-medium text-emerald-700">{vergelijking.gestegen} gestegen</span>,{" "}
            <span className="font-medium text-slate-700">{vergelijking.gelijk} gelijk</span>,{" "}
            <span className="font-medium text-red-600">{vergelijking.gedaald} gedaald</span>.
            {vergelijking.verschillen
              .filter((v) => v.verschil !== 0)
              .map((v) => ` ${v.naam}: ${v.voor} → ${v.nu}.`)
              .join("")}
          </p>
        )}
        {metingen.length === 0 ? (
          <p className="text-xs text-slate-400">Nog geen meting vastgelegd.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {metingen.map((m) => {
              const p = berekenProfiel(m);
              return (
                <li key={m.op} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <span className="text-slate-700">
                    {datum(m.op)}
                    {m.scope ? ` · ${m.scope}` : ""}
                  </span>
                  <span className="text-slate-500">
                    {p.gemeten} van 8 dimensies · levels {p.dimensies.map((d) => (d.niveau === null ? "–" : d.niveau)).join(" ")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mb-8 whitespace-pre-line text-[10px] leading-relaxed text-slate-400">
        <p className="mb-1">
          Bron: {MODEL.naam} v{MODEL.versie}, {MODEL.uitgever}.{" "}
          <a className="underline" href={MODEL.bron} target="_blank" rel="noreferrer">
            sei.cmu.edu/library/ai-adoption-maturity-model
          </a>
          . Dit is geen officieel assessment of certificering. Voor intern gebruik; verspreiding buiten de organisatie vraagt toestemming
          van het SEI.
        </p>
        {MODEL.copyright}
      </div>
    </div>
  );
}
