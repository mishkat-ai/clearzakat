import type { CalcMethod, HoldingIntent } from "@/lib/investorCalc";

export const CALCULATOR_DRAFT_KEY = "clearzakat.calculatorDraft.v2";

export type AppMode = "quick" | "advanced";

export type CalculatorDraftV2 = {
  v: 2;
  appMode: AppMode;
  nisabThreshold: string;
  /** User confirms Nisab is met elsewhere; skip threshold comparison for badge/zakat gate */
  nisabMetWithOutsideAssets: boolean;
  quickStockValue: string;
  quickCash: string;
  quickGoldSilver: string;
  quickOtherSavings: string;
  quickFreshCapital: string;
  quickDebts: string;
  stockPortfolio: string;
  cashOnHand: string;
  advancedGoldSilver: string;
  advancedOtherSavings: string;
  liabilities: string;
  exemptCapital: string;
  annualDividends: string;
  holdingIntent: HoldingIntent;
  method: CalcMethod;
  leadName: string;
  leadEmail: string;
};

const DEFAULT_DRAFT: CalculatorDraftV2 = {
  v: 2,
  appMode: "advanced",
  nisabThreshold: "",
  nisabMetWithOutsideAssets: false,
  quickStockValue: "",
  quickCash: "",
  quickGoldSilver: "",
  quickOtherSavings: "",
  quickFreshCapital: "",
  quickDebts: "",
  stockPortfolio: "",
  cashOnHand: "",
  advancedGoldSilver: "",
  advancedOtherSavings: "",
  liabilities: "",
  exemptCapital: "",
  annualDividends: "",
  holdingIntent: "longterm",
  method: "full",
  leadName: "",
  leadEmail: "",
};

export const LEGACY_CALCULATOR_DRAFT_KEY = "clearzakat.investorDraft.v1";

function isHoldingIntent(x: unknown): x is HoldingIntent {
  return x === "active" || x === "longterm";
}

function isCalcMethod(x: unknown): x is CalcMethod {
  return x === "full" || x === "quarter" || x === "dividend";
}

function isAppMode(x: unknown): x is AppMode {
  return x === "quick" || x === "advanced";
}

function migrateFromV1(d: Record<string, unknown>): Partial<CalculatorDraftV2> {
  return {
    v: 2,
    appMode: "advanced",
    nisabThreshold:
      typeof d.nisabThreshold === "string" ? d.nisabThreshold : "",
    stockPortfolio:
      typeof d.stockPortfolio === "string" ? d.stockPortfolio : "",
    cashOnHand: typeof d.cashOnHand === "string" ? d.cashOnHand : "",
    liabilities: typeof d.liabilities === "string" ? d.liabilities : "",
    exemptCapital:
      typeof d.exemptCapital === "string" ? d.exemptCapital : "",
    annualDividends:
      typeof d.annualDividends === "string" ? d.annualDividends : "",
    holdingIntent: isHoldingIntent(d.holdingIntent)
      ? d.holdingIntent
      : "longterm",
    method: isCalcMethod(d.method) ? d.method : "full",
    leadName: typeof d.leadName === "string" ? d.leadName : "",
    leadEmail: typeof d.leadEmail === "string" ? d.leadEmail : "",
  };
}

function parseQuickFields(d: Record<string, unknown>): Partial<
  Pick<
    CalculatorDraftV2,
    | "quickStockValue"
    | "quickCash"
    | "quickGoldSilver"
    | "quickOtherSavings"
    | "quickFreshCapital"
    | "quickDebts"
  >
> {
  const out: Partial<
    Pick<
      CalculatorDraftV2,
      | "quickStockValue"
      | "quickCash"
      | "quickGoldSilver"
      | "quickOtherSavings"
      | "quickFreshCapital"
      | "quickDebts"
    >
  > = {};
  if (typeof d.quickStockValue === "string")
    out.quickStockValue = d.quickStockValue;
  else if (typeof d.standardGold === "string")
    out.quickStockValue = d.standardGold;

  if (typeof d.quickCash === "string") out.quickCash = d.quickCash;
  else if (typeof d.standardCash === "string")
    out.quickCash = d.standardCash;

  if (typeof d.quickFreshCapital === "string")
    out.quickFreshCapital = d.quickFreshCapital;
  else if (typeof d.standardExempt === "string")
    out.quickFreshCapital = d.standardExempt;

  if (typeof d.quickDebts === "string") out.quickDebts = d.quickDebts;
  else if (typeof d.standardLiabilities === "string")
    out.quickDebts = d.standardLiabilities;

  if (typeof d.quickGoldSilver === "string")
    out.quickGoldSilver = d.quickGoldSilver;
  if (typeof d.quickOtherSavings === "string")
    out.quickOtherSavings = d.quickOtherSavings;

  return out;
}

function parseAppMode(d: Record<string, unknown>): AppMode | undefined {
  if (isAppMode(d.appMode)) return d.appMode;
  if (d.appMode === "standard") return "quick";
  return undefined;
}

export function parseCalculatorDraft(
  raw: string | null,
  legacyRaw: string | null,
): Partial<CalculatorDraftV2> {
  if (raw) {
    try {
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (d.v === 2) {
        const out: Partial<CalculatorDraftV2> = {};
        const mode = parseAppMode(d);
        if (mode !== undefined) out.appMode = mode;
        if (typeof d.nisabThreshold === "string")
          out.nisabThreshold = d.nisabThreshold;
        if (typeof d.nisabMetWithOutsideAssets === "boolean")
          out.nisabMetWithOutsideAssets = d.nisabMetWithOutsideAssets;
        Object.assign(out, parseQuickFields(d));
        if (typeof d.stockPortfolio === "string")
          out.stockPortfolio = d.stockPortfolio;
        if (typeof d.cashOnHand === "string") out.cashOnHand = d.cashOnHand;
        if (typeof d.advancedGoldSilver === "string")
          out.advancedGoldSilver = d.advancedGoldSilver;
        if (typeof d.advancedOtherSavings === "string")
          out.advancedOtherSavings = d.advancedOtherSavings;
        if (typeof d.liabilities === "string") out.liabilities = d.liabilities;
        if (typeof d.exemptCapital === "string")
          out.exemptCapital = d.exemptCapital;
        if (typeof d.annualDividends === "string")
          out.annualDividends = d.annualDividends;
        if (isHoldingIntent(d.holdingIntent))
          out.holdingIntent = d.holdingIntent;
        if (isCalcMethod(d.method)) out.method = d.method;
        if (typeof d.leadName === "string") out.leadName = d.leadName;
        if (typeof d.leadEmail === "string") out.leadEmail = d.leadEmail;
        return out;
      }
      if (d.v === 1) {
        return migrateFromV1(d);
      }
    } catch {
      return {};
    }
  }
  if (legacyRaw) {
    try {
      const d = JSON.parse(legacyRaw) as Record<string, unknown>;
      if (d.v === 1) {
        return migrateFromV1(d);
      }
    } catch {
      return {};
    }
  }
  return {};
}

export function mergeDraft(partial: Partial<CalculatorDraftV2>): CalculatorDraftV2 {
  return { ...DEFAULT_DRAFT, ...partial };
}

export function serializeDraft(d: CalculatorDraftV2): string {
  return JSON.stringify(d);
}
