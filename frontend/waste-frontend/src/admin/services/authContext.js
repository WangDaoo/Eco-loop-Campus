import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../supabaseClient";
import { getAdminProfile } from "./supabaseStore";

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

  useEffect(() => {
    let active = true;

    async function loadSession() {
      if (!isSupabaseConfigured || !supabase) {
        if (active) setState({ loading: false, user: null, profile: null, source: null, error: null });
        return;
      }

      try {
        const response = await supabase.auth.getSession();
        if (response.error) throw response.error;
        const nextState = await makeAuthState(response.data?.session?.user || null);
        if (active) setState(nextState);
      } catch (error) {
        if (active) setState({ loading: false, user: null, profile: null, source: null, error });
      }
    }

    loadSession();

    let listener = null;
    if (isSupabaseConfigured && supabase) {
      try {
        listener = supabase.auth.onAuthStateChange(async (event, session) => {
        try {
          const nextState = await makeAuthState(session?.user || null);
          if (active) setState(nextState);
        } catch (error) {
          if (active) setState({ loading: false, user: session?.user || null, profile: null, source: null, error });
        }
        });
      } catch (error) {
        if (active) setState(current => ({ ...current, error }));
      }
    }

    return () => {
      active = false;
      listener?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  const value = useMemo(() => ({ ...state, isAdmin: Boolean(state.profile), applyAuthUser }), [state, applyAuthUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return context;
}
