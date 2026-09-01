import React from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Navigation } from "lucide-react";
import { formatDistance } from "../lib/geo";
import { getCategory } from "../lib/categories";
import { formatFee } from "../lib/currency";
import Avatar from "./Avatar.jsx";
import RatingSummary from "./RatingSummary.jsx";
import { displayName } from "../lib/profileDisplay";
import { formatTimeOnly } from "../lib/formatDateTime";

export default function ActivityCard({ activity, spotsLeft, isFull, isOwn, distanceKm, hostRating }) {
  const navigate = useNavigate();
  const category = getCategory(activity.type);
  const Icon = category.icon;
  const host = activity.profiles;

  return (
    <div
      className="listing-card"
      style={{ background: isFull ? "var(--paper-deep)" : "var(--white)" }}
      onClick={() => navigate(`/activity/${activity.id}`)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700,
              fontSize: 19,
              lineHeight: 1.2,
              color: isFull ? "var(--muted)" : "var(--ink)",
            }}
          >
            {formatTimeOnly(activity.starts_at)}
          </div>
          <div
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 600,
              fontSize: 15,
              marginTop: 2,
              color: isFull ? "var(--muted)" : "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activity.title}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {isOwn && (
            <div className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--moss)", marginBottom: 2 }}>
              Yours
            </div>
          )}
          {isFull ? (
            <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
              Full
            </div>
          ) : activity.fee ? (
            <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 17, color: "var(--brick)" }}>
              {formatFee(activity.fee, activity.currency)}
            </div>
          ) : (
            <div className="mono" style={{ fontSize: 13, color: "var(--muted)" }}>
              Free
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, color: category.color }}>
          <Icon size={12} />
          {category.value}
        </span>
        {activity.city && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <MapPin size={12} />
            {[activity.city, activity.country].filter(Boolean).join(", ")}
          </span>
        )}
        {typeof distanceKm === "number" && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--moss)", flexShrink: 0 }}>
            <Navigation size={12} />
            {formatDistance(distanceKm)}
          </span>
        )}
      </div>

      {host && (
        <div className="listing-hairline" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <Avatar src={host.avatar_url} name={host.display_name} seed={activity.host_id} size={20} />
            <span style={{ fontSize: 12, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName(host)}
            </span>
            <RatingSummary summary={hostRating} size={10} />
          </div>
          <span
            className="mono"
            style={{ fontSize: 11, color: isFull ? "var(--brick)" : "var(--muted)", fontWeight: isFull ? 600 : 400, flexShrink: 0 }}
          >
            {isFull ? "Join waitlist" : `${spotsLeft} of ${activity.spots_total} left`}
          </span>
        </div>
      )}
    </div>
  );
}
