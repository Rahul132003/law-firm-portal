import { redirect } from "next/navigation";

/**
 * Administration moved into Settings — user management now lives at
 * /settings/team alongside the account and security pages.
 *
 * This stub stays so existing bookmarks and links keep working. A temporary
 * redirect rather than a permanent one: browsers cache permanent redirects
 * hard, and the portal's routes are still moving around.
 */
export default function AdminPage() {
  redirect("/settings/team");
}
