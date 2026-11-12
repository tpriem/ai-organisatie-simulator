// Een huisje, voor de Home-knop.
export default function HomeIcoon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 9.5 10 3l7 6.5" />
      <path d="M5 8.5V16a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8.5" />
      <path d="M8.5 17v-4.5h3V17" />
    </svg>
  );
}
