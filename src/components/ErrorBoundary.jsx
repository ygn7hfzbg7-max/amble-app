import React from "react";

// Catches render-time exceptions in its subtree so one broken section (e.g. a
// bad map prop) shows a fallback instead of unmounting the whole page blank.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <p className="error-banner">
          {this.props.message || "Something went wrong showing this. Please try refreshing."}
        </p>
      );
    }
    return this.props.children;
  }
}
