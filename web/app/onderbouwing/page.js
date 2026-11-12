import { getLocale, getDictionary } from "@/lib/i18n";
import SiteKop from "@/components/SiteKop";
import Onderbouwing from "@/components/Onderbouwing";
import DownloadKnop from "@/components/DownloadKnop";
import { onderbouwing, ONDERBOUWING_TITEL, ONDERBOUWING_ONDERTITEL, ONDERBOUWING_VERSIE } from "../../../src/onderbouwing.js";

// Het document "Werking en onderbouwing": hoe de simulator werkt, hoe hij rekent en waarop hij is
// gebaseerd. De inhoud staat in src/onderbouwing.js en is ook als pdf te downloaden.

export const metadata = {
  title: ONDERBOUWING_TITEL + " | " + ONDERBOUWING_ONDERTITEL,
  description: "Hoe de simulator werkt, hoe hij rekent en op welke onderzoeken hij is gebaseerd. Voor directies en bestuurders.",
};

export default async function OnderbouwingPage() {
  const locale = await getLocale();
  const { nav, doc: t } = getDictionary(locale);
  const hoofdstukken = onderbouwing();

  return (
    <div className="flex-1 bg-page font-display text-slate-900">
      <SiteKop locale={locale} path="/onderbouwing" nav={nav} />

      <section className="border-b border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
          <span className="mb-5 inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/70">{t.label}</span>
          <h1 className="mb-4 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">{ONDERBOUWING_TITEL}.</h1>
          <p className="mb-2 bg-gradient-to-r from-hod-lilac to-hod-cyan bg-clip-text text-lg font-medium text-transparent sm:text-xl">{ONDERBOUWING_ONDERTITEL}</p>
          <p className="mb-8 max-w-2xl leading-relaxed text-white/65">{t.intro}</p>
          <div className="flex flex-wrap items-center gap-3">
            <DownloadKnop
              href="/onderbouwing/pdf"
              bezigTekst={t.bezig}
              klaarTekst={t.klaar}
              foutTekst={t.fout}
              className="rounded-full border border-hod-violet bg-hod-violet px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t.download}
            </DownloadKnop>
            <a href="/contact" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/85 transition-colors hover:border-white/40 hover:text-white">
              {t.contact}
            </a>
            <span className="text-xs text-white/40">
              {t.versie} {ONDERBOUWING_VERSIE}
              {locale !== "nl" ? " · " + t.taal : ""}
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[14rem_1fr]">
        <nav aria-label={t.inhoud} className="hidden lg:block">
          <div className="sticky top-24">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">{t.inhoud}</p>
            <ol className="space-y-1 text-sm">
              {hoofdstukken.map((h, i) => (
                <li key={h.id}>
                  <a href={"#" + h.id} className="flex gap-2 rounded-lg px-2 py-1.5 font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white">
                    <span className="text-white/35">{i + 1}</span>
                    {h.titel}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="min-w-0 space-y-10 text-white/75">
          <Onderbouwing hoofdstukken={hoofdstukken} />

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-hod-violet/40 bg-gradient-to-br from-hod-violet/25 to-hod-cyan/10 p-6 sm:p-8">
            <div>
              <h2 className="text-xl font-bold text-white">{t.slotKop}</h2>
              <p className="mt-1 text-sm text-white/75">{t.slotTekst}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <DownloadKnop
                href="/onderbouwing/pdf"
                bezigTekst={t.bezig}
                klaarTekst={t.klaar}
                foutTekst={t.fout}
                className="rounded-full border border-white bg-white px-5 py-2.5 text-sm font-semibold text-page transition-opacity hover:opacity-90"
              >
                {t.download}
              </DownloadKnop>
              <a href="/contact" className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-white/60">
                {t.contact}
              </a>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
