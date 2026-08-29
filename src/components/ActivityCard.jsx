import React from "react";
import { useNavigate } from "react-router-dom";
import { Mountain, UtensilsCrossed, Footprints, Clock, Users } from "lucide-react";

const TYPE_ICON = { Hike: Mountain, Food: UtensilsCrossed, Walk: Footprints };

export default function ActivityCard({ activity, spotsLeft, isFull, isOwn }) {
  const navigate = useNavigate();
  const Icon = TYPE_ICON[activity.type] || Footprints;

  return (
    <div
      className="card"
      style={{
        cursor: "pointer",
        background: isFull ? "var(--paper-deep)" : "var(--white)",
      }}
      onClick={() => navigate(`/activity/${activity.id}`)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon size={16} color={isFull ? "var(--muted)" : "var(--moss)"} />
          <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            {activity.type}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isOwn && (
            <span
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--white)",
                background: "var(--moss)",
                borderRadius: 999,
                padding: "2px 8px",
              }}
            >
              Yours
            </span>
          )}
          {isFull && (
            <span
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--muted)",
                border: "1px solid var(--muted)",
                borderRadius: 999,
                padding: "2px 8px",
              }}
            >
              Full
            </span>
          )}
        </div>
      </div>
      <h3 style={{ fontSize: 16, marginBottom: 6, color: isFull ? "var(--muted)" : "var(--ink)" }}>
        {activity.title}
      </h3>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 12, marginBottom: 4 }}>
        <Clock size={12} />
        {new Date(activity.starts_at).toLocaleString()}
      </div>
      <div
        className="mono"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: isFull ? "var(--brick)" : "var(--muted)",
          fontWeight: isFull ? 600 : 400,
        }}
      >
        <Users size={12} />
        {isFull ? "Full — join waitlist" : `${spotsLeft} of ${activity.spots_total} spots left`}
      </div>
    </div>
  );
}
