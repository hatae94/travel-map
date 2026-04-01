"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Place } from "@/lib/api/types";

// Fix leaflet default marker icon issue in bundlers
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface MapViewProps {
  places: Place[];
  activeIndex: number | null;
  onMarkerClick: (index: number) => void;
  visible?: boolean;
}

export function MapView({
  places,
  activeIndex,
  onMarkerClick,
  visible = true,
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([36.5, 127.8], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Invalidate size and re-fit bounds when becoming visible
  useEffect(() => {
    if (!visible || !mapRef.current) return;
    const map = mapRef.current;
    setTimeout(() => {
      map.invalidateSize();
      const validPlaces = places.filter((p) => p.latitude != null);
      if (validPlaces.length > 0) {
        const bounds = L.latLngBounds(
          validPlaces.map((p) => [p.latitude, p.longitude] as L.LatLngTuple),
        );
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }, 0);
  }, [visible, places]);

  // Update markers when places change
  const updateMarkers = useCallback(
    (map: L.Map) => {
      markersRef.current.forEach((m) => map.removeLayer(m));
      markersRef.current = [];

      const validPlaces = places.filter((p) => p.latitude != null);
      validPlaces.forEach((place, i) => {
        const marker = L.marker([place.latitude, place.longitude])
          .addTo(map)
          .bindPopup(
            `<b>${place.name_ko ?? place.name}</b>${place.type ? `<br>${place.type}` : ""}`,
          );
        marker.on("click", () => onMarkerClick(i));
        markersRef.current.push(marker);
      });

      if (validPlaces.length > 0) {
        const bounds = L.latLngBounds(
          validPlaces.map((p) => [p.latitude, p.longitude] as L.LatLngTuple),
        );
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    },
    [places, onMarkerClick],
  );

  useEffect(() => {
    if (!mapRef.current) return;
    updateMarkers(mapRef.current);
  }, [updateMarkers]);

  // Focus on active marker
  useEffect(() => {
    if (activeIndex == null || !mapRef.current) return;
    const place = places[activeIndex];
    if (!place?.latitude) return;
    mapRef.current.setView([place.latitude, place.longitude], 16);
    markersRef.current[activeIndex]?.openPopup();
  }, [activeIndex, places]);

  return <div ref={containerRef} className="relative z-0 flex-1" />;
}
