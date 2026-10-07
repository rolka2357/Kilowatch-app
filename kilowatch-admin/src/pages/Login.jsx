/**
 * Admin login page for the console.
 * Supports Google popup and email/password sign-in; on success navigates
 * home where RequireAdmin checks admins/{uid}. Includes theme toggle.
 */
import { useState } from "react";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";

import { auth } from "../firebase";
import { userFacingError } from "../userFacingError";
import { useTheme } from "../theme";

export default function Login() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Email / password Auth, then go to dashboard
  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(userFacingError(err, "Sign-in failed"));
    } finally {
      setBusy(false);
    }
  }

  // Google popup Auth, then go to dashboard
  async function onGoogle() {
    setBusy(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate("/", { replace: true });
    } catch (err) {
      setError(userFacingError(err, "Google sign-in failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <button
        type="button"
        className="theme-toggle login-theme-toggle"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? "Light mode" : "Dark mode"}
      </button>
      <form className="card login-card" onSubmit={onSubmit}>
        <img
          className="login-logo"
          src="/kilowatch_logo.png"
          alt="Kilowatch"
        />
        <h1>Admin console</h1>
        <p className="muted">
          Sign in with a Google account listed under <code>admins/</code> in
          Firebase.
        </p>

        <button
          type="button"
          className="btn primary"
          onClick={onGoogle}
          disabled={busy}
          style={{ width: "100%", marginTop: 18 }}
        >
          {busy ? "Signing in…" : "Continue with Google"}
        </button>

        <div className="login-divider">or email / password</div>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn ghost" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Signing in…" : "Sign in with email"}
        </button>
      </form>
    </div>
  );
}
