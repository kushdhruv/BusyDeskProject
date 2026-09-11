"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { SessionUser } from "./types";

interface SessionContextType {
  user: SessionUser | null;
  agents: { id: string; name: string; email?: string }[];
  loading: boolean;
  refreshUser: () => Promise<void>;
  refreshAgents: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType>({
  user: null,
  agents: [],
  loading: true,
  refreshUser: async () => {},
  refreshAgents: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [agents, setAgents] = useState<{ id: string; name: string; email?: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  const refreshAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.users || []);
      }
    } catch {
      setAgents([]);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const [meRes, usersRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/users").catch(() => null),
        ]);

        if (isMounted && meRes.ok) {
          const meData = await meRes.json();
          setUser(meData.user || null);
        }

        if (isMounted && usersRes && usersRes.ok) {
          const usersData = await usersRes.json();
          setAgents(usersData.users || []);
        }
      } catch {
        // ignore
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SessionContext.Provider
      value={{
        user,
        agents,
        loading,
        refreshUser,
        refreshAgents,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
