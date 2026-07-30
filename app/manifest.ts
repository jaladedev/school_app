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
    // Falls back to static icons when the school hasn't uploaded a logo
    // (public/icon-192.png, public/icon-512.png, plus a maskable variant
    // with safe-zone padding so Android doesn't crop a plain square icon
    // into a circle awkwardly). If a school logo IS set, we skip the
    // maskable variant for that branch -- an admin-uploaded logo has no
    // guaranteed safe-zone padding, so declaring it maskable could get
    // it cropped badly on Android; "any" is the safer purpose for
    // arbitrary uploaded images.
    icons: settings?.logo_url
      ? [
          { src: settings.logo_url, sizes: "192x192", type: "image/png" },
          { src: settings.logo_url, sizes: "512x512", type: "image/png" },
        ]
      : [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
  };
}
