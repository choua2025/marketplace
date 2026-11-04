"use client";

import { usePathname } from "@/i18n/navigation";

/** The admin panel has its own header and sidebar, so the site header/footer step aside there. */
export function HideOnAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return children;
}
