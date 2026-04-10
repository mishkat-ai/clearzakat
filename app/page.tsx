"use client";

import { useCallback, useEffect, useState } from "react";
import { WelcomeSetupModal } from "@/components/WelcomeSetupModal";
import {
  COUNTRIES,
  STORAGE_KEY,
  type CountryCurrency,
  type StoredSetup,
} from "@/lib/countries";

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

type ZakatBlockReason = "nisab" | null;

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [nisabThreshold, setNisabThreshold] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [cash, setCash] = useState("");
  const [liabilities, setLiabilities] = useState("");
  const [freshCapital, setFreshCapital] = useState("");
  const [netZakatable, setNetZakatable] = useState<number | null>(null);
  const [zakatDue, setZakatDue] = useState<number | null>(null);
  const [zakatBlockReason, setZakatBlockReason] =
    useState<ZakatBlockReason>(null);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");

  useEffect(() => {
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
          setCurrencySymbol(d.symbol);
          setCurrencyCode(d.currency);
          setNisabThreshold(String(d.silverPerGram * NISAB_SILVER_GRAMS));
          setShowWelcome(false);
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

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
    },
    [],
  );

  const handleCalculate = useCallback(() => {
    const nisab = parseFloat(nisabThreshold.replace(/,/g, "")) || 0;
    const p = parseFloat(portfolio.replace(/,/g, "")) || 0;
    const c = parseFloat(cash.replace(/,/g, "")) || 0;
    const l = parseFloat(liabilities.replace(/,/g, "")) || 0;
    const f = parseFloat(freshCapital.replace(/,/g, "")) || 0;
    const net = p + c - l - f;
    setNetZakatable(net);

    if (net < nisab) {
      setZakatDue(0);
      setZakatBlockReason("nisab");
      return;
    }

    setZakatDue(net * 0.025);
    setZakatBlockReason(null);
  }, [portfolio, cash, liabilities, freshCapital, nisabThreshold]);

  const cc = (code: string) => `(${code})`;

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
        open={showWelcome}
        countries={COUNTRIES}
        onComplete={handleWelcomeComplete}
      />

      <header className="border-b border-border bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-lg">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            ClearZakat
          </h1>
          <p className="mt-1 text-sm text-muted sm:text-base">
            Zakat calculator for stock investors — amounts in{" "}
            <span className="font-medium text-foreground">{currencyCode}</span>{" "}
            <span className="tabular-nums">({currencySymbol})</span>
          </p>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
          <section
            className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8"
            aria-labelledby="inputs-heading"
          >
            <h2
              id="inputs-heading"
              className="text-sm font-medium uppercase tracking-wide text-muted"
            >
              Your assets
            </h2>
            <div className="mt-6 flex flex-col gap-5">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Current Nisab Threshold {cc(currencyCode)}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={nisabThreshold}
                  onChange={(e) => setNisabThreshold(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none transition-[box-shadow,border-color] placeholder:text-muted/60 focus:border-forest focus:ring-2 focus:ring-forest/20"
                />
                <span className="text-xs leading-relaxed text-muted">
                  Auto-calculated as 1g silver price × {NISAB_SILVER_GRAMS}{" "}
                  (approx. silver Nisab weight). Adjust if needed; verify with
                  current rates.
                </span>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Current Stock Portfolio Value {cc(currencyCode)}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none transition-[box-shadow,border-color] placeholder:text-muted/60 focus:border-forest focus:ring-2 focus:ring-forest/20"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Liquid Cash on Hand {cc(currencyCode)}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none transition-[box-shadow,border-color] placeholder:text-muted/60 focus:border-forest focus:ring-2 focus:ring-forest/20"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Current Liabilities/Debts {cc(currencyCode)}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={liabilities}
                  onChange={(e) => setLiabilities(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none transition-[box-shadow,border-color] placeholder:text-muted/60 focus:border-forest focus:ring-2 focus:ring-forest/20"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Fresh Capital Injected (Last 354 Days) {cc(currencyCode)}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={freshCapital}
                  onChange={(e) => setFreshCapital(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none transition-[box-shadow,border-color] placeholder:text-muted/60 focus:border-forest focus:ring-2 focus:ring-forest/20"
                />
                <span className="text-xs leading-relaxed text-muted">
                  External funds deposited into your portfolio within the last
                  lunar year have not reached Haul and are exempt from this
                  year&apos;s calculation.
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleCalculate}
              className="mt-8 w-full rounded-xl bg-forest px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-forest-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
            >
              Calculate Zakat
            </button>
          </section>

          <section
            className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8"
            aria-labelledby="results-heading"
          >
            <h2
              id="results-heading"
              className="text-sm font-medium uppercase tracking-wide text-muted"
            >
              Results
            </h2>
            <dl className="mt-6 flex flex-col gap-6">
              <div className="flex flex-col gap-1 border-b border-border pb-6">
                <dt className="text-sm text-muted">Net Zakatable Assets</dt>
                <dd className="text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
                  {netZakatable === null
                    ? "—"
                    : formatWithSymbol(netZakatable, currencySymbol)}
                </dd>
              </div>
              <div className="flex flex-col gap-2">
                <dt className="text-sm text-muted">Total Zakat Due (2.5%)</dt>
                <dd className="text-5xl font-bold tabular-nums tracking-tight text-forest sm:text-6xl md:text-7xl">
                  {zakatDue === null
                    ? "—"
                    : formatWithSymbol(zakatDue, currencySymbol)}
                </dd>
                {zakatDue !== null && zakatBlockReason === "nisab" && (
                  <p className="text-sm text-muted">
                    Net assets are below the Nisab threshold.
                  </p>
                )}
              </div>
            </dl>
          </section>

          <section
            className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-6 shadow-sm sm:p-8"
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
            <div className="mt-5 flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">Name</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200/90 bg-white px-4 py-3 text-base text-foreground outline-none transition-[box-shadow,border-color] placeholder:text-muted/60 focus:border-forest focus:ring-2 focus:ring-forest/20"
                  placeholder="Your name"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Email
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  className="w-full rounded-xl border border-emerald-200/90 bg-white px-4 py-3 text-base text-foreground outline-none transition-[box-shadow,border-color] placeholder:text-muted/60 focus:border-forest focus:ring-2 focus:ring-forest/20"
                  placeholder="you@example.com"
                />
              </label>
              <button
                type="button"
                className="mt-1 w-full rounded-xl border border-forest/20 bg-forest px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-forest-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-50"
              >
                Submit &amp; Enter Draw
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
