import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";

const APPROX_RADIUS_METERS = 400;

// A pin in the app's brick accent, in place of Leaflet's stock blue marker.
const pinIcon = L.divIcon({
  className: "amble-pin",
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.716 23.284 0 15 0z" fill="#b84b2c"/>
      <circle cx="15" cy="15" r="5.5" fill="#fbf8f1"/>
    </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -36],
});

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as "MacIntel" but, unlike a real Mac, has touch support.
  const isModernIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isAppleMobile || isModernIPad;
}

function buildMapsUrl(latitude, longitude, label) {
  const encodedLabel = encodeURIComponent(label || "Meeting point");
  return isIOSDevice()
    ? `https://maps.apple.com/?ll=${latitude},${longitude}&q=${encodedLabel}`
    : `https://www.google.com/maps?q=${latitude},${longitude}(${encodedLabel})`;
}

export default function ActivityMap({ latitude, longitude, precise, meetPoint }) {
  const containerRef = useRef(null);
  const hasValidCoords = Number.isFinite(latitude) && Number.isFinite(longitude);

  useEffect(() => {
    if (!hasValidCoords || !containerRef.current) return undefined;

    // Guard against a leftover Leaflet instance on this node (e.g. from a
    // fast prop change or a dev double-effect) — re-initializing on top of
    // one throws "Map container is already initialized."
    if (containerRef.current._leaflet_id) {
      delete containerRef.current._leaflet_id;
    }

    let map;
    try {
      map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      });
      map.attributionControl.setPrefix(false);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      if (precise) {
        L.marker([latitude, longitude], { icon: pinIcon }).addTo(map);
        map.setView([latitude, longitude], 15);
      } else {
        const circle = L.circle([latitude, longitude], {
          radius: APPROX_RADIUS_METERS,
          color: "#3c6e58",
          weight: 2,
          dashArray: "6 6",
          fillColor: "#3c6e58",
          fillOpacity: 0.12,
        }).addTo(map);
        L.circleMarker([latitude, longitude], {
          radius: 5,
          color: "#fbf8f1",
          weight: 2,
          fillColor: "#3c6e58",
          fillOpacity: 1,
        }).addTo(map);
        map.fitBounds(circle.getBounds(), { padding: [8, 8] });
      }
    } catch (err) {
      console.error("Couldn't render the activity map:", err);
    }

    return () => {
      if (map) map.remove();
    };
  }, [latitude, longitude, precise, hasValidCoords]);

  if (!hasValidCoords) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      <div ref={containerRef} className="activity-map" style={{ height: 200 }} />
      {!precise && (
        <p className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
          Approximate area — exact meeting point shared once confirmed.
        </p>
      )}
      {precise && (
        <a
          href={buildMapsUrl(latitude, longitude, meetPoint)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            textDecoration: "none",
            fontFamily: '"Space Grotesk", sans-serif',
            marginTop: 8,
          }}
        >
          <Navigation size={16} />
          Get directions
        </a>
      )}
    </div>
  );
}
