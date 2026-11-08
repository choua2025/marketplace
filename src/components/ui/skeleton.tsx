import { cn } from "@/lib/utils";

/** Grey placeholder block shown while content loads. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };
