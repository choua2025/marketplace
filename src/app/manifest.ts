import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ช่างดี (ChangDee)",
    short_name: "ช่างดี",
    description: "แพลตฟอร์มหาช่างใกล้บ้าน จองงาน แชต และรีวิวได้ในที่เดียว",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563EB",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
