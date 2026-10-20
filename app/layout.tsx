import type { Metadata } from "next";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/NavigationProgress";
import { ToastProvider } from "@/components/ToastProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { OfflineAttendanceSync } from "@/components/OfflineAttendanceSync";
import { readPublicConfigFromEnv } from "@/lib/env.client";
import "./globals.css";

// The page embeds this school's public config, which is read from the server's
// runtime environment. It must never be prerendered at build time, or the values
// of whatever environment ran the build would be baked into every school.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "School Management",
  description: "Timetables, lessons, notes and records for students, teachers and administration.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/favicon-32.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#faf7f0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // "<" is escaped so no value can close the script tag.
  const publicConfig = JSON.stringify(readPublicConfigFromEnv()).replace(/</g, "\\u003c");

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `window.__PUBLIC_CONFIG__=${publicConfig};` }} />
      </head>
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <ToastProvider />
        <ServiceWorkerRegister />
        <OfflineAttendanceSync />
        {children}
      </body>
    </html>
  );
}
