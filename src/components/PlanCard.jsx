import React from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, MessageCircle } from "lucide-react";
import ShareButton from "./ShareButton.jsx";
import Avatar from "./Avatar.jsx";
import RatingSummary from "./RatingSummary.jsx";
import { getCategory } from "../lib/categories";
import { formatTimeOnly } from "../lib/formatDateTime";

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

export default function PlanCard({ plan, unreadThreads, hostRating }) {
  const navigate = useNavigate();
  const { activity, role } = plan;
  const category = getCategory(activity.type);
  const Icon = category.icon;
  const unread = unreadThreads || new Set();

  const isConfirmed =
    role === "hosting" ? plan.confirmed.length > 0 : plan.myStatus === "accepted";
  const canSeeExact = role === "hosting" || plan.myStatus === "accepted";
  const areaLabel = [activity.city, activity.country].filter(Boolean).join(", ");
  const locationLabel = canSeeExact ? activity.meet_point : areaLabel || "Location shared once confirmed";

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
      className="listing-card"
      style={{
        borderLeft: isConfirmed ? "4px solid var(--moss)" : "1px solid var(--paper-deep)",
        background: isConfirmed ? "rgba(60, 110, 88, 0.06)" : "var(--white)",
      }}
      onClick={() => navigate(`/activity/${activity.id}`)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 19, lineHeight: 1.2, color: "var(--ink)" }}>
            {formatTimeOnly(activity.starts_at)}
          </div>
          <div
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 600,
              fontSize: 15,
              marginTop: 2,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activity.title}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
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
          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: role === "hosting" ? "var(--gold)" : "var(--muted)" }}>
            {role === "hosting" ? "Hosting" : "Joining"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, color: category.color }}>
          <Icon size={12} />
          {category.value}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <MapPin size={12} />
          {locationLabel}
        </span>
      </div>

      {role === "hosting" ? (
        <div className="listing-hairline">
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: plan.confirmed.length > 0 ? 8 : 0 }}>
            {plan.confirmed.length}/{activity.spots_total} confirmed
          </div>
          {plan.confirmed.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {plan.confirmed.map((c) => (
                <div key={c.requestId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span
                    role="button"
                    tabIndex={0}
                    style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, cursor: "pointer" }}
                    onClick={(e) => goToProfile(e, c.travellerId)}
                    onKeyDown={(e) => e.key === "Enter" && goToProfile(e, c.travellerId)}
                  >
                    <Avatar src={c.avatarUrl} name={c.name} seed={c.travellerId} size={20} />
                    <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                    </span>
                    {unread.has(`${activity.id}:${c.travellerId}`) && <UnreadDot size={6} />}
                  </span>
                  <button className="mono" style={{ ...messageButtonStyle(), flexShrink: 0 }} onClick={(e) => goToChat(e, c.travellerId)}>
                    <MessageCircle size={12} /> Message
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="listing-hairline" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div
            role="button"
            tabIndex={0}
            style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, cursor: "pointer" }}
            onClick={(e) => goToProfile(e, activity.host_id)}
            onKeyDown={(e) => e.key === "Enter" && goToProfile(e, activity.host_id)}
          >
            <Avatar src={plan.hostAvatarUrl} name={plan.hostName} seed={activity.host_id} size={20} />
            <span style={{ fontSize: 12, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {plan.hostName}
            </span>
            <RatingSummary summary={hostRating} size={10} />
          </div>
          <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[plan.myStatus] || "var(--muted)", flexShrink: 0 }}>
            {STATUS_LABEL[plan.myStatus] || plan.myStatus}
          </span>
        </div>
      )}

      {role === "joining" && plan.myStatus === "accepted" && (
        <button className="mono" style={{ ...messageButtonStyle(), marginTop: 10 }} onClick={(e) => goToChat(e, activity.host_id)}>
          <MessageCircle size={12} /> Message host
          {unread.has(`${activity.id}:${activity.host_id}`) && <UnreadDot size={6} />}
        </button>
      )}
    </div>
  );
}
