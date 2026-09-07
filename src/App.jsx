import React, { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase, ensureProfile } from "./lib/supabaseClient";
import { isProfileComplete } from "./lib/profileDisplay";
import Login from "./pages/Login.jsx";
import Feed from "./pages/Feed.jsx";
import ActivityDetail from "./pages/ActivityDetail.jsx";
import ActivityRequests from "./pages/ActivityRequests.jsx";
import PostActivity from "./pages/PostActivity.jsx";
import EditActivity from "./pages/EditActivity.jsx";
import EditProfile from "./pages/EditProfile.jsx";
import ProfileSetup from "./pages/ProfileSetup.jsx";
import Verification from "./pages/Verification.jsx";
import PublicProfile from "./pages/PublicProfile.jsx";
import MyPlans from "./pages/MyPlans.jsx";
import PendingRequests from "./pages/PendingRequests.jsx";
import ChatThread from "./pages/ChatThread.jsx";
import ReviewSubmit from "./pages/ReviewSubmit.jsx";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  // null = not checked yet, true/false once we know. Reset to null whenever
  // there's no signed-in user so a fresh sign-in always re-checks.
  const [profileComplete, setProfileComplete] = useState(null);

  const refreshProfileComplete = useCallback(async (userId) => {
    if (!userId) {
      setProfileComplete(null);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, bio")
      .eq("id", userId)
      .single();
    if (error) {
      // Fail open — a transient fetch error shouldn't lock an existing,
      // already-complete user out of the app.
      console.error("Couldn't check profile completeness:", error.message);
      setProfileComplete(true);
      return;
    }
    setProfileComplete(isProfileComplete(data));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await ensureProfile(data.session?.user);
      await refreshProfileComplete(data.session?.user?.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      await ensureProfile(s?.user);
      await refreshProfileComplete(s?.user?.id);
    });
    return () => listener.subscription.unsubscribe();
  }, [refreshProfileComplete]);

  // Wait for the completeness check too (once signed in) so protected
  // routes never flash before we know whether to redirect to setup.
  if (session === undefined || (session && profileComplete === null)) {
    return <div className="app-shell" style={{ padding: 40 }}>Loading…</div>;
  }

  const needsSetup = !!session && profileComplete === false;

  // Every route except /login, /profile-setup and the public activity/profile
  // pages goes through this — including on a plain reload or back-button
  // navigation, since it's re-evaluated on every render from live state
  // rather than from how the user got there.
  const gate = (element) => {
    if (!session) return <Navigate to="/login" />;
    if (needsSetup) return <Navigate to="/profile-setup" replace />;
    return element;
  };

  // Same gate, but for routes that stay reachable without a session at all.
  const gatePublic = (element) => {
    if (needsSetup) return <Navigate to="/profile-setup" replace />;
    return element;
  };

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Routes>
          <Route
            path="/login"
            element={
              session ? (
                <Navigate
                  to={
                    needsSetup
                      ? "/profile-setup"
                      : new URLSearchParams(window.location.search).get("redirect") || "/"
                  }
                />
              ) : (
                <Login />
              )
            }
          />
          <Route
            path="/profile-setup"
            element={
              session ? (
                profileComplete ? (
                  <Navigate to="/" />
                ) : (
                  <ProfileSetup onComplete={() => refreshProfileComplete(session.user.id)} />
                )
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route path="/" element={gate(<Feed />)} />
          {/* Public so a shared link works for someone who isn't logged in — they land
              on the activity's public (unconfirmed) view and are prompted to sign up
              or log in from there in order to request to join. */}
          <Route path="/activity/:id" element={gatePublic(<ActivityDetail />)} />
          <Route path="/activity/:id/requests" element={gate(<ActivityRequests />)} />
          <Route path="/post" element={gate(<PostActivity />)} />
          <Route path="/activity/:id/edit" element={gate(<EditActivity />)} />
          <Route path="/my-plans" element={gate(<MyPlans />)} />
          <Route path="/my-plans/requests" element={gate(<PendingRequests />)} />
          <Route path="/chat/:activityId/:otherId" element={gate(<ChatThread />)} />
          <Route path="/activity/:activityId/review/:revieweeId" element={gate(<ReviewSubmit />)} />
          <Route path="/profile" element={gate(<PublicProfile />)} />
          <Route path="/profile/edit" element={gate(<EditProfile />)} />
          <Route path="/verification" element={gate(<Verification />)} />
          {/* Public so a profile link works for someone who isn't logged in,
              same as the activity detail page above. */}
          <Route path="/profile/:userId" element={gatePublic(<PublicProfile />)} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
