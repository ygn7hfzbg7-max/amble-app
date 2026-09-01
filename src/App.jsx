import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase, ensureProfile } from "./lib/supabaseClient";
import Login from "./pages/Login.jsx";
import Feed from "./pages/Feed.jsx";
import ActivityDetail from "./pages/ActivityDetail.jsx";
import ActivityRequests from "./pages/ActivityRequests.jsx";
import PostActivity from "./pages/PostActivity.jsx";
import Profile from "./pages/Profile.jsx";
import EditProfile from "./pages/EditProfile.jsx";
import PublicProfile from "./pages/PublicProfile.jsx";
import MyPlans from "./pages/MyPlans.jsx";
import PendingRequests from "./pages/PendingRequests.jsx";
import ChatThread from "./pages/ChatThread.jsx";
import ReviewSubmit from "./pages/ReviewSubmit.jsx";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      ensureProfile(data.session?.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      ensureProfile(s?.user);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="app-shell" style={{ padding: 40 }}>Loading…</div>;
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Routes>
          <Route
            path="/login"
            element={
              session ? (
                <Navigate to={new URLSearchParams(window.location.search).get("redirect") || "/"} />
              ) : (
                <Login />
              )
            }
          />
          <Route
            path="/"
            element={session ? <Feed /> : <Navigate to="/login" />}
          />
          {/* Public so a shared link works for someone who isn't logged in — they land
              on the activity's public (unconfirmed) view and are prompted to sign up
              or log in from there in order to request to join. */}
          <Route path="/activity/:id" element={<ActivityDetail />} />
          <Route
            path="/activity/:id/requests"
            element={session ? <ActivityRequests /> : <Navigate to="/login" />}
          />
          <Route
            path="/post"
            element={session ? <PostActivity /> : <Navigate to="/login" />}
          />
          <Route
            path="/my-plans"
            element={session ? <MyPlans /> : <Navigate to="/login" />}
          />
          <Route
            path="/my-plans/requests"
            element={session ? <PendingRequests /> : <Navigate to="/login" />}
          />
          <Route
            path="/chat/:activityId/:otherId"
            element={session ? <ChatThread /> : <Navigate to="/login" />}
          />
          <Route
            path="/activity/:activityId/review/:revieweeId"
            element={session ? <ReviewSubmit /> : <Navigate to="/login" />}
          />
          <Route
            path="/profile"
            element={session ? <Profile /> : <Navigate to="/login" />}
          />
          <Route
            path="/profile/edit"
            element={session ? <EditProfile /> : <Navigate to="/login" />}
          />
          {/* Public so a profile link works for someone who isn't logged in,
              same as the activity detail page above. */}
          <Route path="/profile/:userId" element={<PublicProfile />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
