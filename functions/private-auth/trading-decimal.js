// Fixed precision arithmetic for exchange strings; never round through a JS float.
export const DECIMAL_SCALE = 10n ** 18n;
export function parseDecimal(value) {
  if (typeof value !== "string" || !/^-?\d{1,20}(\.\d{1,18})?$/.test(value)) throw new TypeError("Invalid decimal string");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const result = BigInt(whole) * DECIMAL_SCALE + BigInt(fraction.padEnd(18, "0"));
  return value.startsWith("-") ? -result : result;
}
export function formatDecimal(value) {
  const negative = value < 0n;
  const n = negative ? -value : value;
  const fraction = (n % DECIMAL_SCALE).toString().padStart(18, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${n / DECIMAL_SCALE}${fraction ? `.${fraction}` : ""}`;
}
