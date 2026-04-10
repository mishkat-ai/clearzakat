"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CountryCurrency } from "@/lib/countries";

type WelcomeSetupModalProps = {
  open: boolean;
  countries: CountryCurrency[];
  onComplete: (payload: {
    country: CountryCurrency;
    silverPerGram: number;
    nisabFromSilver: number;
  }) => void;
};

const inputClass =
  "w-full rounded-xl border border-zinc-200/90 bg-white px-4 py-3.5 text-base text-zinc-900 shadow-sm outline-none transition-all duration-200 placeholder:text-zinc-400 focus:border-emerald-800/35 focus:shadow-[0_0_0_3px_rgba(11,59,36,0.08)] focus:ring-0";

export function WelcomeSetupModal({
  open,
  countries,
  onComplete,
}: WelcomeSetupModalProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CountryCurrency | null>(null);
  const [silver, setSilver] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries.slice(0, 80);
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q),
    ).slice(0, 100);
  }, [countries, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setListOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const handleStart = useCallback(() => {
    const g = parseFloat(silver.replace(/,/g, "")) || 0;
    if (!selected || g <= 0) return;
    const nisabFromSilver = g * 595;
    onComplete({ country: selected, silverPerGram: g, nisabFromSilver });
    setListOpen(false);
  }, [selected, silver, onComplete]);

  if (!open) return null;

  const canSubmit = Boolean(selected && (parseFloat(silver.replace(/,/g, "")) || 0) > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-5 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-baseline-title"
    >
      <div className="max-h-[min(90vh,680px)] w-full max-w-[440px] overflow-y-auto rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-2xl shadow-zinc-900/10 sm:p-10 sm:max-w-md">
        <header className="space-y-3">
          <h2
            id="welcome-baseline-title"
            className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[1.65rem] sm:leading-snug"
          >
            Set Your Financial Baseline
          </h2>
          <p className="text-[0.9375rem] leading-relaxed text-zinc-500">
            We need two quick details to calibrate the Shariah engine to your
            local currency and market rates.
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-3" ref={rootRef}>
          <label className="text-sm font-medium tracking-tight text-zinc-700">
            Select your Country
          </label>
          <div className="relative">
            <input
              type="text"
              role="combobox"
              aria-expanded={listOpen}
              aria-controls="country-listbox"
              aria-autocomplete="list"
              placeholder={
                selected
                  ? `${selected.name} (${selected.currency})`
                  : "Search countries…"
              }
              value={listOpen ? query : selected ? selected.name : query}
              onChange={(e) => {
                setQuery(e.target.value);
                setListOpen(true);
              }}
              onFocus={() => {
                setListOpen(true);
                if (selected) setQuery(selected.name);
              }}
              className={inputClass}
            />
            {listOpen && (
              <ul
                id="country-listbox"
                role="listbox"
                className="absolute z-10 mt-2 max-h-52 w-full overflow-y-auto rounded-xl border border-zinc-200/90 bg-white py-1 shadow-lg shadow-zinc-900/5"
              >
                {filtered.length === 0 ? (
                  <li className="px-4 py-3.5 text-sm text-zinc-500">
                    No matches. Try another search.
                  </li>
                ) : (
                  filtered.map((c) => (
                    <li key={c.code} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected?.code === c.code}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-zinc-800 transition-colors duration-150 hover:bg-zinc-50"
                        onClick={() => {
                          setSelected(c);
                          setQuery("");
                          setListOpen(false);
                        }}
                      >
                        <span>{c.name}</span>
                        <span className="shrink-0 tabular-nums text-zinc-500">
                          {c.symbol} · {c.currency}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          {selected && !listOpen && (
            <p className="text-xs leading-relaxed text-zinc-500">
              Currency symbol:{" "}
              <span className="font-medium text-zinc-800">
                {selected.symbol}
              </span>{" "}
              ({selected.currency})
            </p>
          )}
        </div>

        <label className="mt-10 flex flex-col gap-3">
          <span className="text-sm font-medium tracking-tight text-zinc-700">
            Current price of 1 gram of Silver in your local currency
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="0"
            value={silver}
            onChange={(e) => setSilver(e.target.value)}
            className={inputClass}
          />
        </label>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleStart}
          className="mt-12 w-full rounded-xl bg-forest px-6 py-4 text-base font-semibold text-white shadow-sm outline-none transition-colors duration-200 ease-out hover:bg-forest-hover active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none"
        >
          Start Calculating
        </button>
      </div>
    </div>
  );
}
