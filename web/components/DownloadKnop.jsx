"use client";

import { useEffect, useRef, useState } from "react";

// Een downloadknop die laat zien wat er gebeurt. Een rapport of pdf wordt op het moment van klikken
// gemaakt en dat duurt een paar tellen; met een gewone link zie je in die tijd niets en ook niet dat
// het klaar is. Deze knop haalt het bestand zelf op, toont dat hij bezig is en wordt groen als het
// bestand is opgeslagen.
//
// Zonder JavaScript, of met de rechtermuisknop, blijft het een gewone link naar hetzelfde adres.

const KLAAR_MS = 4000;
const FOUT_MS = 6000;

// De kleuren van de toestanden staan als stijl op het element, zodat ze winnen van de kleurklassen
// van de knop (elke knop heeft zijn eigen kleur: limoen, donkerblauw, paars of wit).
const STIJL = {
  klaar: { backgroundColor: "#047857", borderColor: "#047857", color: "#ffffff" },
  fout: { backgroundColor: "#b91c1c", borderColor: "#b91c1c", color: "#ffffff" },
};

function bestandsnaam(res, terugval) {
  const kop = res.headers.get("content-disposition") ?? "";
  return kop.match(/filename="?([^";]+)"?/)?.[1] ?? terugval;
}

export default function DownloadKnop({ href, children, className = "", bezigTekst = "Wordt gemaakt…", klaarTekst = "✓ Gedownload", foutTekst = "Mislukt, probeer opnieuw", naam = "download" }) {
  const [toestand, setToestand] = useState("rust");
  const [melding, setMelding] = useState("");
  const klok = useRef(null);

  useEffect(() => () => clearTimeout(klok.current), []);

  const straksTerug = (ms) => {
    clearTimeout(klok.current);
    klok.current = setTimeout(() => setToestand("rust"), ms);
  };

  async function haalOp(e) {
    // Met een toets erbij (nieuw tabblad, opslaan als) doet de browser wat de gebruiker vraagt.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (toestand === "bezig") return;
    setToestand("bezig");
    setMelding("");
    try {
      const res = await fetch(href, { cache: "no-store" });
      if (!res.ok) {
        let uitleg = "";
        try {
          uitleg = (await res.clone().json()).error ?? "";
        } catch {
          uitleg = (await res.text()).slice(0, 200);
        }
        throw new Error(uitleg || `De server gaf een fout (${res.status}).`);
      }
      const blob = await res.blob();
      const adres = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = adres;
      link.download = bestandsnaam(res, naam);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(adres), 10000);
      setToestand("klaar");
      straksTerug(KLAAR_MS);
    } catch (err) {
      setMelding(err.message);
      setToestand("fout");
      straksTerug(FOUT_MS);
    }
  }

  const tekst = toestand === "bezig" ? bezigTekst : toestand === "klaar" ? klaarTekst : toestand === "fout" ? foutTekst : children;

  return (
    <a
      href={href}
      onClick={haalOp}
      aria-busy={toestand === "bezig"}
      title={toestand === "fout" ? melding : undefined}
      style={STIJL[toestand]}
      className={`${className} ${toestand === "bezig" ? "cursor-wait opacity-70" : ""}`}
    >
      {/* "contents": de inhoud doet zelf mee in de opmaak van de knop (bijvoorbeeld tekst links, pijl rechts). */}
      <span aria-live="polite" className="contents">
        {tekst}
      </span>
    </a>
  );
}
