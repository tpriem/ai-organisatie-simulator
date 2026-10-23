"use client";

import { useState } from "react";
import { conceptMail, MAIL_LIMIETEN } from "../../../../../src/mailLink.js";

// Een zojuist gemaakte link per mail naar de klant sturen. Er gaat nooit iets vanzelf de deur uit: de
// adviseur vult het adres in, past het concept aan en klikt zelf op Versturen. Het adres van de
// klant wordt nergens bewaard.

export default function LinkMailen({ klantId, url, soort, rol = "" }) {
  const [open, setOpen] = useState(false);
  const [laden, setLaden] = useState(false);
  const [info, setInfo] = useState(null); // { organisatie, afzender, beschikbaar }
  const [aan, setAan] = useState("");
  const [onderwerp, setOnderwerp] = useState("");
  const [tekst, setTekst] = useState("");
  const [kopie, setKopie] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const [verstuurdNaar, setVerstuurdNaar] = useState(null);

  async function openen() {
    setOpen(true);
    setFout(null);
    if (info) return;
    setLaden(true);
    try {
      const res = await fetch(`/api/clients/${klantId}/links/mail`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Kon de gegevens niet ophalen.");
      setInfo(d);
      const concept = conceptMail({ soort, organisatie: d.organisatie, rol });
      setOnderwerp(concept.onderwerp);
      setTekst(concept.tekst);
    } catch (e) {
      setFout(e.message);
    } finally {
      setLaden(false);
    }
  }

  async function verstuur(e) {
    e.preventDefault();
    if (bezig) return;
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch(`/api/clients/${klantId}/links/mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aan, onderwerp, tekst, url, kopie }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Versturen mislukt.");
      setVerstuurdNaar(aan.trim());
      setOpen(false);
      setAan("");
    } catch (err) {
      setFout(err.message);
    } finally {
      setBezig(false);
    }
  }

  const veld = "mt-0.5 block w-full rounded-md border border-slate-300 bg-card px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="mt-2">
      {verstuurdNaar && !open && (
        <p className="mb-1.5 text-[11px] text-emerald-700">
          Verstuurd naar {verstuurdNaar}.{info?.afzender && kopie ? ` Een kopie is naar ${info.afzender} gegaan.` : ""}
        </p>
      )}

      {!open && (
        <button type="button" onClick={openen} className="rounded-md border border-indigo-300 bg-card px-3 py-1 text-xs font-medium text-indigo-400 hover:bg-indigo-50">
          {verstuurdNaar ? "Nog een mail sturen" : "✉ Mail naar klant…"}
        </button>
      )}

      {open && (
        <form onSubmit={verstuur} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          {laden && <p className="text-xs text-slate-500">Concept ophalen…</p>}

          {info && !info.beschikbaar && (
            <p className="text-xs text-amber-700">E-mail versturen is nog niet ingesteld op deze omgeving (RESEND_API_KEY ontbreekt). Kopieer de link en verstuur hem zelf.</p>
          )}

          {info && info.beschikbaar && (
            <>
              <label className="block text-[11px] text-slate-500">
                Aan (één e-mailadres)
                <input type="email" required value={aan} onChange={(e) => setAan(e.target.value)} placeholder="naam@klant.nl" maxLength={MAIL_LIMIETEN.email} className={veld} autoComplete="off" />
              </label>
              <label className="mt-2 block text-[11px] text-slate-500">
                Onderwerp
                <input type="text" required value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} maxLength={MAIL_LIMIETEN.onderwerp} className={veld} />
              </label>
              <label className="mt-2 block text-[11px] text-slate-500">
                Bericht
                <textarea required rows={10} value={tekst} onChange={(e) => setTekst(e.target.value)} maxLength={MAIL_LIMIETEN.tekst} className={`${veld} leading-relaxed`} />
              </label>
              <p className="mt-1 text-[11px] text-slate-400">
                Onder het bericht komt automatisch een knop met de link, met de geldigheid. Antwoorden van de klant gaan naar {info.afzender ?? "jou"}.
              </p>
              <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                <input type="checkbox" checked={kopie} onChange={(e) => setKopie(e.target.checked)} />
                Stuur mij een kopie{info.afzender ? ` (${info.afzender})` : ""}
              </label>
            </>
          )}

          {fout && <p className="mt-2 text-xs text-red-400">{fout}</p>}

          <div className="mt-3 flex items-center gap-2">
            {info?.beschikbaar && (
              <button type="submit" disabled={bezig} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                {bezig ? "Versturen…" : "Versturen"}
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} disabled={bezig} className="text-xs text-slate-500 hover:text-slate-700 hover:underline">
              Annuleren
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
