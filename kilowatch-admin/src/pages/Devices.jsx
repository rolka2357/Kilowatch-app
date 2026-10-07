/**
 * Devices inventory page: all paired plugs across homes.
 * Live-subscribes to devices, appliances, rooms, live, and users, then
 * flattens into searchable/filterable cards with online status and power.
 */
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";

import { database } from "../firebase";
import { paths } from "../paths";
import { userFacingError } from "../userFacingError";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "online", label: "Online" },
  { id: "offline", label: "Offline" },
  { id: "on", label: "Switch on" },
  { id: "orphan", label: "No appliance" },
];

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

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Only count live kWh when the reading’s date is today. */
function isLiveToday(live, date = new Date()) {
  return String(live?.date || "") === todayKey(date);
}

export default function Devices() {
  const [devicesTree, setDevicesTree] = useState({});
  const [appliancesTree, setAppliancesTree] = useState({});
  const [roomsTree, setRoomsTree] = useState({});
  const [liveTree, setLiveTree] = useState({});
  const [users, setUsers] = useState({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  // Subscribe to all trees needed to resolve owner / appliance / live
  useEffect(() => {
    const unsubs = [
      onValue(
        ref(database, paths.devicesRoot()),
        (snap) => setDevicesTree(snap.val() || {}),
        (err) => setError(userFacingError(err, "Could not load devices"))
      ),
      onValue(ref(database, paths.appliancesRoot()), (snap) =>
        setAppliancesTree(snap.val() || {})
      ),
      onValue(ref(database, paths.roomsRoot()), (snap) =>
        setRoomsTree(snap.val() || {})
      ),
      onValue(ref(database, paths.liveRoot()), (snap) =>
        setLiveTree(snap.val() || {})
      ),
      onValue(ref(database, paths.users()), (snap) =>
        setUsers(snap.val() || {})
      ),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, []);

  // Flatten owner → device map into display rows (join appliance/room/live)
  const rows = useMemo(() => {
    const list = [];
    Object.entries(devicesTree || {}).forEach(([ownerUid, devices]) => {
      Object.entries(devices || {}).forEach(([deviceId, device]) => {
        const appliances = appliancesTree[ownerUid] || {};
        const rooms = roomsTree[ownerUid] || {};
        const live = liveTree[ownerUid]?.[deviceId] || {};
        const owner = users[ownerUid] || {};

        let applianceName = null;
        let roomName = null;
        const applianceId = device?.applianceId;
        if (applianceId && appliances[applianceId]) {
          applianceName = appliances[applianceId].name || null;
          const roomId =
            appliances[applianceId].roomId || device?.roomId || null;
          if (roomId && rooms[roomId]) {
            roomName = rooms[roomId].name || null;
          }
        } else {
          const linked = Object.values(appliances).find(
            (a) => a?.deviceId === deviceId
          );
          if (linked) {
            applianceName = linked.name || null;
            if (linked.roomId && rooms[linked.roomId]) {
              roomName = rooms[linked.roomId].name || null;
            }
          } else if (device?.roomId && rooms[device.roomId]) {
            roomName = rooms[device.roomId].name || null;
          }
        }

        list.push({
          key: `${ownerUid}:${deviceId}`,
          ownerUid,
          deviceId,
          applianceName,
          roomName,
          ownerName: owner.fullName || owner.email || ownerUid,
          ownerEmail: owner.email || "",
          online: Boolean(device?.online),
          switchOn: Boolean(device?.switchOn),
          provider: device?.provider || "tuya",
          pairedAt: device?.pairedAt || null,
          updatedAt: device?.updatedAt || null,
          identifier: device?.identifier || null,
          powerW: live?.powerW ?? null,
          kwh: isLiveToday(live) ? Number(live?.kwh || 0) : 0,
          liveAt: live?.timestamp || null,
        });
      });
    });
    return list.sort((a, b) =>
      String(a.applianceName || a.deviceId).localeCompare(
        String(b.applianceName || b.deviceId)
      )
    );
  }, [devicesTree, appliancesTree, roomsTree, liveTree, users]);

  const summary = useMemo(() => {
    const online = rows.filter((r) => r.online).length;
    const switchOn = rows.filter((r) => r.switchOn).length;
    const orphan = rows.filter((r) => !r.applianceName).length;
    return {
      total: rows.length,
      online,
      offline: rows.length - online,
      switchOn,
      orphan,
    };
  }, [rows]);

  // Online / offline / switch / orphan filter + text search
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "online" && !row.online) return false;
      if (filter === "offline" && row.online) return false;
      if (filter === "on" && !row.switchOn) return false;
      if (filter === "orphan" && row.applianceName) return false;
      if (!q) return true;
      return (
        String(row.applianceName || "").toLowerCase().includes(q) ||
        String(row.roomName || "").toLowerCase().includes(q) ||
        String(row.ownerName || "").toLowerCase().includes(q) ||
        String(row.ownerEmail || "").toLowerCase().includes(q) ||
        String(row.deviceId || "").toLowerCase().includes(q) ||
        String(row.identifier || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Hardware</p>
        <div className="page-head row">
          <div>
            <h1>Devices</h1>
            <p className="muted">
              Pairing status: each Plug ID is listed with its owner User ID,
              plus online status and live power.
            </p>
          </div>
          <div className="search-wrap">
            <input
              className="search"
              placeholder="Search appliance, room, owner, device id…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="summary-strip">
        <div className="summary-pill">
          <span className="summary-num">{summary.total}</span>
          <span className="muted small">Total plugs</span>
        </div>
        <div className="summary-pill">
          <span className="summary-num">{summary.online}</span>
          <span className="muted small">Online</span>
        </div>
        <div className="summary-pill">
          <span className="summary-num">{summary.offline}</span>
          <span className="muted small">Offline</span>
        </div>
        <div className="summary-pill">
          <span className="summary-num">{summary.orphan}</span>
          <span className="muted small">Unlinked</span>
        </div>
      </div>

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
          Showing {filtered.length} of {summary.total}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state panel">
          <strong>No devices found</strong>
          <p className="muted">
            Paired plugs appear here once users add appliances in the app.
          </p>
        </div>
      ) : (
        <div className="device-grid">
          {filtered.map((row) => (
            <article
              key={row.key}
              className={`device-card ${row.online ? "is-online" : "is-offline"}`}
            >
              <div className="device-card-top">
                <div>
                  <h3>{row.applianceName || "Unlinked plug"}</h3>
                  <p className="muted small">
                    {row.roomName || "No room"} · {row.ownerName}
                  </p>
                </div>
                <div className="device-badges">
                  <span
                    className={`badge-pill ${row.online ? "ok" : "warn"}`}
                  >
                    {row.online ? "Online" : "Offline"}
                  </span>
                  <span
                    className={`badge-pill ${row.switchOn ? "ok" : ""}`}
                  >
                    {row.switchOn ? "On" : "Off"}
                  </span>
                </div>
              </div>

              <div className="device-metrics">
                <div>
                  <span className="muted small">Power</span>
                  <strong>
                    {row.powerW != null
                      ? `${Number(row.powerW).toFixed(0)} W`
                      : "—"}
                  </strong>
                </div>
                <div>
                  <span className="muted small">Today kWh</span>
                  <strong>
                    {row.kwh != null ? Number(row.kwh).toFixed(3) : "—"}
                  </strong>
                </div>
              </div>

              <div className="device-meta">
                <div className="pairing-row">
                  <span className="muted small">Plug ID</span>
                  <span className="mono small">{row.deviceId}</span>
                </div>
                <div className="pairing-row">
                  <span className="muted small">User ID</span>
                  <span className="mono small">{row.ownerUid}</span>
                </div>
                {row.identifier ? (
                  <div className="pairing-row">
                    <span className="muted small">QR / box</span>
                    <span className="muted small">{row.identifier}</span>
                  </div>
                ) : null}
                <div className="muted small">
                  Paired {formatWhen(row.pairedAt)}
                </div>
                <div className="muted small">
                  Live {formatWhen(row.liveAt || row.updatedAt)}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
