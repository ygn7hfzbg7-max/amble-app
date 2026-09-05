import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Eye, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import Avatar from "../components/Avatar.jsx";
import TierBadge from "../components/TierBadge.jsx";
import { displayName } from "../lib/profileDisplay";
import { TIER_LABELS } from "../lib/verification";

export default function Profile() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        setError(error.message);
        return;
      }
      setUserId(data.user?.id || null);
      setEmail(data.user?.email || "");
      if (data.user?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("display_name, avatar_url, verification_tier")
          .eq("id", data.user.id)
          .single();
        if (profileError) setError(profileError.message);
        else setProfile(profileData);
      }
    })();
  }, []);

  const handleSignOut = async () => {
    setError("");
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
    else navigate("/login");
  };

  return (
    <div style={{ padding: "24px 20px" }}>
      <button
        onClick={() => navigate(-1)}
        className="mono"
        style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 20, cursor: "pointer" }}
      >
        <ChevronLeft size={16} /> back
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
        <Avatar src={profile?.avatar_url} name={profile?.display_name} seed={userId} size={56} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 20, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName(profile)}
          </h1>
          <p className="mono" style={{ color: "var(--muted)", fontSize: 12, marginBottom: 4 }}>{email}</p>
          <TierBadge tier={profile?.verification_tier} />
        </div>
      </div>

      <ErrorBanner message={error} />

      <button
        className="btn-secondary"
        style={{ marginTop: 16, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        onClick={() => navigate("/verification")}
      >
        <ShieldCheck size={16} /> Verification — {TIER_LABELS[profile?.verification_tier] || "Basic"}
      </button>
      {userId && (
        <button
          className="btn-secondary"
          style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          onClick={() => navigate(`/profile/${userId}`)}
        >
          <Eye size={16} /> View your public profile
        </button>
      )}
      <button
        className="btn-secondary"
        style={{ marginBottom: 12 }}
        onClick={() => navigate("/profile/edit")}
      >
        Edit profile
      </button>
      <button className="btn-secondary" onClick={handleSignOut}>Sign out</button>
    </div>
  );
}
