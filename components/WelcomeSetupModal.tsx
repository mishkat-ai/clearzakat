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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-setup-title"
    >
      <div className="max-h-[min(90vh,640px)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-2xl sm:p-8">
        <h2
          id="welcome-setup-title"
          className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
        >
          Welcome setup
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Choose your country and today&apos;s silver price so we can set your
          Nisab and display amounts in your currency.
        </p>

        <div className="mt-6 flex flex-col gap-2" ref={rootRef}>
          <label className="text-sm font-medium text-foreground">
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
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none transition-[box-shadow,border-color] placeholder:text-muted/60 focus:border-forest focus:ring-2 focus:ring-forest/20"
            />
            {listOpen && (
              <ul
                id="country-listbox"
                role="listbox"
                className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-border bg-white py-1 shadow-lg"
              >
                {filtered.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted">
                    No matches. Try another search.
                  </li>
                ) : (
                  filtered.map((c) => (
                    <li key={c.code} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected?.code === c.code}
                        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm text-foreground hover:bg-surface"
                        onClick={() => {
                          setSelected(c);
                          setQuery("");
                          setListOpen(false);
                        }}
                      >
                        <span>{c.name}</span>
                        <span className="shrink-0 tabular-nums text-muted">
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
            <p className="text-xs text-muted">
              Currency symbol:{" "}
              <span className="font-medium text-foreground">
                {selected.symbol}
              </span>{" "}
              ({selected.currency})
            </p>
          )}
        </div>

        <label className="mt-5 flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">
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
            className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none transition-[box-shadow,border-color] placeholder:text-muted/60 focus:border-forest focus:ring-2 focus:ring-forest/20"
          />
        </label>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleStart}
          className="mt-8 w-full rounded-xl bg-forest px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-forest-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45"
        >
          Start Calculating
        </button>
      </div>
    </div>
  );
}
