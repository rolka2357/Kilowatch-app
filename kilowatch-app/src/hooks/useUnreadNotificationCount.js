import { useEffect, useMemo, useState } from "react";
import {
  limitToLast,
  onValue,
  orderByKey,
  query,
  ref,
} from "firebase/database";

import { auth, database } from "../firebase/firebaseConfig";
import { normalizeEmailKey, paths } from "../firebase/dbPaths";
import { useHome } from "../context/HomeContext";
import {
  getNotificationsLastRead,
  subscribeNotificationReadState,
} from "../notifications/notificationReadState";

const ALERTS_PER_HOME = 40;

/**
 * Unread count for the header bell badge:
 * pending invites + home alerts newer than the last time the user opened
 * the Notifications screen.
 */
export default function useUnreadNotificationCount() {
  const { authUid, homes } = useHome();
  const uid = authUid || auth.currentUser?.uid || null;

  const [lastReadAt, setLastReadAt] = useState(0);
  const [inviteItems, setInviteItems] = useState([]);
  const [alertsByHome, setAlertsByHome] = useState({});

  const homeUids = useMemo(() => {
    const set = new Set();
    if (uid) set.add(uid);
    (homes || []).forEach((home) => {
      if (home?.status === "active" && home?.ownerUid) {
        set.add(home.ownerUid);
      }
    });
    return [...set];
  }, [uid, homes]);

  useEffect(() => {
    if (!uid) {
      setLastReadAt(0);
      return undefined;
    }

    let cancelled = false;
    getNotificationsLastRead(uid).then((value) => {
      if (!cancelled) setLastReadAt(value);
    });

    const unsub = subscribeNotificationReadState((changedUid, value) => {
      if (changedUid === uid) setLastReadAt(value);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setInviteItems([]);
      return undefined;
    }

    let emailUnsub = null;
    const profileUnsub = onValue(
      ref(database, paths.userProfile(uid)),
      (snapshot) => {
        const profile = snapshot.val() || {};
        const emailKey =
          profile.emailKey ||
          normalizeEmailKey(profile.email || auth.currentUser?.email || "");

        if (emailUnsub) emailUnsub();
        if (!emailKey) {
          setInviteItems([]);
          return;
        }

        emailUnsub = onValue(
          ref(database, paths.emailInvites(emailKey)),
          (inviteSnap) => {
            const value = inviteSnap.val() || {};
            setInviteItems(
              Object.values(value).filter(
                (invite) => invite?.status === "pending"
              )
            );
          }
        );
      }
    );

    return () => {
      profileUnsub();
      if (emailUnsub) emailUnsub();
    };
  }, [uid]);

  useEffect(() => {
    if (homeUids.length === 0) {
      setAlertsByHome({});
      return undefined;
    }

    const unsubs = homeUids.map((homeUid) =>
      onValue(
        query(
          ref(database, paths.homeAlerts(homeUid)),
          orderByKey(),
          limitToLast(ALERTS_PER_HOME)
        ),
        (snap) => {
          setAlertsByHome((prev) => ({
            ...prev,
            [homeUid]: snap.val() || {},
          }));
        },
        () => {
          setAlertsByHome((prev) => ({
            ...prev,
            [homeUid]: {},
          }));
        }
      )
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [homeUids.join("|")]);

  const count = useMemo(() => {
    let total = 0;

    inviteItems.forEach((invite) => {
      const when = Number(invite?.createdAt || 0);
      if (when > lastReadAt) total += 1;
    });

    Object.values(alertsByHome).forEach((alerts) => {
      Object.values(alerts || {}).forEach((alert) => {
        if (!alert || alert.type === "selfTest") return;
        if (!alert.title && !alert.body) return;
        const when = Number(alert.createdAt || 0);
        if (when > lastReadAt) total += 1;
      });
    });

    return total;
  }, [inviteItems, alertsByHome, lastReadAt]);

  return {
    count,
    label: count > 99 ? "99+" : count > 0 ? String(count) : "",
    lastReadAt,
  };
}
