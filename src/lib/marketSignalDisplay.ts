import type { SignalPriceZone } from "@/lib/marketSignal";

export const researchPrice = (value: number) => new Intl.NumberFormat("zh-CN", { maximumSignificantDigits: 12 }).format(value);
export const zoneKind = (zone: SignalPriceZone) => (zone.kind === "support") !== (zone.status === "retested") ? "支撑" : "阻力";
export const zoneRange = (zone: SignalPriceZone) => `${researchPrice(zone.lower)} – ${researchPrice(zone.upper)}`;
