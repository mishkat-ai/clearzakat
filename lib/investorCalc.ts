export function parseMoneyInput(s: string): number {
  return parseFloat(String(s).replace(/,/g, "")) || 0;
}

export type HoldingIntent = "active" | "longterm";
export type CalcMethod = "full" | "quarter" | "dividend";

const ACTIVE_STOCK_PROXY = 0.28;
const LONGTERM_STOCK_PROXY = 0.25;

export type InvestorCalcInputs = {
  portfolio: number;
  cash: number;
  goldSilver: number;
  otherCashSavings: number;
  liabilities: number;
  exemptCapital: number;
  nisab: number;
  annualDividends: number;
  method: CalcMethod;
  holdingIntent: HoldingIntent;
  /** When true, treat Nisab as satisfied elsewhere; apply 2.5% to positive net only. */
  nisabMetWithOutsideAssets: boolean;
};

export type NisabStatusBadge = "no_zakat" | "below_nisab" | "above_nisab";

export type InvestorCalcSnapshot = {
  /** Listed stocks + brokerage cash (core), excludes optional assets */
  coreListedPlusCash: number;
  /** Optional gold/silver + other savings */
  optionalOtherAssets: number;
  /** Face-value sum P+C+G+O for display */
  totalPortfolioValue: number;
  liabilitiesAndExempt: number;
  stockProxyRate: number;
  /** Gross zakatable base before liabilities & exempt (method-specific). */
  grossZakatableBeforeDeductions: number;
  netZakatableAmount: number;
  zakatDue: number;
  nisabStatus: NisabStatusBadge;
  methodLabel: string;
  methodDetail: string;
};

export function computeInvestorSnapshot(
  input: InvestorCalcInputs,
): InvestorCalcSnapshot {
  const P = Math.max(0, input.portfolio);
  const C = Math.max(0, input.cash);
  const G = Math.max(0, input.goldSilver);
  const O = Math.max(0, input.otherCashSavings);
  const L = Math.max(0, input.liabilities);
  const E = Math.max(0, input.exemptCapital);
  const D = Math.max(0, input.annualDividends);
  const nisab = Math.max(0, input.nisab);

  const coreListedPlusCash = P + C;
  const optionalOtherAssets = G + O;
  const totalPortfolioValue = P + C + G + O;
  const liabilitiesAndExempt = L + E;

  const stockProxyRate =
    input.holdingIntent === "active"
      ? ACTIVE_STOCK_PROXY
      : LONGTERM_STOCK_PROXY;

  let grossZakatableBeforeDeductions: number;
  let methodLabel: string;
  let methodDetail: string;

  if (input.method === "full") {
    grossZakatableBeforeDeductions = totalPortfolioValue;
    methodLabel = "Full portfolio value";
    methodDetail =
      optionalOtherAssets > 0
        ? "Stocks + cash + optional gold/savings, before liabilities and exempt capital."
        : "Stocks + cash, before liabilities and exempt capital.";
  } else if (input.method === "quarter") {
    grossZakatableBeforeDeductions = P * stockProxyRate + C + G + O;
    const pct = Math.round(stockProxyRate * 100);
    methodLabel = "Zakatable assets only (stock proxy)";
    methodDetail =
      optionalOtherAssets > 0
        ? `${pct}% of stock value plus cash, optional gold/savings, before liabilities and exempt capital.`
        : `${pct}% of stock value plus full cash, before liabilities and exempt capital.`;
  } else {
    grossZakatableBeforeDeductions = D + G + O;
    methodLabel = "Dividend yield only";
    methodDetail =
      optionalOtherAssets > 0
        ? "Dividend income plus optional gold/savings; portfolio deductions not applied to dividend base."
        : "Uses your stated annual dividend income as the zakatable base (portfolio deductions not applied to this method).";
  }

  const netZakatableAmount =
    input.method === "dividend"
      ? D + G + O
      : grossZakatableBeforeDeductions - liabilitiesAndExempt;

  let nisabStatus: NisabStatusBadge;
  let zakatDue: number;

  if (input.nisabMetWithOutsideAssets) {
    nisabStatus = "above_nisab";
    zakatDue =
      netZakatableAmount > 0 ? netZakatableAmount * 0.025 : 0;
  } else if (netZakatableAmount <= 0) {
    nisabStatus = "no_zakat";
    zakatDue = 0;
  } else if (nisab <= 0) {
    nisabStatus = "below_nisab";
    zakatDue = 0;
  } else if (netZakatableAmount < nisab) {
    nisabStatus = "below_nisab";
    zakatDue = 0;
  } else {
    nisabStatus = "above_nisab";
    zakatDue = netZakatableAmount * 0.025;
  }

  zakatDue = Math.max(0, zakatDue);

  return {
    coreListedPlusCash,
    optionalOtherAssets,
    totalPortfolioValue,
    liabilitiesAndExempt,
    stockProxyRate,
    grossZakatableBeforeDeductions,
    netZakatableAmount,
    zakatDue,
    nisabStatus,
    methodLabel,
    methodDetail,
  };
}
