import { requireAuthPage } from "@/lib/session";

import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata = { title: "Your account — KPI Scorecard" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireAuthPage();

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Your account</h1>
        <p className="mt-0.5 text-sm text-gray-600">
          Signed in as <span className="font-medium text-gray-900">{user.username}</span>
          {user.role === "ADMIN" ? " (admin)" : ""}.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Change password</h2>
        <p className="mb-4 text-sm text-gray-600">
          Changing it signs you out on every other device and browser.
        </p>
        <ChangePasswordForm username={user.username} />
      </section>
    </div>
  );
}
