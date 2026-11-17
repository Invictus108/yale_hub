import { cookies, headers } from "next/headers";

import { identifyToken, SESSION_COOKIE } from "../../src/core/auth.js";

export async function currentNetId(): Promise<string | null> {
  const jar = await cookies();
  const headerStore = await headers();
  return identifyToken(jar.get(SESSION_COOKIE)?.value, headerStore.get("x-netid"));
}
