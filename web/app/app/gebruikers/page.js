"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

export default function GebruikersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [lastInvite, setLastInvite] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/users");
    setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setCreating(true);
    setError(null);
    setLastInvite(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Aanmaken mislukt");
      setLastInvite(body);
      setName("");
      setEmail("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="flex-1 bg-slate-50">
      <main className="max-w-2xl mx-auto w-full px-6 py-10">
        <div className="flex items-center justify-between">
          <a href="/app" className="text-sm text-slate-400 hover:text-indigo-600 transition-colors">
            ← Alle klanten
          </a>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-xs text-slate-400 hover:text-indigo-600 transition-colors"
          >
            Uitloggen
          </button>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-3 mb-1">Gebruikers</h1>
        <p className="text-slate-500 mb-8">Beheer wie kan inloggen op de interne tool.</p>

        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 mb-8 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Naam"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mailadres"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !email.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-40"
          >
            {creating ? "Uitnodigen..." : "+ Gebruiker uitnodigen"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {lastInvite && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
              <p className="font-medium mb-1">
                {lastInvite.emailSent
                  ? `Uitnodiging verstuurd naar ${lastInvite.user.email}.`
                  : `Uitnodigingsmail kon niet verstuurd worden (nog geen domein geverifieerd bij Resend) — deel deze link handmatig:`}
              </p>
              {!lastInvite.emailSent && (
                <p className="break-all font-mono text-[11px] bg-white rounded px-2 py-1.5 border border-emerald-100">
                  {lastInvite.setupLink}
                </p>
              )}
            </div>
          )}
        </form>

        {loading ? (
          <p className="text-sm text-slate-400">Laden...</p>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{u.name || u.email}</p>
                  <p className="text-xs text-slate-400">
                    {u.email} · {u.passwordSet ? "actief" : "wacht op wachtwoord instellen"}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(u.id)}
                  className="text-xs text-red-400 hover:text-red-600 hover:underline"
                >
                  verwijderen
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
