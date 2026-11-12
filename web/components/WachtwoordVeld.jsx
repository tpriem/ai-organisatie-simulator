"use client";

import { useState } from "react";

// Een wachtwoordveld met een oogje om te zien wat je typt. Het wachtwoord blijft standaard verborgen;
// het oogje zet het veld tijdelijk op leesbaar.

function Oog({ open }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {/* Een streep door het oog zolang het wachtwoord verborgen is. */}
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}

export default function WachtwoordVeld({ className = "", ...props }) {
  const [zichtbaar, setZichtbaar] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={zichtbaar ? "text" : "password"}
        className={`w-full rounded-lg border border-slate-300 py-2.5 pl-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${className}`}
      />
      <button
        type="button"
        onClick={() => setZichtbaar((z) => !z)}
        aria-label={zichtbaar ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
        aria-pressed={zichtbaar}
        title={zichtbaar ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-400 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Oog open={zichtbaar} />
      </button>
    </div>
  );
}
