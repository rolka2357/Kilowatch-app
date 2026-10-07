/**
 * Onboarding content page: tutorial video URL for “See how it works”.
 * Live-reads content/onboarding; save writes tutorialVideoUrl (or clears it
 * so the app shows “Coming soon”).
 */
import { useEffect, useState } from "react";
import { onValue, ref, update } from "firebase/database";

import { database } from "../firebase";
import { paths } from "../paths";
import { userFacingError } from "../userFacingError";

/** Allow empty (hide video) or http(s) URLs only. */
function looksLikeHttpUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function Onboarding() {
  const [url, setUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Live sync of tutorial link from RTDB
    return onValue(ref(database, paths.onboarding()), (snap) => {
      const value = snap.val() || {};
      const next = String(value.tutorialVideoUrl || "").trim();
      setUrl(next);
      setSavedUrl(next);
      setUpdatedAt(value.tutorialVideoUpdatedAt || null);
      setLoaded(true);
    });
  }, []);

  // Persist URL (or null to clear) for new onboarding users
  async function save(event) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!looksLikeHttpUrl(trimmed)) {
      setError("Enter a valid http(s) link, or leave blank to hide the video.");
      setMessage("");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      await update(ref(database), {
        [paths.onboardingTutorialVideoUrl()]: trimmed || null,
        [`${paths.onboarding()}/tutorialVideoUpdatedAt`]: Date.now(),
      });
      setSavedUrl(trimmed);
      setMessage(
        trimmed
          ? "Tutorial video link saved. New onboarding users will open this URL."
          : "Link cleared. The app will show “Coming soon” until you add a URL."
      );
    } catch (saveError) {
      setError(userFacingError(saveError, "Unable to save the tutorial link."));
    } finally {
      setBusy(false);
    }
  }

  const dirty = url.trim() !== savedUrl;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Onboarding</h1>
          <p className="lede">
            Manage the tutorial video shown during app onboarding (“See how it
            works”).
          </p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2>Tutorial video URL</h2>
          <p className="muted small">
            Paste a YouTube (or any https) link. Leave empty to show “Coming
            soon” in the app.
          </p>
        </div>

        <div className="onboarding-body">
          {!loaded ? (
            <p className="muted">Loading…</p>
          ) : (
            <form className="onboarding-form" onSubmit={save}>
              <label className="field">
                <span>Video link</span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError("");
                    setMessage("");
                  }}
                  placeholder="https://www.youtube.com/watch?v=…"
                  autoComplete="off"
                />
              </label>

              {updatedAt ? (
                <p className="muted small">
                  Last updated{" "}
                  {new Date(updatedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              ) : (
                <p className="muted small">No tutorial link saved yet.</p>
              )}

              {error ? <p className="error">{error}</p> : null}
              {message ? <p className="ok">{message}</p> : null}

              <div className="row gap">
                <button
                  type="submit"
                  className="btn primary"
                  disabled={busy || !dirty}
                >
                  {busy ? "Saving…" : "Save link"}
                </button>
                {savedUrl ? (
                  <a
                    className="btn ghost"
                    href={savedUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open current link
                  </a>
                ) : null}
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
