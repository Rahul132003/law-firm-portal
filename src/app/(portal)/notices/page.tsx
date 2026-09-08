import type { Metadata } from "next";

import { NoticeBoard } from "@/components/notices/notice-board";
import { canPostNotices } from "@/lib/auth/roles";
import { requireUser } from "@/lib/dal";
import { FIRM_NAME } from "@/lib/firm";
import { listNotices } from "@/lib/notices/queries";

export const metadata: Metadata = {
  title: `Notice Board · ${FIRM_NAME}`,
};

export default async function NoticesPage() {
  const user = await requireUser();
  const notices = await listNotices(user);

  const unread = notices.filter((notice) => notice.readAt === null).length;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          Notice Board
        </h1>
        <p className="mt-1 text-sm text-secondary">
          {unread === 0
            ? "You are up to date with every firm notice."
            : `${unread} notice${unread === 1 ? "" : "s"} awaiting your acknowledgement.`}
        </p>
      </header>

      <NoticeBoard notices={notices} canPost={canPostNotices(user.role)} />
    </div>
  );
}
