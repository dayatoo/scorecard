import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in — KPI Scorecard" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">KPI Scorecard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Enter the shared password to continue.
        </p>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
