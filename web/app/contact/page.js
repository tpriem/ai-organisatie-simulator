import Image from "next/image";
import { getLocale, getDictionary } from "@/lib/i18n";
import SiteKop from "@/components/SiteKop";
import ContactForm from "./ContactForm";

export default async function ContactPage() {
  const locale = await getLocale();
  const { nav, contact: t } = getDictionary(locale);

  return (
    <div className={`flex-1 bg-page text-slate-900 font-display`}>
      <SiteKop locale={locale} path="/contact" nav={nav} />

      <ContactForm t={t} />

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col items-center gap-3 text-center text-xs text-white/40">
          <a href="https://www.houseofdigital.nl" target="_blank" rel="noopener noreferrer" aria-label="Naar de website van House of Digital" className="transition-opacity hover:opacity-80">
            <Image src="/hod-logo-white.png" alt="House of Digital" width={800} height={400} className="h-5 w-auto opacity-70" />
          </a>
          AI Organisatie Transformatie Simulator · House of Digital
        </div>
      </footer>
    </div>
  );
}
