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
const SILVER_PRICE_LAST_VERIFIED_KEY = "clearzakat.silverPriceLastVerifiedAt";
const LEGACY_NISAB_UPDATED_KEY = "clearzakat.nisabPriceUpdatedAt";

function nisabThresholdStringFromSilverPerGram(g: number): string {
  if (!Number.isFinite(g) || g <= 0) return "";
  const n = g * NISAB_SILVER_GRAMS;
  return String(Math.round(n * 10000) / 10000);
}

function readSilverLastVerifiedIso(): string | null {
  try {
    let iso = localStorage.getItem(SILVER_PRICE_LAST_VERIFIED_KEY);
    if (!iso) {
      const legacy = localStorage.getItem(LEGACY_NISAB_UPDATED_KEY);
      if (legacy) {
        localStorage.setItem(SILVER_PRICE_LAST_VERIFIED_KEY, legacy);
        iso = legacy;
      }
    }
    return iso;
  } catch {
    return null;
  }
}

function writeSilverLastVerifiedNow(): string {
  const iso = new Date().toISOString();
  try {
    localStorage.setItem(SILVER_PRICE_LAST_VERIFIED_KEY, iso);
  } catch {
    /* ignore */
  }
  return iso;
}

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

function MathLine({
  sign,
  label,
  value,
}: {
  sign: "+" | "−" | "=";
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline gap-3 border-b border-slate-200/60 py-2.5 last:border-b-0">
      <span className="w-5 shrink-0 text-center text-base font-semibold text-slate-400">
        {sign}
      </span>
      <span className="min-w-0 flex-1 text-sm text-slate-600">{label}</span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
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
    description: "100% of stocks + cash (+ optional assets), then deductions.",
  },
  {
    id: "quarter",
    title: "Zakatable assets only (~25% proxy)",
    description: "Proxy % on stocks + full cash (+ optional), then deductions.",
  },
  {
    id: "dividend",
    title: "Dividend yield only",
    description: "Dividends (+ optional assets) as base; no portfolio deductions.",
  },
];

type SilverPriceNisabSectionProps = {
  currencyCode: string;
  silverPerGramInput: string;
  onSilverChange: (value: string) => void;
  derivedNisabFormatted: string;
  lastVerifiedDisplay: string;
  silverStale: boolean;
  googleSearchHref: string;
  onResetDefault: () => void;
  resetDisabled: boolean;
  nisabMetWithOutsideAssets: boolean;
  onToggleOutside: (checked: boolean) => void;
  inputClassName: string;
};

function SilverPriceNisabSection({
  currencyCode,
  silverPerGramInput,
  onSilverChange,
  derivedNisabFormatted,
  lastVerifiedDisplay,
  silverStale,
  googleSearchHref,
  onResetDefault,
  resetDisabled,
  nisabMetWithOutsideAssets,
  onToggleOutside,
  inputClassName,
}: SilverPriceNisabSectionProps) {
  const cc = (code: string) => `(${code})`;
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-5">
      <div className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:p-5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Silver baseline
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              Nisab uses {NISAB_SILVER_GRAMS}g silver; your 1g rate drives the
              threshold.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetDefault}
            disabled={resetDisabled}
            className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/90 px-3 py-2 text-[11px] font-semibold tracking-tight text-slate-600 shadow-sm transition-[color,box-shadow,border-color,background-color] hover:border-slate-300 hover:bg-white hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/20 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 sm:mt-0.5 sm:w-auto"
          >
            <span className="text-sm leading-none text-slate-500" aria-hidden>
              ↻
            </span>
            Reset to Default
          </button>
        </div>

        <label className="mt-4 flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">
            1g silver price {cc(currencyCode)}
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="0"
            name="silverPerGram"
            autoComplete="off"
            value={silverPerGramInput}
            onChange={(e) => onSilverChange(e.target.value)}
            className={`${inputClassName} tabular-nums`}
          />
        </label>

        <a
          href={googleSearchHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex w-fit items-center gap-1 text-sm font-semibold text-forest/95 underline decoration-slate-300/80 underline-offset-[3px] transition-colors hover:text-forest hover:decoration-forest/45"
        >
          Check live rate <span aria-hidden>↗</span>
        </a>

        <div
          className={`mt-4 rounded-lg border border-slate-200/70 bg-white/70 px-3 py-2.5 ${
            silverStale ? "border-amber-200/80 bg-amber-50/35" : ""
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Active auditor
          </p>
          <div
            className={`mt-1.5 text-xs leading-relaxed ${
              silverStale ? "text-amber-900/95" : "text-slate-600"
            }`}
          >
            <p className="font-medium">
              Last verified:{" "}
              <span
                className={`tabular-nums ${
                  silverStale ? "text-amber-950" : "text-foreground"
                }`}
              >
                {lastVerifiedDisplay}
              </span>
            </p>
            {silverStale ? (
              <p className="mt-1.5 text-[11px] font-medium leading-snug text-amber-900/95">
                ⚠️ Prices fluctuate—verify today&apos;s rate.
              </p>
            ) : (
              <p className="mt-1 text-[11px] leading-snug text-slate-500">
                Updates whenever you change the 1g rate above.
              </p>
            )}
          </div>
        </div>

        <p className="mt-3 text-xs font-medium tabular-nums text-slate-600">
          Nisab threshold (derived):{" "}
          <span className="text-foreground">{derivedNisabFormatted}</span>
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200/70 bg-slate-50/50 px-3 py-2.5 transition-colors hover:bg-slate-50">
        <input
          type="checkbox"
          checked={nisabMetWithOutsideAssets}
          onChange={(e) => onToggleOutside(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-forest focus:ring-forest/30"
        />
        <span className="text-sm leading-snug text-muted">
          I already meet the Nisab threshold with other outside assets.
        </span>
      </label>
    </div>
  );
}

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

  const [resetAnchorSilverPerGram, setResetAnchorSilverPerGram] = useState<
    number | null
  >(null);
  const [silverPerGramInput, setSilverPerGramInput] = useState("");
  const [silverPriceLastVerifiedIso, setSilverPriceLastVerifiedIso] = useState<
    string | null
  >(null);
  const [liveInvestorCount, setLiveInvestorCount] = useState(42);

  const touchSilverPriceLastVerified = useCallback(() => {
    setSilverPriceLastVerifiedIso(writeSilverLastVerifiedNow());
  }, []);

  const handleSilverPerGramInputChange = useCallback((value: string) => {
    setSilverPerGramInput(value);
    const g = parseMoneyInput(value);
    setNisabThreshold(nisabThresholdStringFromSilverPerGram(g));
    setSilverPriceLastVerifiedIso(writeSilverLastVerifiedNow());
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as StoredSetup;
      if (typeof d.countryCode !== "string") return;
      const next: StoredSetup = {
        ...d,
        silverPerGram: Number.isFinite(g) && g >= 0 ? g : 0,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const handleResetSilverToDefault = useCallback(() => {
    if (resetAnchorSilverPerGram == null || resetAnchorSilverPerGram <= 0) {
      return;
    }
    const g = resetAnchorSilverPerGram;
    setSilverPerGramInput(String(g));
    setNisabThreshold(nisabThresholdStringFromSilverPerGram(g));
    touchSilverPriceLastVerified();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as StoredSetup;
      if (typeof d.countryCode !== "string") return;
      const next: StoredSetup = { ...d, silverPerGram: g };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, [resetAnchorSilverPerGram, touchSilverPriceLastVerified]);

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
          setResetAnchorSilverPerGram(d.silverPerGram);
          setSilverPerGramInput(String(d.silverPerGram));
          let verified = readSilverLastVerifiedIso();
          if (!verified) {
            verified = writeSilverLastVerifiedNow();
          }
          setSilverPriceLastVerifiedIso(verified);
          setNisabThreshold(
            nisabThresholdStringFromSilverPerGram(d.silverPerGram),
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
    const base = 42 + Math.floor(Math.random() * 6);
    setLiveInvestorCount(base);
    const tick = () => {
      setLiveInvestorCount((c) => {
        const roll = Math.random();
        let delta = 0;
        if (roll < 0.42) delta = 1;
        else if (roll < 0.68) delta = 0;
        else if (roll < 0.86) delta = -1;
        else delta = 2;
        return Math.max(36, Math.min(78, c + delta));
      });
    };
    const id = window.setInterval(
      tick,
      10000 + Math.floor(Math.random() * 9000),
    );
    return () => window.clearInterval(id);
  }, [hydrated]);

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

  const silverGoogleSearchHref = useMemo(() => {
    const label =
      new Intl.DisplayNames(["en"], { type: "currency" }).of(currencyCode) ??
      currencyCode;
    const q = `1g silver price in ${label}`;
    return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  }, [currencyCode]);

  const lastVerifiedDisplay = useMemo(() => {
    if (!silverPriceLastVerifiedIso) return "—";
    const dt = new Date(silverPriceLastVerifiedIso);
    if (Number.isNaN(dt.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(dt);
  }, [silverPriceLastVerifiedIso]);

  const silverLastVerifiedStale = useMemo(() => {
    if (!silverPriceLastVerifiedIso) return false;
    const t = new Date(silverPriceLastVerifiedIso).getTime();
    if (Number.isNaN(t)) return true;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return t < cutoff.getTime();
  }, [silverPriceLastVerifiedIso]);

  const derivedNisabFromSilverDisplay = useMemo(() => {
    const g = parseMoneyInput(silverPerGramInput);
    if (!g) return "—";
    return formatWithSymbol(g * NISAB_SILVER_GRAMS, currencySymbol);
  }, [silverPerGramInput, currencySymbol]);

  const handleWelcomeComplete = useCallback(
    (payload: {
      country: CountryCurrency;
      silverPerGram: number;
    }) => {
      const { country, silverPerGram } = payload;
      setCurrencySymbol(country.symbol);
      setCurrencyCode(country.currency);
      setResetAnchorSilverPerGram(silverPerGram);
      setSilverPerGramInput(String(silverPerGram));
      setNisabThreshold(nisabThresholdStringFromSilverPerGram(silverPerGram));
      const stored: StoredSetup = {
        countryCode: country.code,
        countryName: country.name,
        currency: country.currency,
        symbol: country.symbol,
        silverPerGram,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      touchSilverPriceLastVerified();
      setShowWelcome(false);
      setRegionModalOpen(false);
    },
    [touchSilverPriceLastVerified],
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
      const zakatStr = formatWithSymbol(
        Math.max(0, snap.zakatDue),
        currencySymbol,
      );

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

  const eligibilityCard = useMemo(() => {
    const nisabVal = parseMoneyInput(nisabThreshold);
    const net = active.netZakatableAmount;
    const fs = (n: number) => formatWithSymbol(n, currencySymbol);
    if (nisabMetWithOutsideAssets) {
      return {
        title: "Status: Above Nisab",
        subtext: `You indicated Nisab is met with outside assets. Net zakatable amount: ${fs(net)}.`,
        positive: true,
      };
    }
    if (active.nisabStatus === "above_nisab") {
      return {
        title: "Status: Above Nisab",
        subtext: `Your net zakatable amount of ${fs(net)} exceeds the Nisab threshold of ${fs(nisabVal)}.`,
        positive: true,
      };
    }
    if (active.nisabStatus === "below_nisab") {
      return {
        title: "Status: Below Nisab",
        subtext: `Your net zakatable amount of ${fs(net)} is below the Nisab threshold of ${fs(nisabVal)}.`,
        positive: false,
      };
    }
    return {
      title: "Status: No Zakat Due",
      subtext:
        net <= 0
          ? "After deductions, there is no zakatable surplus."
          : `Net zakatable amount is ${fs(net)}.`,
      positive: false,
    };
  }, [active, currencySymbol, nisabMetWithOutsideAssets, nisabThreshold]);

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
    <div className="flex min-h-[100dvh] flex-1 flex-col">
      <WelcomeSetupModal
        open={showWelcome || regionModalOpen}
        countries={COUNTRIES}
        onComplete={handleWelcomeComplete}
        baselineSeedKey={modalBaselineSeedKey}
        baselineCountryCode={modalBaselineCountryCode}
        baselineSilverPerGram={modalBaselineSilver}
      />

      <header className="border-b border-slate-200/70 bg-gradient-to-b from-slate-100/95 via-slate-50/98 to-[#eef3f8] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
          <div className="relative mb-6 flex min-h-[2.75rem] items-start justify-end sm:mb-8">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-10 sm:px-14"
              aria-live="polite"
            >
              <div className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-300/50 bg-white/95 px-3 py-1.5 shadow-[0_4px_16px_-4px_rgba(15,23,42,0.14),0_2px_6px_-2px_rgba(5,150,105,0.12)] backdrop-blur-sm sm:gap-2.5 sm:px-4 sm:py-2">
                <span
                  className="cz-social-proof-dot-sm shrink-0"
                  aria-hidden
                />
                <p className="truncate text-center text-[10px] font-medium leading-tight tracking-tight text-slate-800 sm:text-xs sm:leading-snug">
                  <span className="text-emerald-700" aria-hidden>
                    ●{" "}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    [{Math.max(42, liveInvestorCount)}+]
                  </span>{" "}
                  <span className="text-slate-600">
                    investors calculated their Zakat in the last 24 hours.
                  </span>
                </p>
              </div>
            </div>
            {!showWelcome ? (
              <button
                type="button"
                onClick={openRegionSettings}
                className="relative z-10 inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/25 focus-visible:ring-offset-2 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
                aria-label="Change region and currency"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-3.5 shrink-0 text-slate-500 sm:size-4"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.65.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.396 2.598a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.292.24-.437.613-.43.992a6.932 6.932 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.598a1.125 1.125 0 0 1-1.37.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.338.183-.587.494-.65.868l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.649-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.598a1.125 1.125 0 0 1-.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.379-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.598a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.337-.183.588-.495.65-.869l.214-1.281z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"
                  />
                </svg>
                <span className="hidden min-[380px]:inline">Region</span>
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 text-center sm:gap-4 sm:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Decision clarity
            </p>
            <h1 className="flex flex-col gap-2 sm:gap-2.5">
              <span className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                ClearZakat
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 sm:text-xs sm:tracking-[0.32em]">
                For Stock Investors
              </span>
            </h1>
            <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-600 sm:mx-0 sm:text-[0.9375rem]">
              Use{" "}
              <span className="font-medium text-slate-800">Quick Portfolio</span>{" "}
              for a simple stock + cash view, or{" "}
              <span className="font-medium text-slate-800">
                Advanced (Stocks)
              </span>{" "}
              for a guided method choice. Amounts in{" "}
              <span className="font-medium text-slate-800">{currencyCode}</span>{" "}
              <span className="tabular-nums text-slate-800">
                ({currencySymbol})
              </span>
              .
            </p>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-7 pb-10 sm:pb-16">
          <div
            className="rounded-[14px] border border-slate-200/70 bg-slate-200/75 p-[3px] shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]"
            role="tablist"
            aria-label="Calculator mode"
          >
            <div className="grid w-full grid-cols-2 gap-[3px]">
              <button
                type="button"
                role="tab"
                aria-selected={appMode === "quick"}
                onClick={() => setAppMode("quick")}
                className={`relative min-w-0 rounded-[11px] px-2 py-3 text-center text-sm font-semibold transition-all duration-200 sm:px-4 sm:py-3.5 sm:text-[0.9375rem] ${
                  appMode === "quick"
                    ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.08),0_4px_12px_-4px_rgba(15,23,42,0.12)]"
                    : "text-slate-500 hover:bg-white/40 hover:text-slate-700"
                }`}
              >
                Quick Portfolio
                <span
                  className={`mt-0.5 block text-[9px] font-medium uppercase tracking-wide sm:mt-1 sm:text-[10px] ${
                    appMode === "quick" ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Stocks + cash
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={appMode === "advanced"}
                onClick={() => setAppMode("advanced")}
                className={`relative min-w-0 rounded-[11px] px-2 py-3 text-center text-sm font-semibold transition-all duration-200 sm:px-4 sm:py-3.5 sm:text-[0.9375rem] ${
                  appMode === "advanced"
                    ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.08),0_4px_12px_-4px_rgba(15,23,42,0.12)]"
                    : "text-slate-500 hover:bg-white/40 hover:text-slate-700"
                }`}
              >
                Advanced (Stocks)
                <span
                  className={`mt-0.5 block text-[9px] font-medium uppercase tracking-wide sm:mt-1 sm:text-[10px] ${
                    appMode === "advanced" ? "text-slate-500" : "text-slate-400"
                  }`}
                >
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

                <SilverPriceNisabSection
                  currencyCode={currencyCode}
                  silverPerGramInput={silverPerGramInput}
                  onSilverChange={handleSilverPerGramInputChange}
                  derivedNisabFormatted={derivedNisabFromSilverDisplay}
                  lastVerifiedDisplay={lastVerifiedDisplay}
                  silverStale={silverLastVerifiedStale}
                  googleSearchHref={silverGoogleSearchHref}
                  onResetDefault={handleResetSilverToDefault}
                  resetDisabled={
                    resetAnchorSilverPerGram == null ||
                    resetAnchorSilverPerGram <= 0
                  }
                  nisabMetWithOutsideAssets={nisabMetWithOutsideAssets}
                  onToggleOutside={setNisabMetWithOutsideAssets}
                  inputClassName={INPUT_CLASS}
                />
              </div>
            </section>
          ) : (
            <section
              className="rounded-2xl border border-slate-200/80 bg-surface-elevated/95 p-6 shadow-[0_1px_0_rgba(15,23,42,0.04),0_12px_40px_-16px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-8"
              aria-labelledby="portfolio-heading"
            >
              <div className="mb-7 rounded-xl border border-slate-200/85 bg-white/95 p-5 shadow-sm sm:p-6">
                <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  Why do you hold these stocks?
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">
                  This sets a sensible default method. You can still change the
                  method in your portfolio block below.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHoldingIntent("active");
                      setMethod("full");
                    }}
                    className={`rounded-xl border px-4 py-3.5 text-left text-sm font-semibold transition-all sm:py-4 ${
                      holdingIntent === "active"
                        ? "border-forest/45 bg-emerald-50/70 shadow-sm ring-2 ring-forest/15"
                        : "border-slate-200/90 bg-white hover:border-slate-300"
                    }`}
                  >
                    Trading / Short-term Profit
                    <span className="mt-1.5 block text-xs font-normal leading-snug text-muted">
                      Default: 100% full value on listed stocks.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHoldingIntent("longterm");
                      setMethod("quarter");
                    }}
                    className={`rounded-xl border px-4 py-3.5 text-left text-sm font-semibold transition-all sm:py-4 ${
                      holdingIntent === "longterm"
                        ? "border-forest/45 bg-emerald-50/70 shadow-sm ring-2 ring-forest/15"
                        : "border-slate-200/90 bg-white hover:border-slate-300"
                    }`}
                  >
                    Long-term Investment / Retirement
                    <span className="mt-1.5 block text-xs font-normal leading-snug text-muted">
                      Suggested: 25% proxy or dividend method (adjust below).
                    </span>
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-emerald-900/[0.09] bg-gradient-to-b from-emerald-50/50 via-slate-50/40 to-white px-5 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:px-8 sm:py-10">
                <div className="border-b border-slate-200/70 pb-5">
                  <h2
                    id="portfolio-heading"
                    className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
                  >
                    Stock portfolio
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Listed value, cash, method, and deductions for this zakat
                    year.
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

                <fieldset className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-4">
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
                  {method === "quarter" ? (
                    <p className="text-[11px] font-medium text-muted">
                      Stock proxy:{" "}
                      <span className="text-foreground">
                        {Math.round(advancedSnapshot.stockProxyRate * 100)}%
                      </span>{" "}
                      ({holdingIntent === "active" ? "active" : "long-term"}{" "}
                      profile)
                    </p>
                  ) : null}
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
                    Optional exclusion for recent deposits.
                  </span>
                </label>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-dashed border-slate-200/90 bg-slate-50/25 p-3 opacity-[0.72] sm:p-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100/70 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/20 focus-visible:ring-offset-1"
                  aria-expanded={showAdvancedOtherAssets}
                  onClick={() => setShowAdvancedOtherAssets((v) => !v)}
                >
                  <span className="text-sm leading-none opacity-70" aria-hidden>
                    +
                  </span>
                  Other assets (optional)
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
              </div>

              <SilverPriceNisabSection
                currencyCode={currencyCode}
                silverPerGramInput={silverPerGramInput}
                onSilverChange={handleSilverPerGramInputChange}
                derivedNisabFormatted={derivedNisabFromSilverDisplay}
                lastVerifiedDisplay={lastVerifiedDisplay}
                silverStale={silverLastVerifiedStale}
                googleSearchHref={silverGoogleSearchHref}
                onResetDefault={handleResetSilverToDefault}
                resetDisabled={
                  resetAnchorSilverPerGram == null ||
                  resetAnchorSilverPerGram <= 0
                }
                nisabMetWithOutsideAssets={nisabMetWithOutsideAssets}
                onToggleOutside={setNisabMetWithOutsideAssets}
                inputClassName={INPUT_CLASS}
              />
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

            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted">
              {active.methodLabel}
            </p>

            <div
              className={`mt-6 rounded-2xl border px-5 py-6 sm:px-6 ${
                eligibilityCard.positive
                  ? "border-emerald-200/90 bg-emerald-50/55"
                  : "border-slate-200/90 bg-slate-50/90"
              }`}
              role="status"
            >
              <p
                className={`text-xl font-bold tracking-tight sm:text-2xl ${
                  eligibilityCard.positive
                    ? "text-emerald-900"
                    : "text-slate-500"
                }`}
              >
                {eligibilityCard.title}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {eligibilityCard.subtext}
              </p>
            </div>

            {appMode === "quick" ? (
              <div className="mt-6 rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 py-1 sm:px-5">
                <MathLine
                  sign="+"
                  label="Stocks + cash"
                  value={formatWithSymbol(
                    quickSnapshot.stocksPlusCash,
                    currencySymbol,
                  )}
                />
                {quickSnapshot.optionalOtherAssets > 0 ? (
                  <MathLine
                    sign="+"
                    label="Other assets"
                    value={formatWithSymbol(
                      quickSnapshot.optionalOtherAssets,
                      currencySymbol,
                    )}
                  />
                ) : null}
                <MathLine
                  sign="−"
                  label="Fresh capital + debts"
                  value={formatWithSymbol(
                    quickSnapshot.freshCapitalPlusDebts,
                    currencySymbol,
                  )}
                />
                <div className="border-t-2 border-slate-300/50 pt-0.5">
                  <MathLine
                    sign="="
                    label="Net zakatable"
                    value={formatWithSymbol(
                      quickSnapshot.netZakatableAmount,
                      currencySymbol,
                    )}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 py-1 sm:px-5">
                {method === "dividend" ? (
                  <>
                    <MathLine
                      sign="+"
                      label="Dividends (stated)"
                      value={formatWithSymbol(
                        parseMoneyInput(annualDividends),
                        currencySymbol,
                      )}
                    />
                    {advancedSnapshot.optionalOtherAssets > 0 ? (
                      <MathLine
                        sign="+"
                        label="Other assets"
                        value={formatWithSymbol(
                          advancedSnapshot.optionalOtherAssets,
                          currencySymbol,
                        )}
                      />
                    ) : null}
                    <div className="border-t-2 border-slate-300/50 pt-0.5">
                      <MathLine
                        sign="="
                        label="Net zakatable"
                        value={formatWithSymbol(
                          advancedSnapshot.netZakatableAmount,
                          currencySymbol,
                        )}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <MathLine
                      sign="+"
                      label="Listed stocks + cash"
                      value={formatWithSymbol(
                        advancedSnapshot.coreListedPlusCash,
                        currencySymbol,
                      )}
                    />
                    {advancedSnapshot.optionalOtherAssets > 0 ? (
                      <MathLine
                        sign="+"
                        label="Other assets"
                        value={formatWithSymbol(
                          advancedSnapshot.optionalOtherAssets,
                          currencySymbol,
                        )}
                      />
                    ) : null}
                    <MathLine
                      sign="−"
                      label="Liabilities + exempt capital"
                      value={formatWithSymbol(
                        advancedSnapshot.liabilitiesAndExempt,
                        currencySymbol,
                      )}
                    />
                    <div className="border-t-2 border-slate-300/50 pt-0.5">
                      <MathLine
                        sign="="
                        label="Net zakatable"
                        value={formatWithSymbol(
                          advancedSnapshot.netZakatableAmount,
                          currencySymbol,
                        )}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2 border-t border-slate-200/80 pt-6 sm:flex-row sm:items-end sm:justify-between">
              <span className="text-sm font-semibold text-foreground">
                Zakat due (2.5%)
              </span>
              <span className="text-3xl font-bold tabular-nums tracking-tight text-forest sm:text-4xl">
                {formatWithSymbol(
                  Math.max(0, active.zakatDue),
                  currencySymbol,
                )}
              </span>
            </div>

            <p className="mt-7 border-t border-slate-200/70 pt-6 text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">
              Different scholarly views exist. This tool follows established
              Shariah standards for equities (AAOIFI/SGC). You choose the
              method; we ensure the math is transparent.
            </p>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
              Educational estimate only. Confirm with a qualified scholar for
              your situation.
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
