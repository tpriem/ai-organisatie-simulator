"use client";

import { useState } from "react";
import { regelTekst } from "../../../../../src/logboek.js";

// Het logboek van de klant: wie deed wat en wanneer. Wordt pas opgehaald als de adviseur het opent.

const moment = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function Logboek({ id }) {
  const [regels, setRegels] = useState(null);
  const [fout, setFout] = useState(null);

  async function laad(open) {
    if (!open) return;
    setFout(null);
    try {
      const res = await fetch(`/api/clients/${id}/logboek`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Kon het logboek niet ophalen.");
      setRegels(body.regels ?? []);
    } catch (err) {
      setFout(err.message);
    }
  }

  return (
    <details className="mb-6 rounded-xl border border-slate-200 bg-card shadow-sm" onToggle={(e) => laad(e.currentTarget.open)}>
      <summary className="cursor-pointer list-none px-6 py-4 text-sm font-semibold text-slate-800">
        🗒 Logboek <span className="ml-1 text-xs font-normal text-slate-500">wie deed wat en wanneer</span>
      </summary>
      <div className="border-t border-slate-200 px-6 py-4">
        {fout && <p className="text-xs text-red-400">{fout}</p>}
        {!fout && regels === null && <p className="text-xs text-slate-500">Laden…</p>}
        {regels?.length === 0 && <p className="text-xs text-slate-500">Nog niets vastgelegd. Het logboek begint bij de eerstvolgende handeling.</p>}
        {regels?.length > 0 && (
          <ul className="max-h-80 space-y-1.5 overflow-y-auto">
            {regels.map((r, i) => (
              <li key={`${r.op}-${i}`} className="flex flex-wrap gap-x-3 text-xs text-slate-600">
                <span className="w-40 shrink-0 text-slate-500">{moment(r.op)}</span>
                <span className="min-w-0 flex-1 text-slate-700">{regelTekst(r)}</span>
                <span className="text-slate-500">{r.door ?? "onbekend"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
