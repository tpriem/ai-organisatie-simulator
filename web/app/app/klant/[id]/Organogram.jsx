"use client";

import { useMemo, useState } from "react";
import { buildOrgChartData, balkSegmenten, aansturingRegels, organogramTeksten, BESTEMMING_VOLGORDE } from "@/lib/orgChartData";
import { getWaardetype } from "../../../../../src/config.js";
import { nl } from "../../../../../src/formatNl.js";
import { BESTEMMING_STIJL } from "./bestemmingStijl";

// Het organogram laat per rol of afdeling zien hoeveel capaciteit vrijkomt en waar die heen kan.
// Het gekleurde deel van elke balk is wat vrijkomt, het grijze deel blijft. Er staat bewust niet
// hoeveel mensen overblijven: de tool toont capaciteit, geen formatie.

const pct = (deel, geheel) => (geheel > 0 ? Math.round((deel / geheel) * 100) : 0);

// Boom met verbindingslijnen. Puur CSS, zodat de boxen vanzelf netjes onder elkaar uitlijnen.
const BOOM_CSS = `
.og-boom ul { display: flex; justify-content: center; position: relative; margin: 0; padding: 18px 0 0; list-style: none; }
.og-boom li { position: relative; display: flex; flex-direction: column; align-items: center; padding: 18px 8px 0; }
.og-boom li::before, .og-boom li::after { content: ""; position: absolute; top: 0; right: 50%; width: 50%; height: 18px; border-top: 1px solid #cbd5e1; }
.og-boom li::after { right: auto; left: 50%; border-left: 1px solid #cbd5e1; }
.og-boom li:only-child { padding-top: 0; }
.og-boom li:only-child::before, .og-boom li:only-child::after { display: none; }
.og-boom li:first-child::before, .og-boom li:last-child::after { border: 0 none; }
.og-boom li:last-child::before { border-right: 1px solid #cbd5e1; border-radius: 0 6px 0 0; }
.og-boom li:first-child::after { border-radius: 6px 0 0 0; }
.og-boom ul ul::before { content: ""; position: absolute; top: 0; left: 50%; height: 18px; border-left: 1px solid #cbd5e1; }
.og-boom > ul { padding-top: 0; }
`;

function StapelBalk({ fteHuidig, vrijPerType, dun = false }) {
  const segmenten = balkSegmenten(fteHuidig, vrijPerType);
  const vrij = segmenten.reduce((t, s) => t + s.fte, 0);
  return (
    <div
      className={`flex w-full overflow-hidden rounded-full bg-slate-100 ${dun ? "h-1.5" : "h-2.5"}`}
      role="img"
      aria-label={`${nl(vrij, 1)} van ${nl(fteHuidig, 1)} FTE komt vrij`}
    >
      {segmenten.map((s) => (
        <div key={s.soort} className={(BESTEMMING_STIJL[s.soort] ?? BESTEMMING_STIJL.onbepaald).balk} style={{ width: `${s.aandeel * 100}%` }} />
      ))}
    </div>
  );
}

function Bestemming({ vrijPerType, kort = false }) {
  const typen = BESTEMMING_VOLGORDE.filter((t) => (vrijPerType?.[t] ?? 0) > 0);
  if (typen.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-x-2">
      {typen.map((t) => {
        const w = getWaardetype(t);
        const stijl = BESTEMMING_STIJL[t];
        return (
          <span key={t} className={`whitespace-nowrap ${stijl.tekst}`}>
            {w ? `${w.icon} ${kort ? w.label.split(" ")[0] : w.label}` : "nog niet bepaald"}
          </span>
        );
      })}
    </span>
  );
}

function Legenda() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-5 rounded-full bg-slate-100 ring-1 ring-slate-200" /> blijft
      </span>
      <span className="text-slate-400">komt vrij en kan naar:</span>
      {["kostenreductie", "capaciteitsgroei", "kwaliteitsverbetering"].map((t) => {
        const w = getWaardetype(t);
        return (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-5 rounded-full ${BESTEMMING_STIJL[t].balk}`} /> {w.label.toLowerCase()}
          </span>
        );
      })}
    </div>
  );
}

function RolBox({ knoop, aantalVerborgen, openKlap, onKlap }) {
  const heeftKinderen = knoop.kinderen.length > 0;
  return (
    <div className="w-[208px] rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-sm">
      <p className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800" title={knoop.rolnaam}>
        {knoop.rolnaam}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">{nl(knoop.fteHuidig, 1)} FTE</p>
      <div className="mt-1.5">
        <StapelBalk fteHuidig={knoop.fteHuidig} vrijPerType={knoop.vrijPerType} />
      </div>
      <p className="mt-1.5 text-[11px] text-slate-700">
        <span className="font-medium">{nl(knoop.fteVrij, 1)} FTE vrij</span>
        <span className="text-slate-400"> · {pct(knoop.fteVrij, knoop.fteHuidig)}%</span>
      </p>
      <p className="mt-0.5 text-[11px]">
        <Bestemming vrijPerType={knoop.vrijPerType} />
      </p>
      {heeftKinderen && (
        <button
          type="button"
          onClick={onKlap}
          className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
        >
          {openKlap ? "▾" : "▸"} {aantalVerborgen} {aantalVerborgen === 1 ? "rol" : "rollen"} eronder
        </button>
      )}
    </div>
  );
}

function BoomKnoop({ knoop, dichtgeklapt, zetKlap }) {
  const dicht = dichtgeklapt.has(knoop.roleId);
  return (
    <li>
      <RolBox knoop={knoop} aantalVerborgen={knoop.spanAantalRollen} openKlap={!dicht} onKlap={() => zetKlap(knoop.roleId)} />
      {knoop.kinderen.length > 0 && !dicht && (
        <ul>
          {knoop.kinderen.map((k) => (
            <BoomKnoop key={k.roleId} knoop={k} dichtgeklapt={dichtgeklapt} zetKlap={zetKlap} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Bij grote rosters staat een volledige boom niet meer op één scherm: dan beginnen de lagen onder
// de tweede dichtgeklapt, en klap je open waar je wilt kijken.
const MAX_ROLLEN_OPEN = 20;

function standaardDicht(top, totaalRollen) {
  const dicht = new Set();
  if (totaalRollen <= MAX_ROLLEN_OPEN) return dicht;
  const loop = (k) => {
    if (k.diepte >= 1 && k.kinderen.length) dicht.add(k.roleId);
    k.kinderen.forEach(loop);
  };
  top.forEach(loop);
  return dicht;
}

function Boom({ hierarchie, rollen }) {
  const [dichtgeklapt, setDichtgeklapt] = useState(() => standaardDicht(hierarchie.top, rollen));
  const zetKlap = (id) =>
    setDichtgeklapt((huidig) => {
      const nieuw = new Set(huidig);
      if (nieuw.has(id)) nieuw.delete(id);
      else nieuw.add(id);
      return nieuw;
    });

  return (
    <div className="og-boom overflow-x-auto pb-2 text-center">
      <style>{BOOM_CSS}</style>
      <div className="inline-block min-w-full text-center align-top">
        <ul className="inline-flex">
          {hierarchie.top.map((k) => (
            <BoomKnoop key={k.roleId} knoop={k} dichtgeklapt={dichtgeklapt} zetKlap={zetKlap} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function Aansturing({ regels }) {
  if (regels.length === 0) return null;
  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-semibold text-slate-700">Aansturing</p>
      <p className="mb-2 mt-0.5 text-[11px] text-slate-400">Hoeveel werk hangt onder een leidinggevende, en hoeveel daarvan komt vrij.</p>
      <ul className="space-y-2.5">
        {regels.map((r) => (
          <li key={r.roleId}>
            <p className={`text-xs ${r.hoog ? "text-slate-800" : "text-slate-600"}`}>
              {r.hoog && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />}
              {r.tekst}
            </p>
            <div className="mt-1 max-w-sm">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full ${r.hoog ? "bg-amber-500" : "bg-slate-400"}`} style={{ width: `${Math.min(r.aandeelVrij * 100, 100)}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RolRij({ rol }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_120px_150px] items-center gap-3 py-2 sm:grid-cols-[minmax(0,1fr)_160px_170px_minmax(0,1fr)]">
      <p className="truncate text-xs text-slate-700" title={rol.rolnaam}>
        {rol.rolnaam}
      </p>
      <StapelBalk fteHuidig={rol.fteHuidig} vrijPerType={rol.vrijPerType} dun />
      <p className="text-[11px] text-slate-600">
        {nl(rol.fteHuidig, 1)} FTE · <span className="font-medium text-slate-700">{nl(rol.fteVrij, 1)} vrij</span>
      </p>
      <p className="hidden text-[11px] sm:block">
        <Bestemming vrijPerType={rol.vrijPerType} kort />
      </p>
    </div>
  );
}

function AfdelingKaart({ naam, x, rollen }) {
  const teksten = { onderdeel: (v) => `${nl(v.fteHuidig, 1)} FTE · ${nl(v.fteVrij, 1)} FTE vrij (${pct(v.fteVrij, v.fteHuidig)}%)` };
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2.5">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-slate-800">{naam}</p>
          <p className="shrink-0 text-xs text-slate-500">{teksten.onderdeel(x)}</p>
        </div>
        <StapelBalk fteHuidig={x.fteHuidig} vrijPerType={x.vrijPerType} />
      </div>
      {/* Bij één rol zou de rij de afdelingsbalk herhalen; dan volstaat de naam van de rol. */}
      <div className="divide-y divide-slate-50 px-3">
        {rollen.length === 1 ? <p className="py-2 text-xs text-slate-500">{rollen[0].rolnaam}</p> : rollen.map((r) => <RolRij key={r.roleId} rol={r} />)}
      </div>
    </div>
  );
}

export default function Organogram({ rollen }) {
  const chart = useMemo(() => buildOrgChartData(rollen), [rollen]);
  const teksten = useMemo(() => organogramTeksten(chart), [chart]);
  const regels = useMemo(() => aansturingRegels(chart.hierarchie), [chart]);
  const o = chart.organisatie;

  return (
    <>
      <p className="mb-4 text-xs text-slate-400">{teksten.uitleg}</p>

      {/* Rommelige rostergegevens niet stil wegpoetsen: als een rapportagelijn niet klopt,
          hoort de gebruiker dat te zien. */}
      {chart.hierarchie?.problemen?.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
          <p className="text-xs font-semibold text-amber-800">Let op bij de rapportagelijnen in het roster</p>
          <ul className="mt-1 space-y-0.5">
            {chart.hierarchie.problemen.map((p, i) => (
              <li key={i} className="text-[11px] text-amber-700">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-semibold text-slate-800">Hele organisatie</p>
          <p className="text-xs text-slate-500">
            {nl(o.fteHuidig, 1)} FTE · <span className="font-medium text-slate-700">{nl(o.fteVrij, 1)} FTE komt vrij</span> ({pct(o.fteVrij, o.fteHuidig)}%)
            {chart.heeftAfdelingen && ` · ${chart.afdelingen.length} afdelingen, ${chart.rollen.length} rollen`}
          </p>
        </div>
        <StapelBalk fteHuidig={o.fteHuidig} vrijPerType={o.vrijPerType} />
        <p className="mt-1.5 text-[11px]">
          <Bestemming vrijPerType={o.vrijPerType} />
        </p>
      </div>

      <Legenda />

      {chart.hierarchie ? (
        <>
          <Boom hierarchie={chart.hierarchie} rollen={chart.rollen.length} />
          <Aansturing regels={regels} />
        </>
      ) : chart.heeftAfdelingen ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {chart.afdelingen.map((a) => (
            <AfdelingKaart key={a.afdeling} naam={a.afdeling} x={a} rollen={a.rollen} />
          ))}
        </div>
      ) : (
        <AfdelingKaart naam="Rollen" x={{ fteHuidig: o.fteHuidig, fteVrij: o.fteVrij, vrijPerType: o.vrijPerType }} rollen={chart.rollen} />
      )}
    </>
  );
}
