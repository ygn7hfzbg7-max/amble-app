// Currency lives on the activity, set by the host when posting — the app
// never converts between currencies. A host is paid in person in their own
// local currency, so we only ever display the amount with the right symbol,
// never a converted figure.

export const CURRENCIES = [
  { code: "GBP", symbol: "£", label: "British pound" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "USD", symbol: "$", label: "US dollar" },
  { code: "CAD", symbol: "$", label: "Canadian dollar" },
  { code: "AUD", symbol: "$", label: "Australian dollar" },
  { code: "NZD", symbol: "$", label: "New Zealand dollar" },
  { code: "CHF", symbol: "Fr", label: "Swiss franc" },
  { code: "SEK", symbol: "kr", label: "Swedish krona" },
  { code: "NOK", symbol: "kr", label: "Norwegian krone" },
  { code: "DKK", symbol: "kr", label: "Danish krone" },
  { code: "PLN", symbol: "zł", label: "Polish zloty" },
  { code: "CZK", symbol: "Kč", label: "Czech koruna" },
  { code: "HUF", symbol: "Ft", label: "Hungarian forint" },
  { code: "JPY", symbol: "¥", label: "Japanese yen" },
  { code: "CNY", symbol: "¥", label: "Chinese yuan" },
  { code: "INR", symbol: "₹", label: "Indian rupee" },
  { code: "SGD", symbol: "$", label: "Singapore dollar" },
  { code: "HKD", symbol: "$", label: "Hong Kong dollar" },
  { code: "ZAR", symbol: "R", label: "South African rand" },
  { code: "BRL", symbol: "R$", label: "Brazilian real" },
  { code: "MXN", symbol: "$", label: "Mexican peso" },
  { code: "TRY", symbol: "₺", label: "Turkish lira" },
  { code: "AED", symbol: "د.إ", label: "UAE dirham" },
];

export const DEFAULT_CURRENCY = "GBP";

const SYMBOL_BY_CODE = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.symbol]));

// Nominatim returns English country names (we request Accept-Language: en),
// so this maps those names to the currency people are actually paid in.
const CURRENCY_BY_COUNTRY = {
  "United Kingdom": "GBP",
  Ireland: "EUR",
  Germany: "EUR",
  France: "EUR",
  Spain: "EUR",
  Italy: "EUR",
  Portugal: "EUR",
  Netherlands: "EUR",
  Belgium: "EUR",
  Austria: "EUR",
  Greece: "EUR",
  Finland: "EUR",
  Luxembourg: "EUR",
  Malta: "EUR",
  Cyprus: "EUR",
  Estonia: "EUR",
  Latvia: "EUR",
  Lithuania: "EUR",
  Slovakia: "EUR",
  Slovenia: "EUR",
  Croatia: "EUR",
  Switzerland: "CHF",
  Sweden: "SEK",
  Norway: "NOK",
  Denmark: "DKK",
  Poland: "PLN",
  Czechia: "CZK",
  "Czech Republic": "CZK",
  Hungary: "HUF",
  "United States": "USD",
  "United States of America": "USD",
  Canada: "CAD",
  Australia: "AUD",
  "New Zealand": "NZD",
  Japan: "JPY",
  China: "CNY",
  India: "INR",
  Singapore: "SGD",
  "Hong Kong": "HKD",
  "South Africa": "ZAR",
  Brazil: "BRL",
  Mexico: "MXN",
  Turkey: "TRY",
  "United Arab Emirates": "AED",
};

export function currencyForCountry(country) {
  return CURRENCY_BY_COUNTRY[country] || DEFAULT_CURRENCY;
}

export function currencySymbol(code) {
  return SYMBOL_BY_CODE[code] || SYMBOL_BY_CODE[DEFAULT_CURRENCY];
}

export function formatFee(fee, code) {
  const symbol = currencySymbol(code);
  const amount = Number.isInteger(fee) ? fee : Number(fee).toFixed(2);
  return `${symbol}${amount}`;
}
