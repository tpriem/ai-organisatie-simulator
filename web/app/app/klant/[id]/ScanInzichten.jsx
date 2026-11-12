"use client";

import { totaalbeeld, organisatieEnSystemen, sterkePunten, bijnaZover, sectorBeeld, stappenplan, onderdeelBeeld } from "../../../../../src/scanInzichten.js";
import { standZin, conclusies, waaromZin, organisatieSystemenZin, opsomming, eindpunt, klein, meervoud, zijn, rolNaam } from "../../../../../src/scanTeksten.js";

// De inzichten van de volwassenheidsscan op het scherm van de adviseur, in dezelfde opbouw en met
// dezelfde zinnen als het rapport voor de klant (src/rapportVolwassenheid.js): de conclusie eerst,
// dan wat het beeld laat zien, de aanpak in drie stappen en de verdieping per onderdeel.

function Kaart({ titel, uitleg, children }) {
  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-card p-4 shadow-sm sm:p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-800">{titel}</h2>
      {uitleg && <p className="mb-3 text-xs text-slate-500">{uitleg}</p>}
      {children}
    </div>
  );
}

function Deel({ titel, uitleg, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-400">{titel}</h3>
      {uitleg && <p className="mb-1.5 text-xs text-slate-500">{uitleg}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

// Zoveel thema's toont "Bijna zover" voluit; de rest staat er bij naam onder.
const MAX_BIJNA = 8;

const Deels = () => <span className="ml-1.5 whitespace-nowrap rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">al deels gedaan</span>;

/** De openingszin en de belangrijkste conclusies, boven het profiel. */
export function InHetKort({ analyse, klantNaam }) {
  const beeld = totaalbeeld(analyse.profiel);
  const punten = conclusies(analyse);
  return (
    <div className="mb-4 rounded-r-xl border-l-4 border-flow-lime bg-slate-50 px-4 py-3">
      <p className="mb-2 text-sm font-semibold leading-snug text-slate-800">{standZin(beeld, klantNaam || "De organisatie")}</p>
      <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-slate-700">
        {punten.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ol>
    </div>
  );
}

/** Patronen die niet in één niveau zitten. */
export function Beeld({ analyse }) {
  const { profiel } = analyse;
  const os = organisatieEnSystemen(profiel);
  const sterk = sterkePunten(profiel);
  const bijna = bijnaZover(profiel);
  const sector = sectorBeeld(profiel);
  if (!os && sterk.length === 0 && bijna.length === 0 && sector.length === 0) return null;
  return (
    <Kaart titel="Wat het beeld laat zien" uitleg="Wat er al staat, wat bijna af is en hoe de thema's voor corporaties ervoor staan.">
      <div className="space-y-5">
        {os && (
          <Deel titel="Organisatie en systemen">
            <p className="text-xs leading-relaxed text-slate-700">{organisatieSystemenZin(os)}</p>
          </Deel>
        )}
        {sterk.length > 0 && (
          <Deel titel="Wat er al staat" uitleg="De thema's waar de organisatie het verst is. Hier kan op worden voortgebouwd.">
            <ul className="space-y-1.5">
              {sterk.map((s) => (
                <li key={s.thema} className="text-xs leading-relaxed text-slate-700">
                  <span className="font-medium text-slate-800">{s.naam}</span>{" "}
                  <span className="text-slate-500">
                    ({s.asNaam}, niveau {s.niveau})
                  </span>
                  : {s.tekst}
                </li>
              ))}
            </ul>
          </Deel>
        )}
        {bijna.length > 0 && (
          <Deel
            titel={`Bijna zover (${bijna.length})`}
            uitleg="Bij deze thema's is de eerstvolgende stap al deels gezet. Afmaken brengt het thema een niveau hoger en kost de minste inspanning."
          >
            <ul className="space-y-1.5">
              {bijna.slice(0, MAX_BIJNA).map((b) => (
                <li key={b.thema} className="text-xs leading-relaxed text-slate-700">
                  <span className="font-medium text-slate-800">{b.naam}</span>{" "}
                  <span className="text-slate-500">
                    ({b.asNaam}), naar niveau {b.naarNiveau}
                  </span>
                  : {b.tekst}
                </li>
              ))}
            </ul>
            {bijna.length > MAX_BIJNA && (
              <p className="mt-1.5 text-xs text-slate-500">
                En nog {bijna.length - MAX_BIJNA}: {opsomming(bijna.slice(MAX_BIJNA).map((b) => b.naam))}.
              </p>
            )}
          </Deel>
        )}
        {sector.length > 0 && (
          <Deel titel="Specifiek voor corporaties" uitleg="De gegevens van huurders, het toezicht en de maatschappelijke opdracht.">
            <ul className="space-y-1.5">
              {sector.map((s) => (
                <li key={s.thema} className="text-xs leading-relaxed text-slate-700">
                  <span className="font-medium text-slate-800">{s.naam}</span>{" "}
                  <span className="text-slate-500">
                    niveau {s.niveau}, doel {s.doel}
                  </span>
                  : {s.stap ? s.stap.tekst : "Alle niveaus zijn gehaald."}
                  {s.stap?.deels && <Deels />}
                </li>
              ))}
            </ul>
          </Deel>
        )}
      </div>
    </Kaart>
  );
}

/** De aanpak in drie stappen, met de volledige volgorde eronder voor wie alles wil zien. */
export function Aanpak({ analyse }) {
  const plan = stappenplan(analyse);
  if (plan.totaal === 0) return null;
  return (
    <Kaart
      titel="Wat nu: de aanpak in drie stappen"
      uitleg="De aanpak begint bij wat iets anders tegenhoudt: een voorwaarde om de vrijkomende tijd te benutten, of een thema dat eerst op orde moet zijn voordat een ander thema zin heeft. Daarna volgen de grootste afstanden tot het doel."
    >
      <div className="space-y-5">
        <Deel titel="Stap 1: nu beginnen">
          <ol className="space-y-3">
            {plan.nu.map((i, n) => (
              <li key={i.thema} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{n + 1}</span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">{i.naam}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {i.asNaam} · niveau {i.niveau} → {i.doel}
                    </span>
                  </p>
                  <p className="text-xs leading-relaxed text-amber-800">{eindpunt(waaromZin(i.waarom))}</p>
                  {i.stap && (
                    <p className="text-xs leading-relaxed text-slate-700">
                      De eerste stap is gezet als geldt: {i.stap.tekst}
                      {i.stap.deels && <Deels />}
                    </p>
                  )}
                  {i.stap?.voorbeelden.length > 0 && <p className="text-xs text-slate-500">Dat is te zien aan: {opsomming(i.stap.voorbeelden)}.</p>}
                </div>
              </li>
            ))}
          </ol>
        </Deel>
        {plan.daarna.length > 0 && (
          <Deel titel="Stap 2: daarna" uitleg="De overige thema's met een afstand van twee niveaus of meer tot het doel.">
            <ul className="space-y-1.5">
              {plan.daarna.map((i) => (
                <li key={i.thema} className="text-xs leading-relaxed text-slate-700">
                  <span className="font-medium text-slate-800">{i.naam}</span>{" "}
                  <span className="text-slate-500">
                    ({i.asNaam}), niveau {i.niveau} → {i.doel}
                  </span>
                  {i.stap ? `: ${i.stap.tekst}` : ""}
                </li>
              ))}
            </ul>
          </Deel>
        )}
        {plan.later.length > 0 && (
          <Deel titel="Stap 3: later">
            <p className="text-xs leading-relaxed text-slate-700">
              {meervoud(plan.later.length, "thema", "thema's")} met een kleinere afstand tot het doel of een latere plek in de volgorde:{" "}
              {opsomming(plan.later.map((i) => i.naam))}.
            </p>
          </Deel>
        )}
        <details>
          <summary className="cursor-pointer text-xs font-medium text-indigo-400 hover:underline">Alle {analyse.volgorde.length} thema&apos;s in volgorde van aanpak</summary>
          <ol className="mt-2 space-y-2">
            {analyse.volgorde.map((i) => (
              <li key={i.thema} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-400">{i.volgorde}</span>
                <div className="min-w-0">
                  <p className="text-xs text-slate-800">
                    <span className="font-medium">{i.naam}</span>
                    <span className="ml-2 text-slate-500">
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
        </details>
      </div>
    </Kaart>
  );
}

const STAND_KLEUR = {
  "nog niet": "bg-slate-100 text-slate-600",
  "deels gedaan": "bg-emerald-50 text-emerald-700",
  "alle niveaus gehaald": "bg-indigo-50 text-indigo-700",
  "niet gemeten": "bg-slate-100 text-slate-400",
};

/** Per onderdeel dezelfde vaste opbouw als in het rapport. Dichtgeklapt, zodat het scherm overzichtelijk blijft. */
export function PerOnderdeel({ analyse, onOpen }) {
  const gemeten = analyse.profiel.assen.filter((a) => a.gemeten);
  if (gemeten.length === 0) return null;
  return (
    <Kaart titel="Per onderdeel" uitleg="Waar het over gaat, wat er al is, wat het niveau bepaalt en de eerstvolgende stap per thema. Klik op een onderdeel om het te openen.">
      <div className="space-y-2">
        {gemeten.map((a) => {
          const o = onderdeelBeeld(a, analyse);
          const redenen = [
            ...o.voorwaarden
              .filter((v) => v.scenario === "realistisch")
              .map((v) => `${v.naam} is een voorwaarde om de vrijkomende tijd te benutten (nodig: niveau ${v.vereist}, nu: ${v.huidig === null ? "niet gemeten" : `niveau ${v.huidig}`}).`),
            ...o.nodigVoor.map((n) => `${n.naam} moet eerst op orde zijn voor ${n.voorNaam}: ${klein(n.reden.charAt(0))}${n.reden.slice(1)}`),
          ];
          return (
            <details key={a.id} className="group rounded-lg border border-slate-200 open:bg-slate-50/60">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5">
                <span className="text-sm font-medium text-slate-800">{a.naam}</span>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  niveau {a.niveau} ({klein(a.niveauNaam)}), doel {a.doel}
                  <span aria-hidden="true" className="text-slate-400 transition-transform group-open:rotate-90">
                    ▶
                  </span>
                </span>
              </summary>
              <div className="space-y-3 border-t border-slate-200 px-4 py-3">
                <Deel titel="Waar het over gaat">
                  <p className="text-xs leading-relaxed text-slate-700">{a.beschrijving}</p>
                </Deel>
                <Deel titel="Wat er al is">
                  {o.watErAlIs.length === 0 ? (
                    <p className="text-xs text-slate-700">Op dit onderdeel is nog geen thema voorbij de start.</p>
                  ) : (
                    <ul className="space-y-1">
                      {o.watErAlIs.map((w) => (
                        <li key={w.thema} className="text-xs leading-relaxed text-slate-700">
                          <span className="font-medium text-slate-800">{w.naam}</span> <span className="text-slate-500">(niveau {w.niveau})</span>: {w.tekst}
                        </li>
                      ))}
                    </ul>
                  )}
                </Deel>
                <Deel titel="Wat het niveau bepaalt">
                  <p className="mb-2 text-xs leading-relaxed text-slate-700">
                    {a.gat === 0 ? "Het doel is gehaald. " : ""}Het niveau van een onderdeel is dat van het zwakste thema; hier {zijn(o.bepalend.length)} dat{" "}
                    {opsomming(o.bepalend)}.
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-card">
                    <table className="w-full min-w-[30rem] text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="px-3 py-1.5 font-medium">Thema</th>
                          <th className="px-3 py-1.5 font-medium">Niveau</th>
                          <th className="px-3 py-1.5 font-medium">Eerstvolgende stap</th>
                          <th className="px-3 py-1.5 font-medium">Stand</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.themas.map((t) => (
                          <tr key={t.naam} className="border-t border-slate-100 align-top">
                            <td className={`px-3 py-1.5 ${t.bepaaltNiveau ? "font-semibold text-slate-800" : "text-slate-700"}`}>{t.naam}</td>
                            <td className="px-3 py-1.5 text-slate-700">{t.gemeten ? t.niveau : "niet gemeten"}</td>
                            <td className="px-3 py-1.5 leading-relaxed text-slate-700">{t.stap ? `Niveau ${t.stap.niveau}: ${t.stap.tekst}` : "Geen: alle niveaus zijn gehaald."}</td>
                            <td className="px-3 py-1.5">
                              <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${STAND_KLEUR[t.stand]}`}>{t.stand}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Deel>
                {o.tegenspraken.length > 0 && (
                  <Deel titel="Waar rollen het anders zien">
                    <p className="text-xs leading-relaxed text-slate-700">
                      Over {meervoud(o.tegenspraken.length, "stelling", "stellingen")} zegt de ene rol ja en de andere nee. Bijvoorbeeld bij {o.tegenspraken[0].thema}:
                      &ldquo;{o.tegenspraken[0].tekst}&rdquo; {opsomming(o.tegenspraken[0].rollenJa.map(rolNaam))} zegt ja,{" "}
                      {opsomming(o.tegenspraken[0].rollenNee.map(rolNaam))} zegt nee.
                    </p>
                  </Deel>
                )}
                {redenen.length > 0 && (
                  <Deel titel="Waarom dit telt">
                    <p className="text-xs leading-relaxed text-slate-700">{[...new Set(redenen)].slice(0, 3).join(" ")}</p>
                  </Deel>
                )}
                <button type="button" onClick={() => onOpen(a.id)} className="text-xs font-medium text-indigo-400 hover:underline">
                  Open de vragen van dit onderdeel
                </button>
              </div>
            </details>
          );
        })}
      </div>
    </Kaart>
  );
}
