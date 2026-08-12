"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { SECTORS, getSector } from "@/lib/sectors";
import { IMPACT_QUESTIONS, READINESS_QUESTIONS } from "@/lib/questions";
import { buildOrgChartData } from "@/lib/orgChartData";

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

export default function ClientWorkspace({ id }) {
  const router = useRouter();
  const [allClients, setAllClients] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState("");
  const [impact, setImpact] = useState({});
  const [readiness, setReadiness] = useState({});
  const [savingAnswers, setSavingAnswers] = useState(false);
  const [uploadingRoster, setUploadingRoster] = useState(false);
  const [uploadingProfiles, setUploadingProfiles] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [newClientNaam, setNewClientNaam] = useState("");
  const [expandedRole, setExpandedRole] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    }
    setAllClients(await listRes.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveAnswers(nextSector, nextImpact, nextReadiness) {
    setSavingAnswers(true);
    await fetch(`/api/clients/${id}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sector: nextSector, impact: nextImpact, readiness: nextReadiness }),
    });
    setSavingAnswers(false);
  }

  function handleSectorChange(e) {
    const value = e.target.value;
    setSector(value);
    saveAnswers(value, impact, readiness);
  }

  function handleImpactChange(qid, value) {
    const next = { ...impact, [qid]: value };
    setImpact(next);
    saveAnswers(sector, next, readiness);
  }

  function handleReadinessChange(qid, value) {
    const next = { ...readiness, [qid]: value };
    setReadiness(next);
    saveAnswers(sector, impact, next);
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
      const res = await fetch(`/api/clients/${id}/analyze`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Analyse mislukt");
      setClient((c) => ({ ...c, results: body }));
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
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
    router.push(`/klant/${created.id}`);
  }

  async function handleDeleteClient() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    router.push("/");
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
          <a href="/" className="text-sm text-slate-400 hover:text-indigo-600 transition-colors">
            ← Alle klanten
          </a>
          <select
            value={id}
            onChange={(e) => router.push(`/klant/${e.target.value}`)}
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

        {/* Deel 1: bestanden */}
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
                hint="Excel/CSV: rolnaam, FTE, uren/week, kosten/uur"
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
        </Section>

        {/* Deel 2: sector + vragen */}
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

        <button
          onClick={handleAnalyze}
          disabled={analyzing || !client.rosterFileName || client.profileFiles?.length === 0}
          className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:hover:bg-indigo-600 mb-8"
        >
          {analyzing ? "Analyseren... (kan even duren)" : "⚡ Analyseer"}
        </button>

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
                    const isOpen = expandedRole === r.rolnaam;
                    return (
                      <Fragment key={r.rolnaam}>
                        <tr
                          onClick={() => setExpandedRole(isOpen ? null : r.rolnaam)}
                          className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-indigo-50/50 transition-colors"
                        >
                          <td className="py-2 px-3 w-4 text-indigo-400">{isOpen ? "▾" : "▸"}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{r.rolnaam}</td>
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
                                <p className="text-xs text-slate-500 mb-2">
                                  {r.urenPerWeek} u/week, €{r.kostenPerUur}/uur — besparing/jaar realistisch €
                                  {Math.round(r.scenarios.realistisch.kostenBesparingPerJaar).toLocaleString("nl-NL")},
                                  agressief €
                                  {Math.round(r.scenarios.agressief.kostenBesparingPerJaar).toLocaleString("nl-NL")}
                                </p>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-slate-400 border-b border-slate-200">
                                      <th className="py-1 font-medium">Taak</th>
                                      <th className="py-1 font-medium">Categorie</th>
                                      <th className="py-1 font-medium">Aandeel</th>
                                      <th className="py-1 font-medium">Realistisch %</th>
                                      <th className="py-1 font-medium">Agressief %</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.scenarios.realistisch.taken.map((t, i) => (
                                      <tr key={i} className="border-b border-slate-100 last:border-0">
                                        <td className="py-1 pr-2">{t.omschrijving}</td>
                                        <td className="py-1 pr-2">
                                          <span className="inline-block rounded bg-indigo-100 text-indigo-700 px-1.5 py-0.5 text-[10px]">
                                            {t.categorieLabel}
                                          </span>
                                        </td>
                                        <td className="py-1 pr-2">{(t.aandeel * 100).toFixed(0)}%</td>
                                        <td className="py-1 pr-2">{(t.automatiseringspercentage * 100).toFixed(0)}%</td>
                                        <td className="py-1">
                                          {(r.scenarios.agressief.taken[i]?.automatiseringspercentage * 100).toFixed(0)}%
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>

                                {r.competenties?.length > 0 && (
                                  <>
                                    <p className="text-xs font-semibold text-slate-500 mt-4 mb-1">
                                      Competentieverschuiving (nu → na transformatie)
                                    </p>
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-left text-slate-400 border-b border-slate-200">
                                          <th className="py-1 font-medium">Competentie</th>
                                          <th className="py-1 font-medium w-16">Nu</th>
                                          <th className="py-1 font-medium w-16">Na</th>
                                          <th className="py-1 font-medium">Toelichting</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {r.competenties.map((c, i) => {
                                          const delta = c.belangNa - c.belangNu;
                                          const trendColor =
                                            delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-slate-400";
                                          const trendIcon = delta > 0 ? "▲" : delta < 0 ? "▼" : "＝";
                                          return (
                                            <tr key={i} className="border-b border-slate-100 last:border-0">
                                              <td className="py-1 pr-2 font-medium text-slate-700">{c.naam}</td>
                                              <td className="py-1 pr-2">{c.belangNu}/5</td>
                                              <td className={`py-1 pr-2 font-medium ${trendColor}`}>
                                                {trendIcon} {c.belangNa}/5
                                              </td>
                                              <td className="py-1 text-slate-500">{c.toelichting}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </>
                                )}
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
              return rollen.map((r) => <OrgChartRole key={r.rolnaam} rol={r} maxFte={maxFte} />);
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
      </main>
    </div>
  );
}
