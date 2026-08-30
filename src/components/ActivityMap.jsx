import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Vite rewrites Leaflet's default marker icon URLs incorrectly unless we
// point them at the bundled assets ourselves.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const APPROX_RADIUS_METERS = 400;

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

  useEffect(() => {
    if (latitude == null || longitude == null || !containerRef.current) return undefined;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    if (precise) {
      L.marker([latitude, longitude]).addTo(map);
      map.setView([latitude, longitude], 15);
    } else {
      const circle = L.circle([latitude, longitude], {
        radius: APPROX_RADIUS_METERS,
        color: "#3c6e58",
        weight: 1,
        fillColor: "#3c6e58",
        fillOpacity: 0.15,
      }).addTo(map);
      map.fitBounds(circle.getBounds(), { padding: [8, 8] });
    }

    return () => map.remove();
  }, [latitude, longitude, precise]);

  if (latitude == null || longitude == null) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        ref={containerRef}
        style={{
          height: 200,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid var(--paper-deep)",
        }}
      />
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
