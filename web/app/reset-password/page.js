"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HodLogo from "@/components/HodLogo";
import HomeLink from "@/components/HomeLink";
import WachtwoordVeld from "@/components/WachtwoordVeld";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("idle"); // idle | saving | done | error
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Wachtwoorden komen niet overeen.");
      setStatus("error");
      return;
    }
    setStatus("saving");
    setError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Er ging iets mis.");
      setStatus("error");
      return;
    }
    setStatus("done");
    setTimeout(() => router.push("/login"), 1500);
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-slate-200 bg-card shadow-sm p-6 text-center">
        <p className="text-sm text-red-400">Deze link mist een geldig token.</p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-slate-200 bg-card shadow-sm p-6 text-center">
        <p className="text-sm text-slate-700">Wachtwoord ingesteld — je wordt doorgestuurd naar inloggen...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-card shadow-sm p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Nieuw wachtwoord</label>
        <WachtwoordVeld required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Herhaal wachtwoord</label>
        <WachtwoordVeld required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={status === "saving"}
        className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-40"
      >
        {status === "saving" ? "Opslaan..." : "Wachtwoord instellen"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex-1 flex items-center justify-center px-6 py-16">
      <HomeLink>Home</HomeLink>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <HodLogo className="h-8 mx-auto mb-6" />
          <h1 className="text-xl font-bold text-slate-900">Wachtwoord instellen</h1>
        </div>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
