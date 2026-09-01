import React from "react";
import { useNavigate } from "react-router-dom";
import { Star } from "lucide-react";
import Avatar from "./Avatar.jsx";
import { displayName } from "../lib/profileDisplay";

// "How was your walk with X?" — shown on My Plans for every review a user
// still owes. Disappears once submitted or once the 14-day window closes,
// since fetchPendingReviews stops returning it either way.
export default function ReviewPrompt({ pending }) {
  const navigate = useNavigate();
  const name = displayName({ display_name: pending.revieweeName });

  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      style={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderLeft: "4px solid var(--gold)",
      }}
      onClick={() => navigate(`/activity/${pending.activityId}/review/${pending.revieweeId}`)}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/activity/${pending.activityId}/review/${pending.revieweeId}`)}
    >
      <Avatar src={pending.revieweeAvatar} name={pending.revieweeName} seed={pending.revieweeId} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          How was your walk with {name}?
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {pending.activityTitle} · Leave a review
        </div>
      </div>
      <Star size={18} color="var(--gold)" style={{ flexShrink: 0 }} />
    </div>
  );
}
