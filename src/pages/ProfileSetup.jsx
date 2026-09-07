import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import Avatar from "../components/Avatar.jsx";
import { resizeImageFile } from "../lib/imageResize";

// Gates the rest of the app until name, avatar and bio are all filled in —
// see the profile-completeness gate in App.jsx. Deliberately has no back
// button and no "skip" path; the only way out besides finishing the form
// is signing out.
export default function ProfileSetup({ onComplete }) {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [form, setForm] = useState({ display_name: "", city: "", bio: "", languages: "", avatar_url: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          setError(userError.message);
          return;
        }
        setUserId(userData.user.id);
        const { data, error } = await supabase
          .from("profiles")
          .select("display_name, city, bio, languages, avatar_url")
          .eq("id", userData.user.id)
          .single();
        if (error) setError(error.message);
        else if (data) {
          setForm({
            display_name: data.display_name || "",
            city: data.city || "",
            bio: data.bio || "",
            languages: data.languages || "",
            avatar_url: data.avatar_url || "",
          });
        }
      } catch (err) {
        setError(err.message || "Couldn't load your profile. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;

    setAvatarError("");
    setUploadingAvatar(true);
    try {
      const blob = await resizeImageFile(file, 512);
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) {
        setAvatarError(uploadError.message || "Couldn't upload that photo. Please try again.");
        return;
      }
      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setForm((f) => ({ ...f, avatar_url: publicUrlData.publicUrl }));
    } catch (err) {
      setAvatarError(err.message || "Couldn't upload that photo. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
  };

  const missingFields = () => {
    const missing = [];
    if (!form.display_name.trim()) missing.push("your name");
    if (!form.avatar_url.trim()) missing.push("a profile photo");
    if (!form.bio.trim()) missing.push("a short bio");
    return missing;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const missing = missingFields();
    if (missing.length > 0) {
      setError(`Please add ${missing.join(", ")} before continuing.`);
      return;
    }

    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        setError(userError.message);
        return;
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: form.display_name.trim(),
          city: form.city,
          bio: form.bio.trim(),
          languages: form.languages,
          avatar_url: form.avatar_url,
        })
        .eq("id", userData.user.id);
      if (error) {
        setError(error.message);
        return;
      }
      if (onComplete) await onComplete();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ padding: "24px 20px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button
          type="button"
          onClick={handleSignOut}
          className="mono"
          style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}
        >
          Sign out
        </button>
      </div>

      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Complete your profile</h1>
      <p style={{ color: "var(--muted)", marginBottom: 20, fontSize: 14 }}>
        Add a name, photo and short bio so hosts and travellers know who they're meeting before you can use Amble.
      </p>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
        <div style={{ position: "relative" }}>
          <Avatar src={form.avatar_url} name={form.display_name} seed={userId} size={92} />
          <button
            type="button"
            onClick={handleAvatarPick}
            disabled={uploadingAvatar}
            aria-label="Add profile photo"
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--brick)",
              color: "var(--white)",
              border: "2px solid var(--paper)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Camera size={15} />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          style={{ display: "none" }}
        />
        <p className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
          {uploadingAvatar ? "Uploading…" : "Tap the camera to add a photo"}
        </p>
        <ErrorBanner message={avatarError} />
      </div>

      <form onSubmit={handleSubmit}>
        <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>Display name *</label>
        <input
          placeholder="What should hosts and travellers call you?"
          value={form.display_name}
          onChange={update("display_name")}
        />

        <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>City (optional)</label>
        <input placeholder="City" value={form.city} onChange={update("city")} />

        <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>Languages spoken (optional)</label>
        <input placeholder="e.g. English, Spanish" value={form.languages} onChange={update("languages")} />

        <label className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>About me *</label>
        <textarea placeholder="Tell people a bit about yourself" value={form.bio} onChange={update("bio")} rows={5} />

        <ErrorBanner message={error} />
        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Continue to Amble"}
        </button>
      </form>
    </div>
  );
}
