/**
 * PURPOSE: Active-home context for the signed-in session.
 * Tracks which home the user is viewing (own vs joined), derives canEdit /
 * isHomeOwner, and resets activeHomeOwnerUid if membership is lost.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { get, onValue, ref } from "firebase/database";

import { auth, database } from "../firebase/firebaseConfig";
import { homeDisplayName, paths } from "../firebase/dbPaths";
import {
  ensureEmailIndex,
  ensureOwnHome,
  ROLES,
  setActiveHome,
} from "../firebase/household";
import { isAccountDisabled } from "../firebase/accountAccess";

const HomeContext = createContext({
  authUid: null,
  activeHomeOwnerUid: null,
  activeRole: ROLES.OWNER,
  canEdit: true,
  isOwnHome: true,
  isHomeOwner: true,
  homes: [],
  loading: true,
});

function ownsUidKeyedHome(authUid, ownMember, memberships) {
  if (!authUid) return false;
  if (ownMember?.status === "active") return true;
  return memberships?.[authUid]?.status === "active";
}

function isActiveMembership(memberships, ownerUid, authUid, ownMember) {
  if (!ownerUid || !authUid) return false;
  if (ownerUid === authUid) {
    return ownsUidKeyedHome(authUid, ownMember, memberships);
  }
  return memberships?.[ownerUid]?.status === "active";
}

export function HomeProvider({ children }) {
  const user = auth.currentUser;
  const authUid = user?.uid || null;
  const [activeHomeOwnerUid, setActiveHomeOwnerUid] = useState(authUid);
  const [memberships, setMemberships] = useState({});
  const [membershipsReady, setMembershipsReady] = useState(false);
  const [profile, setProfile] = useState({});
  const [ownMember, setOwnMember] = useState(null);
  const [activeMember, setActiveMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const resettingHomeRef = useRef(false);

  // Bootstrap email index + own home, then subscribe to profile/memberships.
  useEffect(() => {
    if (!authUid || !user) {
      setLoading(false);
      setMembershipsReady(false);
      return undefined;
    }

    let cancelled = false;
    setMembershipsReady(false);
    resettingHomeRef.current = false;

    (async () => {
      try {
        // One-shot read — avoid onValue + unsub (callback can fire before unsub is assigned)
        const profileSnap = await get(ref(database, paths.userProfile(authUid)));
        const profileValue = profileSnap.val() || {};
        if (!cancelled) setProfile(profileValue);
        if (isAccountDisabled(profileValue)) return;
        await ensureEmailIndex(user, profileValue);
        await ensureOwnHome(user, profileValue);
      } catch (error) {
        console.warn("Home bootstrap skipped", error);
      }
    })();

    const unsubProfile = onValue(
      ref(database, paths.userProfile(authUid)),
      (snapshot) => {
        const value = snapshot.val() || {};
        setProfile(value);
        setActiveHomeOwnerUid(value.activeHomeOwnerUid || null);
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsubMemberships = onValue(
      ref(database, paths.memberships(authUid)),
      (snapshot) => {
        setMemberships(snapshot.val() || {});
        setMembershipsReady(true);
      },
      () => {
        setMemberships({});
        setMembershipsReady(true);
      }
    );

    const unsubOwnMember = onValue(
      ref(database, paths.homeMember(authUid, authUid)),
      (snapshot) => setOwnMember(snapshot.val())
    );

    return () => {
      cancelled = true;
      unsubProfile();
      unsubMemberships();
      unsubOwnMember();
    };
  }, [authUid]);

  useEffect(() => {
    const homeId = activeHomeOwnerUid;
    if (!homeId || !authUid) {
      setActiveMember(null);
      return undefined;
    }

    const unsubscribe = onValue(
      ref(database, paths.homeMember(homeId, authUid)),
      (snapshot) => setActiveMember(snapshot.val()),
      () => setActiveMember(null)
    );
    return unsubscribe;
  }, [activeHomeOwnerUid, authUid]);

  // If the user was kicked/removed, activeHomeOwnerUid can still point at that
  // house. Move them to another home they still belong to, or clear it.
  useEffect(() => {
    if (!authUid || !membershipsReady || loading) return undefined;
    const selected = activeHomeOwnerUid;
    if (
      selected &&
      isActiveMembership(memberships, selected, authUid, ownMember)
    ) {
      return undefined;
    }
    if (!selected && !ownsUidKeyedHome(authUid, ownMember, memberships)) {
      const hasOther = Object.entries(memberships).some(
        ([id, membership]) => id !== authUid && membership?.status === "active"
      );
      if (!hasOther) return undefined;
    }
    if (resettingHomeRef.current) return undefined;

    const nextHomeId = ownsUidKeyedHome(authUid, ownMember, memberships)
      ? authUid
      : Object.keys(memberships).find(
          (id) => id !== authUid && memberships[id]?.status === "active"
        ) || null;

    if (nextHomeId === selected) return undefined;

    resettingHomeRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        await setActiveHome(nextHomeId);
        if (!cancelled) setActiveHomeOwnerUid(nextHomeId);
      } catch (error) {
        console.warn("Failed to reset active home after membership loss", error);
      } finally {
        if (!cancelled) resettingHomeRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authUid,
    activeHomeOwnerUid,
    memberships,
    membershipsReady,
    loading,
    ownMember,
  ]);

  // Own home first, then every other active membership for the home switcher.
  // The uid-keyed house is hidden once ownership was transferred and this
  // user is no longer an active member.
  const homes = useMemo(() => {
    const list = [];
    if (authUid && ownsUidKeyedHome(authUid, ownMember, memberships)) {
      const ownRole =
        ownMember?.role || memberships[authUid]?.role || ROLES.OWNER;
      const ownHomeName =
        memberships[authUid]?.homeName ||
        (ownMember?.homeName ? String(ownMember.homeName) : null) ||
        "My Home";
      list.push({
        ownerUid: authUid,
        homeName: ownHomeName,
        ownerName: profile.fullName || user?.displayName || "Me",
        role: ownRole,
        status: "active",
        isOwn: true,
      });
    }

    Object.entries(memberships).forEach(([ownerUid, membership]) => {
      if (!membership || ownerUid === authUid) return;
      if (membership.status !== "active") return;
      list.push({
        ownerUid,
        homeName: membership.homeName || homeDisplayName(membership.ownerName),
        ownerName: membership.ownerName || "Home",
        role: membership.role || ROLES.VIEWER,
        status: "active",
        isOwn: false,
      });
    });

    return list;
  }, [
    authUid,
    memberships,
    ownMember,
    profile.fullName,
    user?.displayName,
  ]);

  const selectedHomeId = useMemo(() => {
    if (
      activeHomeOwnerUid &&
      isActiveMembership(memberships, activeHomeOwnerUid, authUid, ownMember)
    ) {
      return activeHomeOwnerUid;
    }
    if (ownsUidKeyedHome(authUid, ownMember, memberships)) return authUid;
    const other = Object.keys(memberships).find(
      (id) => id !== authUid && memberships[id]?.status === "active"
    );
    return other || null;
  }, [activeHomeOwnerUid, authUid, memberships, ownMember]);

  const activeRole = useMemo(() => {
    if (!selectedHomeId) return ROLES.VIEWER;
    if (activeMember?.role && activeHomeOwnerUid === selectedHomeId) {
      return activeMember.role;
    }
    if (selectedHomeId === authUid) {
      return ownMember?.role || memberships[authUid]?.role || ROLES.OWNER;
    }
    return memberships[selectedHomeId]?.role || ROLES.VIEWER;
  }, [
    activeHomeOwnerUid,
    activeMember,
    authUid,
    memberships,
    ownMember,
    selectedHomeId,
  ]);

  const selectedHome = homes.find((home) => home.ownerUid === selectedHomeId);
  const isOwnHome = Boolean(selectedHomeId) && selectedHomeId === authUid;
  const isHomeOwner = activeRole === ROLES.OWNER;

  const value = useMemo(
    () => ({
      authUid,
      activeHomeOwnerUid: selectedHomeId,
      activeRole,
      canEdit: activeRole === ROLES.OWNER || activeRole === ROLES.EDITOR,
      isOwnHome,
      isHomeOwner,
      homes,
      // Only show "My Home" when we're actually on the user's own home.
      activeHomeName: selectedHome?.homeName || (isOwnHome ? "My Home" : "Home"),
      loading,
    }),
    [
      authUid,
      selectedHomeId,
      activeRole,
      homes,
      isHomeOwner,
      isOwnHome,
      selectedHome,
      loading,
    ]
  );

  return <HomeContext.Provider value={value}>{children}</HomeContext.Provider>;
}

export function useHome() {
  return useContext(HomeContext);
}
