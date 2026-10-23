"use client";

import { useCallback, useEffect, useState } from "react";
import LinkMailen from "./LinkMailen";

// Bij de input van een klant: een aanleverlink om de klant zelf zijn functieoverzicht en
// functieprofielen te laten uploaden, en de inbox met wat er is binnengekomen. De adviseur neemt
// bestanden over naar het echte roster of de profielen; een analyse start nooit vanzelf.

function formaat(bytes) {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

const datum = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso ?? "";
  }
};

export default function Aanlevering({ id, onOvergenomen }) {
  const [link, setLink] = useState(null); // de actieve aanleverlink, zonder geheim
  const [bestanden, setBestanden] = useState([]);
  const [nieuweUrl, setNieuweUrl] = useState(null);
  const [gekopieerd, setGekopieerd] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);

  // Haalt de actieve link en de inbox op. Geeft de gegevens terug in plaats van ze zelf te zetten,
  // zodat het ophalen vanuit een effect geen state synchroon aanpast.
  const haal = useCallback(async () => {
    try {
      const [l, i] = await Promise.all([
        fetch(`/api/clients/${id}/links`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/clients/${id}/inbox`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      return { link: (l.links ?? []).filter((x) => x.type === "aanlever" && x.actief).pop() ?? null, bestanden: i.bestanden ?? [] };
    } catch {
      return null;
    }
  }, [id]);

  const laad = useCallback(async () => {
    const d = await haal();
    if (d) {
      setLink(d.link);
      setBestanden(d.bestanden);
    }
  }, [haal]);

  useEffect(() => {
    let leeft = true;
    const ververs = () =>
      haal().then((d) => {
        if (leeft && d) {
          setLink(d.link);
          setBestanden(d.bestanden);
        }
      });
    ververs();
    const opFocus = () => document.visibilityState === "visible" && ververs();
    document.addEventListener("visibilitychange", opFocus);
    const tik = setInterval(() => document.visibilityState === "visible" && ververs(), 60_000);
    return () => {
      leeft = false;
      document.removeEventListener("visibilitychange", opFocus);
      clearInterval(tik);
    };
  }, [haal]);

  async function aanroep(url, opties) {
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opties });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setFout(body.error ?? "Dat is niet gelukt.");
      return res.ok ? body : null;
    } finally {
      setBezig(false);
    }
  }

  async function maakLink() {
    const uit = await aanroep(`/api/clients/${id}/links`, { method: "POST", body: JSON.stringify({ type: "aanlever" }) });
    if (uit?.url) {
      setNieuweUrl(uit.url);
      setGekopieerd(false);
    }
    await laad();
  }

  async function trekIn() {
    await aanroep(`/api/clients/${id}/links`, { method: "DELETE", body: JSON.stringify({ linkId: link.id }) });
    setNieuweUrl(null);
    await laad();
  }

  async function overnemen(b) {
    const uit = await aanroep(`/api/clients/${id}/inbox`, { method: "POST", body: JSON.stringify({ soort: b.soort, naam: b.naam }) });
    await laad();
    if (uit) onOvergenomen?.();
  }

  async function verwijder(b) {
    await aanroep(`/api/clients/${id}/inbox`, { method: "DELETE", body: JSON.stringify({ soort: b.soort, naam: b.naam }) });
    await laad();
  }

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(nieuweUrl);
      setGekopieerd(true);
    } catch {
      setGekopieerd(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-card p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-base">🔗</span>
          Klant laten aanleveren
        </h2>
        <button
          type="button"
          onClick={maakLink}
          disabled={bezig}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {link ? "Nieuwe link maken" : "Aanleverlink maken"}
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Stuur de klant een link om zelf het functieoverzicht en de functieprofielen te uploaden. De bestanden komen hieronder binnen; jij controleert ze en neemt ze over. De analyse
        start nooit vanzelf.
      </p>

      {fout && <p className="mb-2 text-xs text-red-400">{fout}</p>}

      {nieuweUrl && (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-xs font-medium text-emerald-800">Aanleverlink</p>
          <div className="mt-1 flex items-center gap-2">
            <input readOnly value={nieuweUrl} onFocus={(e) => e.target.select()} className="w-full rounded border border-emerald-200 bg-card px-2 py-1 text-xs text-slate-700" />
            <button type="button" onClick={kopieer} className="shrink-0 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500">
              {gekopieerd ? "Gekopieerd" : "Kopieer"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-emerald-800">Deze link wordt maar één keer getoond. Een nieuwe link vervangt de vorige.</p>
          <LinkMailen key={nieuweUrl} klantId={id} url={nieuweUrl} soort="aanlever" />
        </div>
      )}

      {link ? (
        <p className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <span>
            Actieve link, aangemaakt {datum(link.aangemaaktOp)}, geldig tot {datum(link.verlooptOp)}.
          </span>
          <button type="button" onClick={trekIn} disabled={bezig} className="text-slate-400 hover:text-red-400 hover:underline">
            Intrekken
          </button>
        </p>
      ) : (
        <p className="mb-3 text-[11px] text-slate-400">Er is geen actieve aanleverlink.</p>
      )}

      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-400">Aangeleverd door de klant ({bestanden.length})</h3>
      {bestanden.length === 0 ? (
        <p className="text-xs text-slate-400">Nog niets binnengekomen.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {bestanden.map((b) => (
            <li key={`${b.soort}/${b.naam}`} className="flex items-center justify-between gap-3 py-1.5 text-xs">
              <span className="min-w-0 truncate text-slate-700">
                <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{b.soort === "roster" ? "functieoverzicht" : "functieprofiel"}</span>
                {b.naam}
              </span>
              <span className="flex shrink-0 items-center gap-3 text-slate-400">
                {formaat(b.grootte)}
                <button type="button" onClick={() => overnemen(b)} disabled={bezig} className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-500/20 disabled:opacity-50">
                  Overnemen
                </button>
                <button type="button" onClick={() => verwijder(b)} disabled={bezig} className="text-slate-500 hover:text-red-400 hover:underline">
                  Verwijderen
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {bestanden.some((b) => b.soort === "roster") && (
        <p className="mt-2 text-[11px] text-amber-700">Een functieoverzicht overnemen vervangt het roster dat nu bij deze klant staat.</p>
      )}
    </section>
  );
}
