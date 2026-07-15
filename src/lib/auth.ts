export const authCookieName = "time-tracker-session";
export const authSessionValue = "minggay-authenticated";
export const authMaxAgeSeconds = 365 * 24 * 60 * 60;

export async function isAuthenticated() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return cookieStore.get(authCookieName)?.value === authSessionValue;
}
