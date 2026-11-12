import HomeIcoon from "@/components/HomeIcoon";

// De Home-knop linksboven op pagina's zonder kop (inloggen, wachtwoord instellen). De omringende
// pagina moet `relative` zijn.
export default function HomeLink({ children = "Home" }) {
  return (
    <a href="/" className="absolute left-5 top-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 sm:left-6">
      <HomeIcoon />
      {children}
    </a>
  );
}
