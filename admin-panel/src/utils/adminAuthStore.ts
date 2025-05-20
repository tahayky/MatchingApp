// Simple in-memory store for the admin auth token for demonstration.
// In a real app, use React Context, Zustand, Redux, etc. for proper state management.

let adminToken: string | null = null;

export const setAdminToken = (token: string | null): void => {
  adminToken = token;
  // If you were using sessionStorage for persistence across tab reloads (but not browser close):
  // if (token) {
  //   sessionStorage.setItem('admin_auth_token_bearer', token);
  // } else {
  //   sessionStorage.removeItem('admin_auth_token_bearer');
  // }
};

export const getAdminToken = (): string | null => {
  // If you were using sessionStorage:
  // return adminToken || sessionStorage.getItem('admin_auth_token_bearer');
  return adminToken;
};

export const clearAdminToken = (): void => {
  adminToken = null;
  // sessionStorage.removeItem('admin_auth_token_bearer');
};