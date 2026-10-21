import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ServiceWorkerRegister } from "@/components/layout/sw-register";
import "../globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "ช่างดี (ChangDee)",
  description: "แพลตฟอร์มหาช่างใกล้บ้าน จองงาน แชต และรีวิวได้ในที่เดียว",
  manifest: "/manifest.webmanifest",
  appleWebApp: { title: "ช่างดี", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Enables static rendering for this locale (SPEC.md section 10: Lighthouse 90+).
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${notoSansThai.variable} h-full antialiased`}>
      <head>
        {/* Sets the dark class before paint to avoid a light/dark flash (SPEC.md section 9). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(!t){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <ServiceWorkerRegister />
          <div className="flex items-center justify-end gap-2 border-b p-2">
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
