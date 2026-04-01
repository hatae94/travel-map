import { apiFetch } from "./client";
import type { AuthResponse } from "./types";

export async function mockLogin(email: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/mock-login", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
