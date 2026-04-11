"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { WelcomeSetupModal } from "@/components/WelcomeSetupModal";
import {
  COUNTRIES,
  STORAGE_KEY,
  type CountryCurrency,
  type StoredSetup,
} from "@/lib/countries";
import {
  computeInvestorSnapshot,
  parseMoneyInput,
  type CalcMethod,
  type HoldingIntent,
} from "@/lib/investorCalc";
import {
  CALCULATOR_DRAFT_KEY,
  LEGACY_CALCULATOR_DRAFT_KEY,
  mergeDraft,
  parseCalculatorDraft,
  serializeDraft,
  type AppMode,
  type CalculatorDraftV2,
} from "@/lib/investorDraft";
import { computeQuickPortfolioSnapshot } from "@/lib/standardCalc";
import { downloadClearZakatReceiptPdf } from "@/lib/clearZakatReceiptPdf";

const NISAB_SILVER_GRAMS = 595;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
}

function formatWithSymbol(value: number, symbol: string): string {
  const neg = value < 0 ? "-" : "";
  return `${neg}${symbol}${formatNumber(value)}`;
}

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-base text-foreground shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-muted/50 focus:border-forest/40 focus:ring-2 focus:ring-[var(--accent-glow)]";

const OTHER_ASSETS_TOGGLE =
  "flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/25 focus-visible:ring-offset-1";

const METHOD_OPTIONS: {
  id: CalcMethod;
  title: string;
  description: string;
}[] = [
  {
    id: "full",
    title: "Full portfolio value",
    description: "Treat stocks and cash at face value before deductions.",
  },
  {
    id: "quarter",
    title: "Zakatable assets only (~25% proxy)",
    description:
      "Apply a stock proxy rate to listed equities, plus full cash, before deductions.",
  },
  {
    id: "dividend",
    title: "Dividend yield only",
    description:
      "Use declared annual dividend income as the zakatable base for this estimate.",
  },
];

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [currencyCode, setCurrencyCode] = useState("USD");

  const [appMode, setAppMode] = useState<AppMode>("advanced");

  const [nisabThreshold, setNisabThreshold] = useState("");
  const [nisabMetWithOutsideAssets, setNisabMetWithOutsideAssets] =
    useState(false);

  const [quickStockValue, setQuickStockValue] = useState("");
  const [quickCash, setQuickCash] = useState("");
  const [quickFreshCapital, setQuickFreshCapital] = useState("");
  const [quickDebts, setQuickDebts] = useState("");
  const [quickGoldSilver, setQuickGoldSilver] = useState("");
  const [quickOtherSavings, setQuickOtherSavings] = useState("");
  const [showQuickOtherAssets, setShowQuickOtherAssets] = useState(false);

  const [stockPortfolio, setStockPortfolio] = useState("");
  const [cashOnHand, setCashOnHand] = useState("");
  const [liabilities, setLiabilities] = useState("");
  const [exemptCapital, setExemptCapital] = useState("");
  const [annualDividends, setAnnualDividends] = useState("");
  const [advancedGoldSilver, setAdvancedGoldSilver] = useState("");
  const [advancedOtherSavings, setAdvancedOtherSavings] = useState("");
  const [showAdvancedOtherAssets, setShowAdvancedOtherAssets] =
    useState(false);
  const [holdingIntent, setHoldingIntent] =
    useState<HoldingIntent>("longterm");
  const [method, setMethod] = useState<CalcMethod>("full");

  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const [modalBaselineCountryCode, setModalBaselineCountryCode] = useState<
    string | null
  >(null);
  const [modalBaselineSilver, setModalBaselineSilver] = useState<number | null>(
    null,
  );
  const [modalBaselineSeedKey, setModalBaselineSeedKey] = useState(0);

  const openRegionSettings = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw) as StoredSetup;
        if (d.countryCode && typeof d.silverPerGram === "number") {
          setModalBaselineCountryCode(d.countryCode);
          setModalBaselineSilver(d.silverPerGram > 0 ? d.silverPerGram : null);
          setModalBaselineSeedKey((k) => k + 1);
          setRegionModalOpen(true);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setModalBaselineCountryCode(null);
    setModalBaselineSilver(null);
    setModalBaselineSeedKey((k) => k + 1);
    setRegionModalOpen(true);
  }, []);

  useEffect(() => {
    const merged = mergeDraft(
      parseCalculatorDraft(
        typeof window !== "undefined"
          ? localStorage.getItem(CALCULATOR_DRAFT_KEY)
          : null,
        typeof window !== "undefined"
          ? localStorage.getItem(LEGACY_CALCULATOR_DRAFT_KEY)
          : null,
      ),
    );

    let setupLoaded = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw) as StoredSetup;
        if (
          d.symbol &&
          d.currency &&
          typeof d.silverPerGram === "number" &&
          d.silverPerGram > 0
        ) {
          setupLoaded = true;
          setCurrencySymbol(d.symbol);
          setCurrencyCode(d.currency);
          const fromSilver = String(d.silverPerGram * NISAB_SILVER_GRAMS);
          setNisabThreshold(
            merged.nisabThreshold.trim() ? merged.nisabThreshold : fromSilver,
          );
          setShowWelcome(false);
        }
      }
    } catch {
      /* ignore */
    }

    setAppMode(merged.appMode);
    setQuickStockValue(merged.quickStockValue);
    setQuickCash(merged.quickCash);
    setQuickFreshCapital(merged.quickFreshCapital);
    setQuickDebts(merged.quickDebts);
    setQuickGoldSilver(merged.quickGoldSilver);
    setQuickOtherSavings(merged.quickOtherSavings);
    if (
      parseMoneyInput(merged.quickGoldSilver) > 0 ||
      parseMoneyInput(merged.quickOtherSavings) > 0
    ) {
      setShowQuickOtherAssets(true);
    }
    setStockPortfolio(merged.stockPortfolio);
    setCashOnHand(merged.cashOnHand);
    setAdvancedGoldSilver(merged.advancedGoldSilver);
    setAdvancedOtherSavings(merged.advancedOtherSavings);
    if (
      parseMoneyInput(merged.advancedGoldSilver) > 0 ||
      parseMoneyInput(merged.advancedOtherSavings) > 0
    ) {
      setShowAdvancedOtherAssets(true);
    }
    setLiabilities(merged.liabilities);
    setExemptCapital(merged.exemptCapital);
    setAnnualDividends(merged.annualDividends);
    setHoldingIntent(merged.holdingIntent);
    setMethod(merged.method);
    setLeadName(merged.leadName);
    setLeadEmail(merged.leadEmail);
    if (!setupLoaded) {
      setNisabThreshold(merged.nisabThreshold);
    }
    setNisabMetWithOutsideAssets(merged.nisabMetWithOutsideAssets);

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const draft: CalculatorDraftV2 = {
      v: 2,
      appMode,
      nisabThreshold,
      nisabMetWithOutsideAssets,
      quickStockValue,
      quickCash,
      quickGoldSilver,
      quickOtherSavings,
      quickFreshCapital,
      quickDebts,
      stockPortfolio,
      cashOnHand,
      advancedGoldSilver,
      advancedOtherSavings,
      liabilities,
      exemptCapital,
      annualDividends,
      holdingIntent,
      method,
      leadName,
      leadEmail,
    };
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(CALCULATOR_DRAFT_KEY, serializeDraft(draft));
      } catch {
        /* ignore */
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, [
    hydrated,
    appMode,
    nisabThreshold,
    nisabMetWithOutsideAssets,
    quickStockValue,
    quickCash,
    quickGoldSilver,
    quickOtherSavings,
    quickFreshCapital,
    quickDebts,
    stockPortfolio,
    cashOnHand,
    advancedGoldSilver,
    advancedOtherSavings,
    liabilities,
    exemptCapital,
    annualDividends,
    holdingIntent,
    method,
    leadName,
    leadEmail,
  ]);

  const quickSnapshot = useMemo(() => {
    return computeQuickPortfolioSnapshot({
      stockValue: parseMoneyInput(quickStockValue),
      idleCash: parseMoneyInput(quickCash),
      goldSilver: parseMoneyInput(quickGoldSilver),
      otherCashSavings: parseMoneyInput(quickOtherSavings),
      freshCapital: parseMoneyInput(quickFreshCapital),
      debts: parseMoneyInput(quickDebts),
      nisab: parseMoneyInput(nisabThreshold),
      nisabMetWithOutsideAssets,
    });
  }, [
    quickStockValue,
    quickCash,
    quickGoldSilver,
    quickOtherSavings,
    quickFreshCapital,
    quickDebts,
    nisabThreshold,
    nisabMetWithOutsideAssets,
  ]);

  const advancedSnapshot = useMemo(() => {
    return computeInvestorSnapshot({
      portfolio: parseMoneyInput(stockPortfolio),
      cash: parseMoneyInput(cashOnHand),
      goldSilver: parseMoneyInput(advancedGoldSilver),
      otherCashSavings: parseMoneyInput(advancedOtherSavings),
      liabilities: parseMoneyInput(liabilities),
      exemptCapital: parseMoneyInput(exemptCapital),
      nisab: parseMoneyInput(nisabThreshold),
      annualDividends: parseMoneyInput(annualDividends),
      method,
      holdingIntent,
      nisabMetWithOutsideAssets,
    });
  }, [
    stockPortfolio,
    cashOnHand,
    advancedGoldSilver,
    advancedOtherSavings,
    liabilities,
    exemptCapital,
    nisabThreshold,
    annualDividends,
    method,
    holdingIntent,
    nisabMetWithOutsideAssets,
  ]);

  const active = appMode === "quick" ? quickSnapshot : advancedSnapshot;

  const handleWelcomeComplete = useCallback(
    (payload: {
      country: CountryCurrency;
      silverPerGram: number;
      nisabFromSilver: number;
    }) => {
      const { country, silverPerGram, nisabFromSilver } = payload;
      setCurrencySymbol(country.symbol);
      setCurrencyCode(country.currency);
      setNisabThreshold(String(nisabFromSilver));
      const stored: StoredSetup = {
        countryCode: country.code,
        countryName: country.name,
        currency: country.currency,
        symbol: country.symbol,
        silverPerGram,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      setShowWelcome(false);
      setRegionModalOpen(false);
    },
    [],
  );

  const handleLeadFormSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      console.log("Form submission started");
      e.preventDefault();

      const name = leadName.trim();
      const email = leadEmail.trim();
      if (!name) {
        setLeadError("Please enter your name.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setLeadError("Please enter a valid email address.");
        return;
      }

      setLeadError(null);
      setLeadSubmitting(true);

      const snap = appMode === "quick" ? quickSnapshot : advancedSnapshot;

      const dateLabel = new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
      }).format(new Date());
      const netStr = formatWithSymbol(
        snap.netZakatableAmount,
        currencySymbol,
      );
      const zakatStr = formatWithSymbol(snap.zakatDue, currencySymbol);

      const formspreePromise = fetch("https://formspree.io/f/mwvwgkal", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email }),
      });

      const pdfPromise = Promise.resolve().then(() => {
        downloadClearZakatReceiptPdf({
          recipientName: name,
          dateLabel,
          netZakatableFormatted: netStr,
          zakatDueFormatted: zakatStr,
          currencyCode,
          currencySymbol,
        });
      });

      try {
        const [, res] = await Promise.all([pdfPromise, formspreePromise]);
        if (!res.ok) {
          let message = "Submission failed. Please try again.";
          try {
            const data = (await res.json()) as {
              error?: string;
              errors?: Record<string, string[]>;
            };
            if (typeof data.error === "string" && data.error) {
              message = data.error;
            } else if (data.errors) {
              const first = Object.values(data.errors)[0]?.[0];
              if (first) message = first;
            }
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }
        setLeadSuccess(true);
      } catch (err) {
        setLeadError(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      } finally {
        setLeadSubmitting(false);
      }
    },
    [
      appMode,
      leadName,
      leadEmail,
      quickSnapshot,
      advancedSnapshot,
      currencySymbol,
      currencyCode,
    ],
  );

  const cc = (code: string) => `(${code})`;

  const nisabBadgeClass =
    active.nisabStatus === "above_nisab"
      ? "border-emerald-200/80 bg-emerald-50 text-emerald-900"
      : active.nisabStatus === "below_nisab"
        ? "border-amber-200/80 bg-amber-50 text-amber-950"
        : "border-slate-200/90 bg-slate-100 text-slate-800";

  const nisabBadgeLabel =
    active.nisabStatus === "above_nisab"
      ? "Status: Above Nisab (Zakat Applicable)"
      : active.nisabStatus === "below_nisab"
        ? "Status: Below Nisab (No Zakat Due)"
        : "Status: No Zakat Due";

  if (!hydrated) {
    return (
      <div
        className="flex min-h-screen flex-1 items-center justify-center bg-surface"
        aria-busy="true"
        aria-label="Loading"
      />
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <WelcomeSetupModal
        open={showWelcome || regionModalOpen}
        countries={COUNTRIES}
        onComplete={handleWelcomeComplete}
        baselineSeedKey={modalBaselineSeedKey}
        baselineCountryCode={modalBaselineCountryCode}
        baselineSilverPerGram={modalBaselineSilver}
      />

      <header className="border-b border-[var(--card-ring)] bg-surface-elevated/90 px-4 py-7 shadow-sm backdrop-blur-md sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1 flex flex-col gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-forest-muted">
              Decision clarity
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              ClearZakat: For Stock Investors
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted sm:text-[0.9375rem]">
              Use{" "}
              <span className="font-medium text-foreground">Quick Portfolio</span>{" "}
              for a simple stock + cash view, or{" "}
              <span className="font-medium text-foreground">
                Advanced (Stocks)
              </span>{" "}
              for methods and holding intent. Amounts in{" "}
              <span className="font-medium text-foreground">{currencyCode}</span>{" "}
              <span className="tabular-nums text-foreground/90">
                ({currencySymbol})
              </span>
              .
            </p>
          </div>
          {!showWelcome ? (
            <button
              type="button"
              onClick={openRegionSettings}
              className="shrink-0 self-end rounded-lg px-1 py-0.5 text-sm text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/25 focus-visible:ring-offset-2 sm:self-start sm:pt-1"
              aria-label="Change region and currency"
            >
              <span aria-hidden>⚙️</span> Change Region/Currency
            </button>
          ) : null}
        </div>
      </header>

      <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-7 pb-16">
          <div
            className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white p-2 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]"
            role="tablist"
            aria-label="Calculator mode"
          >
            <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
              <button
                type="button"
                role="tab"
                aria-selected={appMode === "quick"}
                onClick={() => setAppMode("quick")}
                className={`relative rounded-xl px-3 py-3.5 text-center text-sm font-semibold transition-all duration-200 sm:px-4 sm:py-4 sm:text-[0.9375rem] ${
                  appMode === "quick"
                    ? "bg-white text-foreground shadow-md ring-1 ring-slate-200/90"
                    : "text-muted hover:bg-white/50 hover:text-foreground"
                }`}
              >
                Quick Portfolio
                <span className="mt-1 block text-[10px] font-normal uppercase tracking-wide text-muted sm:text-[11px]">
                  Stocks + cash
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={appMode === "advanced"}
                onClick={() => setAppMode("advanced")}
                className={`relative rounded-xl px-3 py-3.5 text-center text-sm font-semibold transition-all duration-200 sm:px-4 sm:py-4 sm:text-[0.9375rem] ${
                  appMode === "advanced"
                    ? "bg-white text-foreground shadow-md ring-1 ring-slate-200/90"
                    : "text-muted hover:bg-white/50 hover:text-foreground"
                }`}
              >
                Advanced (Stocks)
                <span className="mt-1 block text-[10px] font-normal uppercase tracking-wide text-muted sm:text-[11px]">
                  Portfolio & methods
                </span>
              </button>
            </div>
          </div>

          {appMode === "quick" ? (
            <section
              className="rounded-2xl border border-slate-200/80 bg-surface-elevated/95 p-6 shadow-[0_1px_0_rgba(15,23,42,0.04),0_12px_40px_-16px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-8"
              aria-labelledby="quick-heading"
            >
              <div className="flex flex-col gap-1 border-b border-border pb-5">
                <h2
                  id="quick-heading"
                  className="text-lg font-semibold tracking-tight text-foreground"
                >
                  Quick portfolio
                </h2>
                <p className="text-sm text-muted">
                  A streamlined view for stock investors — totals and Nisab
                  only, no method switches.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-5">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Total Stock Value {cc(currencyCode)}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={quickStockValue}
                    onChange={(e) => setQuickStockValue(e.target.value)}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                  <span className="text-xs leading-relaxed text-muted">
                    The current market value of all your active investments.
                  </span>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Idle Cash Balance {cc(currencyCode)}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={quickCash}
                    onChange={(e) => setQuickCash(e.target.value)}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                  <span className="text-xs leading-relaxed text-muted">
                    Uninvested cash sitting in your brokerage or bank.
                  </span>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Fresh Capital Inserted {cc(currencyCode)}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={quickFreshCapital}
                    onChange={(e) => setQuickFreshCapital(e.target.value)}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                  <span className="text-xs leading-relaxed text-muted">
                    Money deposited recently that has not reached the 1-year
                    Haul. This is exempt.
                  </span>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Debts / Liabilities {cc(currencyCode)}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={quickDebts}
                    onChange={(e) => setQuickDebts(e.target.value)}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                  <span className="text-xs leading-relaxed text-muted">
                    Margin loans or immediate debts owed.
                  </span>
                </label>

                <button
                  type="button"
                  className={OTHER_ASSETS_TOGGLE}
                  aria-expanded={showQuickOtherAssets}
                  onClick={() => setShowQuickOtherAssets((v) => !v)}
                >
                  <span className="text-base leading-none" aria-hidden>
                    +
                  </span>
                  Add Other Assets (Optional)
                </button>
                <div
                  className={`overflow-hidden transition-[max-height] duration-300 ease-out ${
                    showQuickOtherAssets ? "max-h-96" : "max-h-0"
                  }`}
                >
                  <div className="flex flex-col gap-5 border-l-2 border-slate-200/70 pl-3 sm:pl-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-foreground">
                        Gold &amp; Silver Value {cc(currencyCode)}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        placeholder="0"
                        value={quickGoldSilver}
                        onChange={(e) => setQuickGoldSilver(e.target.value)}
                        className={`${INPUT_CLASS} tabular-nums`}
                      />
                      <span className="text-xs leading-relaxed text-muted">
                        Included in your net zakatable amount when entered.
                      </span>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-foreground">
                        Other Cash/Savings {cc(currencyCode)}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        placeholder="0"
                        value={quickOtherSavings}
                        onChange={(e) => setQuickOtherSavings(e.target.value)}
                        className={`${INPUT_CLASS} tabular-nums`}
                      />
                      <span className="text-xs leading-relaxed text-muted">
                        Bank or savings outside your brokerage, if zakatable for
                        you.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-border pt-5">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Nisab threshold (silver-based) {cc(currencyCode)}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={nisabThreshold}
                      onChange={(e) => setNisabThreshold(e.target.value)}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </label>
                  <span className="text-xs leading-relaxed text-muted">
                    Default uses 1g silver × {NISAB_SILVER_GRAMS}g; verify live
                    rates.
                  </span>
                  <label className="mt-1 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200/70 bg-slate-50/50 px-3 py-2.5 transition-colors hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={nisabMetWithOutsideAssets}
                      onChange={(e) =>
                        setNisabMetWithOutsideAssets(e.target.checked)
                      }
                      className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-forest focus:ring-forest/30"
                    />
                    <span className="text-sm leading-snug text-muted">
                      I already meet the Nisab threshold with other outside
                      assets.
                    </span>
                  </label>
                </div>
              </div>
            </section>
          ) : (
            <section
              className="rounded-2xl border border-slate-200/80 bg-surface-elevated/95 p-6 shadow-[0_1px_0_rgba(15,23,42,0.04),0_12px_40px_-16px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-8"
              aria-labelledby="portfolio-heading"
            >
              <div className="flex flex-col gap-1 border-b border-border pb-5">
                <h2
                  id="portfolio-heading"
                  className="text-lg font-semibold tracking-tight text-foreground"
                >
                  Stock portfolio
                </h2>
                <p className="text-sm text-muted">
                  Positions and cash you hold for the zakat year — refine with
                  your advisor if needed.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-5">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Listed stock value {cc(currencyCode)}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={stockPortfolio}
                    onChange={(e) => setStockPortfolio(e.target.value)}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Liquid cash (same currency) {cc(currencyCode)}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={cashOnHand}
                    onChange={(e) => setCashOnHand(e.target.value)}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                </label>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Holding intent
                  </span>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setHoldingIntent("active")}
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                        holdingIntent === "active"
                          ? "border-forest/40 bg-white shadow-sm ring-1 ring-forest/15"
                          : "border-transparent bg-white/60 hover:border-slate-200"
                      }`}
                    >
                      <span className="font-semibold text-foreground">
                        Active trading
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted">
                        Frequent buying/selling for capital gains.
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHoldingIntent("longterm")}
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                        holdingIntent === "longterm"
                          ? "border-forest/40 bg-white shadow-sm ring-1 ring-forest/15"
                          : "border-transparent bg-white/60 hover:border-slate-200"
                      }`}
                    >
                      <span className="font-semibold text-foreground">
                        Long-term investment
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted">
                        Holding for fundamental growth and dividends.
                      </span>
                    </button>
                  </div>
                  {method === "quarter" ? (
                    <p className="mt-3 text-xs leading-relaxed text-muted">
                      Proxy on stocks:{" "}
                      <span className="font-medium text-foreground">
                        {Math.round(advancedSnapshot.stockProxyRate * 100)}%
                      </span>{" "}
                      {holdingIntent === "active"
                        ? "(active profile)"
                        : "(long-term profile)"}
                      .
                    </p>
                  ) : null}
                </div>

                <fieldset className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white/70 p-4">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    Calculation method
                  </legend>
                  <div className="flex flex-col gap-2">
                    {METHOD_OPTIONS.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-3 transition-colors ${
                          method === opt.id
                            ? "border-forest/35 bg-emerald-50/50 ring-1 ring-forest/10"
                            : "border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        <input
                          type="radio"
                          name="calc-method"
                          value={opt.id}
                          checked={method === opt.id}
                          onChange={() => setMethod(opt.id)}
                          className="mt-1 size-4 shrink-0 border-slate-300 text-forest focus:ring-forest/30"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">
                            {opt.title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                            {opt.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Annual dividend income (zakat year) {cc(currencyCode)}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={annualDividends}
                    onChange={(e) => setAnnualDividends(e.target.value)}
                    className={`${INPUT_CLASS} tabular-nums ${
                      method !== "dividend" ? "opacity-70" : ""
                    }`}
                  />
                  <span className="text-xs leading-relaxed text-muted">
                    {method === "dividend"
                      ? "Used as the zakatable base when Dividend yield only is selected."
                      : "Optional context; only affects results when Dividend yield only is selected."}
                  </span>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Liabilities &amp; debts {cc(currencyCode)}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={liabilities}
                    onChange={(e) => setLiabilities(e.target.value)}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Exempt capital (e.g. fresh deposits, last ~354 days){" "}
                    {cc(currencyCode)}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={exemptCapital}
                    onChange={(e) => setExemptCapital(e.target.value)}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                  <span className="text-xs leading-relaxed text-muted">
                    Funds not yet in haul may be excluded — confirm with your
                    scholar.
                  </span>
                </label>

                <button
                  type="button"
                  className={OTHER_ASSETS_TOGGLE}
                  aria-expanded={showAdvancedOtherAssets}
                  onClick={() => setShowAdvancedOtherAssets((v) => !v)}
                >
                  <span className="text-base leading-none" aria-hidden>
                    +
                  </span>
                  Add Other Assets (Optional)
                </button>
                <div
                  className={`overflow-hidden transition-[max-height] duration-300 ease-out ${
                    showAdvancedOtherAssets ? "max-h-96" : "max-h-0"
                  }`}
                >
                  <div className="flex flex-col gap-5 border-l-2 border-slate-200/70 pl-3 sm:pl-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-foreground">
                        Gold &amp; Silver Value {cc(currencyCode)}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        placeholder="0"
                        value={advancedGoldSilver}
                        onChange={(e) => setAdvancedGoldSilver(e.target.value)}
                        className={`${INPUT_CLASS} tabular-nums`}
                      />
                      <span className="text-xs leading-relaxed text-muted">
                        Added to your zakatable base at full value alongside
                        stocks and cash.
                      </span>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-foreground">
                        Other Cash/Savings {cc(currencyCode)}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        placeholder="0"
                        value={advancedOtherSavings}
                        onChange={(e) =>
                          setAdvancedOtherSavings(e.target.value)
                        }
                        className={`${INPUT_CLASS} tabular-nums`}
                      />
                      <span className="text-xs leading-relaxed text-muted">
                        Savings outside your brokerage, included at full value
                        when entered.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-border pt-5">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Nisab threshold (silver-based) {cc(currencyCode)}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={nisabThreshold}
                      onChange={(e) => setNisabThreshold(e.target.value)}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </label>
                  <span className="text-xs leading-relaxed text-muted">
                    Default uses 1g silver × {NISAB_SILVER_GRAMS}g; verify live
                    rates.
                  </span>
                  <label className="mt-1 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200/70 bg-slate-50/50 px-3 py-2.5 transition-colors hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={nisabMetWithOutsideAssets}
                      onChange={(e) =>
                        setNisabMetWithOutsideAssets(e.target.checked)
                      }
                      className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-forest focus:ring-forest/30"
                    />
                    <span className="text-sm leading-snug text-muted">
                      I already meet the Nisab threshold with other outside
                      assets.
                    </span>
                  </label>
                </div>
              </div>
            </section>
          )}

          <section
            className="rounded-2xl border border-slate-200/80 bg-surface-elevated/95 p-6 shadow-[0_1px_0_rgba(15,23,42,0.04),0_12px_40px_-16px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-8"
            aria-labelledby="results-heading"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <h2
                id="results-heading"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                Transparent math
              </h2>
              <span className="text-xs font-medium text-muted">
                Live estimate
              </span>
            </div>

            <p className="mt-2 text-sm text-muted">{active.methodDetail}</p>

            <div
              className={`mt-5 inline-flex w-full max-w-full rounded-full border px-4 py-2 text-sm font-medium sm:w-auto ${nisabBadgeClass}`}
              role="status"
            >
              {nisabBadgeLabel}
            </div>

            {appMode === "quick" ? (
              <div className="mt-6 space-y-0 rounded-2xl border border-slate-200/90 bg-slate-50/40 p-1">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-4 py-4">
                  <span className="text-sm text-muted">
                    Stocks + idle cash
                  </span>
                  <span className="text-right text-sm font-semibold tabular-nums text-foreground">
                    {formatWithSymbol(
                      quickSnapshot.stocksPlusCash,
                      currencySymbol,
                    )}
                  </span>
                </div>
                {quickSnapshot.optionalOtherAssets > 0 ? (
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-4 py-4">
                    <span className="text-sm text-muted">
                      Plus: gold &amp; silver, other savings
                    </span>
                    <span className="text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatWithSymbol(
                        quickSnapshot.optionalOtherAssets,
                        currencySymbol,
                      )}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-4 py-4">
                  <span className="text-sm text-muted">
                    Minus: fresh capital + debts
                  </span>
                  <span className="text-right text-sm font-semibold tabular-nums text-foreground">
                    −
                    {formatWithSymbol(
                      quickSnapshot.freshCapitalPlusDebts,
                      currencySymbol,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 bg-white/60 px-4 py-4">
                  <div className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      Net zakatable amount
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      {quickSnapshot.methodLabel}
                    </span>
                  </div>
                  <span className="shrink-0 text-right text-base font-semibold tabular-nums text-foreground">
                    {formatWithSymbol(
                      quickSnapshot.netZakatableAmount,
                      currencySymbol,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-5">
                  <span className="text-sm font-medium text-foreground">
                    Final zakat due (2.5%)
                  </span>
                  <span className="text-3xl font-bold tabular-nums tracking-tight text-forest sm:text-4xl">
                    {formatWithSymbol(
                      quickSnapshot.zakatDue,
                      currencySymbol,
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-0 rounded-2xl border border-slate-200/90 bg-slate-50/40 p-1">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-4 py-4">
                  <span className="text-sm text-muted">
                    Listed stocks + brokerage cash
                  </span>
                  <span className="text-right text-sm font-semibold tabular-nums text-foreground">
                    {formatWithSymbol(
                      advancedSnapshot.coreListedPlusCash,
                      currencySymbol,
                    )}
                  </span>
                </div>
                {advancedSnapshot.optionalOtherAssets > 0 ? (
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-4 py-4">
                    <span className="text-sm text-muted">
                      Plus: gold &amp; silver, other savings
                    </span>
                    <span className="text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatWithSymbol(
                        advancedSnapshot.optionalOtherAssets,
                        currencySymbol,
                      )}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-4 py-4">
                  <span className="text-sm text-muted">
                    Minus: liabilities / exempt capital
                  </span>
                  <span className="text-right text-sm font-semibold tabular-nums text-foreground">
                    {method === "dividend" ? (
                      <span className="text-muted">—</span>
                    ) : (
                      `−${formatWithSymbol(advancedSnapshot.liabilitiesAndExempt, currencySymbol)}`
                    )}
                  </span>
                </div>
                {method === "dividend" ? (
                  <p className="px-4 pb-2 text-[11px] leading-relaxed text-muted">
                    Dividend-only mode uses dividend income as the zakatable
                    base; portfolio liabilities and exempt capital are not
                    subtracted here.
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 bg-white/60 px-4 py-4">
                  <div className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      Net zakatable amount
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      {advancedSnapshot.methodLabel}
                    </span>
                  </div>
                  <span className="shrink-0 text-right text-base font-semibold tabular-nums text-foreground">
                    {formatWithSymbol(
                      advancedSnapshot.netZakatableAmount,
                      currencySymbol,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-5">
                  <span className="text-sm font-medium text-foreground">
                    Final zakat due (2.5%)
                  </span>
                  <span className="text-3xl font-bold tabular-nums tracking-tight text-forest sm:text-4xl">
                    {formatWithSymbol(
                      advancedSnapshot.zakatDue,
                      currencySymbol,
                    )}
                  </span>
                </div>
              </div>
            )}

            <p className="mt-6 text-center text-xs leading-relaxed text-muted">
              {appMode === "quick"
                ? "This tool follows simplified principles for stock investors. Consult a qualified scholar for your situation."
                : "This tool follows simplified principles. Choose the method that aligns with your understanding."}
            </p>
          </section>

          <section
            className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 via-white to-white p-6 shadow-sm sm:p-8"
            aria-labelledby="lead-heading"
          >
            <h2
              id="lead-heading"
              className="text-lg font-semibold tracking-tight text-foreground sm:text-xl"
            >
              Save your record &amp; enter the launch draw
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Enter your email to download a PDF copy of your calculation for
              your records, and automatically enter our launch raffle for a $50
              Amazon Gift Card!
            </p>
            <form
              className="mt-5 flex flex-col gap-4"
              noValidate
              onSubmit={handleLeadFormSubmit}
            >
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">Name</span>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  disabled={leadSubmitting || leadSuccess}
                  className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                  placeholder="Your name"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Email
                </span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  disabled={leadSubmitting || leadSuccess}
                  className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                  placeholder="you@example.com"
                />
              </label>
              {leadError ? (
                <p className="text-sm text-red-700" role="alert">
                  {leadError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={leadSubmitting || leadSuccess}
                className="mt-1 w-full rounded-xl border border-forest/20 bg-forest px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-forest-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-50 disabled:cursor-not-allowed disabled:bg-forest/60 disabled:hover:bg-forest/60"
              >
                {leadSuccess
                  ? "Successfully Entered!"
                  : leadSubmitting
                    ? "Sending…"
                    : "Submit & Enter Draw"}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
