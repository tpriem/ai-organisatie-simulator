import Image from "next/image";
import { Sora } from "next/font/google";
import { getLocale, getDictionary } from "@/lib/i18n";
import LocaleToggle from "@/components/LocaleToggle";

const sora = Sora({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sora" });

function NumberCard({ nr, title, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <span className="block text-sm font-semibold bg-gradient-to-r from-[#6E8BFF] to-[#B07CFF] bg-clip-text text-transparent mb-3">
        {nr}
      </span>
      <h3 className="text-base font-semibold text-white mb-1.5">{title}</h3>
      <p className="text-sm text-white/50 leading-relaxed">{children}</p>
    </div>
  );
}

function StepRow({ nr, title, children }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6E8BFF] to-[#B07CFF] text-white text-sm font-semibold">
        {nr}
      </span>
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-white/50 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const locale = await getLocale();
  const { nav, landing: t } = getDictionary(locale);

  return (
    <div className={`${sora.variable} flex-1 bg-[#07080A] text-[#F4F5F7]`} style={{ fontFamily: "var(--font-sora)" }}>
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#07080A]/70 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/hod-logo-white.png" alt="House of Digital" width={800} height={400} className="h-6 w-auto" priority />
            <span className="hidden sm:block h-4 w-px bg-white/15" />
            <span className="hidden sm:block text-sm font-bold tracking-tight text-white">
              AI Organisatie Transformatie Simulator
            </span>
          </div>
          <div className="flex items-center gap-4">
            <LocaleToggle locale={locale} path="/" dark />
            <a
              href="/login"
              className="text-xs rounded-full border border-white/15 px-4 py-2 text-white/80 hover:border-white/30 hover:text-white transition-colors"
            >
              {nav.login}
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70 mb-7">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {t.badge}
        </span>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 leading-[1.08]">
          {t.heroTitlePre}{" "}
          <span className="bg-gradient-to-r from-[#6E8BFF] to-[#B07CFF] bg-clip-text text-transparent">
            {t.heroTitleHighlight}
          </span>{" "}
          {t.heroTitlePost}
        </h1>
        <p className="text-lg text-white/55 max-w-2xl mx-auto leading-relaxed">{t.heroText}</p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <a
            href="/contact"
            className="rounded-full bg-gradient-to-r from-[#6E8BFF] to-[#B07CFF] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#6E8BFF]/20 hover:opacity-90 transition-opacity"
          >
            {t.cta}
          </a>
        </div>
      </section>

      {/* Wat het oplevert */}
      <section className="mx-auto max-w-5xl px-6 py-20 border-t border-white/10">
        <h2 className="text-3xl font-bold text-center mb-3">
          {t.resultsHeading}{" "}
          <span className="bg-gradient-to-r from-[#6E8BFF] to-[#B07CFF] bg-clip-text text-transparent">
            {t.resultsHeadingHighlight}
          </span>
        </h2>
        <p className="text-center text-white/45 max-w-xl mx-auto mb-12">{t.resultsSub}</p>
        <div className="grid sm:grid-cols-3 gap-5">
          <NumberCard nr="01" title={t.card1Title}>
            {t.card1Text}
          </NumberCard>
          <NumberCard nr="02" title={t.card2Title}>
            {t.card2Text}
          </NumberCard>
          <NumberCard nr="03" title={t.card3Title}>
            {t.card3Text}
          </NumberCard>
        </div>
      </section>

      {/* Hoe het werkt */}
      <section className="mx-auto max-w-3xl px-6 py-20 border-t border-white/10">
        <h2 className="text-3xl font-bold text-center mb-12">{t.howHeading}</h2>
        <div className="space-y-9">
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
      </section>

      {/* Disclaimer / positioning — pull quote style */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 border-l-4 border-l-[#8AA0FF]">
          <p className="text-base text-white/80 leading-relaxed">
            {t.disclaimer.split(`{richting}`)[0]}
            <strong className="text-white">{t.disclaimerStrong}</strong>
            {t.disclaimer.split(`{richting}`)[1]}
          </p>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col items-center gap-3 text-center text-xs text-white/30">
          <Image src="/hod-logo-white.png" alt="House of Digital" width={800} height={400} className="h-5 w-auto opacity-60" />
          {t.footerTagline}
        </div>
      </footer>
    </div>
  );
}
