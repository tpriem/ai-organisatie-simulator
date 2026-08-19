import Image from "next/image";
import { Sora } from "next/font/google";
import { getLocale, getDictionary } from "@/lib/i18n";
import LocaleToggle from "@/components/LocaleToggle";
import ContactForm from "./ContactForm";

const sora = Sora({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sora" });

export default async function ContactPage() {
  const locale = await getLocale();
  const { nav, contact: t } = getDictionary(locale);

  return (
    <div className={`${sora.variable} flex-1 bg-[#07080A] text-[#F4F5F7]`} style={{ fontFamily: "var(--font-sora)" }}>
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#07080A]/70 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <Image src="/hod-logo-white.png" alt="House of Digital" width={800} height={400} className="h-6 w-auto" />
            <span className="hidden sm:block h-4 w-px bg-white/15" />
            <span className="hidden sm:block text-sm font-bold tracking-tight text-white">
              AI Organisatie Transformatie Simulator
            </span>
          </a>
          <div className="flex items-center gap-4">
            <LocaleToggle locale={locale} path="/contact" dark />
            <a
              href="/login"
              className="text-xs rounded-full border border-white/15 px-4 py-2 text-white/80 hover:border-white/30 hover:text-white transition-colors"
            >
              {nav.login}
            </a>
          </div>
        </div>
      </header>

      <ContactForm t={t} />

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col items-center gap-3 text-center text-xs text-white/30">
          <Image src="/hod-logo-white.png" alt="House of Digital" width={800} height={400} className="h-5 w-auto opacity-60" />
          AI Organisatie Transformatie Simulator — House of Digital
        </div>
      </footer>
    </div>
  );
}
