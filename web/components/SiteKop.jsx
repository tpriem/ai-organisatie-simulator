import Image from "next/image";
import LocaleToggle from "@/components/LocaleToggle";
import HomeIcoon from "@/components/HomeIcoon";

// De kop van de openbare pagina's: logo en naam links, rechts de links en de knop om in te loggen.
// Op elke pagina behalve de startpagina staat een Home-knop, ook op een telefoon.
export default function SiteKop({ locale, path, nav }) {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-page/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <a href="/" aria-label="Naar de startpagina" className="flex items-center gap-3">
          <Image src="/hod-logo-white.png" alt="House of Digital" width={800} height={400} className="h-6 w-auto" priority />
          <span className="hidden h-4 w-px bg-white/15 md:block" />
          <span className="hidden text-sm font-bold tracking-tight text-white md:block">AI Organisatie Transformatie Simulator</span>
        </a>
        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          {path !== "/" && (
            <a href="/" className="flex items-center gap-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white">
              <HomeIcoon />
              {nav.home}
            </a>
          )}
          {path !== "/onderbouwing" && (
            <a href="/onderbouwing" className="hidden text-sm font-medium text-white/70 transition-colors hover:text-white sm:block">
              {nav.onderbouwing}
            </a>
          )}
          {path !== "/contact" && (
            <a href="/contact" className="hidden text-sm font-medium text-white/70 transition-colors hover:text-white sm:block">
              {nav.contact}
            </a>
          )}
          <div className="hidden sm:block">
            <LocaleToggle locale={locale} path={path} dark />
          </div>
          <a
            href="/login"
            className="rounded-full bg-gradient-to-r from-hod-violet to-hod-cyan px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-hod-violet/20 transition-opacity hover:opacity-90 sm:px-5"
          >
            {nav.login}
          </a>
        </div>
      </div>
    </header>
  );
}
