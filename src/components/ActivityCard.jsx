import React from "react";
import { useNavigate } from "react-router-dom";
import { Mountain, UtensilsCrossed, Footprints, Clock } from "lucide-react";

const TYPE_ICON = { Hike: Mountain, Food: UtensilsCrossed, Walk: Footprints };

export default function ActivityCard({ activity }) {
  const navigate = useNavigate();
  const Icon = TYPE_ICON[activity.type] || Footprints;

  return (
    <div
      className="card"
      style={{ cursor: "pointer" }}
      onClick={() => navigate(`/activity/${activity.id}`)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon size={16} color="var(--moss)" />
        <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
          {activity.type}
        </span>
      </div>
      <h3 style={{ fontSize: 16, marginBottom: 6 }}>{activity.title}</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 12 }}>
        <Clock size={12} />
        {new Date(activity.starts_at).toLocaleString()}
      </div>
    </div>
  );
}
