/**
 * Admin dashboard overview page.
 * Loads users, news, providers, and tips caches once, then derives summary
 * stats, recent users, quick links, and content-health metrics.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { get, ref } from "firebase/database";

import { database } from "../firebase";
import { paths } from "../paths";
import { userFacingError } from "../userFacingError";

/** Shortcut tiles into the most-used admin sections. */
const QUICK_LINKS = [
  {
    to: "/users",
    title: "Manage users",
    blurb: "Edit profiles, rates, and soft-disable flags.",
  },
  {
    to: "/devices",
    title: "Device inventory",
    blurb: "Online plugs, power draw, and home owners.",
  },
  {
    to: "/providers",
    title: "Electricity rates",
    blurb: "Keep provider catalog in sync with the app.",
  },
  {
    to: "/news",
    title: "Publish news",
    blurb: "Cards shown in Tips & News.",
  },
  {
    to: "/demo",
    title: "Feature demo",
    blurb: "Pick a user and trigger defense demos (limits, KiloSave, dummy data).",
  },
  {
    to: "/support",
    title: "Customer support",
    blurb: "Reset password, pairing lookup, dummy data.",
  },
];

export default function Dashboard() {
  const [usersMap, setUsersMap] = useState({});
  const [newsMap, setNewsMap] = useState({});
  const [providersMap, setProvidersMap] = useState({});
  const [tipsCaches, setTipsCaches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // One-shot parallel fetch for overview counters
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.allSettled([
          get(ref(database, paths.users())),
          get(ref(database, paths.news())),
          get(ref(database, paths.providers())),
          get(ref(database, "tips")),
        ]);
        if (cancelled) return;

        const val = (result) =>
          result.status === "fulfilled" ? result.value.val() || {} : {};

        setUsersMap(val(results[0]));
        setNewsMap(val(results[1]));
        setProvidersMap(val(results[2]));
        setTipsCaches(Object.keys(val(results[3])).length);

        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length) {
          setError(
            userFacingError(
              failed[0].reason,
              "Some data could not be loaded (check admin rules / sign-in)."
            )
          );
        }
      } catch (err) {
        if (!cancelled) setError(userFacingError(err, "Dashboard load failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Aggregate counts + recent users for the cards below
  const insights = useMemo(() => {
    const users = Object.entries(usersMap).map(([uid, row]) => ({
      uid,
      ...(row || {}),
    }));
    const news = Object.values(newsMap || {});
    const providers = Object.values(providersMap || {});

    const onboarded = users.filter((u) => u.onboardingCompleted).length;
    const disabled = users.filter((u) => u.disabled).length;
    const activeNews = news.filter((n) => n.active !== false).length;
    const activeProviders = providers.filter((p) => p.active !== false).length;

    const recent = [...users]
      .sort(
        (a, b) =>
          Number(b.adminUpdatedAt || b.createdAt || 0) -
          Number(a.adminUpdatedAt || a.createdAt || 0)
      )
      .slice(0, 5);

    return {
      users: users.length,
      onboarded,
      pendingOnboarding: Math.max(users.length - onboarded, 0),
      disabled,
      news: news.length,
      activeNews,
      providers: providers.length,
      activeProviders,
      tipsCaches,
      onboardingPct: users.length
        ? Math.round((onboarded / users.length) * 100)
        : 0,
      recent,
    };
  }, [usersMap, newsMap, providersMap, tipsCaches]);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Overview</p>
        <h1>Dashboard</h1>
        <p className="muted">
          Live snapshot from the same Firebase project as the Kilowatch app.
        </p>
      </header>

      {error ? <div className="banner error-banner">{error}</div> : null}

      {loading ? (
        <div className="skeleton-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : (
        <>
          {/* Stat cards: users, news, providers, tips */}
          <div className="stat-grid">
            <article className="stat-card accent">
              <div className="stat-top">
                <span className="stat-label">Users</span>
                <span className="stat-chip">{insights.disabled} disabled</span>
              </div>
              <strong className="stat-value">{insights.users}</strong>
              <div className="meter">
                <div
                  className="meter-fill"
                  style={{ width: `${insights.onboardingPct}%` }}
                />
              </div>
              <p className="stat-meta">
                {insights.onboarded} onboarded · {insights.pendingOnboarding}{" "}
                pending ({insights.onboardingPct}%)
              </p>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span className="stat-label">News</span>
                <span className="stat-chip ok">{insights.activeNews} live</span>
              </div>
              <strong className="stat-value">{insights.news}</strong>
              <p className="stat-meta">Articles in Tips &amp; News feed</p>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Providers</span>
                <span className="stat-chip">{insights.activeProviders} active</span>
              </div>
              <strong className="stat-value">{insights.providers}</strong>
              <p className="stat-meta">Rates shown in onboarding / settings</p>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Tips caches</span>
              </div>
              <strong className="stat-value">{insights.tipsCaches}</strong>
              <p className="stat-meta">Homes with monthly AI tips stored</p>
            </article>
          </div>

          {/* Recent users + quick-action tiles */}
          <div className="dash-split">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Recently touched users</h2>
                  <p className="muted small">
                    Sorted by last admin update / create time
                  </p>
                </div>
                <Link className="text-link" to="/users">
                  View all
                </Link>
              </div>
              {insights.recent.length === 0 ? (
                <div className="empty-inline">No user profiles yet.</div>
              ) : (
                <ul className="person-list">
                  {insights.recent.map((row) => {
                    const name = row.fullName || row.email || "Unknown";
                    const initial = String(name).trim().charAt(0).toUpperCase() || "?";
                    return (
                      <li key={row.uid} className="person-row">
                        <span className="avatar">{initial}</span>
                        <div className="person-meta">
                          <strong>{name}</strong>
                          <span className="muted small">
                            {row.email || row.uid}
                          </span>
                        </div>
                        <span
                          className={`badge-pill ${
                            row.onboardingCompleted ? "ok" : "warn"
                          }`}
                        >
                          {row.onboardingCompleted ? "Onboarded" : "Pending"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Quick actions</h2>
                  <p className="muted small">Jump into content you manage most</p>
                </div>
              </div>
              <div className="action-stack">
                {QUICK_LINKS.map((item) => (
                  <Link key={item.to} to={item.to} className="action-tile">
                    <strong>{item.title}</strong>
                    <span className="muted small">{item.blurb}</span>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Content health: live news / providers / onboarding */}
          <section className="panel section">
            <div className="panel-head">
              <div>
                <h2>Content health</h2>
                <p className="muted small">
                  What the mobile app will currently surface
                </p>
              </div>
            </div>
            <div className="health-grid">
              <div className="health-item">
                <span className="health-label">Live news cards</span>
                <strong>
                  {insights.activeNews}
                  <span className="muted"> / {insights.news}</span>
                </strong>
              </div>
              <div className="health-item">
                <span className="health-label">Active providers</span>
                <strong>
                  {insights.activeProviders}
                  <span className="muted"> / {insights.providers}</span>
                </strong>
              </div>
              <div className="health-item">
                <span className="health-label">Onboarding complete</span>
                <strong>{insights.onboardingPct}%</strong>
              </div>
              <div className="health-item">
                <span className="health-label">Soft-disabled accounts</span>
                <strong>{insights.disabled}</strong>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
  