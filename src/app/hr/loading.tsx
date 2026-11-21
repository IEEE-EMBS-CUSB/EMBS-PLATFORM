import { PageLoadingState } from "@/components/states/loading-state";

export default function HrLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageLoadingState />
    </div>
  );
}
