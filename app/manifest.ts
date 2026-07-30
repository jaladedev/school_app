import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

// Next.js App Router convention (app/manifest.ts) rather than a static
// public/manifest.json — this lets the manifest reflect the actual
// school's name and logo instead of a generic placeholder, since that
// data already lives in school_settings.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const supabase = createClient();
  const { data: settings } = await supabase
    .from("school_settings")
    .select("name, logo_url")
    .eq("id", 1)
    .single();

  const name = settings?.name ?? "School Management";

  return {
    name,
    short_name: name.length > 12 ? name.slice(0, 12) : name,
    description: "Timetables, lessons, attendance, grades, and fees.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#faf7f0",
    theme_color: "#faf7f0",
    // Fallback icons for schools that haven't uploaded a logo yet
    icons: settings?.logo_url
      ? [
          { src: settings.logo_url, sizes: "192x192", type: "image/png" },
          { src: settings.logo_url, sizes: "512x512", type: "image/png" },
        ]
      : [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
  };
}
