"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// De pagina waar een klant via de aanleverlink zijn functieoverzicht en functieprofielen uploadt.
// De bestanden komen in een inbox; de adviseur controleert ze en start de analyse zelf.

const PRIVACY_URL = process.env.NEXT_PUBLIC_PRIVACY_URL;

function formaat(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

function datum(iso) {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function Aanleveren({ token }) {
  const [fase, setFase] = useState("laden"); // laden | ongeldig | klaar
  const [info, setInfo] = useState(null);
  const [meldingen, setMeldingen] = useState([]); // uitkomst per verstuurd bestand
  const [bezig, setBezig] = useState(false);
  const rosterRef = useRef(null);
  const profielRef = useRef(null);
  const url = `/api/aanleveren/${encodeURIComponent(token)}`;

  const laad = useCallback(async () => {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error();
    return r.json();
  }, [url]);

  useEffect(() => {
    let leeft = true;
    laad()
      .then((d) => {
        if (!leeft) return;
        setInfo(d);
        setFase("klaar");
      })
      .catch(() => leeft && setFase("ongeldig"));
    return () => {
      leeft = false;
    };
  }, [laad]);

  async function verstuur(soort, bestanden) {
    if (!bestanden?.length) return;
    setBezig(true);
    const uitkomsten = [];
    // Eén bestand per aanvraag: de aanvraaggrens van het platform geldt per aanvraag.
    for (const bestand of bestanden) {
      const form = new FormData();
      form.set("soort", soort);
      form.set("file", bestand);
      try {
        const res = await fetch(url, { method: "POST", body: form });
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          uitkomsten.push({ naam: bestand.name, ok: true, tekst: soort === "roster" && body.rijen != null ? `Ontvangen, ${body.rijen} functies gevonden` : "Ontvangen" });
        } else {
          uitkomsten.push({ naam: bestand.name, ok: false, tekst: body.error ?? "Versturen mislukt" });
        }
      } catch {
        uitkomsten.push({ naam: bestand.name, ok: false, tekst: "Versturen mislukt, controleer uw verbinding" });
      }
    }
    setMeldingen((m) => [...uitkomsten, ...m].slice(0, 12));
    try {
      setInfo(await laad());
    } catch {
      /* de lijst blijft zoals hij was */
    }
    setBezig(false);
    if (rosterRef.current) rosterRef.current.value = "";
    if (profielRef.current) profielRef.current.value = "";
  }

  async function verwijder(bestand) {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soort: bestand.soort, naam: bestand.naam }),
    });
    if (res.ok) setInfo(await laad());
  }

  if (fase === "laden") return <Omhulsel><p className="py-16 text-center text-slate-500">Laden…</p></Omhulsel>;
  if (fase === "ongeldig") {
    return (
      <Omhulsel>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Deze link is niet (meer) geldig</h1>
          <p className="mt-2 text-sm text-slate-600">
            De link is verlopen of ingetrokken, of niet goed overgenomen. Vraag uw contactpersoon bij House of Digital om een nieuwe link.
          </p>
        </div>
      </Omhulsel>
    );
  }

  const roster = info.bestanden.filter((b) => b.soort === "roster");
  const profielen = info.bestanden.filter((b) => b.soort === "profiel");
  const toegestaan = (soort) => info.soorten[soort].extensies.join(", ");

  return (
    <Omhulsel>
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Gegevens aanleveren voor {info.organisatie}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Voor de analyse hebben wij twee dingen nodig: een overzicht van de functies in uw organisatie en de bijbehorende functieprofielen. Wij controleren uw bestanden voordat de
          analyse start. Deze link blijft geldig tot {datum(info.verlooptOp)}.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Wij vragen <span className="font-medium">geen gegevens van individuele medewerkers</span>. Gebruik in de bestanden dus geen namen van personen.
          {PRIVACY_URL && (
            <>
              {" "}
              <a href={PRIVACY_URL} className="text-indigo-600 underline" target="_blank" rel="noreferrer">
                Lees hoe wij met gegevens omgaan
              </a>
              .
            </>
          )}
        </p>
      </div>

      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">1. Functieoverzicht</h2>
        <p className="mt-1 text-sm text-slate-600">
          Een Excel- of CSV-bestand met per functie het aantal FTE, de uren per week en de kosten per uur (kolommen: rolnaam, fte, uren_per_week, kosten_per_uur; optioneel afdeling en
          rapporteert_aan).{" "}
          <a href="/api/roster-template" className="text-indigo-600 underline">
            Download het sjabloon
          </a>
          .
        </p>
        <label className="mt-3 block">
          <span className="sr-only">Functieoverzicht kiezen</span>
          <input
            ref={rosterRef}
            type="file"
            accept={toegestaan("roster")}
            disabled={bezig}
            onChange={(e) => verstuur("roster", [...e.target.files])}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-500 disabled:opacity-50"
          />
        </label>
        <p className="mt-1 text-xs text-slate-400">Toegestaan: {toegestaan("roster")}, maximaal {info.maxMB} MB. Een eerder aangeleverd functieoverzicht wordt vervangen.</p>
      </section>

      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">2. Functieprofielen</h2>
        <p className="mt-1 text-sm text-slate-600">
          Eén bestand per functie, met een naam die overeenkomt met de functie in het overzicht. U kunt meerdere bestanden tegelijk kiezen.
        </p>
        <label className="mt-3 block">
          <span className="sr-only">Functieprofielen kiezen</span>
          <input
            ref={profielRef}
            type="file"
            multiple
            accept={toegestaan("profiel")}
            disabled={bezig}
            onChange={(e) => verstuur("profiel", [...e.target.files])}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-500 disabled:opacity-50"
          />
        </label>
        <p className="mt-1 text-xs text-slate-400">Toegestaan: {toegestaan("profiel")}, maximaal {info.maxMB} MB per bestand.</p>
      </section>

      {bezig && <p className="mb-4 text-sm text-slate-500" aria-live="polite">Bezig met versturen…</p>}

      {meldingen.length > 0 && (
        <ul className="mb-5 space-y-1.5" aria-live="polite">
          {meldingen.map((m, i) => (
            <li key={i} className={`rounded-lg px-3 py-2 text-sm ${m.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
              <span className="font-medium">{m.naam}</span>: {m.tekst}
            </li>
          ))}
        </ul>
      )}

      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Aangeleverd</h2>
        {info.bestanden.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nog niets aangeleverd.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {[
              ["Functieoverzicht", roster],
              ["Functieprofielen", profielen],
            ].map(([titel, lijst]) =>
              lijst.length === 0 ? null : (
                <div key={titel}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {titel} ({lijst.length})
                  </p>
                  <ul className="divide-y divide-slate-100">
                    {lijst.map((b) => (
                      <li key={`${b.soort}/${b.naam}`} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                        <span className="min-w-0 truncate text-slate-700">{b.naam}</span>
                        <span className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
                          {b.grootte ? formaat(b.grootte) : ""}
                          <button onClick={() => verwijder(b)} className="text-slate-500 hover:text-red-600 hover:underline">
                            Verwijderen
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </Omhulsel>
  );
}

function Omhulsel({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <span className="text-sm font-semibold text-slate-900">House of Digital</span>
          <span className="text-xs text-slate-500">AI Organisatie Transformatie Simulator</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
    </div>
  );
}
