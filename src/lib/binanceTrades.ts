import type { PrivateAuthSession } from "@/lib/privateAuth";
import { tradingRequest, type Trade } from "@/lib/trading";

export interface BinanceFill {
  id: string; orderId: string; time: number; symbol: string; side: "BUY" | "SELL";
  positionSide: "BOTH" | "LONG" | "SHORT"; price: string; qty: string;
  commission: string; commissionAsset: string; realizedPnl: string; maker: boolean;
  importedTradeId: string | null;
}
export interface BinanceQuery { symbol: string; startDate: string; endDate: string; page: number }
export interface BinanceList {
  symbols: string[]; records: BinanceFill[]; total: number; page: number; pages: number;
  updatedAt: string | null; syncedThrough: number | null;
}
export interface BinanceSelection extends Omit<BinanceQuery, "page"> {
  recordIds: string[]; direction: "long" | "short"; completeHistory: boolean;
  createId: string; targetId?: string; revision?: number; plannedRisk?: number | null;
}
export interface BinancePreview {
  symbol: string; direction: "long" | "short"; currency: string; selected: number; added: number; executions: number;
  entryQuantity: string; exitQuantity: string; entryAverage: string | null; exitAverage: string | null;
  remaining: string | null; exchangeRealizedPnl: string; knownFees: string; netPnl: string;
  feesComplete: boolean; positionKnown: boolean; status: "incomplete" | "open" | "closed";
}
export const listBinanceFills = (session: PrivateAuthSession, query: BinanceQuery, signal?: AbortSignal) =>
  tradingRequest<BinanceList>(session, "binance/list", query, signal);
export const previewBinanceTrade = (session: PrivateAuthSession, selection: BinanceSelection) =>
  tradingRequest<{ preview: BinancePreview }>(session, "binance/preview", selection);
export const importBinanceTrade = (session: PrivateAuthSession, selection: BinanceSelection) =>
  tradingRequest<{ trade: Trade; duplicate: boolean; added: number }>(session, "binance/import", selection);
