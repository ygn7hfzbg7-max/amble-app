import React from "react";
import { useNavigate } from "react-router-dom";
import { Mountain, UtensilsCrossed, Footprints, Clock, MapPin } from "lucide-react";

const TYPE_ICON = { Hike: Mountain, Food: UtensilsCrossed, Walk: Footprints };

const STATUS_LABEL = {
  pending: "Pending",
  accepted: "Confirmed",
  declined: "Declined",
  waitlisted: "Waitlisted",
};

const STATUS_COLOR = {
  pending: "var(--muted)",
  accepted: "var(--moss)",
  declined: "var(--brick)",
  waitlisted: "var(--gold)",
};

export default function PlanCard({ plan }) {
  const navigate = useNavigate();
  const { activity, role } = plan;
  const Icon = TYPE_ICON[activity.type] || Footprints;

  const isConfirmed =
    role === "hosting" ? plan.confirmedCount > 0 : plan.myStatus === "accepted";
  const canSeeExact = role === "hosting" || plan.myStatus === "accepted";
  const areaLabel = [activity.city, activity.country].filter(Boolean).join(", ");

  return (
    <div
      className="card"
      style={{
        cursor: "pointer",
        borderLeft: isConfirmed ? "4px solid var(--moss)" : "1px solid var(--paper-deep)",
        background: isConfirmed ? "rgba(60, 110, 88, 0.06)" : "var(--white)",
      }}
      onClick={() => navigate(`/activity/${activity.id}`)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon size={16} color="var(--moss)" />
          <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            {activity.type}
          </span>
        </div>
        <span
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: role === "hosting" ? "var(--gold)" : "var(--muted)",
            border: `1px solid ${role === "hosting" ? "var(--gold)" : "var(--muted)"}`,
            borderRadius: 999,
            padding: "2px 8px",
          }}
        >
          {role === "hosting" ? "Hosting" : "Joining"}
        </span>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 6 }}>{activity.title}</h3>

      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 12, marginBottom: 4 }}>
        <Clock size={12} />
        {new Date(activity.starts_at).toLocaleString()}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 12, marginBottom: canSeeExact ? 4 : 10 }}>
        <MapPin size={12} />
        {canSeeExact ? activity.meet_point : areaLabel || "Location shared once confirmed"}
      </div>
      {canSeeExact && areaLabel && (
        <div className="mono" style={{ color: "var(--muted)", fontSize: 11, marginBottom: 10 }}>
          {areaLabel}
        </div>
      )}

      {role === "hosting" ? (
        <div style={{ fontSize: 13 }}>
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
            {plan.confirmedCount}/{activity.spots_total} confirmed
          </div>
          {plan.confirmedNames.length > 0 ? (
            <div>{plan.confirmedNames.join(", ")}</div>
          ) : (
            <div style={{ color: "var(--muted)" }}>No one confirmed yet</div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Host: {plan.hostName}</span>
          <span className="mono" style={{ fontWeight: 600, color: STATUS_COLOR[plan.myStatus] || "var(--muted)" }}>
            {STATUS_LABEL[plan.myStatus] || plan.myStatus}
          </span>
        </div>
      )}
    </div>
  );
}
