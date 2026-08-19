"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function LoginFormInner({ t }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError(t.error);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.email}</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.password}</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-40"
      >
        {loading ? t.submitting : t.submit}
      </button>
    </form>
  );
}

export default function LoginForm({ t }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">AI Organisatie Transformatie Simulator</h1>
          <p className="text-sm text-slate-500 mt-1">{t.subtitle}</p>
        </div>
        <Suspense>
          <LoginFormInner t={t} />
        </Suspense>
        <p className="text-center mt-4">
          <a href="/forgot-password" className="text-xs text-slate-400 hover:text-indigo-600 transition-colors">
            {t.forgot}
          </a>
        </p>
      </div>
    </div>
  );
}
