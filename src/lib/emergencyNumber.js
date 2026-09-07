// Best-effort mapping from an approximate location to a local emergency
// number, for the "Get help" quick action (GetHelpPanel.jsx). This is
// purely a fast shortcut to standard emergency services — nothing here
// contacts, alerts, or dispatches anyone on Amble's side.
const EU_COUNTRY_CODES = new Set([
  "at", "be", "bg", "hr", "cy", "cz", "dk", "ee", "fi", "fr", "de", "gr",
  "hu", "ie", "it", "lv", "lt", "lu", "mt", "nl", "pl", "pt", "ro", "sk",
  "si", "es", "se",
]);

// 112 is the EU-wide number, and is also the sensible fallback: it's the
// GSM-standard emergency number widely (though not universally) recognised
// outside the EU too — used whenever we can't place the user more
// precisely, or have no location at all.
const FALLBACK = { number: "112", label: "Emergency services" };

export function emergencyNumberForCountryCode(countryCode) {
  const code = (countryCode || "").toLowerCase();
  if (code === "gb") return { number: "999", label: "Emergency services (UK)" };
  if (code === "us") return { number: "911", label: "Emergency services (US)" };
  if (EU_COUNTRY_CODES.has(code)) return { number: "112", label: "Emergency services (EU)" };
  return FALLBACK;
}
