"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/features/auth/lib/auth-token";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const verifySession = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    try {
      await api.currentUser();
      setReady(true);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        clearAccessToken();
        router.replace("/login");
        return;
      }
      setReady(false);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось проверить сессию.",
      );
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void verifySession();
    });
    return () => {
      active = false;
    };
  }, [verifySession]);

  useEffect(() => {
    function handleUnauthorized() {
      clearAccessToken();
      router.replace("/login");
    }
    window.addEventListener("vibely:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("vibely:unauthorized", handleUnauthorized);
  }, [router]);

  if (error) {
    return (
      <main className="auth-guard-state" role="alert">
        <p>{error}</p>
        <button
          onClick={() => {
            setReady(false);
            setError("");
            void verifySession();
          }}
          type="button"
        >
          Повторить
        </button>
      </main>
    );
  }
  if (!ready) {
    return (
      <main aria-live="polite" className="auth-guard-state">
        Проверяем сессию…
      </main>
    );
  }
  return children;
}
