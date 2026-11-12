"use client";

import { useEffect, useState, useCallback, useMemo, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { calculateRole, calculateCapaciteitBestemming, calculateRolBestemming } from "../../../../../src/calculate.js";
import { calculateCompetentieTop5 } from "../../../../../src/competencyTop5.js";
import { calculateCompetentieProfiel, driedeling } from "../../../../../src/competencyProfile.js";
import {
  calculateCompetentieAgenda,
  agendaRijen,
  agendaCellen,
  agendaZin,
  agendaRestZin,
  agendaLaagZin,
  AGENDA_INTRO,
  AGENDA_KOLOMMEN,
} from "../../../../../src/competencyAgenda.js";
import { calculateCapaciteitHerkomst, herkomstRijen, herkomstZin, herkomstCellen, HERKOMST_KOLOMMEN } from "../../../../../src/taakprofiel.js";
import { matchKwaliteit } from "../../../../../src/scanDekking.js";
import {
  isHandmatig,
  waardetypeHerkomst,
  rollenDieBevestigingVragen,
  bevestigtInschatting,
} from "../../../../../src/waardetype.js";
import { WAARDETYPES, getWaardetype } from "../../../../../src/config.js";
import { nl, euroKort, fteBereik, urenRond } from "../../../../../src/formatNl.js";
import { isGoedgekeurd } from "../../../../../src/aanbevelingen.js";
import { kernpunten, kernpuntTekst } from "../../../../../src/samenvatting.js";
import Aanlevering from "./Aanlevering";
import Organogram from "./Organogram";
import { BESTEMMING_STIJL } from "./bestemmingStijl";
import KlantOpzet from "./KlantOpzet";
import { MaturiteitProvider, MaturiteitVragen, MaturiteitResultaten, MaturiteitIngevuld, RealisatieKort } from "./Maturiteit";
import Aanbevelingen from "./Aanbevelingen";
import Logboek from "./Logboek";
import HodLogo from "@/components/HodLogo";
import DownloadKnop from "@/components/DownloadKnop";

/** De kern op één scherm: waar de meeste tijd vrijkomt, en of dat haalbaar is volgens de scan. */
function KernSamenvatting({ results, onOpenScan }) {
  const kern = useMemo(() => kernpunten(results), [results]);
  if (kern.functies.length === 0) return null;
  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">In het kort</p>
      <ul className="space-y-1.5">
        {kern.afdelingen.length > 0 && (
          <li className="text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">Waar de meeste tijd vrijkomt:</span> {kern.afdelingen.map(kernpuntTekst).join(", ")}.
          </li>
        )}
        <li className="text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">Grootste functies:</span> {kern.functies.map(kernpuntTekst).join(", ")}.
        </li>
        <li>
          <RealisatieKort results={results} onOpen={onOpenScan} />
        </li>
      </ul>
    </div>
  );
}

export function CapaciteitBestemming({ results }) {
  const bestemming = useMemo(() => calculateCapaciteitBestemming(results.rollen, "realistisch"), [results.rollen]);
  const herkomst = useMemo(() => waardetypeHerkomst(results.rollen), [results.rollen]);
  const bevestiging = useMemo(() => rollenDieBevestigingVragen(results.rollen), [results.rollen]);
  if (bestemming.length === 0) return null;

  const alleenOnbepaald = bestemming.every((b) => b.waardetype === "onbepaald");
  if (alleenOnbepaald) return null;

  // Alle drie de opties tonen, ook als er geen rol voor is gekozen: het zijn de keuzes van de
  // organisatie, niet alleen wat er nu uit de inschatting komt.
  const perType = new Map(bestemming.map((b) => [b.waardetype, b]));
  const leeg = (w) => ({ waardetype: w, fte: 0, urenPerWeek: 0, rollen: 0, aandeel: 0, waardePerJaar: 0 });
  const rijen = [...WAARDETYPES.map((w) => perType.get(w.id) ?? leeg(w.id)), ...(perType.has("onbepaald") ? [perType.get("onbepaald")] : [])].sort(
    (a, b) => (b.rollen > 0) - (a.rollen > 0) || b.fte - a.fte
  );
  const UITLEG = {
    kostenreductie: "De uren verdwijnen uit de kosten.",
    capaciteitsgroei: "Meer werk met hetzelfde team.",
    kwaliteitsverbetering: "Tijd voor beter werk.",
  };

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">Waar gaat die capaciteit heen?</p>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">
        Drie opties om de vrijgekomen tijd in te zetten. Per functie is ingeschat welke optie het meest voor de hand ligt;
        dat is een vertrekpunt voor het gesprek, geen voorschrift. De keuze is aan de organisatie.
      </p>

      <div className="space-y-3">
        {rijen.map((b) => {
          const type = getWaardetype(b.waardetype);
          const stijl = BESTEMMING_STIJL[b.waardetype] ?? BESTEMMING_STIJL.onbepaald;
          const gebruikt = b.rollen > 0;
          return (
            <div key={b.waardetype} className={gebruikt ? "" : "opacity-60"}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 mb-1">
                <span className={`text-xs font-medium ${stijl.tekst}`}>
                  {type ? `${type.icon} ${type.label}` : "Nog niet bepaald"}
                  {UITLEG[b.waardetype] && <span className="ml-2 font-normal text-slate-400">{UITLEG[b.waardetype]}</span>}
                </span>
                <span className="text-xs text-slate-500 sm:shrink-0">
                  {gebruikt ? (
                    <>
                      {nl(b.fte, 1)} FTE · {Math.round(b.urenPerWeek)} u/week · {b.rollen} {b.rollen === 1 ? "functie" : "functies"} ·{" "}
                      <span className="font-medium text-slate-700">{euroKort(b.waardePerJaar)} per jaar</span>
                    </>
                  ) : (
                    "geen functies"
                  )}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full ${stijl.balk}`} style={{ width: gebruikt ? `${Math.max(b.aandeel * 100, 1.5)}%` : "0%" }} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        De bedragen zijn de waarde van de vrijgekomen uren tegen de kosten per uur. Het is alleen een besparing als die uren daadwerkelijk uit de kosten verdwijnen; bij groei of kwaliteit
        is het extra output of beter werk.
      </p>

      {/* Deze verdeling rust voor een deel op menselijk oordeel zodra een adviseur
          waardetypes heeft bijgestuurd; dat moet de lezer kunnen zien. */}
      {/* Welke rollen nog bevestigd moeten worden: de kleinste groep die samen de helft van
          de capaciteit draagt. Bij die rollen keert één afwijkende inschatting de verdeling om. */}
      {bevestiging.rollen.length > 0 &&
        (bevestiging.alleBevestigd ? (
          <p className="mt-3 text-xs text-emerald-700">
            De {bevestiging.rollen.length === 1 ? "rol die" : `${bevestiging.rollen.length} rollen die`} samen de helft
            van de capaciteit {bevestiging.rollen.length === 1 ? "draagt is" : "dragen zijn"} bevestigd.
          </p>
        ) : (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-2 text-xs text-amber-800">
            <span className="font-semibold">Nog te bevestigen:</span>{" "}
            {bevestiging.rollen
              .filter((r) => !r.bevestigd)
              .map((r) => `${r.roleLabel} (${Math.round(r.aandeel * 100)}%)`)
              .join(", ")}{" "}
            — samen {Math.round(bevestiging.onbevestigdAandeel * 100)}% van de vrijgekomen capaciteit. Eén afwijkende
            inschatting bij zulke rollen verschuift deze verdeling merkbaar. Open de rol en kies Bevestigen of
            Bijsturen.
          </p>
        ))}

      {herkomst.handmatig > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Voor {herkomst.handmatig} van de {herkomst.totaal} {herkomst.totaal === 1 ? "rol" : "rollen"} is de bestemming
          handmatig bepaald
          {herkomst.afwijkend > 0 ? ` — ${herkomst.afwijkend} daarvan wijkt af van de inschatting van Claude` : ""}.
        </p>
      )}
    </div>
  );
}

const MATCH_KLEUR = {
  sterk: { stip: "bg-emerald-500", tekst: "text-emerald-700" },
  matig: { stip: "bg-amber-500", tekst: "text-amber-700" },
  zwak: { stip: "bg-red-500", tekst: "text-red-700" },
};

// Waarop is deze rol gematcht, en hoe zeker. De competentie-analyse kiest uit de pool
// van het gematchte ESCO-beroep; zit die match ernaast, dan klopt de hele analyse van
// die rol niet — zonder foutmelding. Daarom hoort dit zichtbaar te zijn bij de rol zelf.
function BeroepsmatchRegel({ beroepsmatch }) {
  if (!beroepsmatch?.label) return null;
  // Dezelfde indeling als in de rapporten en het dekkingspaneel; één bron voor de drempels.
  const kwaliteit = matchKwaliteit(beroepsmatch.score);
  const stijl = MATCH_KLEUR[kwaliteit] ?? { stip: "bg-slate-300", tekst: "text-slate-400" };

  return (
    <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5 flex-wrap">
      <span>Competenties ontleend aan ESCO-beroep</span>
      <span className="font-medium text-slate-600">{beroepsmatch.label}</span>
      <span className={`inline-flex items-center gap-1 ${stijl.tekst}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${stijl.stip}`} />
        match {nl(beroepsmatch.score, 2)}
      </span>
      {kwaliteit !== "sterk" && <span className="text-amber-700">— controleer of dit de juiste rol is</span>}
    </p>
  );
}

// Uit welk soort werk de vrijkomende capaciteit komt. Het tegenstuk van "Waar gaat die capaciteit
// heen?": daar de bestemming, hier de herkomst. Een tabel met uren, geen aandelen: een aandeel
// verschuift ook in categorieën die niet krimpen en is moeilijk te lezen.
export function CapaciteitHerkomst({ results }) {
  const herkomst = useMemo(() => calculateCapaciteitHerkomst(results?.rollen ?? [], "realistisch"), [results?.rollen]);
  const [alles, setAlles] = useState(false);
  if (!herkomst.heeftData) return null;

  const aantal = herkomst.categorieen.length;
  // "Alles" toont elke categorie; anders de top en een samenvatting van de rest.
  const rijen = herkomstRijen(herkomst, alles ? aantal : 5);
  const heeftRest = aantal > 6;

  return (
    <Section title="Waar komt de capaciteit vandaan?" icon="🧭">
      <p className="mb-4 text-sm text-slate-700">{herkomstZin(herkomst)}</p>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-400">
              {HERKOMST_KOLOMMEN.map((k, i) => (
                <th key={k} className={`px-3 py-2 font-medium ${i === 0 ? "text-left" : "text-right"}`}>
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rijen.map((rij) => {
              const cellen = herkomstCellen(rij);
              const totaal = rij.soort === "totaal";
              return (
                <tr key={rij.id} className={`border-b border-slate-100 last:border-0 ${totaal ? "bg-slate-50 font-semibold text-slate-800" : "text-slate-700"}`}>
                  {cellen.map((c, i) => (
                    <td key={i} className={`px-3 py-2 ${i === 0 ? "text-left" : "text-right tabular-nums"} ${i === 2 && !totaal ? "font-medium" : ""} ${rij.soort === "overig" && i === 0 ? "text-slate-500" : ""}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {heeftRest && (
        <button type="button" onClick={() => setAlles((a) => !a)} className="mt-3 text-xs text-indigo-400 hover:underline">
          {alles ? "Alleen de grootste vijf tonen" : `Toon alle ${aantal} categorieën`}
        </button>
      )}
    </Section>
  );
}

// De competenties die straks extra nodig zijn, geteld over alle functies. Per functie staat al wat
// die functie nodig heeft; hier zie je welke competenties de hele organisatie raken. Dat is één
// programma, geen reeks ontwikkelgesprekken. Geen kolommen voor FTE of een belangscore: dat leest als
// formatie of als een getal zonder uitleg.
export function CompetentieAgenda({ results }) {
  const agenda = useMemo(() => calculateCompetentieAgenda(results?.rollen ?? [], "realistisch"), [results?.rollen]);
  const [alles, setAlles] = useState(false);
  if (agenda.competenties.length === 0) return null;

  const breed = agenda.competenties.filter((c) => c.aantalRollen > 1);
  const { rijen, rest } = agendaRijen(agenda, alles ? agenda.competenties.length : 5);
  const mogelijkRest = agendaRijen(agenda, 5).rest > 0;
  const laagZin = agendaLaagZin(agenda);

  return (
    <Section title="Welke competenties raken de hele organisatie?" icon="🎓">
      <p className="text-xs text-slate-500 mb-4">{AGENDA_INTRO}</p>

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <StatCard label="Competenties nieuw nodig" value={agenda.competenties.length} sub="over alle functies" />
        <StatCard
          label="Raakt meerdere functies"
          value={breed.length}
          sub={breed.length > 0 ? "kandidaat voor één programma" : "allemaal functiespecifiek"}
        />
        <StatCard
          label="Niet met training op te lossen"
          value={agenda.aandeelNietTrainbaar === null ? "—" : `${Math.round(agenda.aandeelNietTrainbaar * 100)}%`}
          sub={`${agenda.competenties.filter((c) => c.trainbaarheid === "laag").length} van de ${agenda.competenties.length} competenties`}
        />
      </div>

      <div className="rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-400">
              {AGENDA_KOLOMMEN.map((k) => (
                <th key={k} className="px-3 py-2 text-left font-medium">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rijen.map((c) => {
              const stijl = TRAINBAARHEID_KLEUR[c.trainbaarheid] ?? { stip: "bg-slate-300", tekst: "text-slate-400" };
              const [naam, nodigIn, trainbaar] = agendaCellen(c, agenda.aantalRollenTotaal);
              return (
                <tr key={c.naam} className="border-b border-slate-100 last:border-0 text-slate-700">
                  <td className="px-3 py-2 text-slate-800">{naam}</td>
                  {/* Welke functies het precies zijn staat achter de muisaanwijzer. */}
                  <td className="px-3 py-2 cursor-help" title={c.rollen.join("\n")}>
                    {nodigIn}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${stijl.tekst}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${stijl.stip}`} />
                      {trainbaar}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rest > 0 && <p className="mt-2 text-xs text-slate-500">{agendaRestZin(rest)}</p>}
      {mogelijkRest && (
        <button type="button" onClick={() => setAlles((a) => !a)} className="mt-2 text-xs text-indigo-400 hover:underline">
          {alles ? "Alleen de breedste vijf tonen" : `Toon alle ${agenda.competenties.length} competenties`}
        </button>
      )}

      {laagZin && <p className="mt-3 text-xs text-amber-700">{laagZin}</p>}
    </Section>
  );
}

function Section({ title, icon, children, right }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-card shadow-sm p-4 sm:p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-base">
            {icon}
          </span>
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function StepChip({ done, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      <span
        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[11px] ${
          done ? "bg-emerald-500 text-white" : "bg-slate-300 text-white"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      {label}
    </span>
  );
}

function FileDropLabel({ htmlFor, uploading, label, hint }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
        uploading
          ? "border-indigo-300 bg-indigo-50/50"
          : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30"
      }`}
    >
      <span className="text-xl">{uploading ? "⏳" : "📤"}</span>
      <span className="text-sm font-medium text-slate-700">{uploading ? "Uploaden..." : label}</span>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

function StatCard({ label, value, sub, noot }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      {noot && <p className="mt-auto pt-2 text-xs leading-snug text-slate-400">{noot}</p>}
    </div>
  );
}

function TabButton({ active, onClick, icon, label, done }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active ? "border-indigo-600 text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      <span>{icon}</span>
      {label}
      {done && <span className="text-emerald-500 text-xs">✓</span>}
    </button>
  );
}

function getOrigineelTaken(role) {
  if (role.taken) return role.taken;
  // Fallback voor resultaten van vóór dit veld bestond.
  return role.scenarios.realistisch.taken.map((t) => ({
    omschrijving: t.omschrijving,
    categorie: t.categorie,
    categorieLabel: t.categorieLabel,
    aandeel: t.aandeel,
  }));
}

// Het waardetype van een rol bijsturen. Claude leidt het af uit het functieprofiel, maar
// wat een organisatie met de vrijgekomen tijd wil is haar keuze, niet die van een
// taalmodel. Zodra de bestemming het kopgetal van het rapport bepaalt, moet de adviseur
// die kunnen vastleggen.
function WaardetypeBeheer({ id, role, onSaved, bevestiging = null }) {
  const [open, setOpen] = useState(false);
  const [reden, setReden] = useState("");
  // Welke actie loopt er: "bevestigen", "terugzetten" of "opslaan". Opslaan schrijft ook een
  // versie in de historie en kan enkele seconden duren; zonder zichtbare voortgang klikt een
  // adviseur dubbel of denkt dat er niets gebeurt.
  const [bezigMet, setBezigMet] = useState(null);
  const bezig = bezigMet !== null;
  const [fout, setFout] = useState(null);

  const huidig = getWaardetype(role.waardetype);
  const handmatig = isHandmatig(role);
  const ai = getWaardetype(role.waardetypeAI);

  async function kies(waardetype, actie = "opslaan") {
    if (bezig) return;
    setBezigMet(actie);
    setFout(null);
    try {
      const res = await fetch(`/api/clients/${id}/rollen/${encodeURIComponent(role.roleId ?? role.rolnaam)}/waardetype`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waardetype, reden }),
      });
      const body = await res.json();
      if (res.ok) {
        onSaved(body);
        setReden("");
        setOpen(false);
      } else {
        setFout(body.error ?? "Opslaan mislukt");
      }
    } catch (err) {
      setFout(err.message);
    } finally {
      setBezigMet(null);
    }
  }

  return (
    <div className="mb-4 rounded-lg bg-indigo-50/60 px-3 py-2" aria-busy={bezig}>
      <span className="sr-only" role="status" aria-live="polite">
        {bezigMet ? "Bezig met opslaan" : ""}
      </span>
      <div className="flex items-start gap-2">
        <span className="text-base leading-none">{huidig?.icon ?? "❔"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-700">
            {huidig?.label ?? "Waardetype nog niet bepaald"}
            {handmatig && (
              <span className="ml-1.5 rounded bg-card px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
                {bevestigtInschatting(role) ? "bevestigd" : "handmatig bepaald"}
              </span>
            )}
          </p>
          {role.waardetypeToelichting && <p className="text-xs text-slate-500 mt-0.5">{role.waardetypeToelichting}</p>}
          {handmatig && ai && ai.id !== huidig?.id && (
            <p className="text-xs text-slate-400 mt-0.5">
              Inschatting van Claude was: {ai.icon} {ai.label}
            </p>
          )}
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 text-xs text-indigo-400 hover:text-indigo-400 hover:underline"
        >
          {open ? "Sluiten" : "Bijsturen"}
        </button>
      </div>

      {/* Grote rollen vragen om een bevestiging: gemeten dat het waardetype per rol meestal
          stabiel is, maar dat één wissel bij een rol met veel capaciteit het kopgetal
          omkeert. Bevestigen kan in één klik; het is dezelfde actie als bijsturen. */}
      {bevestiging && !bevestiging.bevestigd && huidig && (
        <div className="mt-2 flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-2">
          <p className="text-xs text-amber-800">
            Deze rol draagt <span className="font-semibold">{Math.round(bevestiging.aandeel * 100)}%</span> van de
            vrijgekomen capaciteit. Eén afwijkende inschatting verschuift hier het kopgetal merkbaar — bevestig het
            waardetype of stuur het bij.
          </p>
          <button
            onClick={() => kies(role.waardetype, "bevestigen")}
            disabled={bezig}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-card border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {bezigMet === "bevestigen" && <Spinner />}
            {bezigMet === "bevestigen" ? "Bevestigen…" : "Bevestigen"}
          </button>
        </div>
      )}

      {open && (
        <div className="mt-2 border-t border-indigo-100 pt-2">
          <p className="text-xs text-slate-500 mb-1.5">Waar moet de vrijgekomen tijd van deze rol naartoe?</p>
          <div className="flex flex-wrap gap-1.5">
            {WAARDETYPES.map((w) => (
              <button
                key={w.id}
                onClick={() => kies(w.id)}
                disabled={bezig}
                aria-pressed={role.waardetype === w.id}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
                  role.waardetype === w.id
                    ? "border-indigo-400 bg-card font-medium text-indigo-700"
                    : "border-slate-200 bg-card text-slate-600 hover:border-indigo-300"
                }`}
              >
                {w.icon} {w.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={reden}
            onChange={(e) => setReden(e.target.value)}
            maxLength={300}
            placeholder="Reden (optioneel), bijvoorbeeld: groeiambitie in de regio"
            className="mt-2 w-full rounded-md border border-slate-200 bg-card px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {handmatig && (
            <button
              onClick={() => kies(null, "terugzetten")}
              disabled={bezig}
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 hover:underline disabled:opacity-50"
            >
              {bezigMet === "terugzetten" && <Spinner />}
              {bezigMet === "terugzetten" ? "Terugzetten…" : "Terug naar de inschatting van Claude"}
            </button>
          )}
          {bezigMet === "opslaan" && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Spinner /> Opslaan…
            </p>
          )}
          {fout && <p className="mt-1.5 text-xs text-red-400">{fout}</p>}
        </div>
      )}
    </div>
  );
}

// Na een nieuwe analyse: wat is er met de eerder aangepaste taakverdeling gebeurd?
function TakenOvernameMelding({ role }) {
  if (role.takenAangepastVervallen) {
    return (
      <p className="mb-2 rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-xs text-amber-800">
        Je eerder aangepaste taakverdeling voor deze rol is niet overgenomen: {role.takenAangepastVervallen.reden} De
        eerdere versie staat in de versiehistorie.
      </p>
    );
  }
  if (role.takenAangepastOvername === "categorie") {
    return (
      <p className="mb-2 text-xs text-slate-500">
        Je aangepaste taakverdeling is overgenomen per categorie; de taken zelf zijn bij de nieuwe analyse opnieuw
        geformuleerd. Controleer de aandelen hieronder.
      </p>
    );
  }
  return null;
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

function WaardetypeBadge({ waardetype, toelichting, compact = false, handmatig = false, bevestigen = null }) {
  const w = getWaardetype(waardetype);
  if (!w) return null;
  if (compact) {
    return (
      <span
        title={`${w.label}${handmatig ? " (handmatig bepaald)" : ""}${toelichting ? ` — ${toelichting}` : ""}`}
        className="text-sm"
      >
        {w.icon}
        {handmatig && <span className="text-indigo-400">*</span>}
        {bevestigen && (
          <span
            className="ml-0.5 text-amber-500"
            title={`Bevestig het waardetype: deze rol draagt ${Math.round(bevestigen.aandeel * 100)}% van de vrijgekomen capaciteit`}
          >
            ●
          </span>
        )}
      </span>
    );
  }
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg bg-indigo-50/60 px-3 py-2">
      <span className="text-base leading-none">{w.icon}</span>
      <div>
        <p className="text-xs font-semibold text-slate-700">{w.label}</p>
        {toelichting && <p className="text-xs text-slate-500 mt-0.5">{toelichting}</p>}
      </div>
    </div>
  );
}

function CompetentieTop5Block({ title, subtitle, items }) {
  if (!items?.length) return null;
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      <p className="text-xs text-slate-400 mb-2">{subtitle}</p>
      <div className="space-y-1.5">
        {items.map((c) => (
          <div key={c.naam} className="flex items-center gap-2">
            <span className="w-44 shrink-0 text-xs text-slate-600 truncate" title={c.naam}>
              {c.naam}
            </span>
            <div className="flex-1 h-2.5 rounded bg-slate-200 overflow-hidden">
              <div className="h-full bg-indigo-500" style={{ width: `${c.relatiefPct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TRAINBAARHEID_KLEUR = {
  hoog: { balk: "bg-emerald-500", stip: "bg-emerald-500", tekst: "text-emerald-700" },
  midden: { balk: "bg-blue-500", stip: "bg-blue-500", tekst: "text-blue-300" },
  laag: { balk: "bg-orange-500", stip: "bg-orange-500", tekst: "text-orange-300" },
};
const TRAINBAARHEID_ONBEKEND = { balk: "bg-slate-400", stip: "bg-slate-400", tekst: "text-slate-500" };

function kleurVan(tier) {
  return TRAINBAARHEID_KLEUR[tier] ?? TRAINBAARHEID_ONBEKEND;
}

function OverlapKpis({ profiel }) {
  if (!profiel) return null;
  const eersteToets = profiel.teToetsen?.[0];
  // Werkt ook op analyses van vóór deze driedeling; die missen de velden en krijgen ze
  // afgeleid, zodat een bestaand rapport niet stilzwijgend de helft weglaat.
  const d = driedeling(profiel);
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-lg bg-card p-3">
        <p className="text-xs text-slate-500">Sluit nu al aan</p>
        <p className="text-2xl font-semibold text-slate-800">{profiel.overlapPct}%</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {d
            ? `van de toekomstige behoefte — nog ${d.teOntwikkelenPct}% is te ontwikkelen`
            : "van de toekomstige competentiebehoefte vraagt de rol nu al"}
        </p>
      </div>
      {/* Bewust het níet-trainbare deel als kopgetal. "80% na training" leest als een
          toestand die je bereikt, terwijl het een bovengrens is; wat je niet kunt
          trainen is het getal waar een beslissing aan hangt. */}
      <div className="rounded-lg bg-card p-3">
        <p className="text-xs text-slate-500">Niet met training te overbruggen</p>
        <p className="text-2xl font-semibold text-slate-800">
          {d ? d.nietTrainbaarPct : "—"}
          {d && "%"}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {!d
            ? "→ onbekend zonder ESCO-gegevens"
            : eersteToets
              ? `→ toets bezetting op: ${eersteToets.naam}`
              : "→ het hele verschil is te ontwikkelen"}
        </p>
      </div>
    </div>
  );
}

function TijdsbestedingsBalk({ taken }) {
  if (!taken?.length) return null;
  const totaal = taken.reduce((s, t) => s + t.aandeel, 0);
  if (totaal <= 0) return null;

  const rij = (toonRest) => (
    <div className="flex h-7 w-full overflow-hidden rounded">
      {taken.map((t, i) => {
        const breedte = (t.aandeel / totaal) * 100;
        const blijft = toonRest ? (1 - t.automatiseringspercentage) * 100 : 100;
        return (
          <div
            key={i}
            className="flex border-r border-slate-50 last:border-r-0"
            style={{ width: `${breedte}%` }}
            title={`${t.omschrijving} — ${Math.round(t.aandeel * 100)}% van de rol, ${Math.round(
              t.automatiseringspercentage * 100
            )}% automatiseerbaar`}
          >
            <div className="bg-indigo-500" style={{ width: `${blijft}%` }} />
            <div className="bg-slate-300" style={{ width: `${100 - blijft}%` }} />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-700">Tijdsbesteding — nu versus straks</p>
      <p className="text-xs text-slate-400 mb-2">Beweeg over een blok voor de taaknaam</p>
      <p className="text-[11px] text-slate-400 mb-0.5">Nu</p>
      {rij(false)}
      <p className="text-[11px] text-slate-400 mt-1.5 mb-0.5">Straks</p>
      {rij(true)}
      <div className="mt-1.5 flex gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-indigo-500" /> blijft
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-slate-300" /> geautomatiseerd
        </span>
      </div>
    </div>
  );
}

function ProfielKolom({ titel, items, acties }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-[11px] text-slate-400 mb-2">{titel}</p>
      <div className="space-y-2">
        {items.slice(0, 6).map((c) => {
          const kleur = kleurVan(c.trainbaarheid);
          const actie = acties?.[c.naam];
          return (
            <div key={c.naam}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${kleur.stip}`} />
                <span className="flex-1 truncate text-xs text-slate-700" title={c.naam}>
                  {c.naam}
                </span>
                {actie && <span className={`shrink-0 text-[11px] ${actie.klasse}`}>{actie.label}</span>}
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-slate-200">
                <div className={`h-full ${kleur.balk}`} style={{ width: `${c.relatiefPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompetentieProfielVergelijking({ profiel }) {
  if (!profiel) return null;

  // Acties per competentie: trainbaar tekort = ontwikkelen, niet-trainbaar = toetsen.
  // Bewust geen uitspraak over mensen vervangen — de tool kent het rolprofiel, niet
  // de medewerker; of iemand het al kan, moet de organisatie zelf toetsen.
  const acties = {};
  for (const c of profiel.teOntwikkelen ?? []) {
    acties[c.naam] = { label: "ontwikkelen", klasse: "text-slate-500" };
  }
  for (const c of profiel.teToetsen ?? []) {
    acties[c.naam] = { label: "toetsen bezetting", klasse: "text-orange-300" };
  }

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-700">Competentieprofiel — nu versus straks</p>
      <p className="text-xs text-slate-400 mb-2">
        Competenties uit de ESCO-classificatie (EU); kleur toont hoe goed ze te ontwikkelen zijn
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <ProfielKolom titel="Nu" items={profiel.profielNu} />
        <ProfielKolom titel="Straks" items={profiel.profielStraks} acties={acties} />
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
        {["hoog", "midden", "laag"].map((tier) => (
          <span key={tier} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${kleurVan(tier).stip}`} /> {tier} trainbaar
          </span>
        ))}
      </div>
      {/* Voorwaarde 1 van de ESCO-gebruiksvoorwaarden schrijft de Engelse zin letterlijk
          voor; voorwaarde 2 vraagt eigen bewerkingen als zodanig te markeren — de
          trainbaarheidsweging is onze afleiding, niet die van ESCO. */}
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        This service uses the ESCO classification of the European Commission. De indeling naar trainbaarheid is een
        eigen afleiding op basis van ESCO-metadata en maakt geen deel uit van ESCO zelf.
      </p>
    </div>
  );
}

function VersieHistorie({ id, onHersteld }) {
  const [open, setOpen] = useState(false);
  const [versies, setVersies] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);

  async function openen() {
    if (open) return setOpen(false);
    setOpen(true);
    setFout(null);
    try {
      const res = await fetch(`/api/clients/${id}/versies`);
      const body = await res.json();
      setVersies(res.ok ? body.versies : []);
      if (!res.ok) setFout(body.error);
    } catch (err) {
      setFout(err.message);
      setVersies([]);
    }
  }

  async function herstel(versieId) {
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch(`/api/clients/${id}/versies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versieId }),
      });
      const body = await res.json();
      if (res.ok) {
        onHersteld(body);
        setOpen(false);
      } else {
        setFout(body.error);
      }
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={openen}
        className="text-xs rounded-lg bg-card text-slate-600 border border-slate-200 px-3 py-1.5 shadow-sm hover:bg-slate-50 transition-colors"
        title="Eerdere versies van deze analyse terugzetten"
      >
        ↩ Vorige versies
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-card p-3 shadow-lg">
          <p className="text-xs font-semibold text-slate-700 mb-1">Eerdere versies</p>
          <p className="text-xs text-slate-400 mb-2">
            Elke analyse bewaart de vorige uitkomst. De huidige versie wordt bewaard voordat je terugzet.
          </p>

          {fout && <p className="text-xs text-red-400 mb-2">{fout}</p>}
          {versies === null && <p className="text-xs text-slate-400">Laden…</p>}
          {versies?.length === 0 && !fout && (
            <p className="text-xs text-slate-500">
              Nog geen eerdere versies bewaard. Ze verschijnen zodra een analyse opnieuw gedraaid wordt.
            </p>
          )}

          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {versies?.map((v) => (
              <div key={v.id} className="flex items-center gap-2 rounded border border-slate-100 px-2 py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700">
                    {new Date(v.created_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                  {v.reden && <p className="text-[11px] text-slate-400 truncate">{v.reden}</p>}
                </div>
                <button
                  onClick={() => herstel(v.id)}
                  disabled={bezig}
                  className="shrink-0 text-xs rounded bg-slate-100 px-2 py-1 hover:bg-slate-200 disabled:opacity-50"
                >
                  {bezig ? "…" : "Terugzetten"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// "Waar gaat de capaciteit heen?" voor één functie: wat er vrijkomt, wat dat waard is, en wat elk
// van de drie opties voor deze functie betekent. De bediening (bevestigen of bijsturen) staat eronder.
function RolBestemming({ role, children }) {
  const b = calculateRolBestemming(role);
  const gevolg = (o) => {
    if (o.gevolg.soort === "waardePerJaar") return `Lagere kosten: ${euroKort(o.gevolg.waarde)} per jaar`;
    if (o.gevolg.soort === "outputgroei") {
      return o.gevolg.waarde != null ? `Meer output met hetzelfde team: +${nl(o.gevolg.waarde * 100, 0)}%` : "Meer output met hetzelfde team";
    }
    return `${Math.round(o.gevolg.waarde)} uur per week naar beter werk`;
  };
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-card p-4">
      <p className="text-sm font-semibold text-slate-800">Waar gaat de capaciteit van deze functie heen?</p>
      <p className="mt-0.5 mb-3 text-xs text-slate-500">
        {nl(b.fte, 1)} FTE ({Math.round(b.urenPerWeek)} uur per week) komt vrij, tot {nl(b.fteAgressief, 1)} FTE in het ambitieuze scenario. Dat is{" "}
        {euroKort(b.waardePerJaar)} per jaar waard ({euroKort(b.waardePerJaarAgressief)} ambitieus).
      </p>
      <ul className="space-y-1.5">
        {b.opties.map((o) => (
          <li
            key={o.waardetype}
            className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${
              o.gekozen ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200 text-slate-500"
            }`}
          >
            <span className={`font-medium ${o.gekozen ? "text-indigo-800" : "text-slate-600"}`}>
              {o.icon} {o.label}
              {o.gekozen && <span className="ml-2 rounded bg-card px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">bestemming</span>}
            </span>
            <span className="shrink-0 text-right">{gevolg(o)}</span>
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

function TaakTable({ id, role, onSaved, bevestiging = null }) {
  const identifier = role.roleId ?? role.rolnaam;
  const origineelTaken = useMemo(() => getOrigineelTaken(role), [role]);
  const savedTaken = role.takenAangepast ?? origineelTaken;
  const [liveTaken, setLiveTaken] = useState(savedTaken);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLiveTaken(role.takenAangepast ?? origineelTaken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier, role.takenAangepast]);

  const liveResult = useMemo(
    () =>
      calculateRole({
        rolnaam: role.rolnaam,
        afdeling: role.afdeling,
        fte: role.fte,
        urenPerWeek: role.urenPerWeek,
        kostenPerUur: role.kostenPerUur,
        taken: liveTaken,
      }),
    [liveTaken, role.rolnaam, role.afdeling, role.fte, role.urenPerWeek, role.kostenPerUur]
  );

  const competentieTop5 = useMemo(
    () => calculateCompetentieTop5(liveResult.scenarios.realistisch.taken, role.taakCompetenties),
    [liveResult, role.taakCompetenties]
  );

  // Alleen beschikbaar voor analyses die op de ESCO-koppeling draaien; oudere
  // resultaten vallen terug op de top 5-weergave hieronder.
  const competentieProfiel = useMemo(
    () =>
      role.competentieMeta
        ? calculateCompetentieProfiel(
            liveResult.scenarios.realistisch.taken,
            role.taakCompetenties,
            role.nieuweCompetenties,
            role.competentieMeta
          )
        : null,
    [liveResult, role.taakCompetenties, role.nieuweCompetenties, role.competentieMeta]
  );

  const totaalAandeelPct = Math.round(liveTaken.reduce((s, t) => s + t.aandeel, 0) * 100);
  const isDirtyFromSaved = JSON.stringify(liveTaken) !== JSON.stringify(savedTaken);
  const isAdjustedFromOrigineel = JSON.stringify(liveTaken) !== JSON.stringify(origineelTaken);

  function handleAandeelChange(i, pctValue) {
    const pct = Math.max(0, Math.min(100, Number(pctValue) || 0)) / 100;
    setLiveTaken((prev) => prev.map((t, idx) => (idx === i ? { ...t, aandeel: pct } : t)));
  }

  function handleReset() {
    setLiveTaken(origineelTaken);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${id}/rollen/${encodeURIComponent(identifier)}/taken`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taken: liveTaken }),
      });
      const body = await res.json();
      if (res.ok) onSaved(body);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Opbouw van het rolblok: eerst wat er met het werk gebeurt (tijdbalk en
          taakverdeling), daarna pas wat dat voor competenties betekent. Zo komt de
          onderbouwing vóór de conclusie. */}
      <RolBestemming role={role}>
        <div className="mt-3">
          <WaardetypeBeheer id={id} role={role} onSaved={onSaved} bevestiging={bevestiging} />
        </div>
      </RolBestemming>
      <BeroepsmatchRegel beroepsmatch={role.beroepsmatch} />
      <TakenOvernameMelding role={role} />
      {competentieProfiel && <TijdsbestedingsBalk taken={liveResult.scenarios.realistisch.taken} />}

      {/* Capaciteit voorop, bedrag als detail. Bij een rol met waardetype
          capaciteitsgroei of kwaliteit is het besparingsbedrag zelfs misleidend: die
          uren ga je niet wegsnijden. */}
      <p className="text-xs text-slate-500 mb-1">
        {role.fte} FTE × {role.urenPerWeek} u/week — er komt{" "}
        <span className="font-medium text-slate-700">
          {Math.round(liveResult.scenarios.realistisch.automatiseerbareUrenPerWeek)} uur per week
        </span>{" "}
        vrij ({nl(liveResult.scenarios.realistisch.fteWeg, 2)} FTE), ambitieus{" "}
        {Math.round(liveResult.scenarios.agressief.automatiseerbareUrenPerWeek)} uur.
      </p>
      <p className="text-xs text-slate-400 mb-2">
        Als besparing ingeboekt: €
        {Math.round(liveResult.scenarios.realistisch.kostenBesparingPerJaar).toLocaleString("nl-NL")} – €
        {Math.round(liveResult.scenarios.agressief.kostenBesparingPerJaar).toLocaleString("nl-NL")} per jaar (à €
        {role.kostenPerUur}/uur).
      </p>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs ${totaalAandeelPct !== 100 ? "text-red-400 font-medium" : "text-slate-400"}`}>
          Totaal aandeel: {totaalAandeelPct}%{totaalAandeelPct !== 100 ? " — moet 100% zijn" : ""}
        </span>
        {(isDirtyFromSaved || isAdjustedFromOrigineel) && (
          <div className="flex items-center gap-2">
            {isAdjustedFromOrigineel && (
              <button
                onClick={handleReset}
                className="text-xs text-slate-400 hover:text-indigo-400 hover:underline"
              >
                Herstel naar AI-inschatting
              </button>
            )}
            {isDirtyFromSaved && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs rounded-md bg-indigo-600 text-white px-2.5 py-1 hover:bg-indigo-500 disabled:opacity-40"
              >
                {saving ? "Opslaan..." : "Opslaan"}
              </button>
            )}
          </div>
        )}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-200">
            <th className="py-1 font-medium">Taak</th>
            <th className="py-1 font-medium">Categorie</th>
            <th className="py-1 font-medium w-20">Aandeel</th>
            <th className="py-1 font-medium w-36">Automatisering</th>
          </tr>
        </thead>
        <tbody>
          {liveResult.scenarios.realistisch.taken.map((t, i) => {
            const agressiefPct = Math.round(
              (liveResult.scenarios.agressief.taken[i]?.automatiseringspercentage ?? 0) * 100
            );
            const realistischPct = Math.round(t.automatiseringspercentage * 100);
            const rowEdited = liveTaken[i].aandeel !== origineelTaken[i]?.aandeel;
            return (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-2">{t.omschrijving}</td>
                <td className="py-1.5 pr-2">
                  <span className="inline-block rounded bg-indigo-500/20 text-indigo-700 px-1.5 py-0.5 text-[11px]">
                    {t.categorieLabel}
                  </span>
                </td>
                <td className="py-1.5 pr-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(liveTaken[i].aandeel * 100)}
                      onChange={(e) => handleAandeelChange(i, e.target.value)}
                      className="w-12 rounded border border-slate-200 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="text-slate-400">%</span>
                    {rowEdited && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-amber-500"
                        title="Aangepast t.o.v. AI-inschatting"
                      />
                    )}
                  </div>
                </td>
                <td className="py-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-3 rounded bg-slate-200 overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${realistischPct}%` }} />
                    </div>
                    <span className="text-[11px] text-slate-500 w-8 text-right">{realistischPct}%</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">ambitieus {agressiefPct}%</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Competenties als apart blok onder de taakverdeling: dit is de gevolgtrekking
          uit de cijfers hierboven, niet het vertrekpunt. */}
      <div className="mt-6 border-t border-slate-200 pt-4">
        {competentieProfiel ? (
          <>
            <OverlapKpis profiel={competentieProfiel} />
            <CompetentieProfielVergelijking profiel={competentieProfiel} />
          </>
        ) : (
          <>
            <CompetentieTop5Block
              title="De functie vóór de transformatie"
              subtitle="Top 5 competenties, gewogen naar aandeel in de huidige taakverdeling"
              items={competentieTop5.top5Nu}
            />
            <CompetentieTop5Block
              title="De functie ná de transformatie"
              subtitle="Top 5 competenties, gewogen naar het overgebleven taakaandeel (realistisch scenario)"
              items={competentieTop5.top5Na}
            />
          </>
        )}
      </div>
    </>
  );
}

export default function ClientWorkspace({ id, nieuw = false }) {
  const router = useRouter();
  const [allClients, setAllClients] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("bedrijf");
  const [scopeLabel, setScopeLabel] = useState("");
  const [savingAnswers, setSavingAnswers] = useState(false);
  const [uploadingRoster, setUploadingRoster] = useState(false);
  const [uploadingProfiles, setUploadingProfiles] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStage, setAnalyzeStage] = useState(null);
  const [error, setError] = useState(null);
  const [newClientNaam, setNewClientNaam] = useState("");
  const [expandedRole, setExpandedRole] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("input");
  const [resultatenSub, setResultatenSub] = useState("functies"); // functies | maturity
  const [opzetGesloten, setOpzetGesloten] = useState(false);
  const [vraagAnalyse, setVraagAnalyse] = useState(null); // { opnieuw } zolang de waarschuwing openstaat

  // Twee losse onderzoeken, elk met invoer en uitkomst: de capaciteitsanalyse (functieoverzicht en
  // functieprofielen) en de AI-volwassenheidsscan (vragenlijst). Welk van de twee je ziet volgt uit het
  // tabblad: de vragenlijst en de volwassenheidsuitkomsten horen bij de scan, de rest bij de analyse.
  const onderzoek =
    activeTab === "maturiteit" || (activeTab === "resultaten" && resultatenSub === "maturity") ? "volwassenheid" : "capaciteit";
  const kiesOnderzoek = (nieuw) => {
    if (nieuw === onderzoek) return;
    const opResultaten = activeTab === "resultaten"; // wie bij de uitkomsten zit, blijft bij de uitkomsten
    setResultatenSub(nieuw === "capaciteit" ? "functies" : "maturity");
    setActiveTab(opResultaten ? "resultaten" : nieuw === "capaciteit" ? "input" : "maturiteit");
  };
  const naarUitkomsten = (soort) => {
    setResultatenSub(soort);
    setActiveTab("resultaten");
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [clientRes, listRes] = await Promise.all([
      fetch(`/api/clients/${id}`),
      fetch("/api/clients"),
    ]);
    if (clientRes.ok) {
      const data = await clientRes.json();
      setClient(data);
      setScope(data.answers.scope ?? "bedrijf");
      setScopeLabel(data.answers.scopeLabel ?? "");
    }
    setAllClients(await listRes.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Ververst de klantgegevens zonder de pagina op "laden" te zetten, bijvoorbeeld nadat een
  // bestand uit de inbox is overgenomen.
  const verversKlant = useCallback(async () => {
    const res = await fetch(`/api/clients/${id}`);
    if (res.ok) setClient(await res.json());
  }, [id]);

  async function saveAnswers(partial) {
    const payload = { scope, scopeLabel, ...partial };
    setSavingAnswers(true);
    await fetch(`/api/clients/${id}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingAnswers(false);
  }

  function handleScopeChange(value) {
    setScope(value);
    saveAnswers({ scope: value });
  }

  const scopeLabelSaveTimer = useRef(null);
  function handleScopeLabelChange(value) {
    setScopeLabel(value);
    clearTimeout(scopeLabelSaveTimer.current);
    scopeLabelSaveTimer.current = setTimeout(() => saveAnswers({ scopeLabel: value }), 500);
  }

  async function handleRosterUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRoster(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const invoer = e.target;
    try {
      const res = await fetch(`/api/clients/${id}/upload-roster`, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Het uploaden van het functieoverzicht is mislukt. Probeer het opnieuw.");
      }
    } catch {
      setError("Het uploaden van het functieoverzicht is mislukt: geen verbinding met de server. Probeer het opnieuw.");
    } finally {
      // Altijd terugzetten, ook na een fout: anders blijft de knop op "Uploaden..." staan.
      setUploadingRoster(false);
      invoer.value = "";
    }
    await verversKlant();
  }

  async function handleProfilesUpload(e) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadingProfiles(true);
    setError(null);
    const formData = new FormData();
    for (const f of files) formData.append("files", f);
    const invoer = e.target;
    try {
      const res = await fetch(`/api/clients/${id}/upload-profiles`, { method: "POST", body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          body.error ??
            `Het uploaden van ${files.length === 1 ? "het functieprofiel" : "de functieprofielen"} is mislukt. Controleer hieronder welke bestanden er staan en probeer de rest opnieuw.`
        );
      } else if (body.skipped?.length) {
        setError(`Overgeslagen (onbekend bestandstype): ${body.skipped.join(", ")}`);
      }
    } catch {
      setError("Het uploaden is mislukt: geen verbinding met de server. Controleer hieronder welke bestanden er staan en probeer de rest opnieuw.");
    } finally {
      // Altijd terugzetten, ook na een fout: anders blijft de knop op "Uploaden..." staan.
      setUploadingProfiles(false);
      invoer.value = "";
    }
    await verversKlant();
  }

  async function handleDeleteProfile(fileName) {
    await fetch(`/api/clients/${id}/upload-profiles`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName }),
    });
    await load();
  }

  // Rollen zonder functieprofiel tellen niet mee. Dat hoort de adviseur vóór de analyse te weten, niet
  // erna: eerder startte een analyse terwijl een derde van de profielen nog niet was geüpload.
  const zonderProfiel = client?.rosterCheck?.zonderProfiel ?? [];
  function startAnalyse(opties = {}) {
    if (zonderProfiel.length > 0 && !opties.bevestigd) {
      setVraagAnalyse({ opnieuw: Boolean(opties.opnieuw) });
      return;
    }
    setVraagAnalyse(null);
    handleAnalyze(opties);
  }

  async function handleAnalyze({ opnieuw = false } = {}) {
    setAnalyzing(true);
    setError(null);
    try {
      setAnalyzeStage("rollen");
      const rolesRes = await fetch(`/api/clients/${id}/analyze-roles${opnieuw ? "?opnieuw=1" : ""}`, { method: "POST" });
      const rolesBody = await rolesRes.json();
      if (!rolesRes.ok) throw new Error(rolesBody.error ?? "Rol-analyse mislukt");
      setClient((c) => ({ ...c, results: rolesBody }));
      // Niets veranderd: de aanbevelingen (en hun goedkeuring) zijn blijven staan.
      if (rolesBody.aanbevelingen) return;

      setAnalyzeStage("aanbevelingen");
      const aanbevelingenRes = await fetch(`/api/clients/${id}/analyze-aanbevelingen`, { method: "POST" });
      const aanbevelingenBody = await aanbevelingenRes.json();
      if (!aanbevelingenRes.ok) throw new Error(aanbevelingenBody.error ?? "Aanbevelingen genereren mislukt");
      setClient((c) => ({ ...c, results: aanbevelingenBody }));
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
      setAnalyzeStage(null);
    }
  }

  async function handleCreateClient(e) {
    e.preventDefault();
    if (!newClientNaam.trim()) return;
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naam: newClientNaam }),
    });
    const created = await res.json();
    router.push(`/app/klant/${created.id}?nieuw=1`);
  }

  async function handleDeleteClient() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    router.push("/app");
  }

  if (loading)
    return (
      <div className="flex-1">
        <main className="max-w-7xl mx-auto px-6 py-12 text-sm text-slate-400">Laden...</main>
      </div>
    );
  if (!client)
    return (
      <div className="flex-1">
        <main className="max-w-7xl mx-auto px-6 py-12 text-sm text-red-400">Klant niet gevonden.</main>
      </div>
    );

  const results = client.results;
  // Bewust geen hook: hierboven staan vroege returns, en hooks na een voorwaardelijke
  // return geven een crash. De berekening is goedkoop.
  const bevestiging = rollenDieBevestigingVragen(results?.rollen ?? []);
  const bevestigingVan = (r) => bevestiging.rollen.find((x) => x.roleId === (r.roleId ?? r.rolnaam)) ?? null;

  return (
    <div className="flex-1">
      {/* Breder dan de gebruikelijke leesbreedte: dit scherm bestaat vooral uit tabellen
          (rollen, taken, subtotalen per afdeling) en die worden met meer ruimte beter
          leesbaar, niet slechter. Wel een bovengrens, zodat regels op een breed scherm
          niet over de volle breedte uitlopen. */}
      <MaturiteitProvider key={id} id={id}>
      <main className="max-w-7xl mx-auto w-full px-4 py-6 sm:px-6 sm:py-10">
        {/* Klant-switcher */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 mb-6">
          <a href="/app" aria-label="Naar alle klanten" className="shrink-0">
            <HodLogo className="h-6" />
          </a>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" />
          <div className="order-3 flex w-full min-w-0 items-center gap-3 sm:order-none sm:w-auto">
          <a href="/app" className="shrink-0 text-sm text-slate-400 hover:text-indigo-400 transition-colors">
            ← Alle klanten
          </a>
          <select
            value={id}
            onChange={(e) => router.push(`/app/klant/${e.target.value}`)}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-card px-2.5 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:flex-none"
          >
            {allClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.naam}
              </option>
            ))}
          </select>
          </div>
          <form onSubmit={handleCreateClient} className="order-4 flex w-full gap-1.5 sm:order-none sm:ml-auto sm:w-auto">
            <input
              type="text"
              value={newClientNaam}
              onChange={(e) => setNewClientNaam(e.target.value)}
              placeholder="+ nieuwe klant"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-card px-2.5 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-36 sm:flex-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              Aanmaken
            </button>
          </form>
          <div className="order-2 ml-auto flex items-center gap-3 sm:order-none sm:ml-0">
            <a href="/app/gebruikers" className="text-xs text-slate-400 hover:text-indigo-400 transition-colors">
              Gebruikers
            </a>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
            >
              Uitloggen
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 break-words">{client.naam}</h1>
          </div>
          <button
            onClick={handleDeleteClient}
            disabled={deleting}
            onBlur={() => setConfirmDelete(false)}
            className={`text-xs rounded-lg px-3 py-1.5 border transition-colors ${
              confirmDelete
                ? "bg-red-600 text-white border-red-600"
                : "text-red-500 border-red-200 hover:bg-red-50"
            }`}
          >
            {deleting ? "Verwijderen..." : confirmDelete ? "Weet je het zeker? Klik nogmaals" : "Verwijder klant"}
          </button>
        </div>

        {/* Scope: totale bedrijf of business unit/afdeling */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="inline-flex rounded-lg border border-slate-200 bg-card p-0.5 text-xs">
            <button
              onClick={() => handleScopeChange("bedrijf")}
              className={`px-3 py-1 rounded-md transition-colors ${
                scope === "bedrijf" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Totale bedrijf
            </button>
            <button
              onClick={() => handleScopeChange("afdeling")}
              className={`px-3 py-1 rounded-md transition-colors ${
                scope === "afdeling" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Business unit / afdeling
            </button>
          </div>
          {scope === "afdeling" && (
            <input
              type="text"
              value={scopeLabel}
              onChange={(e) => handleScopeLabelChange(e.target.value)}
              placeholder="Naam van de afdeling/unit (bijv. Klantenservice)"
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs w-64 max-w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
        </div>

        {/* Twee onderzoeken, elk met de eigen voortgang. Kies er een; daaronder staan zijn invoer en uitkomsten. */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2" role="tablist" aria-label="Onderzoek">
          {[
            ["capaciteit", "📊", "Capaciteitsanalyse", "Hoeveel tijd komt er vrij als AI taken overneemt, en waar blijft die tijd? Op basis van functieoverzicht en functieprofielen."],
            ["volwassenheid", "🧭", "AI-volwassenheidsscan", "Hoe ver is de organisatie met AI, en wat is de volgende stap? Vragenlijst voor directie, management, IT, HR en werkvloer."],
          ].map(([sleutel, icoon, titel, uitleg]) => (
            <button
              key={sleutel}
              type="button"
              role="tab"
              aria-selected={onderzoek === sleutel}
              onClick={() => kiesOnderzoek(sleutel)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                onderzoek === sleutel
                  ? "border-indigo-500 bg-card shadow-sm ring-1 ring-indigo-500"
                  : "border-slate-200 bg-card/60 hover:border-indigo-300"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <span className="text-base">{icoon}</span>
                {titel}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">{uitleg}</span>
              <span className="mt-3 flex flex-wrap gap-1.5">
                {sleutel === "capaciteit" ? (
                  <>
                    <StepChip done={!!client.rosterFileName} label="Functieoverzicht" />
                    <StepChip done={client.profileFiles?.length > 0} label="Functieprofielen" />
                    <StepChip done={!!results} label="Analyse" />
                  </>
                ) : (
                  <MaturiteitIngevuld>{(klaar) => <StepChip done={klaar} label="Vragenlijst" />}</MaturiteitIngevuld>
                )}
              </span>
            </button>
          ))}
        </div>

        {nieuw && !opzetGesloten && <KlantOpzet id={id} onSluit={() => setOpzetGesloten(true)} />}

        {savingAnswers && <p className="text-xs text-indigo-400 mb-4">Opslaan...</p>}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {/* De analyse hoort alleen bij de capaciteitsanalyse; de scan rekent zelf mee bij elke wijziging. */}
        {onderzoek === "capaciteit" && (
          <button
            onClick={() => startAnalyse()}
            disabled={analyzing || uploadingProfiles || uploadingRoster || !client.rosterFileName || client.profileFiles?.length === 0}
            className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:hover:bg-indigo-600 mb-6"
          >
            {analyzing
              ? analyzeStage === "aanbevelingen"
                ? "Aanbevelingen genereren... (kan even duren)"
                : "Rollen analyseren... (kan even duren)"
              : "⚡ Analyseer de capaciteit"}
          </button>
        )}
        {onderzoek === "capaciteit" && vraagAnalyse && !analyzing && (
          <div className="-mt-3 mb-6 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">
              {zonderProfiel.length} van de {client.rosterCheck?.totaalRollen ?? "?"} rollen {zonderProfiel.length === 1 ? "heeft" : "hebben"} geen functieprofiel en{" "}
              {zonderProfiel.length === 1 ? "telt" : "tellen"} niet mee in de analyse
            </p>
            <p className="mt-1 text-xs text-amber-700">
              {zonderProfiel.slice(0, 12).join(", ")}
              {zonderProfiel.length > 12 ? ` en nog ${zonderProfiel.length - 12}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => startAnalyse({ ...vraagAnalyse, bevestigd: true })}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
              >
                Toch analyseren
              </button>
              <button
                type="button"
                onClick={() => {
                  setVraagAnalyse(null);
                  setActiveTab("input");
                }}
                className="rounded-md border border-slate-300 bg-card px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-300"
              >
                Eerst de profielen aanvullen
              </button>
            </div>
          </div>
        )}
        {onderzoek === "capaciteit" && results && !analyzing && !vraagAnalyse && (
          <p className="-mt-4 mb-6 text-xs text-slate-500">
            Een nieuwe analyse hergebruikt de eerdere inschatting voor functies waarvan het profiel niet is veranderd, zodat dezelfde invoer dezelfde uitkomst geeft
            {typeof results.hergebruikteRollen === "number" && results.hergebruikteRollen > 0
              ? ` (laatste keer: ${results.hergebruikteRollen} van ${results.rollen.length} hergebruikt)`
              : ""}
            .{" "}
            <button type="button" onClick={() => startAnalyse({ opnieuw: true })} className="text-indigo-400 underline-offset-2 hover:underline">
              Alles opnieuw laten inschatten
            </button>
          </p>
        )}

        {/* Tabbladen van het gekozen onderzoek: eerst de invoer, dan de uitkomsten. */}
        <div className="flex gap-1 border-b border-slate-200 mb-6">
          {onderzoek === "capaciteit" ? (
            <>
              <TabButton
                active={activeTab === "input"}
                onClick={() => setActiveTab("input")}
                icon="📁"
                label="Invoer"
                done={!!client.rosterFileName && client.profileFiles?.length > 0}
              />
              <TabButton
                active={activeTab === "resultaten"}
                onClick={() => naarUitkomsten("functies")}
                icon="📊"
                label="Resultaten"
                done={!!results}
              />
            </>
          ) : (
            <MaturiteitIngevuld>
              {(klaar) => (
                <>
                  <TabButton
                    active={activeTab === "maturiteit"}
                    onClick={() => setActiveTab("maturiteit")}
                    icon="📝"
                    label="Vragenlijst"
                    done={klaar}
                  />
                  <TabButton
                    active={activeTab === "resultaten"}
                    onClick={() => naarUitkomsten("maturity")}
                    icon="🧭"
                    label="Resultaten"
                    done={klaar}
                  />
                </>
              )}
            </MaturiteitIngevuld>
          )}
        </div>

        {/* Tab: Input */}
        {activeTab === "input" && (
        <>
        <Aanlevering id={id} onOvergenomen={verversKlant} />
        <Section title="Invoer — functieoverzicht en functieprofielen" icon="📁">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-1">
            <div>
              <input
                id="roster-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleRosterUpload}
                disabled={uploadingRoster}
                className="sr-only"
              />
              <FileDropLabel
                htmlFor="roster-upload"
                uploading={uploadingRoster}
                label="Upload functieoverzicht"
                hint="Excel/CSV: rolnaam, FTE, uren/week, loonkosten per contractuur. Optioneel: afdeling, en rapporteert_aan voor een organogram met rapportagelijnen."
              />
              <a
                href="/api/roster-template"
                className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-400 hover:underline"
              >
                ⬇ Download het sjabloon voor het functieoverzicht (.xlsx)
              </a>
              {client.rosterFileName && (
                <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1">
                  <span>✓</span> {client.rosterFileName}
                </p>
              )}
            </div>

            <div>
              <input
                id="profiles-upload"
                type="file"
                accept=".docx,.pdf,.txt,.md"
                multiple
                onChange={handleProfilesUpload}
                disabled={uploadingProfiles}
                className="sr-only"
              />
              <FileDropLabel
                htmlFor="profiles-upload"
                uploading={uploadingProfiles}
                label="Upload functieprofielen"
                hint=".docx, .pdf, .txt — één per rol"
              />
              {client.rosterCheck?.rollen?.some((r) => r.afdeling) && (
                <p className="text-xs text-slate-400 mt-1.5">
                  Het functieoverzicht bevat afdelingen — geef bestandsnamen een afdeling-prefix (bijv. "NL_Klantenservice.docx",
                  "BE_Klantenservice.docx") zodat rollen met dezelfde naam in verschillende afdelingen apart
                  gekoppeld worden.
                </p>
              )}
              {client.profileFiles?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {client.profileFiles.map((f) => (
                    <li key={f} className="flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-1 truncate">
                        <span className="text-emerald-400">✓</span> {f}
                      </span>
                      <button
                        onClick={() => handleDeleteProfile(f)}
                        className="text-red-400 hover:text-red-400 hover:underline shrink-0 ml-2"
                      >
                        verwijderen
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {client.rosterCheck && !client.rosterCheck.error && (
            <div className="mt-5">
              <p className="text-sm font-medium text-slate-700 mb-2">
                Controle:{" "}
                <span className={client.rosterCheck.gekoppeld === client.rosterCheck.totaalRollen ? "text-emerald-700" : "text-amber-400"}>
                  {client.rosterCheck.gekoppeld} / {client.rosterCheck.totaalRollen}
                </span>{" "}
                rollen uit het functieoverzicht gekoppeld aan een functieprofiel
              </p>
              <div className="rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400 bg-slate-50 border-b border-slate-200">
                      <th className="py-2 px-3 font-medium">Rol</th>
                      <th className="py-2 px-3 font-medium">Afdeling</th>
                      <th className="py-2 px-3 font-medium">FTE</th>
                      <th className="py-2 px-3 font-medium">Uren/week</th>
                      <th className="py-2 px-3 font-medium">Kosten/uur</th>
                      <th className="py-2 px-3 font-medium">Loonkosten/jaar</th>
                      <th className="py-2 px-3 font-medium">Profiel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.rosterCheck.rollen.map((r, i) => (
                      <tr key={r.roleId ?? i} className="border-b border-slate-100 last:border-0">
                        <td className="py-1.5 px-3 text-slate-700">{r.rolnaam}</td>
                        <td className="py-1.5 px-3 text-slate-500">{r.afdeling || "—"}</td>
                        <td className="py-1.5 px-3">{r.fte}</td>
                        <td className="py-1.5 px-3">{r.urenPerWeek}</td>
                        <td className="py-1.5 px-3">
                          {new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(r.kostenPerUur)}
                        </td>
                        <td className="py-1.5 px-3">
                          {new Intl.NumberFormat("nl-NL", {
                            style: "currency",
                            currency: "EUR",
                            maximumFractionDigits: 0,
                          }).format(r.loonkostenPerJaar)}
                        </td>
                        <td className={`py-1.5 px-3 font-medium ${r.gekoppeld ? "text-emerald-400" : "text-red-400"}`}>
                          {r.gekoppeld ? "✓" : "✗ ontbreekt"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200 font-medium text-slate-700">
                      <td className="py-1.5 px-3">Totaal / gewogen gem.</td>
                      <td className="py-1.5 px-3"></td>
                      <td className="py-1.5 px-3">{nl(client.rosterCheck.totalen.totaalFte, 1)}</td>
                      <td className="py-1.5 px-3">{nl(client.rosterCheck.totalen.gewogenUrenPerWeek, 1)}</td>
                      <td className="py-1.5 px-3">
                        {new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(
                          client.rosterCheck.totalen.gewogenKostenPerUur
                        )}
                      </td>
                      <td className="py-1.5 px-3">
                        {new Intl.NumberFormat("nl-NL", {
                          style: "currency",
                          currency: "EUR",
                          maximumFractionDigits: 0,
                        }).format(client.rosterCheck.totalen.totaalLoonkostenPerJaar)}
                      </td>
                      <td className="py-1.5 px-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Totale huidige loonkosten:{" "}
                <span className="font-medium text-slate-700">
                  {new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
                    client.rosterCheck.totalen.totaalLoonkostenPerJaar
                  )}
                </span>{" "}
                / jaar
              </p>

              {client.rosterCheck.subtotalenPerAfdeling?.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-medium text-slate-700 mb-2">Subtotalen per afdeling</p>
                  <div className="rounded-lg border border-slate-200 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-400 bg-slate-50 border-b border-slate-200">
                          <th className="py-2 px-3 font-medium">Afdeling</th>
                          <th className="py-2 px-3 font-medium">Rollen</th>
                          <th className="py-2 px-3 font-medium">FTE</th>
                          <th className="py-2 px-3 font-medium">Gem. uren/week</th>
                          <th className="py-2 px-3 font-medium">Gem. kosten/uur</th>
                          <th className="py-2 px-3 font-medium">Loonkosten/jaar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {client.rosterCheck.subtotalenPerAfdeling.map((s) => (
                          <tr key={s.afdeling} className="border-b border-slate-100 last:border-0">
                            <td className="py-1.5 px-3 text-slate-700 font-medium">{s.afdeling}</td>
                            <td className="py-1.5 px-3">{s.aantalRollen}</td>
                            <td className="py-1.5 px-3">{nl(s.totaalFte, 1)}</td>
                            <td className="py-1.5 px-3">{nl(s.gewogenUrenPerWeek, 1)}</td>
                            <td className="py-1.5 px-3">
                              {new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(
                                s.gewogenKostenPerUur
                              )}
                            </td>
                            <td className="py-1.5 px-3">
                              {new Intl.NumberFormat("nl-NL", {
                                style: "currency",
                                currency: "EUR",
                                maximumFractionDigits: 0,
                              }).format(s.totaalLoonkostenPerJaar)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          {client.rosterCheck?.error && (
            <p className="text-xs text-amber-400 mt-4">Kon controle niet uitvoeren: {client.rosterCheck.error}</p>
          )}
        </Section>
        </>
        )}

        {/* Tab: AI-volwassenheid (vragenlijst) */}
        {activeTab === "maturiteit" && (
          <MaturiteitVragen
            onNaarResultaten={() => {
              setResultatenSub("maturity");
              setActiveTab("resultaten");
            }}
          />
        )}

        {/* Tab: Resultaten */}
        {activeTab === "resultaten" && (
        <>
        {/* Welke uitkomsten je ziet volgt uit het gekozen onderzoek (bovenaan): de capaciteitsanalyse en de
            AI-volwassenheidsscan hebben elk hun eigen uitkomsten. */}
        {resultatenSub === "maturity" ? (
          <MaturiteitResultaten results={results} klantNaam={client.naam} onNaarVragen={() => setActiveTab("maturiteit")} />
        ) : !results ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-card/60 px-6 py-16 text-center">
              <p className="text-sm text-slate-500 mb-1">Nog geen analyse uitgevoerd.</p>
              <p className="text-xs text-slate-400">Vul bij Invoer het functieoverzicht en de functieprofielen in en klik op "Analyseer de capaciteit".</p>
            </div>
          ) : (
          <>
        {results && (
          <Section
            title="Resultaten"
            icon="📊"
            right={
              <div className="flex flex-wrap gap-2">
                <DownloadKnop
                  href={`/api/clients/${id}/report`}
                  className="text-xs rounded-lg border border-indigo-600 bg-indigo-600 text-white px-3 py-1.5 shadow-sm hover:bg-indigo-500 transition-colors"
                >
                  ⬇ Capaciteitsrapport (Word)
                </DownloadKnop>
                <DownloadKnop
                  href={`/api/clients/${id}/report-pdf`}
                  className="text-xs rounded-lg bg-card text-indigo-400 border border-indigo-200 px-3 py-1.5 shadow-sm hover:bg-indigo-50 transition-colors"
                >
                  ⬇ Capaciteitsrapport (PDF)
                </DownloadKnop>
                <VersieHistorie id={id} onHersteld={(updated) => setClient((c) => ({ ...c, results: updated }))} />
              </div>
            }
          >
            {results.aanbevelingen && !isGoedgekeurd(results.aanbevelingen) && (
              <p className="mb-3 text-xs text-amber-700">
                De bevindingen en aanbevelingen zijn nog een concept en staan daarom niet in het rapport. Keur ze onderaan deze pagina goed om ze mee te nemen.
              </p>
            )}
            <div className="mb-5 rounded-xl border border-indigo-300/40 bg-indigo-50/60 text-slate-800 px-4 py-3 flex items-start gap-2.5">
              <span className="text-lg leading-none">💬</span>
              <p className="text-sm leading-snug">
                <span className="font-semibold">Richtinggevend, geen voorspelling.</span> Dit is een vertrekpunt voor
                gesprek — de basis voor het vervolgtraject, niet het eindoordeel.
              </p>
            </div>

            {/* Rollen die niet in de totalen zitten, direct boven de totalen: wie de kaarten leest moet
                weten dat ze niet compleet zijn. Verschijnt alleen als er echt iets ontbreekt. */}
            {results.missingProfiles?.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                <p className="text-xs font-semibold text-amber-800">Niet meegenomen in de totalen: geen functieprofiel aangeleverd</p>
                <p className="mt-0.5 text-xs text-amber-700">{results.missingProfiles.join(", ")}</p>
              </div>
            )}

            {results.mislukteRollen?.length > 0 && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2">
                <p className="text-xs font-semibold text-red-800">
                  Niet meegenomen in de totalen: {results.mislukteRollen.length}{" "}
                  {results.mislukteRollen.length === 1 ? "rol is" : "rollen zijn"} niet geanalyseerd
                </p>
                <p className="text-xs text-red-700 mt-0.5">
                  De overige rollen zijn wél volledig. Draai de analyse opnieuw om deze rollen alsnog mee te nemen;
                  eerder geslaagde rollen blijven behouden.
                </p>
                <ul className="mt-1.5 space-y-1">
                  {results.mislukteRollen.map((r) => (
                    <li key={r.roleId ?? r.roleLabel} className="text-xs text-red-700">
                      <span className="font-medium">{r.roleLabel}</span> — {r.fout}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 mb-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="FTE totaal"
                value={results.organisatieTotaal.realistisch.totaalFteHuidig}
                sub={`${results.rollen.length} rollen`}
              />
              <StatCard
                label="Automatiseerbaar"
                value={`${nl((results.organisatieTotaal.realistisch.reductiePercentageOrganisatie * 100), 0)}–${nl((results.organisatieTotaal.agressief.reductiePercentageOrganisatie * 100), 0)}%`}
                sub="realistisch – ambitieus"
              />
              {/* De kop-KPI is de vrijgekomen capaciteit, niet de besparing. Dezelfde
                  som, maar het stelt de vervolgvraag — waar zet je die uren op in —
                  in plaats van 'm te beantwoorden met kostenreductie. */}
              <StatCard
                label="Capaciteit die vrijkomt"
                value={fteBereik(results.organisatieTotaal.realistisch.totaalFteWeg, results.organisatieTotaal.agressief.totaalFteWeg)}
                sub={`realistisch – ambitieus · circa ${urenRond(
                  results.organisatieTotaal.realistisch.totaalVrijgekomenUrenPerWeek ??
                    results.organisatieTotaal.realistisch.totaalFteWeg * 36
                )} uur per week (realistisch)`}
              />
              {/* Het financiële beeld naast de capaciteit: dezelfde uren, uitgedrukt in geld. De
                  opties om ze in te zetten staan er direct onder. */}
              <StatCard
                label="Waarde van die tijd"
                value={`${euroKort(results.organisatieTotaal.realistisch.totaalKostenBesparingPerJaar)}–${euroKort(results.organisatieTotaal.agressief.totaalKostenBesparingPerJaar)}`}
                sub="per jaar, realistisch – ambitieus"
                noot="Alleen een besparing als de uren uit de kosten verdwijnen."
              />
            </div>

            <KernSamenvatting results={results} onOpenScan={() => naarUitkomsten("maturity")} />

            <CapaciteitBestemming results={results} />

            <div className="rounded-lg border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 bg-slate-50 border-b border-slate-200">
                    <th className="py-2 px-3 font-medium"></th>
                    <th className="py-2 px-3 font-medium">Functie</th>
                    <th className="py-2 px-3 font-medium">FTE</th>
                    <th className="py-2 px-3 font-medium">Vrijkomend</th>
                    <th className="py-2 px-3 font-medium">Bestemming</th>
                    <th className="py-2 px-3 font-medium text-right">Waarde per jaar</th>
                  </tr>
                </thead>
                <tbody>
                  {results.rollen.map((r) => {
                    const isOpen = expandedRole === (r.roleId ?? r.rolnaam);
                    return (
                      <Fragment key={r.roleId ?? r.rolnaam}>
                        <tr
                          onClick={() => setExpandedRole(isOpen ? null : (r.roleId ?? r.rolnaam))}
                          className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-indigo-50/50 transition-colors"
                        >
                          <td className="py-2 px-3 w-4 text-indigo-400">{isOpen ? "▾" : "▸"}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{r.roleLabel ?? r.rolnaam}</td>
                          <td className="py-2 px-3">{r.fte}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="font-medium">{nl(r.scenarios.realistisch.fteWeg, 1)} FTE</span>
                            <span className="text-slate-400"> · {Math.round(r.scenarios.realistisch.automatiseerbareUrenPerWeek)} u/wk</span>
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            {getWaardetype(r.waardetype) ? (
                              <span className="inline-flex items-center gap-1.5">
                                <WaardetypeBadge
                                  waardetype={r.waardetype}
                                  toelichting={r.waardetypeToelichting}
                                  handmatig={isHandmatig(r)}
                                  bevestigen={bevestigingVan(r)?.bevestigd === false ? bevestigingVan(r) : null}
                                  compact
                                />
                                {getWaardetype(r.waardetype).label}
                              </span>
                            ) : (
                              <span className="text-slate-400">Nog niet bepaald</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            <span className="font-medium">{euroKort(r.scenarios.realistisch.kostenBesparingPerJaar)}</span>
                            <span className="text-slate-400"> – {euroKort(r.scenarios.agressief.kostenBesparingPerJaar)}</span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td></td>
                            <td colSpan={5} className="pb-4 px-3">
                              <div className="rounded-lg bg-slate-50 p-3">
                                <TaakTable
                                  id={id}
                                  role={r}
                                  bevestiging={bevestigingVan(r)}
                                  onSaved={(updated) => setClient((c) => ({ ...c, results: updated }))}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {results.subtotalenPerAfdeling?.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium text-slate-700 mb-2">Subtotalen per afdeling</p>
                <div className="rounded-lg border border-slate-200 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-400 bg-slate-50 border-b border-slate-200">
                        <th className="py-2 px-3 font-medium">Afdeling</th>
                        <th className="py-2 px-3 font-medium">Rollen</th>
                        <th className="py-2 px-3 font-medium">FTE huidig</th>
                        <th className="py-2 px-3 font-medium">Komt vrij (realistisch)</th>
                        <th className="py-2 px-3 font-medium">Komt vrij (ambitieus)</th>
                        <th className="py-2 px-3 font-medium">Waarde per jaar (realistisch–ambitieus)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.subtotalenPerAfdeling.map((s) => (
                        <tr key={s.afdeling} className="border-b border-slate-100 last:border-0">
                          <td className="py-1.5 px-3 text-slate-700 font-medium">{s.afdeling}</td>
                          <td className="py-1.5 px-3">{s.aantalRollen}</td>
                          <td className="py-1.5 px-3">{nl(s.scenarios.realistisch.totaalFteHuidig, 1)}</td>
                          <td className="py-1.5 px-3">{nl(s.scenarios.realistisch.totaalFteWeg, 1)} FTE</td>
                          <td className="py-1.5 px-3">{nl(s.scenarios.agressief.totaalFteWeg, 1)} FTE</td>
                          <td className="py-1.5 px-3">
                            €{Math.round(s.scenarios.realistisch.totaalKostenBesparingPerJaar / 1000)}k–€
                            {Math.round(s.scenarios.agressief.totaalKostenBesparingPerJaar / 1000)}k
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Section>
        )}

        {results && (
          <Section title="Organogram — waar de capaciteit vrijkomt" icon="🏢">
            <Organogram rollen={results.rollen} />
          </Section>
        )}

        <CapaciteitHerkomst results={results} />
        <CompetentieAgenda results={results} />

        {results?.aanbevelingen && (
          <Section title="Bevindingen & aanbevelingen" icon="💡">
            <Aanbevelingen id={id} aanbevelingen={results.aanbevelingen} onOpgeslagen={(updated) => setClient((c) => ({ ...c, results: updated }))} />
          </Section>
        )}
          </>
          )}
        </>
        )}

        <Logboek id={id} />
      </main>
      </MaturiteitProvider>
    </div>
  );
}
