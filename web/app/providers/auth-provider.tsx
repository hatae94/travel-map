"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { JwtPayload } from "@/lib/api/types";
import { mockLogin } from "@/lib/api/auth";

interface AuthState {
  token: string | null;
  user: JwtPayload | null;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseToken(token: string): JwtPayload {
  const payload = JSON.parse(decodeBase64Utf8(token.split(".")[1])) as JwtPayload;
  if (payload.exp * 1000 < Date.now()) throw new Error("Token expired");
  return payload;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<JwtPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (stored) {
      try {
        setUser(parseToken(stored));
        setToken(stored);
      } catch {
        localStorage.removeItem("token");
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string) => {
    const res = await mockLogin(email);
    const parsed = parseToken(res.access_token);
    localStorage.setItem("token", res.access_token);
    setToken(res.access_token);
    setUser(parsed);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext value={{ token, user, isLoading, login, logout }}>
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
