import Link from "next/link";

import { listDepartments } from "@/lib/data";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Register — KPI Scorecard" };

export default async function RegisterPage() {
  const departments = await listDepartments();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">KPI Scorecard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create an account. New registrations are held for admin approval
          before they can sign in.
        </p>
        <RegisterForm departments={departments} />
        <p className="mt-4 text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
