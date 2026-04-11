import type { NisabStatusBadge } from "@/lib/investorCalc";

export type QuickPortfolioSnapshot = {
  /** Listed stocks + idle brokerage cash (core) */
  stocksPlusCash: number;
  /** Optional gold/silver + other savings (0 if unused) */
  optionalOtherAssets: number;
  /** Fresh capital + debts (subtracted together) */
  freshCapitalPlusDebts: number;
  netZakatableAmount: number;
  zakatDue: number;
  nisabStatus: NisabStatusBadge;
  methodLabel: string;
  methodDetail: string;
};

/**
 * Quick portfolio: (stocks + idle cash + optional assets) − (fresh capital + debts) → net zakatable; 2.5% if above nisab.
 */
export function computeQuickPortfolioSnapshot(input: {
  stockValue: number;
  idleCash: number;
  goldSilver: number;
  otherCashSavings: number;
  freshCapital: number;
  debts: number;
  nisab: number;
  /** When true, treat Nisab as satisfied; apply 2.5% to positive net only. */
  nisabMetWithOutsideAssets: boolean;
}): QuickPortfolioSnapshot {
  const P = Math.max(0, input.stockValue);
  const C = Math.max(0, input.idleCash);
  const G = Math.max(0, input.goldSilver);
  const O = Math.max(0, input.otherCashSavings);
  const F = Math.max(0, input.freshCapital);
  const D = Math.max(0, input.debts);
  const nisab = Math.max(0, input.nisab);

  const stocksPlusCash = P + C;
  const optionalOtherAssets = G + O;
  const freshCapitalPlusDebts = F + D;
  const net = stocksPlusCash + optionalOtherAssets - freshCapitalPlusDebts;

  let nisabStatus: NisabStatusBadge;
  let zakatDue: number;
  if (input.nisabMetWithOutsideAssets) {
    nisabStatus = "above_nisab";
    zakatDue = net > 0 ? net * 0.025 : 0;
  } else if (net <= 0) {
    nisabStatus = "no_zakat";
    zakatDue = 0;
  } else if (nisab <= 0) {
    nisabStatus = "below_nisab";
    zakatDue = 0;
  } else if (net < nisab) {
    nisabStatus = "below_nisab";
    zakatDue = 0;
  } else {
    nisabStatus = "above_nisab";
    zakatDue = net * 0.025;
  }

  const methodDetail =
    optionalOtherAssets > 0
      ? "Listed value plus idle brokerage cash, optional gold/savings, minus exempt deposits and debts."
      : "Listed value plus idle brokerage cash, minus exempt deposits and debts.";

  return {
    stocksPlusCash,
    optionalOtherAssets,
    freshCapitalPlusDebts,
    netZakatableAmount: net,
    zakatDue,
    nisabStatus,
    methodLabel: "Quick portfolio (stocks + cash)",
    methodDetail,
  };
}
