import { ADMIN_COOKIE, adminCookieOptions, createAdminToken, passwordMatches } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  if (!(await passwordMatches(password))) return Response.redirect(new URL("/login?error=1", request.url), 303);
  const response = Response.redirect(new URL("/admin", request.url), 303);
  response.headers.append("set-cookie", serializeCookie(ADMIN_COOKIE, await createAdminToken(), adminCookieOptions));
  return response;
}

function serializeCookie(name: string, value: string, options: typeof adminCookieOptions): string {
  return `${name}=${value}; Path=${options.path}; Max-Age=${options.maxAge}; HttpOnly; Secure; SameSite=Strict`;
}
