"use client";

import { useState } from "react";
import { useAuth } from "@/app/providers/auth-provider";

export function LoginModal() {
  const { user, isLoading, login } = useAuth();
  const [email, setEmail] = useState("mock1@test.com");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isLoading || user) return null;

  async function handleLogin() {
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "서버 연결 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[340px] rounded-xl bg-white p-8 text-center">
        <h2 className="mb-2 text-xl font-bold">Travel Map</h2>
        <p className="mb-5 text-sm text-gray-400">
          Mock 로그인으로 시작하세요
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="이메일 (mock1@test.com)"
          className="mb-3 w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400"
        />
        {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
        <button
          onClick={handleLogin}
          disabled={submitting}
          className="w-full rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {submitting ? "로그인 중..." : "로그인"}
        </button>
      </div>
    </div>
  );
}
