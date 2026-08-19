"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { getSector } from "@/lib/sectors";

function initials(naam) {
  return naam
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
];

function avatarColor(naam) {
  let hash = 0;
  for (let i = 0; i < naam.length; i++) hash = (hash + naam.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

export default function HomePage() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [naam, setNaam] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    const res = await fetch("/api/clients");
    setClients(await res.json());
    setLoading(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!naam.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naam }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Aanmaken mislukt");
      }
      const client = await res.json();
      router.push(`/app/klant/${client.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex-1 bg-gradient-to-b from-indigo-50/60 via-white to-white">
      <main className="mx-auto max-w-2xl w-full px-6 py-16">
        <div className="mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Intern tool
          </span>
          <div className="flex items-start justify-between">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
              AI Organisatie Transformatie Simulator
            </h1>
            <div className="shrink-0 flex items-center gap-3 mt-1.5">
              <a href="/app/gebruikers" className="text-xs text-slate-400 hover:text-indigo-600 transition-colors">
                Gebruikers
              </a>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-xs text-slate-400 hover:text-indigo-600 transition-colors"
              >
                Uitloggen
              </button>
            </div>
          </div>
          <p className="text-slate-500">Kies een klant om verder te gaan, of maak een nieuwe aan.</p>
        </div>

        <form onSubmit={handleCreate} className="flex gap-2 mb-10">
          <input
            type="text"
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="Naam van de klant/organisatie"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={creating || !naam.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:hover:bg-indigo-600"
          >
            + Nieuwe klant
          </button>
        </form>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Laden...</p>
        ) : clients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
            <p className="text-sm text-slate-500">Nog geen klanten. Maak hierboven de eerste aan.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {clients.map((c) => {
              const sector = c.sector ? getSector(c.sector) : null;
              return (
                <li key={c.id}>
                  <a
                    href={`/app/klant/${c.id}`}
                    className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarColor(
                        c.naam
                      )}`}
                    >
                      {initials(c.naam)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 truncate">{c.naam}</span>
                        {c.scope === "afdeling" && c.scopeLabel && (
                          <span className="shrink-0 rounded-full bg-amber-50 text-amber-700 text-[10px] font-medium px-2 py-0.5">
                            {c.scopeLabel}
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-slate-400">
                        {sector ? sector.sector : "Geen sector ingesteld"}
                      </span>
                    </span>
                    <span className="text-slate-300 group-hover:text-indigo-400 transition-colors">→</span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
