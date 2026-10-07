/**
 * Admin auth gate for protected routes.
 * useAdminAuth listens for Firebase Auth and checks admins/{uid} in RTDB.
 * RequireAdmin redirects unsigned users to login and blocks non-admins.
 */
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { get, ref } from "firebase/database";
import { Navigate } from "react-router-dom";

import { auth, database } from "../firebase";
import { paths } from "../paths";

/** Live auth state + RTDB admin flag for the signed-in user. */
export function useAdminAuth() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe once; resolve admin claim from RTDB on each auth change
    return onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (!next) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      try {
        const snap = await get(ref(database, paths.admin(next.uid)));
        setIsAdmin(snap.val() === true);
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  return { user, isAdmin, loading, signOut: () => signOut(auth) };
}

/** Route wrapper: only render children when the user is a listed admin. */
export function RequireAdmin({ children }) {
  const { user, isAdmin, loading } = useAdminAuth();

  if (loading) {
    return <div className="center-page">Checking admin access…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <div className="center-page">
        <h2>Not an admin</h2>
        <p>
          Signed in as {user.email}. Add{" "}
          <code>admins/{user.uid} = true</code> in Firebase RTDB, then refresh.
        </p>
        <button type="button" onClick={() => signOut(auth)}>
          Sign out
        </button>
      </div>
    );
  }
  return children;
}
