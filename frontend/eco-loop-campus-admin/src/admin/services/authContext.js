import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAdminProfile, loadAdminSession, signOutAdmin } from "./supabaseStore";

const AuthContext = createContext(null);

async function makeAuthState(user) {
  if (!user) return { loading: false, user: null, profile: null, source: null, error: null };
  const profileResult = await getAdminProfile(user);
  return {
    loading: false,
    user,
    profile: profileResult.data,
    source: profileResult.source,
    error: profileResult.error,
  };
}

export function AdminAuthProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    user: null,
    profile: null,
    source: null,
    error: null,
  });

  const applyAuthUser = useCallback(async user => {
    const nextState = await makeAuthState(user);
    setState(nextState);
    return nextState;
  }, []);

  const logout = useCallback(async () => {
    await signOutAdmin();
    setState({ loading: false, user: null, profile: null, source: null, error: null });
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSession() {
      const session = await loadAdminSession();
      const sessionData = session.data || {};
      if (!active) return;
      setState({
        loading: false,
        user: sessionData.user || session.data,
        profile: Object.prototype.hasOwnProperty.call(sessionData, "profile") ? sessionData.profile : session.data,
        source: session.source,
        error: session.error,
      });
    }
    loadSession();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({ ...state, isAdmin: Boolean(state.profile), applyAuthUser, logout }), [state, applyAuthUser, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return context;
}
