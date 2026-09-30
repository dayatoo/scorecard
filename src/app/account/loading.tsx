import { Spinner } from "@/components/Spinner";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-md justify-center px-4 py-20">
      <Spinner />
    </div>
  );
}
