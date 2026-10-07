/**
 * Users admin page: list, filter, edit, create, and soft-delete profiles.
 * Live-subscribes to users + providers; edit modal archives rate history
 * when the kWh rate changes. Create uses createCustomerUser (secondary Auth).
 */
import { useEffect, useMemo, useState } from "react";
import { get, onValue, push, ref, remove, update } from "firebase/database";

import { createCustomerUser } from "../createCustomerUser";
import { database } from "../firebase";
import { DEFAULT_PROVIDERS, paths } from "../paths";
import { userFacingError } from "../userFacingError";

function homeDisplayName(fullName) {
  const first = String(fullName || "My")
    .trim()
    .split(/\s+/)[0];
  if (!first) return "My Home";
  const possessive = /s$/i.test(first) ? `${first}'` : `${first}'s`;
  return `${possessive} Home`;
}

/** Keep People screens in sync when admin renames a user. */
async function syncDisplayNameAcrossHomes(uid, fullName) {
  const trimmed = String(fullName || "").trim();
  if (!uid || !trimmed) return;

  const now = Date.now();
  const updates = {};
  const membershipsSnap = await get(ref(database, paths.userMemberships(uid)));
  const memberships = membershipsSnap.val() || {};

  await Promise.all(
    Object.keys(memberships).map(async (homeId) => {
      updates[`${paths.homeMember(homeId, uid)}/fullName`] = trimmed;
      updates[`${paths.homeMember(homeId, uid)}/updatedAt`] = now;

      const memberSnap = await get(ref(database, paths.homeMember(homeId, uid)));
      const member = memberSnap.val() || {};
      if (member.role !== "owner" && homeId !== uid) return;

      const homeName = homeDisplayName(trimmed);
      updates[`${paths.homeMeta(homeId)}/name`] = homeName;
      updates[`${paths.homeMeta(homeId)}/updatedAt`] = now;

      const membersSnap = await get(ref(database, paths.homeMembers(homeId)));
      const members = membersSnap.val() || {};
      Object.keys(members).forEach((memberUid) => {
        updates[`${paths.membership(memberUid, homeId)}/homeName`] = homeName;
        updates[`${paths.membership(memberUid, homeId)}/ownerName`] = trimmed;
        updates[`${paths.membership(memberUid, homeId)}/updatedAt`] = now;
      });
    })
  );

  if (!memberships[uid]) {
    const ownMemberSnap = await get(ref(database, paths.homeMember(uid, uid)));
    if (ownMemberSnap.exists()) {
      updates[`${paths.homeMember(uid, uid)}/fullName`] = trimmed;
      updates[`${paths.homeMember(uid, uid)}/updatedAt`] = now;
      const homeName = homeDisplayName(trimmed);
      updates[`${paths.homeMeta(uid)}/name`] = homeName;
      updates[`${paths.homeMeta(uid)}/updatedAt`] = now;
    }
  }

  if (Object.keys(updates).length > 0) {
    await update(ref(database), updates);
  }
}

const EMPTY = {
  fullName: "",
  email: "",
  electricityProviderId: "custom",
  electricityProviderName: "",
  electricityRate: "",
  disabled: false,
};

const EMPTY_CREATE = {
  fullName: "",
  email: "",
  password: "",
  electricityProviderId: "meralco",
  electricityProviderName: "Meralco",
  electricityRate: "",
  markOnboarded: false,
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Onboarding pending" },
  { id: "done", label: "Onboarded" },
  { id: "disabled", label: "Disabled" },
];

function initials(row) {
  const source = String(row.fullName || row.email || "?").trim();
  return source.charAt(0).toUpperCase() || "?";
}

/** Photo avatar with letter fallback when URL missing or fails. */
function UserAvatar({ row, size }) {
  const url = String(row?.photoURL || "").trim();
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(url) && !failed;
  const style = size
    ? { width: size, height: size, borderRadius: Math.round(size * 0.3), fontSize: size > 48 ? "1.2rem" : undefined }
    : undefined;

  if (showPhoto) {
    return (
      <img
        className="avatar avatar-img"
        src={url}
        alt=""
        style={style}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className="avatar" style={style}>
      {initials(row)}
    </span>
  );
}

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

function historyRows(profile) {
  const map = profile?.electricityRateHistory || {};
  return Object.entries(map)
    .map(([id, row]) => ({ id, ...(row || {}) }))
    .sort(
      (a, b) =>
        Number(b.endedAt || b.startedAt || 0) -
        Number(a.endedAt || a.startedAt || 0)
    );
}

/** Matches AppNavigator: done if flag set or legacy rate timestamp exists. */
function isOnboardingDone(profile = {}) {
  return (
    profile.onboardingCompleted === true ||
    Boolean(profile.electricityRateUpdatedAt)
  );
}

export default function Users() {
  const [users, setUsers] = useState({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingUid, setEditingUid] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [providersMap, setProvidersMap] = useState({});

  useEffect(() => {
    // Live user profiles
    return onValue(ref(database, paths.users()), (snap) => {
      setUsers(snap.val() || {});
    });
  }, []);

  useEffect(() => {
    // Provider catalog for create-user dropdown
    return onValue(ref(database, paths.providers()), (snap) => {
      setProvidersMap(snap.val() || {});
    });
  }, []);

  // Active providers from RTDB, or DEFAULT_PROVIDERS fallback
  const providerOptions = useMemo(() => {
    const fromDb = Object.entries(providersMap || {})
      .map(([id, row]) => ({
        id,
        name: row?.shortName || row?.name || id,
        rate: Number(row?.rate) || null,
        order: Number(row?.order) || 99,
        active: row?.active !== false,
      }))
      .filter((p) => p.active && p.id !== "custom");
    if (fromDb.length) {
      return fromDb.sort((a, b) => a.order - b.order);
    }
    return DEFAULT_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.shortName || p.name,
      rate: p.rate,
      order: p.order,
    }));
  }, [providersMap]);

  const createRateTyped = String(createForm.electricityRate || "").trim() !== "";
  const createProviderDisabled = createRateTyped;
  const allRows = useMemo(
    () =>
      Object.entries(users).map(([uid, profile]) => ({
        uid,
        ...(profile || {}),
      })),
    [users]
  );

  const summary = useMemo(() => {
    const total = allRows.length;
    const pending = allRows.filter((r) => !isOnboardingDone(r)).length;
    const disabled = allRows.filter((r) => r.disabled).length;
    const active = allRows.filter((r) => !r.disabled).length;
    return { total, pending, disabled, active };
  }, [allRows]);

  // Filter tabs + search query → visible table rows
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows
      .filter((row) => {
        if (filter === "pending" && isOnboardingDone(row)) return false;
        if (filter === "done" && !isOnboardingDone(row)) return false;
        if (filter === "disabled" && !row.disabled) return false;
        if (!q) return true;
        return (
          String(row.fullName || "").toLowerCase().includes(q) ||
          String(row.email || "").toLowerCase().includes(q) ||
          String(row.electricityProviderName || "").toLowerCase().includes(q) ||
          row.uid.toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        String(a.fullName || a.email || "").localeCompare(
          String(b.fullName || b.email || "")
        )
      );
  }, [allRows, query, filter]);

  const editingProfile = editingUid ? users[editingUid] || {} : null;
  const pastRates = editingProfile ? historyRows(editingProfile) : [];

  function startEdit(row) {
    const matchedProvider = providerOptions.find(
      (provider) =>
        provider.id === row.electricityProviderId ||
        provider.name.toLowerCase() ===
          String(row.electricityProviderName || "").toLowerCase()
    );
    setEditingUid(row.uid);
    setForm({
      fullName: row.fullName || "",
      email: row.email || "",
      electricityProviderId:
        matchedProvider?.id || row.electricityProviderId || "custom",
      electricityProviderName: row.electricityProviderName || "",
      electricityRate:
        row.electricityRate != null ? String(row.electricityRate) : "",
      disabled: Boolean(row.disabled),
      onboardingCompleted: isOnboardingDone(row),
    });
    setMessage("");
  }

  // Persist profile edits; archive previous rate when it changes
  async function saveEdit(event) {
    event.preventDefault();
    if (!editingUid) return;

    const prev = users[editingUid] || {};
    const rate = Number(form.electricityRate);
    const now = Date.now();
    const prevRate = Number(prev.electricityRate);
    const selectedProvider = providerOptions.find(
      (provider) => provider.id === form.electricityProviderId
    );
    const nextProviderId = selectedProvider?.id || "custom";
    const nextProvider =
      selectedProvider?.name || form.electricityProviderName.trim() || null;

    const payload = {
      fullName: form.fullName.trim(),
      electricityProviderId: nextProviderId,
      electricityProviderName: nextProvider,
      electricityRate: Number.isFinite(rate) ? rate : null,
      disabled: Boolean(form.disabled),
      onboardingCompleted: Boolean(form.onboardingCompleted),
      onboardingCompletedAt: form.onboardingCompleted
        ? prev.onboardingCompletedAt || now
        : null,
      adminUpdatedAt: now,
    };

    if (Number.isFinite(rate)) {
      payload.electricityRateUpdatedAt = form.onboardingCompleted ? now : null;
    } else {
      payload.electricityRateUpdatedAt = null;
    }

    const rateChanged =
      Number.isFinite(prevRate) &&
      Number.isFinite(rate) &&
      (prevRate !== rate ||
        String(prev.electricityProviderId || "") !==
          String(nextProviderId || "") ||
        String(prev.electricityProviderName || "") !==
          String(nextProvider || ""));

    if (rateChanged) {
      const historyKey = push(
        ref(database, `${paths.user(editingUid)}/electricityRateHistory`)
      ).key;
      payload[`electricityRateHistory/${historyKey}`] = {
        rate: prevRate,
        providerId: prev.electricityProviderId || null,
        providerName: prev.electricityProviderName || null,
        startedAt: prev.electricityRateUpdatedAt || null,
        endedAt: now,
        source: "admin",
      };
    }

    await update(ref(database, paths.user(editingUid)), payload);
    if (payload.fullName) {
      try {
        await syncDisplayNameAcrossHomes(editingUid, payload.fullName);
      } catch (err) {
        console.warn("Name fan-out failed", err);
      }
    }
    setMessage("User saved.");
    setEditingUid(null);
  }

  // Remove RTDB profile only (Auth account may remain)
  async function deleteUserProfile(uid) {
    if (
      !window.confirm(
        "Delete this user PROFILE node only? Auth login may still exist in Firebase Auth."
      )
    ) {
      return;
    }
    await remove(ref(database, paths.user(uid)));
    setMessage("User profile removed from RTDB.");
  }

  function openCreate() {
    setCreating(true);
    setCreateForm(EMPTY_CREATE);
    setCreateError("");
    setMessage("");
    setError("");
  }

  // Create Auth + profile via secondary Firebase app
  async function submitCreate(event) {
    event.preventDefault();
    setCreateBusy(true);
    setCreateError("");
    setError("");
    try {
      const result = await createCustomerUser(createForm);
      setMessage(
        `User created: ${result.email} (${result.uid}). They can sign in on the app with this email and password.`
      );
      setCreating(false);
      setCreateForm(EMPTY_CREATE);
    } catch (err) {
      const code = err?.code || "";
      let text = userFacingError(err, "Could not create user.");
      if (code === "auth/email-already-in-use") {
        text = "This email is already registered in Firebase Auth.";
      } else if (code === "auth/invalid-email") {
        text = "Enter a valid email address.";
      } else if (code === "auth/weak-password") {
        text = "Password is too weak (use at least 6 characters).";
      }
      setCreateError(text);
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Accounts</p>
        <div className="page-head row">
          <div>
            <h1>Users</h1>
            <p className="muted">
              Profiles, electricity rates, and onboarding status used by the app.
            </p>
          </div>
          <div className="row gap" style={{ alignItems: "center" }}>
            <div className="search-wrap">
              <input
                className="search"
                placeholder="Search name, email, provider, uid…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button type="button" className="btn primary" onClick={openCreate}>
              Add user
            </button>
          </div>
        </div>
      </header>

      <div className="summary-strip">
        <div className="summary-pill">
          <span className="summary-num">{summary.total}</span>
          <span className="muted small">Total</span>
        </div>
        <div className="summary-pill">
          <span className="summary-num">{summary.active}</span>
          <span className="muted small">Active</span>
        </div>
        <div className="summary-pill">
          <span className="summary-num">{summary.pending}</span>
          <span className="muted small">Pending onboarding</span>
        </div>
        <div className="summary-pill">
          <span className="summary-num">{summary.disabled}</span>
          <span className="muted small">Disabled</span>
        </div>
      </div>

      {message ? <div className="banner ok-banner">{message}</div> : null}
      {error ? <div className="banner error-banner">{error}</div> : null}

      <div className="toolbar">
        <div className="filter-tabs">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`filter-tab ${filter === item.id ? "active" : ""}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="muted small">
          Showing {rows.length} of {summary.total}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state panel">
          <strong>No users match</strong>
          <p className="muted">Try another filter or clear the search.</p>
        </div>
      ) : (
        <div className="table-wrap panel">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Provider / rate</th>
                <th>Onboarding</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.uid}>
                  <td>
                    <div className="user-cell">
                      <UserAvatar row={row} />
                      <div>
                        <strong>{row.fullName || "—"}</strong>
                        <div className="muted small">{row.email || "No email"}</div>
                        <div className="mono small">{row.uid}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <strong>
                        {row.electricityProviderName || "No provider"}
                      </strong>
                      <span className="muted small">
                        {row.electricityRate != null
                          ? `₱${Number(row.electricityRate).toFixed(2)} / kWh`
                          : "Rate not set"}
                      </span>
                      {row.electricityRateUpdatedAt ? (
                        <span className="muted small">
                          Since {formatWhen(row.electricityRateUpdatedAt)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge-pill ${
                        isOnboardingDone(row) ? "ok" : "warn"
                      }`}
                    >
                      {isOnboardingDone(row) ? "Done" : "Pending"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge-pill ${
                        row.disabled ? "warn" : "ok"
                      }`}
                    >
                      {row.disabled ? "Disabled" : "Active"}
                    </span>
                  </td>
                  <td className="actions">
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => startEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn danger sm"
                      onClick={() => deleteUserProfile(row.uid)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingUid ? (
        // Edit profile modal
        <div className="modal-backdrop">
          <form className="card modal modal-wide" onSubmit={saveEdit}>
            <p className="eyebrow">Edit profile</p>
            <div className="user-cell" style={{ marginBottom: 12 }}>
              <UserAvatar
                row={{ ...form, photoURL: editingProfile?.photoURL }}
                size={56}
              />
              <div>
                <h2 style={{ margin: 0 }}>{form.fullName || form.email || "User"}</h2>
                <p className="muted small mono" style={{ margin: "4px 0 0" }}>
                  {editingUid}
                </p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Full name
                <input
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                />
              </label>
              <label>
                Email
                <input value={form.email} disabled />
                <span className="muted small">
                  Login email cannot be changed from this panel.
                </span>
              </label>
              <label>
                Provider
                <select
                  value={form.electricityProviderId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      electricityProviderId: e.target.value,
                      electricityProviderName:
                        providerOptions.find(
                          (provider) => provider.id === e.target.value
                        )?.name || f.electricityProviderName,
                    }))
                  }
                >
                  {providerOptions.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                  <option value="custom">Custom / existing provider</option>
                </select>
              </label>
              {form.electricityProviderId === "custom" ? (
                <label>
                  Custom provider name
                  <input
                    value={form.electricityProviderName}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        electricityProviderName: e.target.value,
                      }))
                    }
                  />
                </label>
              ) : null}
              <label>
                Rate (₱/kWh)
                <input
                  value={form.electricityRate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, electricityRate: e.target.value }))
                  }
                />
              </label>
            </div>

            <div className="rate-history">
              <div className="rate-history-head">
                <strong>kWh rate history</strong>
                <span className="muted small">
                  Previous rates are archived when you save a new one
                </span>
              </div>

              <div className="rate-current">
                <span className="badge-pill ok">Current</span>
                <div>
                  <strong>
                    {editingProfile?.electricityRate != null
                      ? `₱${Number(editingProfile.electricityRate).toFixed(2)} / kWh`
                      : "Not set"}
                  </strong>
                  <div className="muted small">
                    {editingProfile?.electricityProviderName || "No provider"}
                    {editingProfile?.electricityRateUpdatedAt
                      ? ` · since ${formatWhen(editingProfile.electricityRateUpdatedAt)}`
                      : ""}
                  </div>
                </div>
              </div>

              {pastRates.length === 0 ? (
                <p className="muted small" style={{ margin: "10px 0 0" }}>
                  No previous rates yet. Change the kWh value and save to start
                  a history.
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
                          {item.providerName || "Provider unknown"}
                          {item.source ? ` · via ${item.source}` : ""}
                        </div>
                      </div>
                      <div className="rate-history-dates muted small">
                        <div>
                          Started {formatWhen(item.startedAt)}
                        </div>
                        <div>
                          Ended {formatWhen(item.endedAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={form.onboardingCompleted}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    onboardingCompleted: e.target.checked,
                  }))
                }
              />
              Onboarding complete
            </label>
            <p className="muted small" style={{ margin: "-4px 0 12px" }}>
              {form.onboardingCompleted
                ? "On — user skips onboarding and goes straight to the app."
                : "Off — user will see onboarding (Welcome → permissions, etc.) on next app open."}
            </p>

            <label className="check">
              <input
                type="checkbox"
                checked={form.disabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, disabled: e.target.checked }))
                }
              />
              Disabled (soft flag for support)
            </label>
            <div className="row gap modal-actions">
              <button type="submit" className="btn primary">
                Save changes
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setEditingUid(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {creating ? (
        // Create Auth + profile modal
        <div className="modal-backdrop">
          <form className="card modal modal-wide" onSubmit={submitCreate}>
            <p className="eyebrow">New account</p>
            <h2 style={{ marginTop: 0 }}>Add user</h2>
            <p className="muted small" style={{ marginTop: 0 }}>
              Creates a Firebase Auth login and RTDB profile. Share the email
              and temporary password with the customer so they can sign in on
              the app.
            </p>

            {createError ? (
              <div className="banner error-banner">{createError}</div>
            ) : null}

            <div className="form-grid">
              <label>
                Full name
                <input
                  required
                  value={createForm.fullName}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                  placeholder="Juan Dela Cruz"
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  autoComplete="off"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="user@email.com"
                />
              </label>
              <label className="span-2">
                Temporary password
                <input
                  required
                  type="text"
                  autoComplete="new-password"
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="At least 6 characters"
                />
              </label>
              <label>
                Provider
                <select
                  value={createForm.electricityProviderId || "meralco"}
                  disabled={createProviderDisabled}
                  onChange={(e) => {
                    const id = e.target.value;
                    const selected =
                      providerOptions.find((p) => p.id === id) ||
                      DEFAULT_PROVIDERS.find((p) => p.id === id);
                    setCreateForm((f) => ({
                      ...f,
                      electricityProviderId: id,
                      electricityProviderName:
                        selected?.name || selected?.shortName || id,
                    }));
                  }}
                >
                  {providerOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {createProviderDisabled ? (
                  <span className="muted small">
                    Provider locked while a custom rate is entered
                  </span>
                ) : null}
              </label>
              <label>
                Rate ₱/kWh (optional)
                <input
                  value={createForm.electricityRate}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      electricityRate: e.target.value,
                    }))
                  }
                  placeholder="Leave blank to use provider default"
                  inputMode="decimal"
                />
              </label>
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={createForm.markOnboarded}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    markOnboarded: e.target.checked,
                  }))
                }
              />
              Mark onboarding complete (only applies if a rate is set)
            </label>

            <div className="row gap modal-actions">
              <button
                type="submit"
                className="btn primary"
                disabled={createBusy}
              >
                {createBusy ? "Creating…" : "Create user"}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={createBusy}
                onClick={() => {
                  setCreating(false);
                  setCreateError("");
                }}
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
