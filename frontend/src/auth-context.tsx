import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { api, setAuthToken, setUnauthorizedHandler, type User } from "./api";
import { storage } from "./utils/storage";
import { queryClient } from "./query-client";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "renter_auth_token";
const AUTH_HOST = "https://auth.emergentagent.com/";

type AuthState = {
  user: User | null;
  loading: boolean;
  googleBusy: boolean;
  setUser: (u: User | null) => void;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  register: (body: {
    email: string;
    password: string;
    name: string;
    role: "homeowner" | "tenant";
    phone: string;
    whatsapp: string;
  }) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function extractSessionId(url?: string | null) {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleBusy, setGoogleBusy] = useState(false);
  const usedSessionIds = useRef<Set<string>>(new Set());

  const applyToken = useCallback(async (token: string | null) => {
    setAuthToken(token);
    if (token) await storage.secureSet(TOKEN_KEY, token);
    else await storage.secureRemove(TOKEN_KEY);
  }, []);

  const clearAuth = useCallback(async () => {
    await applyToken(null);
    setUserState(null);
    queryClient.clear();
  }, [applyToken]);

  const exchangeSession = useCallback(
    async (sessionId: string) => {
      if (usedSessionIds.current.has(sessionId)) return false;
      usedSessionIds.current.add(sessionId);
      try {
        const res = await api<{ session_token: string; user: User }>("/auth/session", {
          method: "POST",
          body: { session_id: sessionId },
          skipAuthRedirect: true,
        });
        await applyToken(res.session_token);
        setUserState(res.user);
        return true;
      } catch (e) {
        console.warn("session exchange failed", e);
        return false;
      }
    },
    [applyToken],
  );

  // Boot: process session_id first, otherwise restore token.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let sid: string | null = null;
        if (Platform.OS === "web" && typeof window !== "undefined") {
          sid = extractSessionId(window.location.hash) ?? extractSessionId(window.location.search);
          if (sid) {
            const ok = await exchangeSession(sid);
            if (ok) {
              const url = new URL(window.location.href);
              url.searchParams.delete("session_id");
              const hash = url.hash.replace(/[#&]?session_id=[^&#]+/, "");
              url.hash = hash === "#" ? "" : hash;
              window.history.replaceState(window.history.state, "", url.toString());
            }
          }
        } else {
          const initial = await Linking.getInitialURL();
          sid = extractSessionId(initial);
          if (sid) await exchangeSession(sid);
        }
        if (!sid) {
          const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
          if (token) {
            setAuthToken(token);
            try {
              const me = await api<User>("/auth/me", { skipAuthRedirect: true });
              if (!cancelled) setUserState(me);
            } catch {
              await clearAuth();
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exchangeSession, clearAuth]);

  // Hot deep links (mobile)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) exchangeSession(sid);
    });
    return () => sub.remove();
  }, [exchangeSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuth();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearAuth]);

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: { email, password },
        skipAuthRedirect: true,
      });
      await applyToken(res.token);
      setUserState(res.user);
    },
    [applyToken],
  );

  const register = useCallback<AuthState["register"]>(
    async (body) => {
      const res = await api<{ token: string; user: User }>("/auth/register", {
        method: "POST",
        body,
        skipAuthRedirect: true,
      });
      await applyToken(res.token);
      setUserState(res.user);
    },
    [applyToken],
  );

  const loginWithGoogle = useCallback(async () => {
    if (Platform.OS === "web") {
      const redirect = window.location.origin + "/";
      window.location.href = `${AUTH_HOST}?redirect=${encodeURIComponent(redirect)}`;
      return;
    }
    setGoogleBusy(true);
    let captured: string | null = null;
    const sub = Linking.addEventListener("url", ({ url }) => {
      captured = url;
    });
    try {
      const redirect = Linking.createURL("");
      const authUrl = `${AUTH_HOST}?redirect=${encodeURIComponent(redirect)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
      let url: string | null = (result as any).url ?? null;
      if (!url) url = captured;
      if (!url) url = await Linking.getInitialURL();
      const sid = extractSessionId(url);
      if (sid) await exchangeSession(sid);
    } finally {
      sub.remove();
      setGoogleBusy(false);
    }
  }, [exchangeSession]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST", skipAuthRedirect: true });
    } catch {
      // ignore
    }
    await clearAuth();
  }, [clearAuth]);

  const refresh = useCallback(async () => {
    try {
      const me = await api<User>("/auth/me", { skipAuthRedirect: true });
      setUserState(me);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      googleBusy,
      setUser: setUserState,
      loginWithPassword,
      register,
      loginWithGoogle,
      logout,
      refresh,
    }),
    [user, loading, googleBusy, loginWithPassword, register, loginWithGoogle, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
