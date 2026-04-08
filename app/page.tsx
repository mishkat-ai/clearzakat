"use client";

import { useCallback, useState } from "react";

/** Comma-separated thousands (e.g. 950,000) for lakhs/crores-scale amounts */
function formatBdt(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

type ZakatBlockReason = "haul" | "nisab" | null;

export default function Home() {
  const [nisabThreshold, setNisabThreshold] = useState("175000");
  const [portfolio, setPortfolio] = useState("");
  const [cash, setCash] = useState("");
  const [liabilities, setLiabilities] = useState("");
  const [haulMet, setHaulMet] = useState(false);
  const [netZakatable, setNetZakatable] = useState<number | null>(null);
  const [zakatDue, setZakatDue] = useState<number | null>(null);
  const [zakatBlockReason, setZakatBlockReason] =
    useState<ZakatBlockReason>(null);

  const handleCalculate = useCallback(() => {
    const nisab =
      parseFloat(nisabThreshold.replace(/,/g, "")) || 0;
    const p = parseFloat(portfolio.replace(/,/g, "")) || 0;
    const c = parseFloat(cash.replace(/,/g, "")) || 0;
    const l = parseFloat(liabilities.replace(/,/g, "")) || 0;
    const net = p + c - l;
    setNetZakatable(net);

    if (!haulMet) {
      setZakatDue(0);
      setZakatBlockReason("haul");
      return;
    }
    if (net < nisab) {
      setZakatDue(0);
      setZakatBlockReason("nisab");
      return;
    }

    setZakatDue(net * 0.025);
    setZakatBlockReason(null);
  }, [portfolio, cash, liabilities, nisabThreshold, haulMet]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-lg">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            ClearZakat
          </h1>
          <p className="mt-1 text-sm text-muted sm:text-base">
            Zakat calculator for stock investors — amounts in BDT
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
                  Current Nisab Threshold (BDT)
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
                  Default based on approx. 52.5 bhori of silver. Please verify
                  current market rates.
                </span>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Current Stock Portfolio Value (BDT)
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
                  Liquid Cash on Hand (BDT)
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
                  Current Liabilities/Debts (BDT)
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
            </div>

            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:bg-zinc-100/70">
              <input
                type="checkbox"
                checked={haulMet}
                onChange={(e) => setHaulMet(e.target.checked)}
                className="accent-forest mt-0.5 size-[1.125rem] shrink-0 rounded border-border focus:ring-2 focus:ring-forest/30 focus:ring-offset-0"
              />
              <span className="text-sm leading-snug text-foreground">
                This wealth has been in my possession for one full lunar year
                (Haul)
              </span>
            </label>

            <button
              type="button"
              onClick={handleCalculate}
              className="mt-6 w-full rounded-xl bg-forest px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-forest-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
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
                    : `${formatBdt(netZakatable)} BDT`}
                </dd>
              </div>
              <div className="flex flex-col gap-2">
                <dt className="text-sm text-muted">Total Zakat Due (2.5%)</dt>
                <dd className="text-5xl font-bold tabular-nums tracking-tight text-forest sm:text-6xl md:text-7xl">
                  {zakatDue === null ? "—" : `${formatBdt(zakatDue)} BDT`}
                </dd>
                {zakatDue !== null && zakatBlockReason === "haul" && (
                  <p className="text-sm text-muted">
                    Zakat is not due until wealth is held for one lunar year.
                  </p>
                )}
                {zakatDue !== null && zakatBlockReason === "nisab" && (
                  <p className="text-sm text-muted">
                    Net assets are below the Nisab threshold.
                  </p>
                )}
              </div>
            </dl>
          </section>
        </div>
      </main>
    </div>
  );
}
