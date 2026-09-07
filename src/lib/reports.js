// Reasons a report/flag can be filed for — shared between the report form
// (ReportPanel.jsx) and the notification email sent from
// api/send-notification.js, so the value stored in `reports.reason` and its
// human-readable label never drift apart.
export const REPORT_REASONS = [
  { value: "no_show", label: "No-show" },
  { value: "felt_unsafe", label: "Felt unsafe" },
  { value: "inappropriate_behavior", label: "Inappropriate behavior" },
  { value: "other", label: "Other" },
];

export function reportReasonLabel(reason) {
  return REPORT_REASONS.find((r) => r.value === reason)?.label || reason;
}
