"use client";

import { useEffect, useState, useCallback, useMemo, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { SECTORS, getSector } from "@/lib/sectors";
import { IMPACT_QUESTIONS, READINESS_QUESTIONS } from "@/lib/questions";
import { buildOrgChartData } from "@/lib/orgChartData";
import { calculateRole } from "../../../../../src/calculate.js";
import { calculateCompetentieTop5 } from "../../../../../src/competencyTop5.js";
import { calculateCompetentieProfiel } from "../../../../../src/competencyProfile.js";
import { WAARDETYPES, getWaardetype } from "../../../../../src/config.js";

function Section({ title, icon, children, right }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
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
        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] ${
          done ? "bg-emerald-500 text-white" : "bg-slate-300 text-white"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      {label}
    </span>
  );
}

function ScaleQuestion({ question, value, onChange }) {
  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <p className="text-sm text-slate-700 mb-2">{question.text}</p>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400 w-8">laag</span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(question.id, n)}
              className={`h-8 w-8 rounded-lg text-sm font-medium border transition-colors ${
                value === n
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-500 border-slate-300 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-slate-400 w-8 text-right">hoog</span>
      </div>
    </div>
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

function urgencyColor(urgentie) {
  if (urgentie?.startsWith("Hoog")) return { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" };
  if (urgentie?.startsWith("Gemiddeld")) return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" };
  return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" };
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function OrgChartBar({ label, value, maxValue, colorClass }) {
  const widthPct = Math.max((value / maxValue) * 100, 2);
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-slate-400">{label}</span>
      <div className="flex-1 h-5 rounded bg-slate-100 overflow-hidden">
        <div className={`h-full rounded ${colorClass}`} style={{ width: `${widthPct}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right text-xs font-medium text-slate-700">{value.toFixed(2)}</span>
    </div>
  );
}

function OrgChartRole({ rol, maxFte }) {
  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <p className="text-sm font-medium text-slate-800 mb-2">{rol.rolnaam}</p>
      <div className="space-y-1.5">
        <OrgChartBar label="Huidig" value={rol.fteHuidig} maxValue={maxFte} colorClass="bg-slate-400" />
        <OrgChartBar label="Realistisch" value={rol.fteRealistisch} maxValue={maxFte} colorClass="bg-indigo-500" />
        <OrgChartBar label="Agressief" value={rol.fteAgressief} maxValue={maxFte} colorClass="bg-indigo-300" />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, done }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
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

function WaardetypeBadge({ waardetype, toelichting, compact = false }) {
  const w = getWaardetype(waardetype);
  if (!w) return null;
  if (compact) {
    return (
      <span title={`${w.label}${toelichting ? ` — ${toelichting}` : ""}`} className="text-sm">
        {w.icon}
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
      <p className="text-[11px] text-slate-400 mb-2">{subtitle}</p>
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
  midden: { balk: "bg-blue-500", stip: "bg-blue-500", tekst: "text-blue-700" },
  laag: { balk: "bg-orange-500", stip: "bg-orange-500", tekst: "text-orange-700" },
};
const TRAINBAARHEID_ONBEKEND = { balk: "bg-slate-400", stip: "bg-slate-400", tekst: "text-slate-500" };

function kleurVan(tier) {
  return TRAINBAARHEID_KLEUR[tier] ?? TRAINBAARHEID_ONBEKEND;
}

function OverlapKpis({ profiel }) {
  if (!profiel) return null;
  const eersteToets = profiel.teToetsen?.[0];
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-lg bg-white p-3">
        <p className="text-[11px] text-slate-500">Overlap met huidig profiel</p>
        <p className="text-2xl font-semibold text-slate-800">{profiel.overlapPct}%</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Deel van de toekomstige competentiebehoefte dat de rol nu al vraagt
        </p>
      </div>
      <div className="rounded-lg bg-white p-3">
        <p className="text-[11px] text-slate-500">Overlap na de juiste training</p>
        <p className="text-2xl font-semibold text-slate-800">
          {profiel.overlapNaTrainingPct ?? "—"}
          {profiel.overlapNaTrainingPct != null && "%"}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {eersteToets
            ? `→ toets bezetting op: ${eersteToets.naam}`
            : profiel.overlapNaTrainingPct != null
              ? "→ het verschil is volledig te ontwikkelen"
              : "→ onbekend zonder ESCO-gegevens"}
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
      <p className="text-[11px] text-slate-400 mb-2">Beweeg over een blok voor de taaknaam</p>
      <p className="text-[10px] text-slate-400 mb-0.5">Nu</p>
      {rij(false)}
      <p className="text-[10px] text-slate-400 mt-1.5 mb-0.5">Straks</p>
      {rij(true)}
      <div className="mt-1.5 flex gap-4 text-[10px] text-slate-400">
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
      <p className="text-[10px] text-slate-400 mb-2">{titel}</p>
      <div className="space-y-2">
        {items.slice(0, 6).map((c) => {
          const kleur = kleurVan(c.trainbaarheid);
          const actie = acties?.[c.naam];
          return (
            <div key={c.naam}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${kleur.stip}`} />
                <span className="flex-1 truncate text-[11px] text-slate-700" title={c.naam}>
                  {c.naam}
                </span>
                {actie && <span className={`shrink-0 text-[10px] ${actie.klasse}`}>{actie.label}</span>}
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
    acties[c.naam] = { label: "toetsen bezetting", klasse: "text-orange-600" };
  }

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-700">Competentieprofiel — nu versus straks</p>
      <p className="text-[11px] text-slate-400 mb-2">
        Competenties uit de ESCO-classificatie (EU); kleur toont hoe goed ze te ontwikkelen zijn
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <ProfielKolom titel="Nu" items={profiel.profielNu} />
        <ProfielKolom titel="Straks" items={profiel.profielStraks} acties={acties} />
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-400">
        {["hoog", "midden", "laag"].map((tier) => (
          <span key={tier} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${kleurVan(tier).stip}`} /> {tier} trainbaar
          </span>
        ))}
      </div>
      {/* Voorwaarde 1 van de ESCO-gebruiksvoorwaarden schrijft de Engelse zin letterlijk
          voor; voorwaarde 2 vraagt eigen bewerkingen als zodanig te markeren — de
          trainbaarheidsweging is onze afleiding, niet die van ESCO. */}
      <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
        This service uses the ESCO classification of the European Commission. De indeling naar trainbaarheid is een
        eigen afleiding op basis van ESCO-metadata en maakt geen deel uit van ESCO zelf.
      </p>
    </div>
  );
}

function TaakTable({ id, role, onSaved }) {
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
      <WaardetypeBadge waardetype={role.waardetype} toelichting={role.waardetypeToelichting} />
      {competentieProfiel && <TijdsbestedingsBalk taken={liveResult.scenarios.realistisch.taken} />}

      <p className="text-xs text-slate-500 mb-2">
        {role.urenPerWeek} u/week, €{role.kostenPerUur}/uur — besparing/jaar realistisch €
        {Math.round(liveResult.scenarios.realistisch.kostenBesparingPerJaar).toLocaleString("nl-NL")}, agressief €
        {Math.round(liveResult.scenarios.agressief.kostenBesparingPerJaar).toLocaleString("nl-NL")}
      </p>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[11px] ${totaalAandeelPct !== 100 ? "text-red-600 font-medium" : "text-slate-400"}`}>
          Totaal aandeel: {totaalAandeelPct}%{totaalAandeelPct !== 100 ? " — moet 100% zijn" : ""}
        </span>
        {(isDirtyFromSaved || isAdjustedFromOrigineel) && (
          <div className="flex items-center gap-2">
            {isAdjustedFromOrigineel && (
              <button
                onClick={handleReset}
                className="text-[11px] text-slate-400 hover:text-indigo-600 hover:underline"
              >
                Herstel naar AI-inschatting
              </button>
            )}
            {isDirtyFromSaved && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-[11px] rounded-md bg-indigo-600 text-white px-2.5 py-1 hover:bg-indigo-500 disabled:opacity-40"
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
                  <span className="inline-block rounded bg-indigo-100 text-indigo-700 px-1.5 py-0.5 text-[10px]">
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
                    <span className="text-[10px] text-slate-500 w-8 text-right">{realistischPct}%</span>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">agressief {agressiefPct}%</div>
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

export default function ClientWorkspace({ id }) {
  const router = useRouter();
  const [allClients, setAllClients] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState("");
  const [impact, setImpact] = useState({});
  const [readiness, setReadiness] = useState({});
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

  const load = useCallback(async () => {
    setLoading(true);
    const [clientRes, listRes] = await Promise.all([
      fetch(`/api/clients/${id}`),
      fetch("/api/clients"),
    ]);
    if (clientRes.ok) {
      const data = await clientRes.json();
      setClient(data);
      setSector(data.answers.sector ?? "");
      setImpact(data.answers.impact ?? {});
      setReadiness(data.answers.readiness ?? {});
      setScope(data.answers.scope ?? "bedrijf");
      setScopeLabel(data.answers.scopeLabel ?? "");
    }
    setAllClients(await listRes.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveAnswers(partial) {
    const payload = { sector, impact, readiness, scope, scopeLabel, ...partial };
    setSavingAnswers(true);
    await fetch(`/api/clients/${id}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingAnswers(false);
  }

  function handleSectorChange(e) {
    const value = e.target.value;
    setSector(value);
    saveAnswers({ sector: value });
  }

  function handleImpactChange(qid, value) {
    const next = { ...impact, [qid]: value };
    setImpact(next);
    saveAnswers({ impact: next });
  }

  function handleReadinessChange(qid, value) {
    const next = { ...readiness, [qid]: value };
    setReadiness(next);
    saveAnswers({ readiness: next });
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
    const res = await fetch(`/api/clients/${id}/upload-roster`, { method: "POST", body: formData });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Upload mislukt");
    }
    setUploadingRoster(false);
    await load();
    e.target.value = "";
  }

  async function handleProfilesUpload(e) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadingProfiles(true);
    setError(null);
    const formData = new FormData();
    for (const f of files) formData.append("files", f);
    const res = await fetch(`/api/clients/${id}/upload-profiles`, { method: "POST", body: formData });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Upload mislukt");
    } else {
      const body = await res.json();
      if (body.skipped?.length) {
        setError(`Overgeslagen (onbekend bestandstype): ${body.skipped.join(", ")}`);
      }
    }
    setUploadingProfiles(false);
    await load();
    e.target.value = "";
  }

  async function handleDeleteProfile(fileName) {
    await fetch(`/api/clients/${id}/upload-profiles`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName }),
    });
    await load();
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);
    try {
      setAnalyzeStage("rollen");
      const rolesRes = await fetch(`/api/clients/${id}/analyze-roles`, { method: "POST" });
      const rolesBody = await rolesRes.json();
      if (!rolesRes.ok) throw new Error(rolesBody.error ?? "Rol-analyse mislukt");
      setClient((c) => ({ ...c, results: rolesBody }));

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
    router.push(`/app/klant/${created.id}`);
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
      <div className="flex-1 bg-slate-50">
        <main className="max-w-3xl mx-auto px-6 py-12 text-sm text-slate-400">Laden...</main>
      </div>
    );
  if (!client)
    return (
      <div className="flex-1 bg-slate-50">
        <main className="max-w-3xl mx-auto px-6 py-12 text-sm text-red-600">Klant niet gevonden.</main>
      </div>
    );

  const results = client.results;
  const sectorInfo = sector ? getSector(sector) : null;
  const hasAnyAnswer = Object.keys(impact).length > 0 || Object.keys(readiness).length > 0;

  return (
    <div className="flex-1 bg-slate-50">
      <main className="max-w-3xl mx-auto w-full px-6 py-10">
        {/* Klant-switcher */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <a href="/app" className="text-sm text-slate-400 hover:text-indigo-600 transition-colors">
            ← Alle klanten
          </a>
          <select
            value={id}
            onChange={(e) => router.push(`/app/klant/${e.target.value}`)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {allClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.naam}
              </option>
            ))}
          </select>
          <form onSubmit={handleCreateClient} className="flex gap-1.5 ml-auto">
            <input
              type="text"
              value={newClientNaam}
              onChange={(e) => setNewClientNaam(e.target.value)}
              placeholder="+ nieuwe klant"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              Aanmaken
            </button>
          </form>
          <div className="flex items-center gap-3">
            <a href="/app/gebruikers" className="text-xs text-slate-400 hover:text-indigo-600 transition-colors">
              Gebruikers
            </a>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-xs text-slate-400 hover:text-indigo-600 transition-colors"
            >
              Uitloggen
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{client.naam}</h1>
            {sectorInfo && (
              <span className="inline-flex items-center gap-1.5 mt-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                {sectorInfo.sector}
              </span>
            )}
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
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
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
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
        </div>

        {/* Voortgang */}
        <div className="flex flex-wrap gap-2 mb-6">
          <StepChip done={!!client.rosterFileName} label="Roster" />
          <StepChip done={client.profileFiles?.length > 0} label="Functieprofielen" />
          <StepChip done={hasAnyAnswer} label="Positioneringsvragen" />
          <StepChip done={!!results} label="Analyse" />
        </div>

        {savingAnswers && <p className="text-xs text-indigo-500 mb-4">Opslaan...</p>}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">
            {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={analyzing || !client.rosterFileName || client.profileFiles?.length === 0}
          className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:hover:bg-indigo-600 mb-6"
        >
          {analyzing
            ? analyzeStage === "aanbevelingen"
              ? "Aanbevelingen genereren... (kan even duren)"
              : "Rollen analyseren... (kan even duren)"
            : "⚡ Analyseer"}
        </button>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 mb-6">
          <TabButton
            active={activeTab === "input"}
            onClick={() => setActiveTab("input")}
            icon="📁"
            label="Input"
            done={!!client.rosterFileName && client.profileFiles?.length > 0}
          />
          <TabButton
            active={activeTab === "positionering"}
            onClick={() => setActiveTab("positionering")}
            icon="🎯"
            label="Positionering"
            done={hasAnyAnswer}
          />
          <TabButton
            active={activeTab === "resultaten"}
            onClick={() => setActiveTab("resultaten")}
            icon="📊"
            label="Resultaten"
            done={!!results}
          />
        </div>

        {/* Tab: Input */}
        {activeTab === "input" && (
        <Section title="Deel 1 — Organisatie-input" icon="📁">
          <div className="grid sm:grid-cols-2 gap-4 mb-1">
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
                label="Upload roster"
                hint="Excel/CSV: rolnaam, FTE, uren/week, kosten/uur (+ optioneel afdeling)"
              />
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
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Roster bevat afdelingen — geef bestandsnamen een afdeling-prefix (bijv. "NL_Klantenservice.docx",
                  "BE_Klantenservice.docx") zodat rollen met dezelfde naam in verschillende afdelingen apart
                  gekoppeld worden.
                </p>
              )}
              {client.profileFiles?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {client.profileFiles.map((f) => (
                    <li key={f} className="flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-1 truncate">
                        <span className="text-emerald-600">✓</span> {f}
                      </span>
                      <button
                        onClick={() => handleDeleteProfile(f)}
                        className="text-red-400 hover:text-red-600 hover:underline shrink-0 ml-2"
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
                <span className={client.rosterCheck.gekoppeld === client.rosterCheck.totaalRollen ? "text-emerald-700" : "text-amber-600"}>
                  {client.rosterCheck.gekoppeld} / {client.rosterCheck.totaalRollen}
                </span>{" "}
                rollen uit het roster gekoppeld aan een functieprofiel
              </p>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
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
                        <td className={`py-1.5 px-3 font-medium ${r.gekoppeld ? "text-emerald-600" : "text-red-600"}`}>
                          {r.gekoppeld ? "✓" : "✗ ontbreekt"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200 font-medium text-slate-700">
                      <td className="py-1.5 px-3">Totaal / gewogen gem.</td>
                      <td className="py-1.5 px-3"></td>
                      <td className="py-1.5 px-3">{client.rosterCheck.totalen.totaalFte.toFixed(1)}</td>
                      <td className="py-1.5 px-3">{client.rosterCheck.totalen.gewogenUrenPerWeek.toFixed(1)}</td>
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
                            <td className="py-1.5 px-3">{s.totaalFte.toFixed(1)}</td>
                            <td className="py-1.5 px-3">{s.gewogenUrenPerWeek.toFixed(1)}</td>
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
            <p className="text-xs text-amber-600 mt-4">Kon controle niet uitvoeren: {client.rosterCheck.error}</p>
          )}
        </Section>
        )}

        {/* Tab: Positionering */}
        {activeTab === "positionering" && (
        <Section title="Deel 2 — Sector & positionering" icon="🎯">
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Sector</label>
            <select
              value={sector}
              onChange={handleSectorChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">— Kies een sector —</option>
              {SECTORS.map((s) => (
                <option key={s.id} value={s.id}>
                  Niveau {s.niveau} — {s.sector} (risico {s.risico}, kans {s.kans})
                </option>
              ))}
            </select>
          </div>

          <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mt-5 mb-1">
            Impact-vragen · 20%
          </h3>
          {IMPACT_QUESTIONS.map((q) => (
            <ScaleQuestion key={q.id} question={q} value={impact[q.id]} onChange={handleImpactChange} />
          ))}

          <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mt-5 mb-1">
            Readiness-vragen · 10%
          </h3>
          {READINESS_QUESTIONS.map((q) => (
            <ScaleQuestion key={q.id} question={q} value={readiness[q.id]} onChange={handleReadinessChange} />
          ))}
        </Section>
        )}

        {/* Tab: Resultaten */}
        {activeTab === "resultaten" && (
          !results ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center">
              <p className="text-sm text-slate-500 mb-1">Nog geen analyse uitgevoerd.</p>
              <p className="text-xs text-slate-400">Vul Input en Positionering in en klik bovenaan op "Analyseer".</p>
            </div>
          ) : (
          <>
        {results && (
          <Section
            title="Resultaten"
            icon="📊"
            right={
              <div className="flex gap-2">
                <a
                  href={`/api/clients/${id}/report`}
                  className="text-xs rounded-lg bg-indigo-600 text-white px-3 py-1.5 shadow-sm hover:bg-indigo-500 transition-colors"
                >
                  ⬇ Word-rapport
                </a>
                <a
                  href={`/api/clients/${id}/report-pdf`}
                  className="text-xs rounded-lg bg-white text-indigo-600 border border-indigo-200 px-3 py-1.5 shadow-sm hover:bg-indigo-50 transition-colors"
                >
                  ⬇ PDF-rapport
                </a>
              </div>
            }
          >
            <div className="mb-5 rounded-xl bg-indigo-600 text-white px-4 py-3 flex items-start gap-2.5">
              <span className="text-lg leading-none">💬</span>
              <p className="text-sm leading-snug">
                <span className="font-semibold">Richtinggevend, geen voorspelling.</span> Dit is een vertrekpunt voor
                gesprek — de basis voor het vervolgtraject, niet het eindoordeel.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mb-5">
              <StatCard
                label="FTE totaal"
                value={results.organisatieTotaal.realistisch.totaalFteHuidig}
                sub={`${results.rollen.length} rollen`}
              />
              <StatCard
                label="Automatiseerbaar"
                value={`${(results.organisatieTotaal.realistisch.reductiePercentageOrganisatie * 100).toFixed(
                  0
                )}–${(results.organisatieTotaal.agressief.reductiePercentageOrganisatie * 100).toFixed(0)}%`}
                sub="realistisch – agressief"
              />
              <StatCard
                label="Besparing/jaar"
                value={`€${Math.round(
                  results.organisatieTotaal.realistisch.totaalKostenBesparingPerJaar / 1000
                )}k–${Math.round(results.organisatieTotaal.agressief.totaalKostenBesparingPerJaar / 1000)}k`}
                sub="realistisch – agressief"
              />
            </div>

            {(() => {
              const counts = WAARDETYPES.map((w) => ({
                ...w,
                count: results.rollen.filter((r) => r.waardetype === w.id).length,
              })).filter((w) => w.count > 0);
              if (counts.length === 0) return null;
              return (
                <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                  {counts.map((w) => (
                    <span key={w.id} className="inline-flex items-center gap-1">
                      {w.icon} <span className="font-medium text-slate-700">{w.count}</span> {w.label.toLowerCase()}
                    </span>
                  ))}
                </div>
              );
            })()}

            {results.sectorAnalyse &&
              (() => {
                const c = urgencyColor(results.sectorAnalyse.urgentie);
                return (
                  <div className={`mb-6 rounded-xl ${c.bg} p-4 flex items-start gap-3`}>
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${c.dot}`} />
                    <div>
                      <p className={`text-sm font-semibold ${c.text}`}>
                        Eindscore {results.sectorAnalyse.eindscore.toFixed(1)} / 5 — {results.sectorAnalyse.urgentie}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">{results.sectorAnalyse.positionering}</p>
                    </div>
                  </div>
                );
              })()}

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 bg-slate-50 border-b border-slate-200">
                    <th className="py-2 px-3 font-medium"></th>
                    <th className="py-2 px-3 font-medium">Rol</th>
                    <th className="py-2 px-3 font-medium">FTE</th>
                    <th className="py-2 px-3 font-medium">Realistisch</th>
                    <th className="py-2 px-3 font-medium">Agressief</th>
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
                          <td className="py-2 px-3 font-medium text-slate-800">
                            <span className="inline-flex items-center gap-1.5">
                              <WaardetypeBadge waardetype={r.waardetype} toelichting={r.waardetypeToelichting} compact />
                              {r.roleLabel ?? r.rolnaam}
                            </span>
                          </td>
                          <td className="py-2 px-3">{r.fte}</td>
                          <td className="py-2 px-3">
                            {r.fte} → <span className="font-medium">{r.scenarios.realistisch.fteOver.toFixed(2)}</span>
                          </td>
                          <td className="py-2 px-3">
                            {r.fte} → <span className="font-medium">{r.scenarios.agressief.fteOver.toFixed(2)}</span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td></td>
                            <td colSpan={4} className="pb-4 px-3">
                              <div className="rounded-lg bg-slate-50 p-3">
                                <TaakTable
                                  id={id}
                                  role={r}
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

            {results.missingProfiles?.length > 0 && (
              <p className="text-xs text-amber-600 mt-4">
                Overgeslagen (geen profiel): {results.missingProfiles.join(", ")}
              </p>
            )}

            {/* Rollen die de analyse niet haalden. De rest van het rapport klopt wél;
                deze rollen ontbreken erin en kunnen los opnieuw geprobeerd worden. */}
            {results.mislukteRollen?.length > 0 && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2">
                <p className="text-xs font-semibold text-red-800">
                  {results.mislukteRollen.length}{" "}
                  {results.mislukteRollen.length === 1 ? "rol is" : "rollen zijn"} niet geanalyseerd
                </p>
                <p className="text-[11px] text-red-700 mt-0.5">
                  De overige rollen hieronder zijn wél volledig. Draai de analyse opnieuw om deze rollen alsnog mee te
                  nemen — eerder geslaagde rollen blijven behouden.
                </p>
                <ul className="mt-1.5 space-y-1">
                  {results.mislukteRollen.map((r) => (
                    <li key={r.roleId ?? r.roleLabel} className="text-[11px] text-red-700">
                      <span className="font-medium">{r.roleLabel}</span> — {r.fout}
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
                        <th className="py-2 px-3 font-medium">FTE realistisch</th>
                        <th className="py-2 px-3 font-medium">FTE agressief</th>
                        <th className="py-2 px-3 font-medium">Besparing/jaar (realistisch–agressief)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.subtotalenPerAfdeling.map((s) => (
                        <tr key={s.afdeling} className="border-b border-slate-100 last:border-0">
                          <td className="py-1.5 px-3 text-slate-700 font-medium">{s.afdeling}</td>
                          <td className="py-1.5 px-3">{s.aantalRollen}</td>
                          <td className="py-1.5 px-3">{s.scenarios.realistisch.totaalFteHuidig.toFixed(1)}</td>
                          <td className="py-1.5 px-3">{s.scenarios.realistisch.totaalFteOver.toFixed(2)}</td>
                          <td className="py-1.5 px-3">{s.scenarios.agressief.totaalFteOver.toFixed(2)}</td>
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
          <Section title="Organogram — voor & na" icon="🏢">
            <p className="text-xs text-slate-400 mb-4">
              Geen hiërarchie beschikbaar in het roster — dit toont FTE per rol, huidig vs. overgebleven na
              transformatie, geschaald t.o.v. de grootste rol.
            </p>
            {(() => {
              const { maxFte, rollen } = buildOrgChartData(results.rollen);
              return rollen.map((r) => <OrgChartRole key={r.roleId ?? r.rolnaam} rol={r} maxFte={maxFte} />);
            })()}
          </Section>
        )}

        {results?.aanbevelingen && (
          <Section title="Bevindingen & Aanbevelingen" icon="💡">
            <p className="text-sm text-slate-700 mb-5">{results.aanbevelingen.bevindingenSamenvatting}</p>

            <div className="grid sm:grid-cols-3 gap-4 mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-2">Krimpende rollen</p>
                {results.aanbevelingen.krimpendeRollen?.length > 0 ? (
                  <ul className="space-y-2">
                    {results.aanbevelingen.krimpendeRollen.map((r, i) => (
                      <li key={i} className="text-xs">
                        <span className="font-medium text-slate-800">{r.rolnaam}</span>
                        <p className="text-slate-500">{r.toelichting}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">—</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">Groeiende rollen</p>
                {results.aanbevelingen.groeiendeRollen?.length > 0 ? (
                  <ul className="space-y-2">
                    {results.aanbevelingen.groeiendeRollen.map((r, i) => (
                      <li key={i} className="text-xs">
                        <span className="font-medium text-slate-800">{r.rolnaam}</span>
                        <p className="text-slate-500">{r.toelichting}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">—</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-2">Samenvoegkandidaten</p>
                {results.aanbevelingen.samenvoegKandidaten?.length > 0 ? (
                  <ul className="space-y-2">
                    {results.aanbevelingen.samenvoegKandidaten.map((s, i) => (
                      <li key={i} className="text-xs">
                        <span className="font-medium text-slate-800">{s.rollen.join(" + ")}</span>
                        <p className="text-slate-500">{s.toelichting}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">—</p>
                )}
              </div>
            </div>

            {results.aanbevelingen.aanbevelingen?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Aanbevelingen</p>
                <ul className="space-y-3">
                  {results.aanbevelingen.aanbevelingen.map((a, i) => (
                    <li key={i} className="rounded-lg bg-indigo-50/60 p-3">
                      <p className="text-sm font-medium text-indigo-900">{a.titel}</p>
                      <p className="text-sm text-slate-600 mt-0.5">{a.beschrijving}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}
          </>
          )
        )}
      </main>
    </div>
  );
}
