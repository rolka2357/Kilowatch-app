/**
 * News CMS for Tips & News (and highlight cards on Appliances / Analytics).
 * Live list with filters; create/edit supports image URL or embedded upload;
 * toggle active/highlight and delete from the card grid.
 */
import { useEffect, useMemo, useState } from "react";
import { onValue, push, ref, remove, set, update } from "firebase/database";

import { database } from "../firebase";
import { paths } from "../paths";
import { userFacingError } from "../userFacingError";

const EMPTY = {
  title: "",
  description: "",
  imageUrl: "",
  link: "",
  order: 1,
  active: true,
  highlight: false,
  publishedAt: "",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_EMBEDDED_IMAGE_BYTES = 350 * 1024;

function dataUrlBytes(dataUrl) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return dataUrl.length;
  return Math.ceil(((dataUrl.length - comma - 1) * 3) / 4);
}

async function compressNewsImage(selectedFile) {
  const objectUrl = URL.createObjectURL(selectedFile);
  try {
    const image = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error("Could not read the selected image."));
      node.src = objectUrl;
    });

    const maxWidth = 1200;
    const maxHeight = 800;
    const initialScale = Math.min(
      1,
      maxWidth / image.naturalWidth,
      maxHeight / image.naturalHeight
    );
    let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
    let height = Math.max(1, Math.round(image.naturalHeight * initialScale));
    let quality = 0.84;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrlBytes(dataUrl) <= MAX_EMBEDDED_IMAGE_BYTES) return dataUrl;

      quality = Math.max(0.5, quality - 0.08);
      width = Math.max(1, Math.round(width * 0.85));
      height = Math.max(1, Math.round(height * 0.85));
    }
    throw new Error("Image is too large to save. Choose a smaller image.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function formatWhen(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function toDateInputValue(ts) {
  const d = ts ? new Date(ts) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fromDateInputValue(value) {
  if (!value) return Date.now();
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return Date.now();
  return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
}

export default function News() {
  const [items, setItems] = useState({});
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    // Live news items under content/news
    return onValue(ref(database, paths.news()), (snap) => {
      setItems(snap.val() || {});
    });
  }, []);

  const allRows = useMemo(
    () =>
      Object.entries(items)
        .map(([id, row]) => ({ id, ...(row || {}) }))
        .sort((a, b) => Number(a.order || 99) - Number(b.order || 99)),
    [items]
  );

  const summary = useMemo(() => {
    const live = allRows.filter((r) => r.active !== false).length;
    const highlights = allRows.filter(
      (r) => r.active !== false && r.highlight === true
    ).length;
    return {
      total: allRows.length,
      live,
      highlights,
      hidden: allRows.length - live,
    };
  }, [allRows]);

  // Filter tabs: all / live / highlights / hidden
  const rows = useMemo(() => {
    if (filter === "live") return allRows.filter((r) => r.active !== false);
    if (filter === "hidden") return allRows.filter((r) => r.active === false);
    if (filter === "highlights")
      return allRows.filter(
        (r) => r.active !== false && r.highlight === true
      );
    return allRows;
  }, [allRows, filter]);

  function openCreate() {
    setEditingId("new");
    setForm({
      ...EMPTY,
      order: allRows.length + 1,
      publishedAt: toDateInputValue(Date.now()),
    });
    setFile(null);
    setMessage("");
    setError("");
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({
      title: row.title || "",
      description: row.description || "",
      imageUrl: row.imageUrl || "",
      link: row.link || "",
      order: row.order ?? 1,
      active: row.active !== false,
      highlight: row.highlight === true,
      publishedAt: toDateInputValue(row.publishedAt || Date.now()),
    });
    setFile(null);
    setMessage("");
    setError("");
  }

  // Firebase Storage is unavailable while project billing is disabled.
  // Compress a selected file and store its data URL with the RTDB News record.
  // The Android app's Image component accepts this same `imageUrl` field.
  async function resolveImageUrl() {
    if (!file) return form.imageUrl.trim();
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      throw new Error("Upload a JPG, PNG, or WebP image.");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("Image must be no larger than 5 MB.");
    }

    return compressNewsImage(file);
  }

  // Create or update news item in RTDB
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const newsId =
        editingId === "new" ? push(ref(database, paths.news())).key : editingId;
      const imageUrl = await resolveImageUrl();
      const payload = {
        id: newsId,
        title: form.title.trim(),
        description: form.description.trim(),
        imageUrl: imageUrl || "",
        link: form.link.trim(),
        order: Number(form.order) || 1,
        active: Boolean(form.active),
        highlight: Boolean(form.highlight),
        updatedAt: Date.now(),
        publishedAt: fromDateInputValue(form.publishedAt),
      };
      await set(ref(database, paths.newsItem(newsId)), payload);
      setEditingId(null);
      setMessage("News saved.");
    } catch (err) {
      setError(userFacingError(err, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  async function removeNews(id) {
    if (!window.confirm("Delete this news item?")) return;
    await remove(ref(database, paths.newsItem(id)));
    setError("");
    setMessage("News deleted.");
  }

  async function toggleActive(row) {
    await update(ref(database, paths.newsItem(row.id)), {
      active: row.active === false,
      updatedAt: Date.now(),
    });
  }

  async function toggleHighlight(row) {
    await update(ref(database, paths.newsItem(row.id)), {
      highlight: row.highlight !== true,
      updatedAt: Date.now(),
    });
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Content</p>
        <div className="page-head row">
          <div>
            <h1>News</h1>
            <p className="muted">
              All active cards show in Tips &amp; News. Highlights also appear
              on Appliances and Analytics.
            </p>
          </div>
          <button type="button" className="btn primary" onClick={openCreate}>
            Add news
          </button>
        </div>
      </header>

      <div className="summary-strip">
        <div className="summary-pill">
          <span className="summary-num">{summary.total}</span>
          <span className="muted small">Total</span>
        </div>
        <div className="summary-pill">
          <span className="summary-num">{summary.live}</span>
          <span className="muted small">Live in app</span>
        </div>
        <div className="summary-pill">
          <span className="summary-num">{summary.highlights}</span>
          <span className="muted small">Highlights</span>
        </div>
        <div className="summary-pill">
          <span className="summary-num">{summary.hidden}</span>
          <span className="muted small">Hidden</span>
        </div>
      </div>

      {message ? <div className="banner ok-banner">{message}</div> : null}
      {error ? <div className="banner error-banner">{error}</div> : null}

      <div className="toolbar">
        <div className="filter-tabs">
          {[
            { id: "all", label: "All" },
            { id: "live", label: "Live" },
            { id: "highlights", label: "Highlights" },
            { id: "hidden", label: "Hidden" },
          ].map((item) => (
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
        <p className="muted small">{rows.length} cards</p>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state panel">
          <strong>No news cards yet</strong>
          <p className="muted">
            Add an article to show it in Tips &amp; News on mobile.
          </p>
          <button type="button" className="btn primary" onClick={openCreate}>
            Add news
          </button>
        </div>
      ) : (
        <div className="news-grid">
          {rows.map((row) => (
            <article
              key={row.id}
              className={`news-card panel ${
                row.active === false ? "is-inactive" : ""
              }`}
            >
              <div
                className="news-image"
                style={{
                  backgroundImage: row.imageUrl
                    ? `url(${row.imageUrl})`
                    : undefined,
                }}
              >
                {!row.imageUrl ? (
                  <span className="news-image-placeholder">No image</span>
                ) : null}
                <span
                  className={`news-status badge-pill ${
                    row.active === false ? "warn" : "ok"
                  }`}
                >
                  {row.active === false ? "Hidden" : "Live"}
                </span>
                {row.highlight === true && row.active !== false ? (
                  <span className="news-highlight badge-pill ok">Highlight</span>
                ) : null}
              </div>
              <div className="news-body">
                <div className="news-order muted small">Order {row.order ?? "—"}</div>
                <h3>{row.title || "Untitled"}</h3>
                <p className="news-desc">{row.description}</p>
                <div className="news-meta">
                  <span className="muted small">
                    Published {formatWhen(row.publishedAt)}
                  </span>
                  {row.link ? (
                    <a href={row.link} target="_blank" rel="noreferrer">
                      Open link
                    </a>
                  ) : (
                    <span className="muted small">No link</span>
                  )}
                </div>
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
                    className="btn ghost sm"
                    onClick={() => toggleHighlight(row)}
                  >
                    {row.highlight === true ? "Unhighlight" : "Highlight"}
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => toggleActive(row)}
                  >
                    {row.active === false ? "Publish" : "Hide"}
                  </button>
                  <button
                    type="button"
                    className="btn danger sm"
                    onClick={() => removeNews(row.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editingId ? (
        // Create / edit news modal
        <div className="modal-backdrop">
          <form className="card modal modal-wide" onSubmit={save}>
            <p className="eyebrow">News card</p>
            <h2>{editingId === "new" ? "Add news" : "Edit news"}</h2>
            {(form.imageUrl || file) && (
              <div
                className="news-preview"
                style={{
                  backgroundImage: form.imageUrl
                    ? `url(${form.imageUrl})`
                    : undefined,
                }}
              >
                {file ? (
                  <span className="muted small">New upload selected</span>
                ) : null}
              </div>
            )}
            <div className="form-grid">
              <label className="span-2">
                Title
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="span-2">
                Description / duration
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="2 min read"
                  required
                />
              </label>
              <label className="span-2">
                Link (opens when user taps the card)
                <input
                  value={form.link}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, link: e.target.value }))
                  }
                  placeholder="https://…"
                />
              </label>
              <label className="span-2">
                Image URL
                <input
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, imageUrl: e.target.value }))
                  }
                  placeholder="https://… or upload below"
                />
              </label>
              <label>
                Or upload image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <span className="muted small">
                  JPG, PNG, or WebP · max 5 MB · compressed automatically
                </span>
              </label>
              <label>
                Date added
                <input
                  type="date"
                  value={form.publishedAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, publishedAt: e.target.value }))
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
            <label className="check">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
              />
              Active (visible in Tips &amp; News)
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.highlight}
                onChange={(e) =>
                  setForm((f) => ({ ...f, highlight: e.target.checked }))
                }
              />
              Highlight (also show on Appliances &amp; Analytics)
            </label>
            <div className="row gap modal-actions">
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? "Saving…" : "Save news"}
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
