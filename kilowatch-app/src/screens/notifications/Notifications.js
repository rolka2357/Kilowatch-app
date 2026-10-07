import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  get,
  limitToLast,
  onValue,
  orderByKey,
  query,
  ref,
} from "firebase/database";

import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import { auth, database } from "../../firebase/firebaseConfig";
import { homeDisplayName, normalizeEmailKey, paths } from "../../firebase/dbPaths";
import { acceptInvite, declineInvite } from "../../firebase/household";
import {
  getNotificationsLastRead,
  markNotificationsRead,
  subscribeNotificationReadState,
} from "../../notifications/notificationReadState";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createNotificationsStyles } from "./NotificationsStyles";
import { userFacingError } from "../../utils/userFacingError";

import BellIcon from "../../../assets/svg/shared/bell_icon.svg";
import HomeIcon from "../../../assets/svg/shared/home_icon.svg";
import KilosaveIcon from "../../../assets/svg/shared/kilosave_icon.svg";
import AppliancesIcon from "../../../assets/svg/shared/appliances_icon.svg";
import TipsNewsIcon from "../../../assets/svg/shared/tips_news_icon.svg";
import WarningIcon from "../../../assets/svg/kilosave/warning_alert.svg";

const ALERTS_PER_HOME = 40;
const MAX_ALERT_ITEMS = 80;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
];

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayKey(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "unknown";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayLabel(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const today = startOfDay();
  const that = startOfDay(d);
  const diffDays = Math.round((today - that) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatWhen(ts) {
  if (!ts) return "";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function NotificationTypeIcon({ kind, alertType, color }) {
  const size = 18;
  if (kind === "home" || alertType === "ownershipTransfer") {
    return <HomeIcon width={size} height={size} />;
  }
  if (kind === "news") {
    return <TipsNewsIcon width={15} height={18} color={color} />;
  }
  if (kind === "alarm" || alertType === "usageLimit") {
    return <WarningIcon width={18} height={18} />;
  }
  if (alertType === "kilosave") {
    return <KilosaveIcon width={18} height={18} color={color} />;
  }
  if (alertType === "schedule") {
    return <AppliancesIcon width={16} height={16} color={color} />;
  }
  return <BellIcon width={18} height={18} color={color} />;
}

const NotificationCard = memo(function NotificationCard({
  styles,
  item,
  onAccept,
  onDecline,
  accepting,
}) {
  const { colors } = useTheme();
  const iconColor = colors?.primary || "#FE6023";
  const badgeStyle = [
    styles.badge,
    item.kind === "alarm" && styles.badgeAlarm,
    item.kind === "alert" && styles.badgeAlert,
    item.kind === "home" && styles.badgeHome,
    item.kind === "news" && styles.badgeNews,
    item.alertType === "kilosave" && styles.badgeKilosave,
    item.alertType === "schedule" && styles.badgeSchedule,
    item.alertType === "usageLimit" && styles.badgeUsage,
  ];

  return (
    <View style={[styles.card, item.unread && styles.cardUnread]}>
      <View style={badgeStyle}>
        <NotificationTypeIcon
          kind={item.kind}
          alertType={item.alertType}
          color={iconColor}
        />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardCategory}>{item.category}</Text>
          {item.whenLabel ? (
            <Text style={styles.cardTime}>{item.whenLabel}</Text>
          ) : null}
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        {item.message ? (
          <Text style={styles.cardMessage} numberOfLines={3}>
            {item.message}
          </Text>
        ) : null}
        {item.kind === "home" && item.invite ? (
          <View style={styles.cardActions}>
            <Pressable
              style={styles.actionBtn}
              disabled={accepting}
              onPress={() => onAccept(item.invite)}
            >
              <Text style={styles.actionBtnText}>
                {accepting ? "Joining…" : "Accept"}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.actionBtnGhost]}
              disabled={accepting}
              onPress={() => onDecline(item.invite)}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnGhostText]}>
                Decline
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
});

function SectionHeader({ styles, title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

export default function Notifications() {
  const styles = useThemedStyles(createNotificationsStyles);
  const { colors } = useTheme();
  const user = auth.currentUser;
  const authUid = user?.uid || null;

  const [invites, setInvites] = useState([]);
  const [news, setNews] = useState([]);
  const [memberships, setMemberships] = useState({});
  const [alertsByHome, setAlertsByHome] = useState({});
  const [devicesByHome, setDevicesByHome] = useState({});
  const [appliancesByHome, setAppliancesByHome] = useState({});
  const [homeNames, setHomeNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState(null);
  const [dateFilter, setDateFilter] = useState("all");
  const [lastReadAt, setLastReadAt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!authUid) return undefined;
      let cancelled = false;
      markNotificationsRead(authUid).then((value) => {
        if (!cancelled) setLastReadAt(value);
      });
      return () => {
        cancelled = true;
      };
    }, [authUid])
  );

  useEffect(() => {
    if (!authUid) {
      setLastReadAt(0);
      return undefined;
    }
    let cancelled = false;
    getNotificationsLastRead(authUid).then((value) => {
      if (!cancelled) setLastReadAt(value);
    });
    const unsub = subscribeNotificationReadState((changedUid, value) => {
      if (changedUid === authUid) setLastReadAt(value);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [authUid]);

  const homeUids = useMemo(() => {
    const set = new Set();
    Object.entries(memberships || {}).forEach(([ownerUid, membership]) => {
      if (membership?.status === "active" && ownerUid) set.add(ownerUid);
    });
    return [...set];
  }, [memberships]);

  useEffect(() => {
    if (!authUid) {
      setLoading(false);
      return undefined;
    }

    let emailUnsub = null;

    const profileUnsub = onValue(
      ref(database, paths.userProfile(authUid)),
      (snapshot) => {
        const profile = snapshot.val() || {};
        const emailKey =
          profile.emailKey ||
          normalizeEmailKey(profile.email || user?.email || "");

        if (emailUnsub) emailUnsub();
        if (!emailKey) {
          setInvites([]);
          return;
        }

        emailUnsub = onValue(
          ref(database, paths.emailInvites(emailKey)),
          (inviteSnap) => {
            const value = inviteSnap.val() || {};
            setInvites(
              Object.values(value).filter(
                (invite) => invite?.status === "pending"
              )
            );
          }
        );
      }
    );

    const membershipsUnsub = onValue(
      ref(database, paths.memberships(authUid)),
      (snap) => setMemberships(snap.val() || {})
    );

    const newsUnsub = onValue(
      ref(database, paths.contentNews()),
      (snapshot) => {
        const value = snapshot.val() || {};
        const items = Object.entries(value)
          .map(([id, item]) => ({ id, ...item }))
          .filter((item) => item?.active !== false && item?.title)
          .sort(
            (a, b) =>
              Number(b.updatedAt || b.createdAt || 0) -
              Number(a.updatedAt || a.createdAt || 0)
          )
          .slice(0, 8);
        setNews(items);
        setLoading(false);
      },
      () => setLoading(false)
    );

    const fallback = setTimeout(() => setLoading(false), 2500);

    return () => {
      clearTimeout(fallback);
      profileUnsub();
      membershipsUnsub();
      if (emailUnsub) emailUnsub();
      newsUnsub();
    };
  }, [authUid, user?.email]);

  useEffect(() => {
    if (homeUids.length === 0) {
      setAlertsByHome({});
      setDevicesByHome({});
      setAppliancesByHome({});
      setHomeNames({});
      return undefined;
    }

    const unsubs = [];

    homeUids.forEach((homeUid) => {
      const alertsQ = query(
        ref(database, paths.homeAlerts(homeUid)),
        orderByKey(),
        limitToLast(ALERTS_PER_HOME)
      );
      unsubs.push(
        onValue(
          alertsQ,
          (snap) => {
            setAlertsByHome((prev) => ({
              ...prev,
              [homeUid]: snap.val() || {},
            }));
          },
          (error) => {
            console.warn(
              "alerts query failed",
              homeUid,
              error?.message || error
            );
          }
        )
      );

      unsubs.push(
        onValue(ref(database, paths.devices(homeUid)), (snap) => {
          setDevicesByHome((prev) => ({
            ...prev,
            [homeUid]: snap.val() || {},
          }));
        })
      );

      unsubs.push(
        onValue(ref(database, paths.appliances(homeUid)), (snap) => {
          setAppliancesByHome((prev) => ({
            ...prev,
            [homeUid]: snap.val() || {},
          }));
        })
      );

      unsubs.push(
        onValue(ref(database, paths.homeMeta(homeUid)), async (snap) => {
          const meta = snap.val() || {};
          if (meta.name) {
            setHomeNames((prev) => ({ ...prev, [homeUid]: meta.name }));
            return;
          }
          try {
            const profileSnap = await get(
              ref(database, paths.userProfile(homeUid))
            );
            const profile = profileSnap.val() || {};
            const label =
              homeUid === authUid
                ? "My Home"
                : memberships[homeUid]?.homeName ||
                  homeDisplayName(
                    profile.fullName ||
                      profile.displayName ||
                      profile.name ||
                      "Home"
                  );
            setHomeNames((prev) => ({ ...prev, [homeUid]: label }));
          } catch (_) {
            setHomeNames((prev) => ({
              ...prev,
              [homeUid]: homeUid === authUid ? "My Home" : "Home",
            }));
          }
        })
      );
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [authUid, homeUids, memberships]);

  const filterCutoff = useMemo(() => {
    const now = Date.now();
    if (dateFilter === "today") return startOfDay();
    if (dateFilter === "7d") return now - 7 * 86400000;
    if (dateFilter === "30d") return now - 30 * 86400000;
    return 0;
  }, [dateFilter]);

  const listRows = useMemo(() => {
    const inviteItems = invites.map((invite) => ({
      id: `home-${invite.inviteId}`,
      kind: "home",
      category: "Home invite",
      title: `Added to ${invite.homeName || "a home"}`,
      message: `${invite.inviterName || "Someone"} invited you as ${
        invite.role || "member"
      }.`,
      when: Number(invite.createdAt || 0),
      whenLabel: formatWhen(invite.createdAt),
      unread: Number(invite.createdAt || 0) > lastReadAt,
      invite,
      priority: 0,
    }));

    const alertItems = [];
    Object.entries(alertsByHome).forEach(([homeUid, alerts]) => {
      const homeLabel =
        homeNames[homeUid] ||
        memberships[homeUid]?.homeName ||
        (homeUid === authUid ? "My Home" : "Home");
      Object.entries(alerts || {}).forEach(([alertId, alert]) => {
        if (!alert?.title && !alert?.body) return;
        const type = alert.type || "homeAlert";
        if (type === "selfTest") return;
        // Transfer alert is for the new owner only.
        if (type === "ownershipTransfer") {
          if (alert.toUid && alert.toUid !== authUid) return;
          if (alert.publishedBy === authUid) return;
        }
        const when = Number(alert.createdAt || 0);
        if (filterCutoff && when && when < filterCutoff) return;

        const title = alert.title || "Kilowatch alert";
        const message = alert.body || "";
        alertItems.push({
          id: `alert-${homeUid}-${alertId}`,
          kind: "alert",
          alertType: type,
          category:
            type === "usageLimit"
              ? "Usage limit"
              : type === "schedule"
                ? "Schedule"
                : type === "kilosave"
                  ? "KiloSave"
                  : type === "ownershipTransfer"
                    ? "Home"
                    : "Alert",
          title,
          message,
          when,
          whenLabel: formatWhen(when),
          unread: when > lastReadAt,
          homeUid,
          homeName: homeLabel,
          priority: type === "ownershipTransfer" ? 0 : 1,
        });
      });
    });

    alertItems.sort((a, b) => Number(b.when || 0) - Number(a.when || 0));
    const cappedAlerts = alertItems.slice(0, MAX_ALERT_ITEMS);

    const offlineItems = [];
    Object.entries(devicesByHome).forEach(([homeUid, devices]) => {
      const appliances = appliancesByHome[homeUid] || {};
      const homeLabel =
        homeNames[homeUid] ||
        (homeUid === authUid ? "My Home" : "Home");
      Object.entries(devices || {}).forEach(([deviceId, device]) => {
        if (!device || device.online !== false) return;
        const when = Number(device.updatedAt || device.lastSeenAt || Date.now());
        if (filterCutoff && when < filterCutoff) return;
        const appliance = Object.values(appliances).find(
          (entry) => entry?.deviceId === deviceId
        );
        const name =
          appliance?.name || device.name || device.identifier || "Smart plug";
        offlineItems.push({
          id: `alarm-offline-${homeUid}-${deviceId}`,
          kind: "alarm",
          alertType: "offline",
          category: "Alarm",
          title: `${name} is offline`,
          message: `${homeLabel} — Check adapter power and Wi‑Fi.`,
          when,
          whenLabel: formatWhen(when),
          unread: true,
          priority: 1,
        });
      });
    });

    const newsItems =
      dateFilter === "all"
        ? news.map((item) => ({
            id: `news-${item.id}`,
            kind: "news",
            category: "News",
            title: item.title || "New update",
            message:
              item.description ||
              item.summary ||
              item.body ||
              "Open Tips & News to read more.",
            when: Number(item.updatedAt || item.createdAt || 0),
            whenLabel: formatWhen(item.updatedAt || item.createdAt),
            unread: false,
            priority: 2,
          }))
        : [];

    const history = [...cappedAlerts, ...offlineItems, ...newsItems].sort(
      (a, b) => Number(b.when || 0) - Number(a.when || 0)
    );

    const rows = [];

    if (inviteItems.length > 0) {
      rows.push({
        id: "section-invites",
        rowType: "section",
        title: "Home invites",
      });
      inviteItems
        .sort((a, b) => Number(b.when || 0) - Number(a.when || 0))
        .forEach((item) => rows.push({ ...item, rowType: "item" }));
    }

    let lastDay = null;
    history.forEach((item) => {
      const key = dayKey(item.when || Date.now());
      if (key !== lastDay) {
        lastDay = key;
        rows.push({
          id: `section-${key}`,
          rowType: "section",
          title: formatDayLabel(item.when || Date.now()),
        });
      }
      rows.push({ ...item, rowType: "item" });
    });

    return rows;
  }, [
    alertsByHome,
    appliancesByHome,
    authUid,
    dateFilter,
    devicesByHome,
    filterCutoff,
    homeNames,
    invites,
    lastReadAt,
    memberships,
    news,
  ]);

  const handleAccept = useCallback(async (invite) => {
    setAcceptingId(invite.inviteId);
    try {
      await acceptInvite(invite);
    } catch (error) {
      Alert.alert("Accept failed", userFacingError(error));
    } finally {
      setAcceptingId(null);
    }
  }, []);

  const handleDecline = useCallback((invite) => {
    Alert.alert("Decline invitation?", "You can be invited again later.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          try {
            await declineInvite(invite);
          } catch (error) {
            Alert.alert("Decline failed", userFacingError(error));
          }
        },
      },
    ]);
  }, []);

  const renderItem = useCallback(
    ({ item }) => {
      if (item.rowType === "section") {
        return <SectionHeader styles={styles} title={item.title} />;
      }
      return (
        <NotificationCard
          styles={styles}
          item={item}
          accepting={acceptingId === item.invite?.inviteId}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
      );
    },
    [acceptingId, handleAccept, handleDecline, styles]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const ListHeader = useMemo(
    () => (
      <View style={styles.filterRow}>
        {FILTERS.map((filter) => {
          const active = dateFilter === filter.id;
          return (
            <Pressable
              key={filter.id}
              onPress={() => setDateFilter(filter.id)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ),
    [dateFilter, styles]
  );

  return (
    <View style={styles.screen}>
      <SettingsHeader title="Notifications" showBack />

      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          data={listRows}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>You're all caught up</Text>
              <Text style={styles.emptyBody}>
                Schedule and usage-limit alerts, home invites, and news will
                show up here — even if you missed a push notification.
              </Text>
            </View>
          }
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
