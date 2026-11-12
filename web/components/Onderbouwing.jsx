import { opmaak } from "../../src/onderbouwing.js";

// Toont de blokken van het document "Werking en onderbouwing" (src/onderbouwing.js) in de huisstijl.

function Tekst({ children }) {
  return opmaak(children).map((d, i) =>
    d.soort === "vet" ? (
      <strong key={i} className="font-semibold text-white">
        {d.tekst}
      </strong>
    ) : d.soort === "link" ? (
      <a
        key={i}
        href={d.href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-hod-lilac underline decoration-hod-lilac/50 underline-offset-2 hover:decoration-hod-lilac"
      >
        {d.tekst}
      </a>
    ) : (
      <span key={i}>{d.tekst}</span>
    )
  );
}

function Blok({ blok }) {
  switch (blok.soort) {
    case "p":
      return (
        <p className="leading-relaxed">
          <Tekst>{blok.tekst}</Tekst>
        </p>
      );
    case "kop":
      return <h3 className="pt-3 text-lg font-bold text-hod-lilac">{blok.tekst}</h3>;
    case "kader":
      return (
        <p className="rounded-r-2xl border-l-4 border-hod-violet bg-white/5 px-5 py-4 text-lg font-medium leading-relaxed text-white">
          <Tekst>{blok.tekst}</Tekst>
        </p>
      );
    case "lijst":
      return (
        <ul className="space-y-2.5">
          {blok.punten.map((p, i) => (
            <li key={i} className="flex gap-3 leading-relaxed">
              <span aria-hidden className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-hod-cyan" />
              <span>
                <Tekst>{p}</Tekst>
              </span>
            </li>
          ))}
        </ul>
      );
    case "stappen":
      return (
        <ol className="space-y-3">
          {blok.punten.map((p, i) => (
            <li key={i} className="flex gap-3 leading-relaxed">
              <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hod-violet text-sm font-semibold text-white">
                {i + 1}
              </span>
              <span>
                <Tekst>{p}</Tekst>
              </span>
            </li>
          ))}
        </ol>
      );
    case "formule":
      return (
        <p className="flex flex-wrap items-center gap-2 rounded-3xl bg-white/10 px-5 py-4 text-sm font-medium text-white">
          <span className="rounded-full bg-hod-cyan px-3 py-1 text-page">{blok.uitkomst}</span>
          <span aria-hidden>=</span>
          {blok.delen.map((d, i) => (
            <span key={d} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden>×</span>}
              <span className="rounded-full bg-white/15 px-3 py-1">{d}</span>
            </span>
          ))}
        </p>
      );
    case "tabel": {
      const smal = new Set(blok.smal ?? []);
      return (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-white/10 text-white">
                {blok.kop.map((k, i) => (
                  <th key={i} scope="col" className={"px-4 py-3 font-semibold" + (smal.has(i) ? " whitespace-nowrap" : "")}>
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blok.rijen.map((r, i) => (
                <tr key={i} className="border-t border-white/10 even:bg-white/5">
                  {r.map((c, j) => (
                    <td key={j} className={"px-4 py-3 align-top leading-relaxed" + (smal.has(j) ? " whitespace-nowrap" : "")}>
                      <Tekst>{c}</Tekst>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    default:
      return null;
  }
}

export default function Onderbouwing({ hoofdstukken }) {
  return hoofdstukken.map((h, i) => (
    <section key={h.id} id={h.id} className="scroll-mt-24 space-y-4 border-t border-white/10 pt-10 first:border-t-0 first:pt-0">
      <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-hod-violet to-hod-cyan text-base text-white">
          {i + 1}
        </span>
        {h.titel}
      </h2>
      {h.blokken.map((b, j) => (
        <Blok key={j} blok={b} />
      ))}
    </section>
  ));
}
