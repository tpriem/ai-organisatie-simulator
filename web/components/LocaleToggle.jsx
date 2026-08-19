function toggleLinkClasses(active, dark) {
  if (active) return dark ? "text-white font-semibold" : "text-slate-900 font-semibold";
  return dark ? "text-white/40 hover:text-white/70" : "text-slate-400 hover:text-slate-700";
}

export default function LocaleToggle({ locale, path, dark = true }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <a href={`/api/locale?locale=nl&redirect=${encodeURIComponent(path)}`} className={toggleLinkClasses(locale === "nl", dark)}>
        NL
      </a>
      <span className={dark ? "text-white/20" : "text-slate-300"}>/</span>
      <a href={`/api/locale?locale=en&redirect=${encodeURIComponent(path)}`} className={toggleLinkClasses(locale === "en", dark)}>
        EN
      </a>
    </div>
  );
}
