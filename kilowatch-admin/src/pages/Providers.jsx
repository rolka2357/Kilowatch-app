/**
 * Electricity providers catalog for onboarding / settings in the app.
 * Live list with search, seed-defaults, create/edit (rate history on change),
 * and delete. Logos resolve via remote URL or bundled SVG by id.
 */
import { useEffect, useMemo, useState } from "react";
import { onValue, push, ref, remove, set, update } from "firebase/database";

import { database } from "../firebase";
import { DEFAULT_PROVIDERS, paths, resolveProviderLogo } from "../paths";

const EMPTY = {
  id: "",
  name: "",
  shortName: "",
  rate: "",
  logoUrl: "",
  active: true,
  order: 99,
};

function formatWhen(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** Past catalog rates newest-first for the edit modal. */
function historyRows(provider) {
  const map = provider?.rateHistory || {};
  return Object.entries(map)
    .map(([id, row]) => ({ id, ...(row || {}) }))
    .sort(
      (a, b) =>
        Number(b.endedAt || b.startedAt || 0) -
        Number(a.endedAt || a.startedAt || 0)
    );
}

export default function Providers() {
  const [providers, setProviders] = useState({});
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    // Live provider catalog
    return onValue(ref(database, paths.providers()), (snap) => {
      setProviders(snap.val() || {});
    });
  }, []);

  // Search + sort by display order
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(providers)
      .map(([id, row]) => ({ id, ...(row || {}) }))
      .filter((row) => {
        if (!q) return true;
        return (
          String(row.name || "").toLowerCase().includes(q) ||
          String(row.shortName || "").toLowerCase().includes(q) ||
          row.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(a.order || 99) - Number(b.order || 99));
  }, [providers, query]);

  const summary = useMemo(() => {
    const all = Object.values(providers || {});
    return {
      total: all.length,
      active: all.filter((p) => p.active !== false).length,
      avgRate:
        all.length > 0
          ? all.reduce((sum, p) => sum + (Number(p.rate) || 0), 0) / all.length
          : 0,
    };
  }, [providers]);

  const editingProvider = editingId && editingId !== "new" ? providers[editingId] : null;
  const pastRates = editingProvider ? historyRows(editingProvider) : [];

  function openCreate() {
    setEditingId("new");
    setForm({ ...EMPTY, order: Object.keys(providers).length + 1 });
    setMessage("");
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({
      id: row.id,
      name: row.name || "",
      shortName: row.shortName || "",
      rate: row.rate != null ? String(row.rate) : "",
      logoUrl: row.logoUrl || "",
      active: row.active !== false,
      order: row.order ?? 99,
    });
    setMessage("");
  }

  // Write DEFAULT_PROVIDERS into RTDB (same presets as mobile)
  async function seedDefaults() {
    const updates = {};
    DEFAULT_PROVIDERS.forEach((provider) => {
      updates[paths.provider(provider.id)] = {
        ...provider,
        logoUrl: "",
        active: true,
        updatedAt: Date.now(),
        rateUpdatedAt: Date.now(),
      };
    });
    updates[`${paths.providersMeta()}/defaultProviderId`] = "meralco";
    await update(ref(database), updates);
    setMessage("Seeded default PH providers (same as mobile presets).");
  }

  // Create or update provider; archive previous rate when it changes
  async function save(event) {
    event.preventDefault();
    const id =
      editingId === "new"
        ? form.id.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")
        : editingId;
    if (!id) {
      setMessage("Provider id is required.");
      return;
    }

    const rate = Number(form.rate);
    const now = Date.now();
    const prev = providers[id] || {};
    const prevRate = Number(prev.rate);
    const nextRate = Number.isFinite(rate) ? rate : null;

    const payload = {
      id,
      name: form.name.trim(),
      shortName: form.shortName.trim() || form.name.trim(),
      rate: nextRate,
      logoUrl: form.logoUrl.trim() || "",
      active: Boolean(form.active),
      order: Number(form.order) || 99,
      updatedAt: now,
      rateHistory: prev.rateHistory || null,
      rateUpdatedAt: prev.rateUpdatedAt || null,
    };

    if (
      Number.isFinite(prevRate) &&
      nextRate != null &&
      prevRate !== nextRate
    ) {
      const historyKey = push(
        ref(database, `${paths.provider(id)}/rateHistory`)
      ).key;
      payload.rateHistory = {
        ...(prev.rateHistory || {}),
        [historyKey]: {
          rate: prevRate,
          startedAt: prev.rateUpdatedAt || prev.updatedAt || null,
          endedAt: now,
          source: "admin",
        },
      };
      payload.rateUpdatedAt = now;
    } else if (nextRate != null && !prev.rateUpdatedAt) {
      payload.rateUpdatedAt = now;
    } else if (nextRate != null) {
      payload.rateUpdatedAt = prev.rateUpdatedAt || now;
    }

    await set(ref(database, paths.provider(id)), payload);
    setEditingId(null);
    setMessage("Provider saved.");
  }

  async function removeProvider(id) {
    if (!window.confirm(`Delete provider ${id}?`)) return;
    await remove(ref(database, paths.provider(id)));
    setMessage("Provider deleted.");
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Catalog</p>
        <div className="page-head row">
          <div>
            <h1>Electricity providers</h1>
            <p className="muted">
              Rates and labels shown in onboarding and settings.
            </p>
          </div>
          <div className="row gap">
            <button type="button" className="btn ghost" onClick={seedDefaults}>
              Seed defaults
            </button>
            <button type="button" className="btn primary" onClick={openCreate}>
              Add provider
            </button>
          </div>
        </div>
      </header>

      <div className="summary-strip">
        <div className="summary-pill">
          <span className="summary-num">{summary.total}</span>
          <span className="muted small">Providers</span>
        </div>
        <div className="summary-pill">
          <span className="summary-num">{summary.active}</span>
          <span className="muted small">Active</span>
        </div>
        <div className="summary-pill">
          <span className="summary-num">
            {summary.total ? `₱${summary.avgRate.toFixed(2)}` : "—"}
          </span>
          <span className="muted small">Avg rate / kWh</span>
        </div>
      </div>

      {message ? <div className="banner ok-banner">{message}</div> : null}

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search providers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="muted small">
          {rows.length} shown · order controls app list position
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state panel">
          <strong>No providers yet</strong>
          <p className="muted">
            Seed the default PH list or add your first provider.
          </p>
          <button type="button" className="btn primary" onClick={seedDefaults}>
            Seed defaults
          </button>
        </div>
      ) : (
        <div className="provider-grid">
          {rows.map((row) => (
            <article
              key={row.id}
              className={`provider-card ${
                row.active === false ? "is-inactive" : ""
              }`}
            >
              <div className="provider-card-top">
                <div className="provider-logo-wrap">
                  <img
                    src={resolveProviderLogo(row.id, row.logoUrl)}
                    alt=""
                    className="thumb lg"
                  />
                </div>
                <span
                  className={`badge-pill ${
                    row.active === false ? "warn" : "ok"
                  }`}
                >
                  {row.active === false ? "Hidden" : "Active"}
                </span>
              </div>
              <h3>{row.shortName || row.name}</h3>
              <p className="muted small">{row.name}</p>
              <div className="provider-rate">
                <span className="rate-value">
                  {row.rate != null ? `₱${Number(row.rate).toFixed(2)}` : "—"}
                </span>
                <span className="muted small">per kWh</span>
              </div>
              <div className="provider-meta">
                <span className="mono small">{row.id}</span>
                <span className="muted small">
                  {row.rateUpdatedAt
                    ? `Rate since ${formatWhen(row.rateUpdatedAt)}`
                    : `Order ${row.order ?? "—"}`}
                </span>
              </div>
              {row.rateHistory && Object.keys(row.rateHistory).length > 0 ? (
                <p className="muted small" style={{ marginTop: 8 }}>
                  {Object.keys(row.rateHistory).length} past rate
                  {Object.keys(row.rateHistory).length === 1 ? "" : "s"}
                </p>
              ) : null}
              <div className="row gap" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => openEdit(row)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn danger sm"
                  onClick={() => removeProvider(row.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editingId ? (
        // Create / edit provider modal
        <div className="modal-backdrop">
          <form className="card modal modal-wide" onSubmit={save}>
            <p className="eyebrow">Provider</p>
            <h2>{editingId === "new" ? "Add provider" : "Edit provider"}</h2>
            <div className="form-grid">
              {editingId === "new" ? (
                <label>
                  Id (slug)
                  <input
                    value={form.id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, id: e.target.value }))
                    }
                    placeholder="meralco"
                    required
                  />
                </label>
              ) : null}
              <label>
                Name
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Short name
                <input
                  value={form.shortName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, shortName: e.target.value }))
                  }
                />
              </label>
              <label>
                Rate (₱/kWh)
                <input
                  value={form.rate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rate: e.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Order
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, order: e.target.value }))
                  }
                />
              </label>
            </div>
            <label>
              Logo URL (optional — app can still use bundled SVG by id)
              <input
                value={form.logoUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, logoUrl: e.target.value }))
                }
                placeholder="https://…"
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
              />
              Active in app
            </label>

            {editingId !== "new" ? (
              <div className="rate-history">
                <div className="rate-history-head">
                  <strong>Catalog rate history</strong>
                  <span className="muted small">
                    Previous ₱/kWh values are archived when you save a new rate
                  </span>
                </div>
                <div className="rate-current">
                  <span className="badge-pill ok">Current</span>
                  <div>
                    <strong>
                      {editingProvider?.rate != null
                        ? `₱${Number(editingProvider.rate).toFixed(2)} / kWh`
                        : "Not set"}
                    </strong>
                    <div className="muted small">
                      {editingProvider?.rateUpdatedAt
                        ? `Since ${formatWhen(editingProvider.rateUpdatedAt)}`
                        : "No rate change date yet"}
                    </div>
                  </div>
                </div>
                {pastRates.length === 0 ? (
                  <p className="muted small" style={{ margin: "10px 0 0" }}>
                    No previous catalog rates yet. Change the rate and save to
                    start history.
                  </p>
                ) : (
                  <ul className="rate-history-list">
                    {pastRates.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>
                            ₱{Number(item.rate).toFixed(2)} / kWh
                          </strong>
                          <div className="muted small">
                            {item.source ? `via ${item.source}` : "archived"}
                          </div>
                        </div>
                        <div className="rate-history-dates muted small">
                          <div>Started {formatWhen(item.startedAt)}</div>
                          <div>Ended {formatWhen(item.endedAt)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            <div className="row gap modal-actions">
              <button type="submit" className="btn primary">
                Save provider
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
