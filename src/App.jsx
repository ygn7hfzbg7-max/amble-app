import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import Login from "./pages/Login.jsx";
import Feed from "./pages/Feed.jsx";
import ActivityDetail from "./pages/ActivityDetail.jsx";
import PostActivity from "./pages/PostActivity.jsx";
import Profile from "./pages/Profile.jsx";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
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
            element={session ? <Navigate to="/" /> : <Login />}
          />
          <Route
            path="/"
            element={session ? <Feed /> : <Navigate to="/login" />}
          />
          <Route
            path="/activity/:id"
            element={session ? <ActivityDetail /> : <Navigate to="/login" />}
          />
          <Route
            path="/post"
            element={session ? <PostActivity /> : <Navigate to="/login" />}
          />
          <Route
            path="/profile"
            element={session ? <Profile /> : <Navigate to="/login" />}
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
