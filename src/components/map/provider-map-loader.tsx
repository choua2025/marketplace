"use client";

import dynamic from "next/dynamic";
import type { MapMarker } from "./provider-map";

export type { MapMarker };

// Leaflet touches the DOM/window at module scope, so it must never run
// during server rendering (see provider-map.tsx).
const ProviderMapLazy = dynamic(() => import("./provider-map").then((m) => m.ProviderMap), {
  ssr: false,
  loading: () => <div className="bg-muted h-80 w-full animate-pulse rounded-lg" />,
});

interface ProviderMapLoaderProps {
  center: { lat: number; lng: number };
  markers: MapMarker[];
  zoom?: number;
  heightClassName?: string;
}

export function ProviderMapLoader(props: ProviderMapLoaderProps) {
  return <ProviderMapLazy {...props} />;
}
