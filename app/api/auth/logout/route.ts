import { ADMIN_COOKIE } from "@/lib/admin-auth";

export async function POST(request: Request) {
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL("/", request.url).toString(),
      "set-cookie": `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
    },
  });
}
