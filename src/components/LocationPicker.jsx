import React, { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";

// Nominatim (OpenStreetMap) is free and needs no API key, but its usage
// policy asks for a way to identify the calling application. Browsers block
// scripts from overriding the User-Agent header, so we rely on the Referer
// header the browser sends automatically — that's the accepted approach for
// browser-based apps per https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DEBOUNCE_MS = 500;
const MIN_QUERY_LENGTH = 3;

function extractCity(address = {}) {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.municipality ||
    address.county ||
    ""
  );
}

export default function LocationPicker({ selected, onSelect }) {
  const [query, setQuery] = useState(selected?.display_name || "");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (selected?.display_name && selected.display_name !== query) {
      setQuery(selected.display_name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    if (selected && query === selected.display_name) return;
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return undefined;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      setSearchError("");
      try {
        const params = new URLSearchParams({
          q: query,
          format: "jsonv2",
          addressdetails: "1",
          limit: "5",
        });
        const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
          signal: controller.signal,
          headers: { "Accept-Language": "en" },
        });
        if (!res.ok) throw new Error("Search unavailable");
        const data = await res.json();
        setSuggestions(data);
        setOpen(true);
      } catch (err) {
        if (err.name !== "AbortError") {
          setSearchError("Couldn't search locations — you can still type a meeting point below.");
          setSuggestions([]);
        }
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const pick = (item) => {
    const address = item.address || {};
    onSelect({
      display_name: item.display_name,
      city: extractCity(address),
      country: address.country || "",
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    });
    setQuery(item.display_name);
    setSuggestions([]);
    setOpen(false);
  };

  const clear = () => {
    onSelect(null);
    setQuery("");
    setSuggestions([]);
    setSearchError("");
  };

  return (
    <div style={{ position: "relative", marginBottom: 14 }}>
      <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
        Location (optional — helps travellers find the area)
      </label>
      <div style={{ position: "relative" }}>
        <input
          placeholder="Search for a place, park, station…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selected) onSelect(null);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          style={{ marginBottom: 0, paddingRight: selected ? 36 : 14, background: "var(--paper-deep)" }}
        />
        {selected && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear location"
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              display: "flex",
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: "4px 0 0",
            padding: 0,
            position: "absolute",
            zIndex: 20,
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            width: "100%",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "10px 12px",
                  fontSize: 13,
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <MapPin size={14} style={{ marginTop: 2, flexShrink: 0, color: "var(--moss)" }} />
                <span>{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {searching && (
        <p className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
          Searching…
        </p>
      )}
      {searchError && (
        <p className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
          {searchError}
        </p>
      )}
      {selected && !searching && (
        <p className="mono" style={{ fontSize: 12, color: "var(--moss)", marginTop: 4 }}>
          Pinned: {selected.city || selected.display_name}
          {selected.country ? `, ${selected.country}` : ""}
        </p>
      )}
    </div>
  );
}
