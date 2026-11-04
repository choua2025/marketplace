import type { Metadata, Viewport } from "next";
import { Noto_Sans_Lao, Noto_Sans_Thai } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ServiceWorkerRegister } from "@/components/layout/sw-register";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { HideOnAdmin } from "@/components/layout/hide-on-admin";
import "../globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
});

const notoSansLao = Noto_Sans_Lao({
  variable: "--font-noto-sans-lao",
  subsets: ["lao", "latin"],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    manifest: "/manifest.webmanifest",
    appleWebApp: { title: t("brand"), statusBarStyle: "default" },
  };
}

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
    // suppressHydrationWarning: the theme script below adds the "dark" class
    // to <html> before React hydrates. It only covers <html>'s own attributes.
    <html
      lang={locale}
      className={`${notoSansThai.variable} ${notoSansLao.variable} h-full antialiased`}
      suppressHydrationWarning
    >
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
          <HideOnAdmin>
            <SiteHeader />
          </HideOnAdmin>
          <div className="flex flex-1 flex-col">{children}</div>
          <HideOnAdmin>
            <SiteFooter />
          </HideOnAdmin>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
