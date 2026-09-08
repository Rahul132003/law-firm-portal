import { redirect } from "next/navigation";

/**
 * The portal has no marketing surface — the root simply forwards into the
 * application. Unauthenticated visitors are bounced to /login by the proxy.
 */
export default function RootPage() {
  redirect("/dashboard");
}
