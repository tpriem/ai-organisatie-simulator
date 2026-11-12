import Image from "next/image";
import { getLocale, getDictionary } from "@/lib/i18n";
import SiteKop from "@/components/SiteKop";

// De landingspagina, in de stijl van House of Digital: donkerpaars, met violet en cyaan als accent.
// De opbouw volgt de vragen van een bezoeker: wat is het, wat levert het op, hoe werkt het.

// Elke kaart een eigen tint, zodat de drie onderdelen uit elkaar te houden zijn.
const TINTEN = {
  violet: "border-hod-violet/40 bg-hod-violet/15",
  cyaan: "border-hod-cyan/30 bg-hod-cyan/10",
  lila: "border-hod-lilac/30 bg-hod-lilac/10",
};

function OnderzoekKaart({ tint, title, children }) {
  return (
    <div className={"flex flex-col rounded-3xl border p-7 " + TINTEN[tint]}>
      <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
      <p className="leading-relaxed text-white/70">{children}</p>
    </div>
  );
}

function StepRow({ nr, title, children }) {
  return (
    <div className="flex gap-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-hod-violet to-hod-cyan text-base font-semibold text-white">
        {nr}
      </span>
      <div>
        <h3 className="mb-1 text-lg font-bold text-white">{title}</h3>
        <p className="leading-relaxed text-white/65">{children}</p>
      </div>
    </div>
  );
}

function DirectLink({ href, children }) {
  return (
    <a href={href} className="group flex items-center justify-between gap-6 border-b border-white/10 py-3 font-medium text-white/80 transition-colors hover:text-white">
      {children}
      <span aria-hidden className="text-hod-cyan transition-transform group-hover:translate-x-1">
        →
      </span>
    </a>
  );
}

export default async function LandingPage() {
  const locale = await getLocale();
  const { nav, landing: t } = getDictionary(locale);
  const [disclaimerVoor, disclaimerNa] = t.disclaimer.split("{richting}");

  return (
    <div className="flex-1 bg-page font-display text-slate-900">
      <SiteKop locale={locale} path="/" nav={nav} />

      {/* Hero */}
      <section className="mx-auto grid max-w-5xl gap-12 px-6 py-16 sm:py-24 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {t.badge}
          </span>
          <h1 className="mb-6 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">
            {t.heroTitlePre}{" "}
            <span className="bg-gradient-to-r from-hod-lilac to-hod-cyan bg-clip-text text-transparent">{t.heroTitleHighlight}</span> {t.heroTitlePost}
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-white/65">{t.heroText}</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="/contact"
              className="rounded-full bg-gradient-to-r from-hod-violet to-hod-cyan px-6 py-3 text-base font-semibold text-white shadow-lg shadow-hod-violet/20 transition-opacity hover:opacity-90"
            >
              {t.cta}
            </a>
            <a href="#hoe-het-werkt" className="rounded-full border border-white/20 px-6 py-3 text-base font-medium text-white/85 transition-colors hover:border-white/40 hover:text-white">
              {t.cta2}
            </a>
          </div>
        </div>
        <div className="self-center rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <p className="mb-2 font-medium text-white">{t.directNaar}</p>
          <DirectLink href="#onderzoeken">{t.linkOnderzoeken}</DirectLink>
          <DirectLink href="#hoe-het-werkt">{t.linkHoe}</DirectLink>
          <DirectLink href="/contact">{t.linkContact}</DirectLink>
          <DirectLink href="/login">{t.linkLogin}</DirectLink>
        </div>
      </section>

      {/* Twee onderzoeken */}
      <section id="onderzoeken" className="mx-auto max-w-5xl scroll-mt-24 border-t border-white/10 px-6 py-20">
        <h2 className="mb-3 text-3xl font-bold text-white sm:text-4xl">
          {t.resultsHeading}{" "}
          <span className="bg-gradient-to-r from-hod-lilac to-hod-cyan bg-clip-text text-transparent">{t.resultsHeadingHighlight}</span>
        </h2>
        <p className="mb-10 max-w-2xl text-lg leading-relaxed text-white/60">{t.resultsSub}</p>
        <div className="grid gap-5 md:grid-cols-3">
          <OnderzoekKaart tint="violet" title={t.card1Title}>
            {t.card1Text}
          </OnderzoekKaart>
          <OnderzoekKaart tint="cyaan" title={t.card2Title}>
            {t.card2Text}
          </OnderzoekKaart>
          <OnderzoekKaart tint="lila" title={t.card3Title}>
            {t.card3Text}
          </OnderzoekKaart>
        </div>
      </section>

      {/* Hoe het werkt */}
      <section id="hoe-het-werkt" className="scroll-mt-24 border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="mb-10 text-3xl font-bold text-white sm:text-4xl">{t.howHeading}</h2>
          <div className="space-y-8">
            <StepRow nr="1" title={t.step1Title}>
              {t.step1Text}
            </StepRow>
            <StepRow nr="2" title={t.step2Title}>
              {t.step2Text}
            </StepRow>
            <StepRow nr="3" title={t.step3Title}>
              {t.step3Text}
            </StepRow>
          </div>
        </div>
      </section>

      {/* Wat het wel en niet is, met de vraag om contact */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid items-center gap-8 rounded-3xl border border-hod-violet/40 bg-gradient-to-br from-hod-violet/25 to-hod-cyan/10 p-8 sm:p-12 md:grid-cols-[1.6fr_1fr]">
          <p className="text-lg leading-relaxed text-white/85">
            {disclaimerVoor}
            <strong className="text-white">{t.disclaimerStrong}</strong>
            {disclaimerNa}
          </p>
          <a
            href="/contact"
            className="rounded-full bg-white px-6 py-3 text-center text-base font-semibold text-page transition-opacity hover:opacity-90"
          >
            {t.cta}
          </a>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 py-8 text-center text-xs text-white/40">
          <a href="https://www.houseofdigital.nl" target="_blank" rel="noopener noreferrer" aria-label="Naar de website van House of Digital" className="transition-opacity hover:opacity-80">
            <Image src="/hod-logo-white.png" alt="House of Digital" width={800} height={400} className="h-5 w-auto opacity-70" />
          </a>
          {t.footerTagline}
        </div>
      </footer>
    </div>
  );
}
