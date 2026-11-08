"use client";
import { useState } from "react";
import { createAuthClient } from "better-auth/react";
const auth = createAuthClient();
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const r = await auth.signIn.email({ email, password });
          if (r.error) {
            setError("Unable to sign in. Check your details and try again.");
          } else window.location.assign("/dashboard");
        } catch {
          setError("Sign-in is unavailable. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      <button className="btn full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
export function SignOut() {
  return (
    <button
      className="btn text"
      onClick={async () => {
        await auth.signOut();
        window.location.assign("/login");
      }}
    >
      Sign out
    </button>
  );
}
