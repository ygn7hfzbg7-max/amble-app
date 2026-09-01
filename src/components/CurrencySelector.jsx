import React from "react";
import { CURRENCIES } from "../lib/currency";

export default function CurrencySelector({ value, onChange }) {
  return (
    <select
      aria-label="Currency"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: 84, flexShrink: 0, marginBottom: 0 }}
    >
      {CURRENCIES.map(({ code, symbol }) => (
        <option key={code} value={code}>
          {code} ({symbol})
        </option>
      ))}
    </select>
  );
}
