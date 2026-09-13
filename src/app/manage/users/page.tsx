import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { UsersClient } from "./UsersClient";

export const metadata = { title: "Users — KPI Scorecard" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentUser = await requireAdminPage();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { department: true },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="mt-0.5 text-sm text-gray-600">
          Approve new registrations, and manage who can sign in.
        </p>
      </div>

      <UsersClient
        currentUserId={currentUser.id}
        users={users.map((u) => ({
          id: u.id,
          username: u.username,
          department: u.department.name,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
