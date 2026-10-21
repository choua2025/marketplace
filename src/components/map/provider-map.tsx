"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

// Bundlers don't resolve Leaflet's default marker image paths on their
// own -- without this the markers render as broken images.
const defaultIcon = L.icon({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
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
