'use client';
import { useEffect, useState } from 'react';

type GoogleApi = {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (r: { credential: string }) => void }): void;
      renderButton(element: HTMLElement, options: Record<string, unknown>): void;
    };
  };
};

export function AdminLogin({ next, googleClientId }: { next: string; googleClientId: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const render = () => {
      const google = (window as unknown as { google?: GoogleApi }).google;
      const element = document.getElementById('admin-google-button');
      if (!google || !element) return;
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setBusy(true);
          setError('');
          const response = await fetch('/api/admin/login/google', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ credential }),
          });
          if (response.ok) location.assign(next);
          else {
            setError((await response.json().catch(() => ({}))).error ?? 'Login Google gagal.');
            setBusy(false);
          }
        },
      });
      google.accounts.id.renderButton(element, { theme: 'outline', size: 'large', width: 320, text: 'signin_with' });
    };
    if ((window as unknown as { google?: GoogleApi }).google) return render();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [googleClientId, next]);

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (response.ok) return location.assign(next);
    setError((await response.json().catch(() => ({}))).error ?? 'Gagal masuk.');
    setBusy(false);
  }

  return (
    <div className="mx-auto mt-16 max-w-md rounded-3xl border bg-white p-8 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#a34f2c]">Panel admin</p>
      <h1 className="mt-3 font-serif text-3xl">Masuk ke Simple Ground</h1>
      <div className="mt-6 flex justify-center" id="admin-google-button" />
      <div className="my-6 flex items-center gap-3 text-xs text-[#68736b]">
        <span className="h-px flex-1 bg-[#e4e0d6]" /> atau dengan email <span className="h-px flex-1 bg-[#e4e0d6]" />
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-medium">
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="username"
            required
            className="mt-1 w-full rounded-xl border px-4 py-3 outline-none focus:border-[#243b2c]"
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-xl border px-4 py-3 outline-none focus:border-[#243b2c]"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !email || !password}
          className="w-full rounded-full bg-[#243b2c] py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <p className="mt-6 text-xs leading-5 text-[#68736b]">
        Lupa password? Jalankan <code>npm run admin:create -- email passwordBaru</code> di server untuk
        mengatur ulang.
      </p>
    </div>
  );
}
