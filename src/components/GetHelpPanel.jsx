import React, { useEffect, useState } from "react";
import { LifeBuoy, Phone, X } from "lucide-react";
import { emergencyNumberForCountryCode } from "../lib/emergencyNumber";

// Nominatim (OpenStreetMap) reverse geocoding — same service/attribution
// approach as LocationPicker.jsx's forward search.
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const UNKNOWN_LOCATION_NOTE =
  "We couldn't confirm your location, so this is the general international emergency number — it may not be the right one where you are.";

// "Get help" quick action for an active match — a fast shortcut to standard
// emergency services, nothing more. This never contacts, alerts, or
// notifies Amble or anyone else; it just surfaces a number and a tel: link.
export default function GetHelpPanel({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fallback = (message) => {
      if (cancelled) return;
      setResult(emergencyNumberForCountryCode(null));
      setNote(message);
      setLoading(false);
    };

    if (!navigator.geolocation) {
      fallback(UNKNOWN_LOCATION_NOTE);
      return undefined;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const params = new URLSearchParams({
            format: "jsonv2",
            lat: String(position.coords.latitude),
            lon: String(position.coords.longitude),
          });
          const res = await fetch(`${NOMINATIM_REVERSE_URL}?${params.toString()}`, {
            headers: { "Accept-Language": "en" },
          });
          if (!res.ok) throw new Error("Reverse geocoding unavailable");
          const data = await res.json();
          if (cancelled) return;
          setResult(emergencyNumberForCountryCode(data?.address?.country_code));
          setLoading(false);
        } catch {
          fallback(UNKNOWN_LOCATION_NOTE);
        }
      },
      () => fallback(UNKNOWN_LOCATION_NOTE),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card" style={{ borderColor: "var(--brick)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LifeBuoy size={17} color="var(--brick)" />
          <h2 style={{ fontSize: 15, margin: 0 }}>Get help</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, display: "flex" }}
        >
          <X size={18} />
        </button>
      </div>

      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
        A fast shortcut to call standard emergency services directly. Amble isn't notified and no one here is
        alerted or dispatched — it's just a phone call.
      </p>

      {loading ? (
        <p className="mono" style={{ fontSize: 13, color: "var(--muted)" }}>
          Finding your local emergency number…
        </p>
      ) : (
        <>
          <a
            href={`tel:${result.number}`}
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}
          >
            <Phone size={16} /> Call {result.number} — {result.label}
          </a>
          {note && (
            <p className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
              {note}
            </p>
          )}
        </>
      )}
    </div>
  );
}
