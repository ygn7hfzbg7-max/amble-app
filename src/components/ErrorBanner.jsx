import React from "react";

export default function ErrorBanner({ message }) {
  if (!message) return null;
  return <p className="error-banner">{message}</p>;
}
