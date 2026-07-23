import type { Metadata } from "next";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/NavigationProgress";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "School Management",
  description: "Timetables, lessons, notes and records for students, teachers and administration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <ToastProvider />
        {children}
      </body>
    </html>
  );
}
