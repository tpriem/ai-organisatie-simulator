"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ASSEN, ANTWOORDEN } from "../../../../src/volwassenheid.js";
import HodLogo from "@/components/HodLogo";

// De pagina die een invuller via zijn persoonlijke link ziet. Alleen de vragen: geen resultaten,
// geen andere gegevens. Antwoorden worden direct opgeslagen; "Versturen" markeert ze als klaar.

const TOTAAL = ASSEN.reduce((s, a) => s + a.themas.reduce((t, th) => t + th.stellingen.length, 0), 0);

function datum(iso) {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function Antwoordknoppen({ stelling, waarde, onZet }) {
  return (
    <div className="flex flex-wrap gap-1.5 sm:w-[18.2rem] sm:shrink-0 sm:justify-end" role="radiogroup" aria-label={stelling.tekst}>
      {ANTWOORDEN.map((a) => (
        <button
          key={a.waarde}
          type="button"
          role="radio"
          aria-checked={waarde === a.waarde}
          onClick={() => onZet(stelling.id, waarde === a.waarde ? null : a.waarde)}
          className={`min-w-[4.2rem] rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            waarde === a.waarde
              ? a.waarde === "ja"
                ? "border-emerald-600 bg-emerald-600 text-white"
                : a.waarde === "nee"
                  ? "border-red-500 bg-red-500 text-white"
                  : a.waarde === "deels"
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-slate-400 bg-slate-400 text-page"
              : "border-slate-300 bg-card text-slate-600 hover:border-indigo-300 hover:text-indigo-400"
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

export default function Invullen({ token }) {
  const [fase, setFase] = useState("laden"); // laden | ongeldig | klaar
  const [info, setInfo] = useState(null);
  const [antwoorden, setAntwoorden] = useState({});
  const [status, setStatus] = useState("nieuw");
  const [opslaan, setOpslaan] = useState("");
  const [vraagBevestiging, setVraagBevestiging] = useState(false);
  const [geopend, setGeopend] = useState(null);
  const laatste = useRef({});
  const timer = useRef(null);
  const wacht = useRef(false);
  const url = `/api/invullen/${encodeURIComponent(token)}`;

  useEffect(() => {
    let leeft = true;
    fetch(url, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        if (!leeft) return;
        setInfo(d);
        laatste.current = d.antwoorden ?? {};
        setAntwoorden(d.antwoorden ?? {});
        setStatus(d.status);
        setFase("klaar");
      })
      .catch(() => leeft && setFase("ongeldig"));
    return () => {
      leeft = false;
    };
  }, [url]);

  const stuur = useCallback(
    async (nieuweStatus, antw) => {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ antwoorden: antw, status: nieuweStatus }),
        keepalive: true,
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    [url]
  );

  function zet(stellingId, waarde) {
    const volgende = { ...laatste.current };
    if (waarde === null) delete volgende[stellingId];
    else volgende[stellingId] = waarde;
    laatste.current = volgende;
    setAntwoorden(volgende);
    setOpslaan("Opslaan…");
    wacht.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await stuur("bezig", laatste.current);
        wacht.current = false;
        setOpslaan("Opgeslagen");
      } catch {
        setOpslaan("Opslaan mislukt, probeer het opnieuw");
      }
    }, 800);
  }

  // Sluit de gebruiker de pagina terwijl er nog iets wacht, dan toch opslaan.
  useEffect(() => {
    const flush = () => {
      if (wacht.current) {
        clearTimeout(timer.current);
        stuur("bezig", laatste.current).catch(() => {});
      }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [stuur]);

  const beantwoord = useMemo(() => Object.keys(antwoorden).length, [antwoorden]);

  async function versturen() {
    setOpslaan("Versturen…");
    clearTimeout(timer.current);
    try {
      const uit = await stuur("ingediend", laatste.current);
      wacht.current = false;
      setStatus(uit.status);
      setInfo((i) => ({ ...i, ingediendOp: uit.bijgewerktOp }));
      setOpslaan("");
      setVraagBevestiging(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setOpslaan("Versturen mislukt, probeer het opnieuw");
    }
  }

  if (fase === "laden") return <Omhulsel><p className="py-16 text-center text-slate-500">Laden…</p></Omhulsel>;
  if (fase === "ongeldig") {
    return (
      <Omhulsel>
        <div className="rounded-xl border border-slate-200 bg-card p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Deze link is niet (meer) geldig</h1>
          <p className="mt-2 text-sm text-slate-600">
            De link is verlopen of ingetrokken, of niet goed overgenomen. Vraag uw contactpersoon bij House of Digital om een nieuwe link.
          </p>
        </div>
      </Omhulsel>
    );
  }

  const ingediend = status === "ingediend";
  const onbeantwoord = TOTAAL - beantwoord;

  return (
    <Omhulsel>
      {ingediend && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-base font-semibold text-emerald-800">Bedankt, uw antwoorden zijn verstuurd.</p>
          <p className="mt-1 text-sm text-emerald-800">
            U hoeft verder niets te doen. Wilt u iets aanpassen, dan kan dat nog tot {datum(info.verlooptOp)}: wijzigingen worden direct opgeslagen.
          </p>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-slate-200 bg-card p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">AI-volwassenheid van {info.organisatie}</h1>
        <p className="mt-1 text-sm text-slate-500">
          U vult in als <span className="font-medium text-slate-700">{info.rolNaam}</span>
          {info.label ? ` (${info.label})` : ""}.
        </p>
        <div className="mt-4 space-y-2 text-sm leading-relaxed text-slate-600">
          <p>
            Deze vragenlijst geeft een eerste beeld van hoe ver {info.organisatie} is met het inzetten van AI. Het zijn {TOTAAL} stellingen in acht onderdelen; reken op
            ongeveer 30 tot 45 minuten. U kunt tussendoor stoppen: uw antwoorden worden steeds bewaard en u gaat verder met dezelfde link.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium">Ja</span>: het klopt grotendeels. <span className="font-medium">Deels</span>: er wordt aan gewerkt of het geldt voor een deel.{" "}
              <span className="font-medium">Nee</span>: het is er niet. <span className="font-medium">N.v.t.</span>: de stelling is voor deze organisatie niet van toepassing.
            </li>
            <li>Weet u het niet? Laat de stelling dan leeg. Antwoord naar eigen inzicht en zo eerlijk mogelijk: er zijn geen goede of foute antwoorden.</li>
            <li>De antwoorden worden per rol verwerkt en niet per persoon getoond.</li>
          </ul>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {beantwoord} van {TOTAAL} beantwoord
            </span>
            <span aria-live="polite">{opslaan}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100" aria-hidden="true">
            <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${(beantwoord / TOTAAL) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {ASSEN.map((as) => {
          const aantal = as.themas.reduce((s, t) => s + t.stellingen.filter((st) => antwoorden[st.id]).length, 0);
          const totaal = as.themas.reduce((s, t) => s + t.stellingen.length, 0);
          const klaar = aantal === totaal;
          return (
            <details key={as.id} open={geopend === as.id} onToggle={(e) => e.currentTarget.open && setGeopend(as.id)} className="group rounded-xl border border-slate-200 bg-card shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-base font-semibold text-slate-900">{as.naam}</p>
                  <p className="text-sm text-slate-500">{as.beschrijving}</p>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-sm text-slate-500">
                  {aantal}/{totaal}
                  {klaar && (
                    <span role="img" aria-label="Alles beantwoord" className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                      ✓
                    </span>
                  )}
                  <span aria-hidden="true" className="text-slate-400 transition-transform group-open:rotate-90">
                    ▶
                  </span>
                </span>
              </summary>
              <div className="border-t border-slate-100 px-5 py-4">
                {as.themas.map((th) => (
                  <div key={th.id} className="mb-5 last:mb-0">
                    <h2 className="text-sm font-semibold text-indigo-700">{th.naam}</h2>
                    <p className="mb-2 text-xs text-slate-500">{th.beschrijving}</p>
                    <ul className="divide-y divide-slate-100">
                      {th.stellingen.map((st) => (
                        <li key={st.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <p className="text-sm text-slate-800">{st.tekst}</p>
                          <Antwoordknoppen stelling={st} waarde={antwoorden[st.id] ?? null} onZet={zet} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <div className="my-8 rounded-xl border border-slate-200 bg-card p-6 shadow-sm">
        {vraagBevestiging ? (
          <div>
            <p className="text-sm text-slate-700">
              U heeft nog {onbeantwoord} {onbeantwoord === 1 ? "stelling" : "stellingen"} niet beantwoord. Een lege stelling telt voor uw antwoord niet mee. Toch versturen?
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={versturen} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                Ja, versturen
              </button>
              <button onClick={() => setVraagBevestiging(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Terug naar de vragen
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {ingediend ? "Uw antwoorden zijn verstuurd. U kunt ze nog aanpassen en opnieuw versturen." : "Klaar? Verstuur uw antwoorden."}
            </p>
            <button
              onClick={() => (onbeantwoord > 0 ? setVraagBevestiging(true) : versturen())}
              disabled={beantwoord === 0}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40"
            >
              {ingediend ? "Opnieuw versturen" : "Versturen"}
            </button>
          </div>
        )}
      </div>
    </Omhulsel>
  );
}

function Omhulsel({ children }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <HodLogo className="h-5" />
          <span className="text-xs text-slate-500">AI-volwassenheidsscan</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
    </div>
  );
}
