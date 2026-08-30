import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Navigation, X, Loader2 } from "lucide-react";

export default function LocationFilter({
  cities,
  value,
  onSelect,
  onClear,
  nearMe,
  onToggleNearMe,
  geoLoading,
  geoError,
}) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const suggestions = useMemo(() => {
    if (value && query === value) return [];
    const q = query.trim().toLowerCase();
    if (!q) return cities.slice(0, 8);
    return cities.filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
  }, [cities, query, value]);

  const pick = (city) => {
    onSelect(city);
    setQuery(city);
    setOpen(false);
  };

  const clear = () => {
    onClear();
    setQuery("");
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <div style={{ position: "relative" }}>
            <MapPin
              size={15}
              color="var(--muted)"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              placeholder="Where? Search by city…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (value) onClear();
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              style={{ marginBottom: 0, paddingLeft: 36, paddingRight: value ? 36 : 14 }}
            />
            {value && (
              <button
                type="button"
                onClick={clear}
                aria-label="Clear city filter"
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
                border: "1px solid var(--paper-deep)",
                borderRadius: 10,
                width: "100%",
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {suggestions.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(c)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "10px 12px",
                      fontSize: 13,
                      borderBottom: "1px solid var(--paper-deep)",
                    }}
                  >
                    <MapPin size={14} style={{ flexShrink: 0, color: "var(--moss)" }} />
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="mono"
          onClick={onToggleNearMe}
          aria-pressed={nearMe}
          title="Sort activities by distance from you"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 14px",
            height: 44,
            borderRadius: 10,
            border: `1px solid ${nearMe ? "var(--brick)" : "var(--paper-deep)"}`,
            background: nearMe ? "var(--brick)" : "var(--white)",
            color: nearMe ? "var(--white)" : "var(--ink)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {geoLoading ? <Loader2 size={14} className="spin" /> : <Navigation size={14} />}
          Near me
        </button>
      </div>

      {geoError && (
        <p className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          {geoError}
        </p>
      )}
    </div>
  );
}
