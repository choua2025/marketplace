import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for whole pages (used by loading.tsx files): a title
 * and a few cards, close enough to every list/detail page in the app.
 */
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "grid" }) {
  return (
    <main
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 pb-12"
      aria-busy="true"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
      {variant === "grid" ? (
        <div className="mt-2 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border p-2">
              <Skeleton className="aspect-[4/3] w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border p-4">
              <Skeleton className="size-12 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
