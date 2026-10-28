const ACCESS_TOKEN_KEY = "vibely-access-token";
const UNAUTHORIZED_EVENT = "vibely:unauthorized";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem(ACCESS_TOKEN_KEY) ??
    window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
  );
}

export function saveAccessToken(token: string, rememberMe: boolean) {
  if (rememberMe) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } else {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function clearAccessToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getUnauthorizedEventName() {
  return UNAUTHORIZED_EVENT;
}
