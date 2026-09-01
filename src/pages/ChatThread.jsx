import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Send } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import ErrorBanner from "../components/ErrorBanner.jsx";
import Avatar from "../components/Avatar.jsx";
import { displayName } from "../lib/profileDisplay";
import { formatChatTimestamp } from "../lib/formatDateTime";

export default function ChatThread() {
  const { activityId, otherId } = useParams();
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [activity, setActivity] = useState(null);
  const [otherProfile, setOtherProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    let channel;
    let cancelled = false;

    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          setLoadError(userError.message);
          return;
        }
        const me = userData.user.id;
        if (cancelled) return;
        setUserId(me);

        const [activityRes, profileRes] = await Promise.all([
          supabase.from("activities").select("id, title").eq("id", activityId).single(),
          supabase.from("profiles").select("id, display_name, avatar_url").eq("id", otherId).single(),
        ]);
        if (activityRes.error) {
          setLoadError(activityRes.error.message);
          return;
        }
        if (profileRes.error) {
          setLoadError(profileRes.error.message);
          return;
        }
        if (cancelled) return;
        setActivity(activityRes.data);
        setOtherProfile(profileRes.data);

        const { data: msgData, error: msgError } = await supabase
          .from("messages")
          .select("*")
          .eq("activity_id", activityId)
          .or(
            `and(sender_id.eq.${me},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${me})`
          )
          .order("created_at", { ascending: true });
        if (msgError) {
          setLoadError(msgError.message);
          return;
        }
        if (cancelled) return;
        setMessages(msgData || []);

        // Mark anything the other person sent us in this thread as read now
        // that the conversation is open.
        await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .eq("activity_id", activityId)
          .eq("sender_id", otherId)
          .eq("recipient_id", me)
          .is("read_at", null);

        channel = supabase
          .channel(`messages-${activityId}-${me}-${otherId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `activity_id=eq.${activityId}` },
            (payload) => {
              const m = payload.new;
              const belongsHere =
                (m.sender_id === me && m.recipient_id === otherId) ||
                (m.sender_id === otherId && m.recipient_id === me);
              if (!belongsHere) return;
              setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
              if (m.recipient_id === me && !m.read_at) {
                supabase
                  .from("messages")
                  .update({ read_at: new Date().toISOString() })
                  .eq("id", m.id)
                  .then(({ error }) => {
                    if (error) console.error("Couldn't mark message read:", error.message);
                  });
              }
            }
          )
          .subscribe();
      } catch (err) {
        setLoadError(err.message || "Couldn't load this conversation. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [activityId, otherId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || !userId) return;
    setSendError("");
    setSending(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({ activity_id: activityId, sender_id: userId, recipient_id: otherId, body: text })
        .select()
        .single();
      if (error) {
        setSendError(error.message);
        return;
      }
      setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
      setBody("");
    } catch (err) {
      setSendError(err.message || "Couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (loadError) {
    return (
      <div style={{ padding: 24 }}>
        <button
          onClick={() => navigate(-1)}
          className="mono"
          style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 20, cursor: "pointer" }}
        >
          <ChevronLeft size={16} /> back
        </button>
        <ErrorBanner message={loadError} />
      </div>
    );
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid var(--paper-deep)", flexShrink: 0 }}>
        <button
          onClick={() => navigate(-1)}
          className="mono"
          style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 10, cursor: "pointer" }}
        >
          <ChevronLeft size={16} /> back
        </button>
        <div
          role="button"
          tabIndex={0}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          onClick={() => navigate(`/profile/${otherId}`)}
          onKeyDown={(e) => e.key === "Enter" && navigate(`/profile/${otherId}`)}
        >
          <Avatar src={otherProfile?.avatar_url} name={otherProfile?.display_name} seed={otherId} size={36} />
          <div>
            <h1 style={{ fontSize: 18, marginBottom: 2 }}>{displayName(otherProfile)}</h1>
            <p className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{activity?.title}</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {messages.length === 0 && (
          <p style={{ color: "var(--muted)", textAlign: "center", marginTop: 40 }}>
            No messages yet — say hello!
          </p>
        )}
        {messages.map((m) => {
          const isMine = m.sender_id === userId;
          return (
            <div
              key={m.id}
              style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", marginBottom: 10 }}
            >
              <div
                style={{
                  maxWidth: "75%",
                  padding: "10px 14px",
                  borderRadius: 14,
                  background: isMine ? "var(--brick)" : "var(--white)",
                  color: isMine ? "var(--white)" : "var(--ink)",
                  border: isMine ? "none" : "1px solid var(--paper-deep)",
                  fontSize: 14,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.body}
              </div>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, padding: "0 2px" }}>
                {formatChatTimestamp(m.created_at)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "12px 20px", borderTop: "1px solid var(--paper-deep)", flexShrink: 0 }}>
        <ErrorBanner message={sendError} />
        <form onSubmit={handleSend} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message…"
            style={{ marginBottom: 0, flex: 1 }}
            disabled={sending}
          />
          <button
            className="btn-primary"
            type="submit"
            style={{ width: "auto", padding: "0 18px", display: "flex", alignItems: "center", justifyContent: "center" }}
            disabled={sending || !body.trim()}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
