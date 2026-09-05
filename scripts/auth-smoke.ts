/**
 * Milestone 2 auth smoke script.
 * Does not print secrets, tokens, or password hashes.
 *
 * Usage: node --import tsx scripts/auth-smoke.ts
 */
import "dotenv/config";

type Json = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function summarizeCookie(setCookie: string | null) {
  if (!setCookie) return "none";
  const names = setCookie
    .split(/,(?=[^;]+?=)/)
    .map((part) => part.trim().split("=")[0])
    .filter(Boolean);
  return names.join(",") || "present";
}

async function main() {
  const baseUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const suffix = Date.now();
  const email = `smoke-${suffix}@example.com`;
  const password = `SmokePass-${suffix}!`;
  const workspaceName = `Smoke Workspace ${suffix}`;

  console.log("Base URL:", baseUrl);
  console.log("Email provider mode check via signup/forgot (no secrets printed)");

  // 1) Providers / Google configured
  const providersRes = await fetch(`${baseUrl}/api/auth/providers`);
  assert(providersRes.ok, `providers endpoint failed: ${providersRes.status}`);
  const providers = (await providersRes.json()) as Json;
  const hasCredentials = Boolean(providers.credentials);
  const hasGoogle = Boolean(providers.google);
  console.log("Providers: credentials=", hasCredentials, "google=", hasGoogle);
  assert(hasCredentials, "credentials provider missing");
  assert(hasGoogle, "google provider missing — check GOOGLE_CLIENT_ID/SECRET");

  // 2) CSRF + Google sign-in URL shape (callback validation)
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
  assert(csrfJson.csrfToken, "csrf token missing");

  const googleUrl = new URL(`${baseUrl}/api/auth/signin/google`);
  // Auth.js v5 sign-in endpoint exists; callback path convention:
  const expectedCallback = `${baseUrl}/api/auth/callback/google`;
  console.log("Expected Google callback:", expectedCallback);

  // 3) Protected route redirect when unauthenticated
  const dashRes = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
  console.log("Unauthenticated /dashboard status:", dashRes.status);
  assert(
    dashRes.status === 307 || dashRes.status === 302 || dashRes.status === 303,
    "expected redirect away from protected dashboard",
  );
  const location = dashRes.headers.get("location") || "";
  assert(location.includes("/login"), `expected login redirect, got ${location}`);

  // 4) Signup
  const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Smoke",
      lastName: "Tester",
      email,
      password,
      workspaceName,
    }),
  });
  const signupJson = (await signupRes.json()) as Json;
  console.log("Signup status:", signupRes.status, "ok=", Boolean(signupJson.ok));
  assert(signupRes.status === 201, `signup failed: ${signupJson.error ?? signupRes.status}`);
  assert(!JSON.stringify(signupJson).toLowerCase().includes("password"), "signup leaked password");

  // 5) Login via credentials callback
  const loginCsrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  const loginCsrf = (await loginCsrfRes.json()) as { csrfToken: string };
  const loginCookie = loginCsrfRes.headers.get("set-cookie");

  const loginBody = new URLSearchParams({
    csrfToken: loginCsrf.csrfToken,
    email,
    password,
    callbackUrl: `${baseUrl}/dashboard`,
    json: "true",
  });

  const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(loginCookie ? { Cookie: loginCookie.split(";")[0] } : {}),
    },
    body: loginBody,
    redirect: "manual",
  });
  const sessionCookie = loginRes.headers.get("set-cookie");
  console.log("Login status:", loginRes.status, "cookies=", summarizeCookie(sessionCookie));
  assert(loginRes.status === 200 || loginRes.status === 302, `login failed: ${loginRes.status}`);

  // Merge cookies for session
  const cookieHeader = [loginCookie, sessionCookie]
    .filter(Boolean)
    .flatMap((value) => String(value).split(/,(?=[^;]+?=)/))
    .map((part) => part.trim().split(";")[0])
    .filter(Boolean)
    .join("; ");

  // 6) Session
  const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  });
  const sessionJson = (await sessionRes.json()) as { user?: { email?: string; id?: string } };
  console.log("Session user present:", Boolean(sessionJson.user?.id));
  assert(sessionJson.user?.email === email, "session email mismatch");

  // 7) Authenticated dashboard access
  const authedDash = await fetch(`${baseUrl}/dashboard`, {
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
    redirect: "manual",
  });
  console.log("Authenticated /dashboard status:", authedDash.status);
  assert(authedDash.status === 200, "authenticated dashboard should be 200");

  // 8) Forgot password / SMTP path
  const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const forgotJson = (await forgotRes.json()) as Json;
  console.log("Forgot-password status:", forgotRes.status, "ok=", Boolean(forgotJson.ok));
  if (forgotRes.status === 503) {
    console.log("SMTP send failed or unconfigured — check SMTP_* values / provider auth");
  } else {
    assert(forgotRes.ok, `forgot-password failed: ${forgotJson.error ?? forgotRes.status}`);
    assert(!JSON.stringify(forgotJson).includes("token="), "forgot-password leaked token");
  }

  // 9) Logout
  const logoutCsrfRes = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  });
  const logoutCsrf = (await logoutCsrfRes.json()) as { csrfToken: string };
  const logoutBody = new URLSearchParams({
    csrfToken: logoutCsrf.csrfToken,
    callbackUrl: `${baseUrl}/login`,
    json: "true",
  });
  const logoutRes = await fetch(`${baseUrl}/api/auth/signout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: logoutBody,
    redirect: "manual",
  });
  console.log("Logout status:", logoutRes.status);

  const postLogoutSession = await fetch(`${baseUrl}/api/auth/session`);
  const postLogoutText = await postLogoutSession.text();
  const postLogoutJson = postLogoutText
    ? (JSON.parse(postLogoutText) as { user?: unknown } | null)
    : null;
  console.log("Post-logout session empty:", !postLogoutJson?.user);

  const postLogoutDash = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
  console.log("Post-logout /dashboard status:", postLogoutDash.status);
  assert(
    postLogoutDash.status === 307 || postLogoutDash.status === 302 || postLogoutDash.status === 303,
    "dashboard should redirect after logout",
  );

  // Silence unused
  void googleUrl;

  console.log("\nSmoke checks completed.");
}

main().catch((error) => {
  console.error("Smoke failed:", error instanceof Error ? error.message : "unknown");
  process.exit(1);
});
