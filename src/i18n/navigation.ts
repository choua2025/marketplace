import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers around next/navigation + next/link -- use these
// instead of the plain Next.js APIs anywhere a path needs the current
// locale prefix (SPEC.md section 9).
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
