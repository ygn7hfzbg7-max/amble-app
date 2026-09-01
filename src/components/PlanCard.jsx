import React from "react";
import { useNavigate } from "react-router-dom";
import { Mountain, UtensilsCrossed, Footprints, Clock, MapPin, MessageCircle } from "lucide-react";
import ShareButton from "./ShareButton.jsx";
import Avatar from "./Avatar.jsx";

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

function messageButtonStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "1px solid var(--paper-deep)",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    color: "var(--ink)",
  };
}

function UnreadDot({ size = 8 }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--brick)",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

export default function PlanCard({ plan, unreadThreads }) {
  const navigate = useNavigate();
  const { activity, role } = plan;
  const Icon = TYPE_ICON[activity.type] || Footprints;
  const unread = unreadThreads || new Set();

  const isConfirmed =
    role === "hosting" ? plan.confirmed.length > 0 : plan.myStatus === "accepted";
  const canSeeExact = role === "hosting" || plan.myStatus === "accepted";
  const areaLabel = [activity.city, activity.country].filter(Boolean).join(", ");

  const hasUnread =
    role === "hosting"
      ? plan.confirmed.some((c) => unread.has(`${activity.id}:${c.travellerId}`))
      : plan.myStatus === "accepted" && unread.has(`${activity.id}:${activity.host_id}`);

  const goToChat = (e, otherId) => {
    e.stopPropagation();
    navigate(`/chat/${activity.id}/${otherId}`);
  };

  const goToProfile = (e, otherId) => {
    e.stopPropagation();
    navigate(`/profile/${otherId}`);
  };

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
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {hasUnread && <UnreadDot />}
          {role === "hosting" && (
            <ShareButton
              iconOnly
              title={activity.title}
              text={`Join me for ${activity.title}${areaLabel ? ` in ${areaLabel}` : ""} on Amble.`}
              url={`${window.location.origin}/activity/${activity.id}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                borderRadius: "50%",
                border: "1px solid var(--paper-deep)",
                background: "var(--white)",
                color: "var(--ink)",
                cursor: "pointer",
                padding: 0,
              }}
            />
          )}
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
            {plan.confirmed.length}/{activity.spots_total} confirmed
          </div>
          {plan.confirmed.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {plan.confirmed.map((c) => (
                <div
                  key={c.requestId}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                >
                  <span
                    role="button"
                    tabIndex={0}
                    style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, cursor: "pointer" }}
                    onClick={(e) => goToProfile(e, c.travellerId)}
                    onKeyDown={(e) => e.key === "Enter" && goToProfile(e, c.travellerId)}
                  >
                    <Avatar src={c.avatarUrl} name={c.name} seed={c.travellerId} size={22} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                    </span>
                    {unread.has(`${activity.id}:${c.travellerId}`) && <UnreadDot size={6} />}
                  </span>
                  <button
                    className="mono"
                    style={{ ...messageButtonStyle(), flexShrink: 0 }}
                    onClick={(e) => goToChat(e, c.travellerId)}
                  >
                    <MessageCircle size={12} /> Message
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "var(--muted)" }}>No one confirmed yet</div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              role="button"
              tabIndex={0}
              style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, cursor: "pointer" }}
              onClick={(e) => goToProfile(e, activity.host_id)}
              onKeyDown={(e) => e.key === "Enter" && goToProfile(e, activity.host_id)}
            >
              <Avatar src={plan.hostAvatarUrl} name={plan.hostName} seed={activity.host_id} size={22} />
              Host: {plan.hostName}
            </span>
            <span className="mono" style={{ fontWeight: 600, color: STATUS_COLOR[plan.myStatus] || "var(--muted)" }}>
              {STATUS_LABEL[plan.myStatus] || plan.myStatus}
            </span>
          </div>
          {plan.myStatus === "accepted" && (
            <button
              className="mono"
              style={{ ...messageButtonStyle(), marginTop: 10 }}
              onClick={(e) => goToChat(e, activity.host_id)}
            >
              <MessageCircle size={12} /> Message host
              {unread.has(`${activity.id}:${activity.host_id}`) && <UnreadDot size={6} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
