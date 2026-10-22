"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  RAAMWERK,
  ASSEN,
  ROLLEN,
  ANTWOORDEN,
  NIVEAUS,
  STANDAARD_DOEL,
  MAX_INVULLERS,
  effectieveAntwoorden,
  analyseer,
  berekenProfiel,
  vergelijkMetingen,
} from "../../../../../src/volwassenheid.js";

// Tabbladen voor het AI-volwassenheidsraamwerk van House of Digital. De vragenlijst (invoer)
// staat onder "AI-volwassenheid", de uitkomsten onder Resultaten → AI-volwassenheid. Het
// ontwerp en de redenering staan in docs/volwassenheidsraamwerk-ontwerp.md. De score staat los
// van de analyse van functies, op één plek na: de realisatievoorwaarden (analyse I) lezen de
// vrijgekomen capaciteit uit die analyse.

const NIVEAU_KLEUR = ["bg-slate-300", "bg-sky-400", "bg-sky-500", "bg-indigo-500", "bg-indigo-600", "bg-emerald-500"];
const rolNaam = (id) => ROLLEN.find((r) => r.id === id)?.naam ?? id;
const ANTWOORD_LABEL = Object.fromEntries(ANTWOORDEN.map((a) => [a.waarde, a.label]));

function datum(iso) {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

// ---- Gedeelde staat -------------------------------------------------------------------------
// De vragen en de uitkomsten zijn twee weergaven van dezelfde meting. De staat staat daarom in
// een provider die om beide tabbladen heen zit en blijft bestaan als de gebruiker wisselt: zo
// gaat een wijziging die nog op opslaan wacht niet verloren en lezen beide weergaven dezelfde
// gegevens.

const MaturiteitContext = createContext(null);

function useMaturiteit() {
  const ctx = useContext(MaturiteitContext);
  if (!ctx) throw new Error("MaturiteitProvider ontbreekt");
  return ctx;
}

const ADVISEUR = "geldend"; // de actieve "invuller" voor het oordeel van de adviseur

export function MaturiteitProvider({ id, children }) {
  const [huidig, setHuidig] = useState(null);
  const [metingen, setMetingen] = useState([]);
  const [status, setStatus] = useState("laden"); // laden | klaar | opslaan | opgeslagen | fout
  const [actief, setActief] = useState(ADVISEUR);
  const [gevraagdeAs, setGevraagdeAs] = useState(null);
  const timer = useRef(null);
  const wacht = useRef(null);
  // De laatste staat, direct bijgewerkt. Twee klikken kort na elkaar mogen elkaar niet
  // overschrijven doordat de tweede nog van de staat van vóór de eerste uitgaat.
  const laatste = useRef(null);

  useEffect(() => {
    let leeft = true;
    fetch(`/api/clients/${id}/maturiteit`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!leeft) return;
        laatste.current = d.huidig;
        setHuidig(d.huidig);
        setMetingen(d.metingen ?? []);
        setStatus("klaar");
      })
      .catch(() => leeft && setStatus("fout"));
    return () => {
      leeft = false;
      // Verlaat de gebruiker de klant terwijl er nog een wijziging wacht, dan toch opslaan.
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

  const bewaar = useCallback(
    (volgende) => {
      laatste.current = volgende;
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
    },
    [id]
  );

  // Wat nog wacht moet weg zijn voordat een meting wordt vastgelegd.
  const spoelLeeg = useCallback(async () => {
    if (!wacht.current) return;
    clearTimeout(timer.current);
    await fetch(`/api/clients/${id}/maturiteit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wacht.current),
    });
    wacht.current = null;
  }, [id]);

  // Wijzig het antwoord of de toelichting van de actieve invuller (of van de adviseur).
  const wijzigBron = (fn) => {
    const nu = laatste.current;
    if (actief === ADVISEUR) {
      bewaar({ ...nu, geldend: fn(nu.geldend) });
    } else {
      bewaar({ ...nu, invullers: nu.invullers.map((i) => (i.id === actief ? { ...i, ...fn(i) } : i)) });
    }
  };
  const zetAntwoord = (stellingId, waarde) =>
    wijzigBron((b) => {
      const antwoorden = { ...b.antwoorden };
      if (waarde === null) delete antwoorden[stellingId];
      else antwoorden[stellingId] = waarde;
      return { ...b, antwoorden };
    });
  const zetBewijs = (stellingId, tekst) =>
    wijzigBron((b) => {
      const bewijs = { ...b.bewijs };
      if (tekst.trim()) bewijs[stellingId] = tekst;
      else delete bewijs[stellingId];
      return { ...b, bewijs };
    });
  const zetBewijsGezien = (stellingId, gezien) => {
    const nu = laatste.current;
    const bewijsGezien = { ...nu.geldend.bewijsGezien };
    if (gezien) bewijsGezien[stellingId] = true;
    else delete bewijsGezien[stellingId];
    bewaar({ ...nu, geldend: { ...nu.geldend, bewijsGezien } });
  };
  const zetDoel = (asId, doel) => bewaar({ ...laatste.current, doelen: { ...laatste.current.doelen, [asId]: doel } });
  const zetScope = (scope) => bewaar({ ...laatste.current, scope });

  const voegInvullerToe = (rol, label) => {
    const nu = laatste.current;
    if (nu.invullers.length >= MAX_INVULLERS) return;
    const nieuwId = `${rol}-${Date.now().toString(36)}`;
    bewaar({ ...nu, invullers: [...nu.invullers, { id: nieuwId, rol, label: label.trim(), antwoorden: {}, bewijs: {} }] });
    setActief(nieuwId);
  };
  const verwijderInvuller = (invullerId) => {
    const nu = laatste.current;
    bewaar({ ...nu, invullers: nu.invullers.filter((i) => i.id !== invullerId) });
    setActief(ADVISEUR);
  };

  const profiel = useMemo(() => (huidig ? berekenProfiel(huidig) : null), [huidig]);
  const effectief = useMemo(() => (huidig ? effectieveAntwoorden(huidig) : null), [huidig]);

  const waarde = {
    id,
    huidig,
    effectief,
    profiel,
    metingen,
    setMetingen,
    status,
    setStatus,
    spoelLeeg,
    actief,
    setActief,
    zetAntwoord,
    zetBewijs,
    zetBewijsGezien,
    zetDoel,
    zetScope,
    voegInvullerToe,
    verwijderInvuller,
    gevraagdeAs,
    setGevraagdeAs,
  };
  return <MaturiteitContext.Provider value={waarde}>{children}</MaturiteitContext.Provider>;
}

// ---- Kleine onderdelen ----------------------------------------------------------------------

function OpslagStatus({ status }) {
  return (
    <span className="text-xs text-slate-400" aria-live="polite">
      {status === "opslaan" ? "Opslaan…" : status === "opgeslagen" ? "Opgeslagen" : status === "fout" ? "Opslaan mislukt" : ""}
    </span>
  );
}

// Groen vinkje: dit onderdeel is helemaal ingevuld.
function Vinkje({ label }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold leading-none text-white"
    >
      ✓
    </span>
  );
}

function Laden({ status, huidig }) {
  if (status === "laden") return <p className="py-8 text-center text-sm text-slate-400">Laden…</p>;
  if (!huidig) return <p className="py-8 text-center text-sm text-red-600">De meting kon niet worden geladen.</p>;
  return null;
}

function Voetnoot() {
  return (
    <p className="mb-8 text-[11px] leading-relaxed text-slate-400">
      {RAAMWERK.naam}, versie {RAAMWERK.versie}. Een zelfbeoordeling: de uitkomst is zo stevig als het bewijs eronder. Er is geen vergelijking
      met andere organisaties en geen totaalscore.
    </p>
  );
}

function ProfielRegel({ a, onOpen }) {
  const gemeten = a.gemeten;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-[minmax(0,13rem)_1fr_auto] items-center gap-3 rounded-md py-1.5 text-left hover:bg-slate-50"
    >
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-700">{a.naam}</p>
        <p className="text-[10px] text-slate-400">
          {a.beantwoord}/{a.totaal} beantwoord
        </p>
      </div>
      <div className="relative h-3 rounded-full bg-slate-100" role="img" aria-label={`${a.naam}: niveau ${a.niveau ?? "niet gemeten"} van 5, doel ${a.doel}`}>
        {gemeten && <div className={`h-3 rounded-full ${NIVEAU_KLEUR[a.niveau]}`} style={{ width: `${Math.max(a.niveau, 0.15) * 20}%` }} />}
        <div className="absolute -top-1 h-5 w-0.5 bg-slate-800/70" style={{ left: `calc(${a.doel * 20}% - 1px)` }} title={`Doelniveau ${a.doel}`} />
      </div>
      <div className="w-56 text-right text-xs">
        {gemeten ? (
          <>
            <span className="font-semibold text-slate-800">
              {a.niveau} · {a.niveauNaam}
            </span>
            {a.niveau > 0 && !a.onderbouwd && <span className="ml-1.5 text-[10px] text-amber-600">indicatief</span>}
            {a.onvolledig && <span className="ml-1.5 text-[10px] text-amber-600">onvolledig</span>}
          </>
        ) : (
          <span className="text-slate-400">niet gemeten</span>
        )}
      </div>
    </button>
  );
}

// ---- Tabblad "AI-volwassenheid": de vragenlijst ----------------------------------------------

function InvullerKeuze() {
  const { huidig, actief, setActief, voegInvullerToe, verwijderInvuller } = useMaturiteit();
  const [nieuw, setNieuw] = useState(false);
  const [rol, setRol] = useState("directie");
  const [label, setLabel] = useState("");
  const [verwijder, setVerwijder] = useState(false);

  const knop = (actiefNu) =>
    `rounded-full border px-3 py-1 text-xs transition-colors ${
      actiefNu ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
    }`;

  return (
    <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2.5">
      <p className="mb-1.5 text-xs font-medium text-slate-700">Wie vult in?</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Wie vult in">
        <button type="button" role="radio" aria-checked={actief === ADVISEUR} onClick={() => setActief(ADVISEUR)} className={knop(actief === ADVISEUR)}>
          Adviseur: geldende antwoorden
        </button>
        {huidig.invullers.map((i) => (
          <button key={i.id} type="button" role="radio" aria-checked={actief === i.id} onClick={() => setActief(i.id)} className={knop(actief === i.id)}>
            {rolNaam(i.rol)}
            {i.label ? ` · ${i.label}` : ""}
          </button>
        ))}
        {huidig.invullers.length < MAX_INVULLERS && (
          <button type="button" onClick={() => setNieuw((n) => !n)} className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-600">
            + Invuller toevoegen
          </button>
        )}
      </div>

      {nieuw && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-slate-500">
            Rol
            <select value={rol} onChange={(e) => setRol(e.target.value)} className="mt-0.5 block rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
              {ROLLEN.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.naam}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-slate-500">
            Omschrijving (geen naam), bijvoorbeeld &quot;teamleider klantenservice&quot;
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={60}
              className="mt-0.5 block w-64 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              voegInvullerToe(rol, label);
              setNieuw(false);
              setLabel("");
            }}
            className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
          >
            Toevoegen
          </button>
        </div>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        {actief === ADVISEUR
          ? "Je legt hier het geldende oordeel vast: dat telt in alle analyses. Zolang je bij een stelling niets invult, geldt het strengste antwoord van de invullers."
          : "Je vult in als deze invuller. Zolang de adviseur bij een stelling niets heeft vastgelegd, geldt het strengste antwoord van de invullers. Antwoorden worden per rol getoond, nooit per persoon."}
      </p>

      {actief !== ADVISEUR && (
        <div className="mt-1.5">
          {verwijder ? (
            <span className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-600">Deze invuller en alle antwoorden verwijderen?</span>
              <button
                type="button"
                onClick={() => {
                  verwijderInvuller(actief);
                  setVerwijder(false);
                }}
                className="rounded bg-red-600 px-2 py-0.5 text-white hover:bg-red-500"
              >
                Zeker weten
              </button>
              <button type="button" onClick={() => setVerwijder(false)} className="text-slate-500 hover:underline">
                Annuleren
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setVerwijder(true)} className="text-[11px] text-slate-400 hover:text-red-600 hover:underline">
              Deze invuller verwijderen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StellingRij({ stelling }) {
  const { huidig, effectief, actief, zetAntwoord, zetBewijs, zetBewijsGezien } = useMaturiteit();
  const adviseur = actief === ADVISEUR;
  const bron = adviseur ? huidig.geldend : huidig.invullers.find((i) => i.id === actief);
  const antwoord = bron?.antwoorden?.[stelling.id] ?? null;
  const bewijs = bron?.bewijs?.[stelling.id] ?? "";
  const anderen = adviseur
    ? huidig.invullers.filter((i) => i.antwoorden?.[stelling.id]).map((i) => ({ rol: i.rol, antwoord: i.antwoorden[stelling.id] }))
    : [];
  const geldendEffectief = effectief[stelling.id];

  return (
    <li className="border-t border-slate-100 py-3 first:border-t-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-sm text-slate-700">
            <span className="mr-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">Niveau {stelling.niveau}</span>
            <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{stelling.kant}</span>
            {stelling.tekst}
          </p>
          <p className="mt-1 text-[11px] italic text-slate-500">
            {stelling.bewijsvraag} <span className="not-italic text-slate-400">Bijvoorbeeld: {stelling.bewijsvoorbeelden.join("; ")}.</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={stelling.tekst}>
          {ANTWOORDEN.map((a) => (
            <button
              key={a.waarde}
              type="button"
              role="radio"
              aria-checked={antwoord === a.waarde}
              onClick={() => zetAntwoord(stelling.id, antwoord === a.waarde ? null : a.waarde)}
              className={`rounded border px-2 py-0.5 text-[11px] transition-colors ${
                antwoord === a.waarde
                  ? a.waarde === "ja"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : a.waarde === "nee"
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
      </div>

      {adviseur && (anderen.length > 0 || (antwoord === null && geldendEffectief)) && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          {anderen.length > 0 && (
            <>
              Invullers:{" "}
              {anderen.map((x, n) => (
                <span key={n}>
                  <span className="mr-2">
                    {rolNaam(x.rol)} <span className="font-medium text-slate-700">{ANTWOORD_LABEL[x.antwoord]}</span>
                  </span>{" "}
                </span>
              ))}
            </>
          )}
          {antwoord === null && geldendEffectief && <span className="text-amber-700">Geldt nu (strengste antwoord): {ANTWOORD_LABEL[geldendEffectief]}</span>}
        </p>
      )}

      <div className="mt-1.5 flex flex-col gap-1.5 sm:flex-row sm:items-center">
        <input
          type="text"
          value={bewijs}
          onChange={(e) => zetBewijs(stelling.id, e.target.value)}
          maxLength={500}
          placeholder={adviseur ? "Bewijs: wat heb je gezien of gehoord?" : "Waaruit blijkt dit?"}
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {adviseur && (
          <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={huidig.geldend.bewijsGezien?.[stelling.id] === true}
              onChange={(e) => zetBewijsGezien(stelling.id, e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
            />
            Bewijs gezien
          </label>
        )}
      </div>
    </li>
  );
}

function ThemaPaneel({ thema, bron }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">{thema.naam}</p>
          <p className="truncate text-xs text-slate-500">{thema.beschrijving}</p>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-[11px] text-slate-400">
          {thema.beantwoord}/{thema.totaal}
          {thema.ingevuld && <Vinkje label={`${thema.naam} is helemaal ingevuld`} />}
        </span>
      </summary>
      <ul className="border-t border-slate-100 px-4 py-1">
        {bron.stellingen.map((s) => (
          <StellingRij key={s.id} stelling={s} />
        ))}
      </ul>
    </details>
  );
}

export function MaturiteitVragen({ onNaarResultaten }) {
  const { huidig, profiel, status, zetScope, zetDoel, gevraagdeAs, setGevraagdeAs } = useMaturiteit();
  // Een klik op een as in de resultaten opent hier die as. De wens wordt bij het openen van dit
  // tabblad gelezen en bij het verlaten weer gewist.
  const [geopend, setGeopend] = useState(gevraagdeAs);
  const startAs = useRef(gevraagdeAs);
  const asRefs = useRef({});

  useEffect(() => {
    const asId = startAs.current;
    if (!asId || !huidig) return;
    startAs.current = null;
    requestAnimationFrame(() => asRefs.current[asId]?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [huidig]);

  useEffect(() => () => setGevraagdeAs(null), [setGevraagdeAs]);

  const wachten = Laden({ status, huidig });
  if (wachten) return wachten;

  const { telling } = profiel;
  return (
    <div>
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-base">🧭</span>
            AI-volwassenheid — vragenlijst
          </h2>
          <OpslagStatus status={status} />
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Acht assen, twintig thema&apos;s, honderd stellingen. Per thema een ladder van vijf niveaus: een niveau geldt pas als de stelling van dat niveau
          én van alle lagere niveaus voldaan is. De uitkomst staat bij <span className="font-medium">Resultaten → AI-volwassenheid</span>.
        </p>
        <label className="mb-4 block text-xs text-slate-500">
          Scope van de beoordeling (organisatieonderdeel)
          <input
            type="text"
            value={huidig.scope ?? ""}
            onChange={(e) => zetScope(e.target.value)}
            maxLength={200}
            placeholder="Bijvoorbeeld: hele organisatie, of business unit Klantenservice"
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>

        <InvullerKeuze />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            <span className="font-semibold text-slate-800">
              {telling.beantwoord} van {telling.totaal}
            </span>{" "}
            stellingen beantwoord (geldende antwoorden)
          </p>
          <button type="button" onClick={onNaarResultaten} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
            Bekijk resultaten →
          </button>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100" aria-hidden="true">
          <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${(telling.beantwoord / telling.totaal) * 100}%` }} />
        </div>
      </div>

      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800">Vragenlijst</h2>
        <p className="text-xs text-slate-500">Klik op een as om de thema&apos;s en stellingen te openen.</p>
      </div>
      <div className="mb-5 space-y-3">
        {profiel.assen.map((a, i) => (
          <details
            key={a.id}
            ref={(el) => (asRefs.current[a.id] = el)}
            open={geopend === a.id}
            onToggle={(e) => e.currentTarget.open && setGeopend(a.id)}
            className="group rounded-xl border border-slate-200 bg-slate-50/60"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {a.naam}
                  <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-normal text-slate-500">{a.kant}kant</span>
                </p>
                <p className="text-xs text-slate-500">{a.beschrijving}</p>
              </div>
              <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                {a.beantwoord}/{a.totaal} beantwoord
                {a.ingevuld && <Vinkje label={`${a.naam} is helemaal ingevuld`} />}
                <span aria-hidden="true" className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
              </span>
            </summary>
            <div className="space-y-2 px-4 pb-4">
              <label className="flex items-center gap-2 text-xs text-slate-500">
                Doelniveau voor deze as
                <select value={a.doel} onChange={(e) => zetDoel(a.id, Number(e.target.value))} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                  {NIVEAUS.map((n) => (
                    <option key={n.niveau} value={n.niveau}>
                      {n.niveau} · {n.naam}
                      {n.niveau === STANDAARD_DOEL ? " (standaard)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {a.themas.map((t, k) => (
                <ThemaPaneel key={t.id} thema={t} bron={ASSEN[i].themas[k]} />
              ))}
            </div>
          </details>
        ))}
      </div>

      <Voetnoot />
    </div>
  );
}

// ---- Tabblad "Resultaten" → AI-volwassenheid ---------------------------------------------------

function Kaart({ titel, uitleg, children }) {
  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-800">{titel}</h2>
      {uitleg && <p className="mb-3 text-xs text-slate-500">{uitleg}</p>}
      {children}
    </div>
  );
}

function Waarschuwing({ children }) {
  return <p className="mt-2 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-800">{children}</p>;
}

function ZwaksteSchakel({ profiel }) {
  const rijen = profiel.assen.filter((a) => a.gemeten);
  if (rijen.length === 0) return null;
  return (
    <Kaart
      titel="Zwakste schakel per as"
      uitleg="Het niveau van een as wordt bepaald door het thema dat het laagst scoort; er is geen gemiddelde. De volgende stap is de eerste stelling die nog niet voldaan is."
    >
      <div className="space-y-2.5">
        {rijen.map((a) => (
          <div key={a.id}>
            <p className="text-xs font-semibold text-slate-700">
              {a.naam} <span className="font-normal text-slate-500">niveau {a.niveau}</span>
            </p>
            {a.zwakksteThemas.map((t) => (
              <p key={t.id} className="text-xs text-slate-600">
                <span className="font-medium">{t.naam}</span>
                {t.volgendeStap ? `: volgende stap (niveau ${t.volgendeStap.niveau}): ${t.volgendeStap.tekst}` : ": alle niveaus voldaan"}
              </p>
            ))}
          </div>
        ))}
      </div>
    </Kaart>
  );
}

function Volgorde({ volgorde }) {
  if (volgorde.length === 0) return null;
  return (
    <Kaart titel="Volgorde van aanpak" uitleg="Grootste kloof eerst, met afhankelijkheden: wat op orde moet zijn voordat iets anders zin heeft, komt vooraan.">
      <ol className="space-y-3">
        {volgorde.map((i) => (
          <li key={i.thema} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-600">{i.volgorde}</span>
            <div className="min-w-0">
              <p className="text-sm text-slate-800">
                <span className="font-medium">{i.naam}</span>
                <span className="ml-2 text-xs text-slate-500">
                  niveau {i.niveau} → {i.doel} ({i.kloof} te gaan)
                </span>
              </p>
              {i.redenen
                .filter((r) => r.soort === "afhankelijkheid")
                .map((r, n) => (
                  <p key={n} className="text-xs text-amber-800">
                    Eerst nodig voor {r.voorNaam}: {r.reden}
                  </p>
                ))}
            </div>
          </li>
        ))}
      </ol>
    </Kaart>
  );
}

function VaardigheidBorging({ rijen }) {
  if (rijen.length === 0) return null;
  const met = rijen.filter((r) => r.signaal);
  return (
    <Kaart
      titel="Vaardigheid versus borging"
      uitleg="Per thema: wat de organisatie kan, tegenover wat geborgd is (eigenaar, afspraken, middelen, herhaalbaar). Een verschil betekent dat het werkt maar kwetsbaar is."
    >
      {met.length === 0 ? (
        <p className="text-xs text-emerald-700">Geen thema waar de vaardigheid verder is dan de borging.</p>
      ) : (
        <ul className="space-y-1.5">
          {met.map((r) => (
            <li key={r.thema} className="text-xs text-slate-700">
              <span className="font-medium">{r.naam}</span>: kan het op niveau {r.kanHet}, geborgd op niveau {r.geborgd} —{" "}
              <span className={r.verschil >= 2 ? "font-medium text-red-600" : "text-amber-700"}>{r.signaal}</span>
            </li>
          ))}
        </ul>
      )}
    </Kaart>
  );
}

function Signalen({ signalen }) {
  if (signalen.length === 0) return null;
  return (
    <Kaart titel="Signalen om te bespreken" uitleg="Combinaties die zelden kloppen. Bedoeld voor het gesprek, geen oordeel.">
      <ul className="space-y-2">
        {signalen.map((s, n) => (
          <li key={n} className="text-xs text-slate-700">
            <span className="mr-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{s.id}</span>
            <span className="font-medium">{s.plek}.</span> {s.uitleg}
          </li>
        ))}
      </ul>
    </Kaart>
  );
}

function Verschillen({ verschillen }) {
  if (!verschillen) return null;
  return (
    <Kaart
      titel="Verschil tussen invullers"
      uitleg={`Per rol: ${verschillen.rollen.map(rolNaam).join(", ")}. Een verschil van twee niveaus of meer is een signaal; antwoorden worden nooit per persoon getoond.`}
    >
      {verschillen.signalen.length === 0 ? (
        <p className="text-xs text-emerald-700">De rollen zijn het in alle thema&apos;s ongeveer eens.</p>
      ) : (
        <ul className="space-y-3">
          {verschillen.signalen.map((t) => (
            <li key={t.thema}>
              <p className="text-xs font-semibold text-slate-700">
                {t.naam}: {Object.entries(t.niveausPerRol).map(([r, n]) => `${rolNaam(r)} niveau ${n}`).join(" · ")}
              </p>
              {t.tegenspraken.slice(0, 3).map((x) => (
                <p key={x.stellingId} className="text-[11px] text-slate-600">
                  Niveau {x.niveau}: {x.rollenJa.map(rolNaam).join(", ")} zegt ja, {x.rollenNee.map(rolNaam).join(", ")} zegt nee — {x.tekst}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Kaart>
  );
}

function Onderbouwing({ profiel }) {
  const rijen = profiel.assen.filter((a) => a.gemeten && a.onderbouwing.voldaan > 0);
  if (rijen.length === 0) return null;
  return (
    <Kaart titel="Onderbouwing" uitleg="Hoeveel van de voldane stellingen heeft de adviseur met bewijs gezien. Een niveau zonder bewijs heet indicatief.">
      <div className="space-y-1.5">
        {rijen.map((a) => (
          <div key={a.id} className="grid grid-cols-[minmax(0,13rem)_1fr_auto] items-center gap-3 text-xs">
            <span className="truncate text-slate-700">{a.naam}</span>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(a.onderbouwing.aandeel ?? 0) * 100}%` }} />
            </div>
            <span className="w-40 text-right text-slate-500">
              {a.onderbouwing.gezien} van {a.onderbouwing.voldaan} gezien
            </span>
          </div>
        ))}
      </div>
    </Kaart>
  );
}

const fte = (n) => (typeof n === "number" ? n.toFixed(1).replace(".", ",") : "");

function Realisatie({ realisatie, heeftAnalyse }) {
  if (!heeftAnalyse) {
    return (
      <Kaart titel="Koppeling met de analyse van functies">
        <p className="text-xs text-slate-400">
          Beschikbaar zodra de analyse van functies is uitgevoerd: dan wordt getoond wat nodig is om de vrijgekomen capaciteit te realiseren.
        </p>
      </Kaart>
    );
  }
  if (!realisatie) return null;
  const scenario = (sleutel, titel, telling) => {
    const l = realisatie.voorwaarden.filter((v) => v.scenario === sleutel);
    if (l.length === 0) return null;
    return (
      <div key={sleutel} className="mb-3">
        <p className="mb-1 text-xs font-semibold text-slate-700">
          {titel}
          {telling ? `: ${telling.voldaan} van ${telling.totaal} voorwaarden voldaan` : ""}
        </p>
        <ul className="space-y-1">
          {l.map((v, n) => (
            <li key={n} className="text-xs text-slate-700">
              <span
                className={`mr-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  v.status === "voldaan" ? "bg-emerald-50 text-emerald-700" : v.status === "niet voldaan" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {v.status}
              </span>
              <span className="font-medium">{v.naam}</span> (nodig: niveau {v.vereist}
              {v.huidig !== null ? `, nu ${v.huidig}` : ""}) — {v.reden}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  return (
    <Kaart
      titel="Koppeling met de analyse van functies"
      uitleg="Of de organisatie de vrijgekomen capaciteit ook kan realiseren. Voorwaarden, geen gecorrigeerd FTE-getal: de uitgangspunten komen uit adviespraktijk en moeten met ervaring worden bijgesteld."
    >
      <p className="mb-3 text-sm text-slate-800">
        Vrijkomende capaciteit in de analyse: <span className="font-semibold">{fte(realisatie.fteRealistisch)} FTE</span> realistisch
        {realisatie.fteAgressief != null && <>, {fte(realisatie.fteAgressief)} FTE ambitieus</>}.
      </p>
      {scenario("realistisch", "Realistisch scenario", realisatie.realistisch)}
      {scenario("agressief", "Ambitieus scenario", realisatie.agressief)}
      {scenario("kwaliteitsverbetering", "Rollen met bestemming kwaliteitsverbetering", null)}
      {realisatie.knelpuntVaardigheden && (
        <Waarschuwing>
          De ontwikkelagenda uit de analyse van functies telt {realisatie.agendaLengte} competenties, terwijl het niveau van Mensen en cultuur: vaardigheden laag
          is. Dat is een concreet knelpunt voor de realisatie.
        </Waarschuwing>
      )}
    </Kaart>
  );
}

export function MaturiteitResultaten({ results, onNaarVragen }) {
  const { id, huidig, profiel, metingen, setMetingen, status, setStatus, spoelLeeg, setGevraagdeAs } = useMaturiteit();
  const [vastleggen, setVastleggen] = useState(false);
  const [melding, setMelding] = useState(null);
  const [verwijderOp, setVerwijderOp] = useState(null);

  const volledig = useMemo(() => (huidig ? analyseer(huidig, { results }) : null), [huidig, results]);
  const vergelijking = useMemo(() => {
    if (!profiel || metingen.length === 0) return null;
    return vergelijkMetingen(berekenProfiel(metingen[0]), profiel);
  }, [profiel, metingen]);

  const wachten = Laden({ status, huidig });
  if (wachten) return wachten;

  async function leggVast() {
    setVastleggen(true);
    setMelding(null);
    try {
      await spoelLeeg();
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

  async function verwijderMeting(op) {
    setMelding(null);
    try {
      const res = await fetch(`/api/clients/${id}/maturiteit`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Verwijderen mislukt");
      setMetingen(body.metingen);
      setMelding({ soort: "ok", tekst: "Meting verwijderd." });
    } catch (err) {
      setMelding({ soort: "fout", tekst: err.message });
    } finally {
      setVerwijderOp(null);
    }
  }

  function naarAs(asId) {
    setGevraagdeAs(asId);
    onNaarVragen();
  }

  const onvolledig = profiel.gemeten > 0 && profiel.telling.beantwoord < profiel.telling.totaal;
  const heeftAnalyse = Boolean(results?.rollen?.length);

  return (
    <div>
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-base">🧭</span>
            AI-volwassenheid — profiel
          </h2>
          <div className="flex items-center gap-3">
            <OpslagStatus status={status} />
            <button type="button" onClick={onNaarVragen} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              ← Naar de vragenlijst
            </button>
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Een niveau per as op een schaal van 0 tot 5; de streep is het doelniveau. Er is geen totaalscore: een gemiddelde zou verbergen wat een directie moet
          weten.
          {huidig.scope ? ` Scope: ${huidig.scope}.` : ""}
        </p>

        {profiel.gemeten === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
            Nog niets beantwoord.{" "}
            <button type="button" onClick={onNaarVragen} className="text-indigo-600 underline">
              Naar de vragenlijst
            </button>
          </p>
        ) : (
          <>
            {["organisatie", "systeem"].map((kant) => (
              <div key={kant} className="mb-2">
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-indigo-500">{kant}kant</p>
                {profiel.assen
                  .filter((a) => a.kant === kant)
                  .map((a) => (
                    <ProfielRegel key={a.id} a={a} onOpen={() => naarAs(a.id)} />
                  ))}
              </div>
            ))}
            <p className="mt-1 text-[11px] text-slate-400">Klik op een as om de bijbehorende vragen te openen.</p>
          </>
        )}

        {onvolledig && (
          <Waarschuwing>
            {profiel.telling.beantwoord} van {profiel.telling.totaal} stellingen beantwoord. Wat niet is beantwoord telt als niet voldaan: het profiel is een
            ondergrens.
          </Waarschuwing>
        )}
        {profiel.gemeten > 0 && profiel.assen.some((a) => a.gemeten && a.niveau > 0 && !a.onderbouwd) && (
          <Waarschuwing>
            Dit is een zelfbeoordeling. Een as is pas onderbouwd als de adviseur het bewijs achter elke voldane stelling heeft gezien; de overige assen zijn
            indicatief.
          </Waarschuwing>
        )}
      </div>

      {profiel.gemeten > 0 && (
        <>
          <ZwaksteSchakel profiel={profiel} />
          <Volgorde volgorde={volledig.volgorde} />
          <VaardigheidBorging rijen={volledig.vaardigheidVersusBorging} />
          <Signalen signalen={volledig.tegenstrijdigheden} />
          <Verschillen verschillen={volledig.verschillen} />
          <Onderbouwing profiel={profiel} />
          <Realisatie realisatie={volledig.realisatie} heeftAnalyse={heeftAnalyse} />
        </>
      )}

      <Kaart
        titel="Metingen in de tijd"
        uitleg="Leg een meting vast om later opnieuw te meten en te zien wat er is verbeterd. Het profiel hierboven is het werkdocument; een vastgelegde meting verandert niet meer."
      >
        <div className="mb-3 flex items-center justify-end">
          <button
            onClick={leggVast}
            disabled={vastleggen || profiel.gemeten === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40"
          >
            {vastleggen && <span aria-hidden="true" className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            {vastleggen ? "Vastleggen…" : "Meting vastleggen"}
          </button>
        </div>
        {melding && <p className={`mb-2 text-xs ${melding.soort === "ok" ? "text-emerald-700" : "text-red-600"}`}>{melding.tekst}</p>}
        {vergelijking?.onvergelijkbaar && (
          <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">Niet te vergelijken met de laatste meting: {vergelijking.onvergelijkbaar}.</p>
        )}
        {vergelijking?.perAs && (
          <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Sinds de laatste meting ({datum(metingen[0].op)}): <span className="font-medium text-emerald-700">{vergelijking.gestegen} gestegen</span>,{" "}
            <span className="font-medium text-slate-700">{vergelijking.gelijk} gelijk</span>, <span className="font-medium text-red-600">{vergelijking.gedaald} gedaald</span>.
            {vergelijking.perAs
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
                  <span className="flex items-center gap-3 text-slate-500">
                    <span>
                      {p.gemeten} van 8 assen · niveaus {p.assen.map((a) => (a.niveau === null ? "–" : a.niveau)).join(" ")}
                    </span>
                    {verwijderOp === m.op ? (
                      <span className="flex items-center gap-1.5">
                        <button onClick={() => verwijderMeting(m.op)} className="rounded bg-red-600 px-2 py-0.5 text-[11px] text-white hover:bg-red-500">
                          Zeker weten
                        </button>
                        <button onClick={() => setVerwijderOp(null)} className="text-[11px] text-slate-500 hover:underline">
                          Annuleren
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => setVerwijderOp(m.op)} className="text-[11px] text-slate-400 hover:text-red-600 hover:underline">
                        Verwijderen
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Kaart>

      <Voetnoot />
    </div>
  );
}

// ---- Voortgang voor de rest van de pagina -----------------------------------------------------
// Geeft aan of de vragenlijst helemaal is ingevuld, voor het vinkje bij het tabblad en bij de
// voortgangschips bovenaan. `children` krijgt true of false.
export function MaturiteitIngevuld({ children }) {
  const { profiel } = useMaturiteit();
  return children(profiel ? profiel.ingevuld : false);
}
