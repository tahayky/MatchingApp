// Simple in-memory store for the admin auth token for demonstration.
// In a real app, use React Context, Zustand, Redux, etc. for proper state management.
// Using sessionStorage for persistence across page navigations within the same tab/session.

const TOKEN_KEY = 'admin_auth_token_bearer';

export const setAdminToken = (token: string | null): void => {
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }
};

export const getAdminToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem(TOKEN_KEY);
  }
  return null;
};

export const clearAdminToken = (): void => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(TOKEN_KEY);
  }
};