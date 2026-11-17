import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { casMode, loginRedirectFor } from "../../src/core/auth";

export default async function LoginPage() {
  if (casMode() === "yale") {
    const host = (await headers()).get("host") ?? "127.0.0.1:3000";
    redirect(loginRedirectFor(host));
  }

  return (
    <>
      <h1>Sign in</h1>
      <p>Localhost CAS mock. This form does not contact Yale.</p>
      <form method="post" action="/api/auth/login">
        <label>
          NetID
          <input name="netId" autoComplete="username" required />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </>
  );
}
