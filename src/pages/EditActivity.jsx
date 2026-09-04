import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Lock } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import LocationPicker from "../components/LocationPicker.jsx";
import CategoryPicker from "../components/CategoryPicker.jsx";
import CurrencySelector from "../components/CurrencySelector.jsx";
import VerificationNotice from "../components/VerificationNotice.jsx";
import { getCategory } from "../lib/categories";
import { requiredTierFor, meetsTier, friendlyVerificationError } from "../lib/verification";

function toDatetimeLocalValue(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const LOCK_NOTICE =
  "Someone has already accepted, so the date/time, location, category, and spots are locked in — changing them now could pull the ground out from under people who already committed. Title and description are still yours to edit. Need to change one of the locked details? Cancel the activity below instead.";

export default function EditActivity() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState(null);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [form, setForm] = useState(null);
  const [location, setLocation] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [myTier, setMyTier] = useState("unverified");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          if (!cancelled) setLoadError(userError.message);
          return;
        }

        const { data: myProfile, error: myProfileError } = await supabase
          .from("profiles")
          .select("verification_tier")
          .eq("id", userData.user.id)
          .single();
        if (!cancelled && !myProfileError) setMyTier(myProfile?.verification_tier || "unverified");

        const { data, error } = await supabase.from("activities").select("*").eq("id", id).single();
        if (error) {
          if (!cancelled) setLoadError(error.message);
          return;
        }
        if (data.host_id !== userData.user.id) {
          navigate(`/activity/${id}`);
          return;
        }
        if (cancelled) return;
        setActivity(data);
        setForm({
          title: data.title || "",
          type: data.type || "Walk",
          description: data.description || "",
          meet_point: data.meet_point || "",
          starts_at: toDatetimeLocalValue(data.starts_at),
          spots_total: data.spots_total ?? 2,
          fee: data.fee ?? 0,
          currency: data.currency || "GBP",
        });

        const { data: acceptedRequests, error: acceptedError } = await supabase
          .from("requests")
          .select("id")
          .eq("activity_id", id)
          .eq("status", "accepted");
        if (cancelled) return;
        if (acceptedError) {
          setLoadError(acceptedError.message);
        } else {
          setAcceptedCount((acceptedRequests || []).length);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Couldn't load this activity. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const locked = acceptedCount > 0;
  const requiredTier = !locked ? requiredTierFor(form?.type) : null;
  const blockedByTier = Boolean(requiredTier) && !meetsTier(myTier, requiredTier);

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSelectLocation = (loc) => {
    setLocation(loc);
    if (loc && !form.meet_point) {
      setForm((f) => ({ ...f, meet_point: loc.display_name.split(",")[0] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (blockedByTier) return;
    setError("");
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        fee: form.fee === "" ? 0 : Number(form.fee),
        currency: form.currency,
      };
      if (!locked) {
        payload.type = form.type;
        payload.meet_point = form.meet_point;
        payload.starts_at = form.starts_at;
        payload.spots_total = Number(form.spots_total);
        if (location) {
          payload.city = location.city || null;
          payload.country = location.country || null;
          payload.latitude = location.latitude ?? null;
          payload.longitude = location.longitude ?? null;
        }
      }
      const { error } = await supabase.from("activities").update(payload).eq("id", id);
      if (error) setError(friendlyVerificationError(error.message));
      else navigate(`/activity/${id}`);
    } catch (err) {
      setError(err.message || "Couldn't save these changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelActivity = async () => {
    if (!window.confirm("Cancel this activity? Everyone who requested or was confirmed will be notified.")) return;
    setError("");
    setCancelling(true);
    try {
      const { error: activityError } = await supabase
        .from("activities")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (activityError) {
        setError(activityError.message);
        return;
      }
      const { error: requestsError } = await supabase
        .from("requests")
        .update({ status: "cancelled" })
        .eq("activity_id", id)
        .in("status", ["pending", "accepted", "waitlisted"]);
      if (requestsError) {
        setError(requestsError.message);
        return;
      }
      navigate(`/activity/${id}`);
    } catch (err) {
      setError(err.message || "Couldn't cancel this activity. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  if (loadError) return <div style={{ padding: 24 }}><ErrorBanner message={loadError} /></div>;
  if (!activity || !form) return <div style={{ padding: 24 }}>Loading…</div>;

  if (activity.status === "cancelled") {
    return (
      <div style={{ padding: "24px 20px" }}>
        <button
          onClick={() => navigate(-1)}
          className="mono"
          style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 20, cursor: "pointer" }}
        >
          <ChevronLeft size={16} /> back
        </button>
        <p style={{ color: "var(--muted)" }}>This activity has been cancelled and can no longer be edited.</p>
      </div>
    );
  }

  const category = getCategory(form.type);

  return (
    <div style={{ padding: "24px 20px" }}>
      <button
        onClick={() => navigate(-1)}
        className="mono"
        style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 20, cursor: "pointer" }}
      >
        <ChevronLeft size={16} /> back
      </button>

      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Edit activity</h1>

      {locked && (
        <div
          className="card"
          style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 20, background: "var(--paper-deep)" }}
        >
          <Lock size={16} style={{ marginTop: 2, flexShrink: 0, color: "var(--muted)" }} />
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>{LOCK_NOTICE}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input placeholder="Title" value={form.title} onChange={update("title")} required />

        <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>Category</label>
        {locked ? (
          <div
            className="mono"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: category.color, marginBottom: 14 }}
          >
            <Lock size={12} /> {category.value}
          </div>
        ) : (
          <CategoryPicker value={form.type} onChange={(type) => setForm((f) => ({ ...f, type }))} userTier={myTier} />
        )}

        {blockedByTier && (
          <div style={{ marginBottom: 14 }}>
            <VerificationNotice category={form.type} requiredTier={requiredTier} action="Hosting" />
          </div>
        )}

        <textarea placeholder="Description" value={form.description} onChange={update("description")} rows={3} />

        {locked ? (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <Lock size={12} /> Meeting point
            </div>
            <div style={{ fontSize: 14 }}>{activity.meet_point}</div>
          </div>
        ) : (
          <>
            <LocationPicker selected={location} onSelect={handleSelectLocation} />
            <input
              placeholder="Meeting point (public place, e.g. 'by the north gate')"
              value={form.meet_point}
              onChange={update("meet_point")}
              required
            />
          </>
        )}

        {locked ? (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <Lock size={12} /> Date & time
            </div>
            <div style={{ fontSize: 14 }}>{activity.starts_at ? new Date(activity.starts_at).toLocaleString() : "TBD"}</div>
          </div>
        ) : (
          <input type="datetime-local" value={form.starts_at} onChange={update("starts_at")} required />
        )}

        <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>Spots (max 3)</label>
        <input
          type="number"
          min={1}
          max={3}
          value={form.spots_total}
          onChange={update("spots_total")}
          disabled={locked}
          title={locked ? "Locked once someone has accepted — cancel the activity to change it." : undefined}
        />

        <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>Fee (0 = free)</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            type="number"
            min={0}
            max={20}
            step="0.01"
            value={form.fee}
            onChange={update("fee")}
            style={{ marginBottom: 0, flex: 1 }}
          />
          <CurrencySelector value={form.currency} onChange={(currency) => setForm((f) => ({ ...f, currency }))} />
        </div>

        <ErrorBanner message={error} />
        <button className="btn-primary" type="submit" disabled={saving || cancelling || blockedByTier}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="card" style={{ marginTop: 24, borderColor: "var(--brick)" }}>
        <h2 style={{ fontSize: 15, marginBottom: 6 }}>Cancel activity</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          This cancels the activity for everyone and can't be undone. Anyone with a pending or confirmed request will
          be notified.
        </p>
        <button
          type="button"
          className="btn-secondary"
          style={{ borderColor: "var(--brick)", color: "var(--brick)" }}
          onClick={handleCancelActivity}
          disabled={saving || cancelling}
        >
          {cancelling ? "Cancelling…" : "Cancel activity"}
        </button>
      </div>
    </div>
  );
}
