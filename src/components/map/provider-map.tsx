"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

// Bundlers don't resolve Leaflet's default marker image paths on their
// own -- static `import`ing them from node_modules produced an empty
// iconUrl under Turbopack, so the three marker images are committed into
// public/leaflet/ and referenced as plain static paths instead.
const defaultIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

interface ProviderMapProps {
  center: { lat: number; lng: number };
  markers: MapMarker[];
  zoom?: number;
  heightClassName?: string;
}

export function ProviderMap({
  center,
  markers,
  zoom = 12,
  heightClassName = "h-80",
}: ProviderMapProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      className={`w-full rounded-lg ${heightClassName}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((marker) => (
        <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={defaultIcon}>
          <Popup>{marker.label}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
