import Image from "next/image";
import Link from "next/link";

import { HeroPattern } from "@/components/HeroPattern";
import { listDepartments } from "@/lib/data";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Register — KPI Scorecard" };

export default async function RegisterPage() {
  const departments = await listDepartments();

  return (
    <div className="relative isolate flex min-h-[calc(100vh-61px)] items-center justify-center overflow-hidden bg-blue-600 px-4 py-12">
      <HeroPattern className="top-1/2 right-[-60px] h-80 w-[560px] -translate-y-1/2" />
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <Image
          src="/brand/logomark-blue.png"
          alt=""
          width={384}
          height={335}
          className="h-10 w-auto"
        />
        <h1 className="mt-3 text-lg">KPI Scorecard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create an account. New registrations are held for admin approval
          before they can sign in.
        </p>
        <RegisterForm departments={departments} />
        <p className="mt-4 text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
