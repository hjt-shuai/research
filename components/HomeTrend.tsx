"use client";

import TrendChart from "./TrendChart";
import { DEFAULT_GOALS, examTotal, sortByDateAsc } from "@/lib/scoring";
import { useAppStore } from "./AppStoreProvider";

export default function HomeTrend() {
  const { store } = useAppStore();
  if (!store.mocks.length) return null;

  const totals = sortByDateAsc(store.mocks).map(examTotal);
  const first = totals[0];
  const last = totals[totals.length - 1];
  const delta = last - first;

  return (
    <section className="card" aria-label="成绩趋势">
      <div className="section-head-row">
        <h2 className="section-title">成绩趋势</h2>
        {totals.length > 1 && (
          <span className="trend-headline">
            {first} → {last}
            <strong className={delta >= 0 ? "up" : "down"}>
              {delta >= 0 ? ` +${delta}` : ` ${delta}`}
            </strong>
          </span>
        )}
      </div>
      <TrendChart mocks={store.mocks} goals={store.goals ?? DEFAULT_GOALS} />
    </section>
  );
}
