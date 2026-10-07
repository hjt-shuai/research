"use client";

import { useMemo, useState } from "react";
import { SUBJECTS, type SubjectId } from "@/lib/plan";
import { MAIN_TARGET, examTotal, sortByDateAsc } from "@/lib/scoring";
import type { Goals, MockExam } from "@/lib/types";

type SeriesKey = "total" | SubjectId;

const LABELS: Record<SeriesKey, string> = {
  total: "总分",
  politics: "政治",
  english: "英语",
  math: "数学",
  cs408: "408",
};

function seriesValues(mocks: MockExam[], key: SeriesKey): number[] {
  const sorted = sortByDateAsc(mocks);
  if (key === "total") return sorted.map(examTotal);
  return sorted.map((m) => m[key]);
}

function seriesDates(mocks: MockExam[]): string[] {
  return sortByDateAsc(mocks).map((m) => m.date);
}

function mmdd(date: string): string {
  const parts = date.split("-");
  if (parts.length < 3) return date;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

/** 取“好看”的刻度步长（1 / 2 / 2.5 / 5 / 10 × 10ⁿ） */
function niceStep(rough: number, allowHalf = true): number {
  if (!Number.isFinite(rough) || rough <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  const step =
    norm <= 1
      ? 1
      : norm <= 2
        ? 2
        : allowHalf && norm <= 2.5
          ? 2.5
          : norm <= 5
            ? 5
            : 10;
  return step * pow;
}

/**
 * 纵轴范围按数据自适应（而不是从 0 开始），否则 310 → 374 这种进步会被压成一条平线；
 * 刻度用整数步长，并把目标线纳入范围，方便看出与目标的距离。
 */
function axisRange(
  values: number[],
  goal: number | null,
): { min: number; max: number; ticks: number[] } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const top = goal != null ? Math.max(hi, goal) : hi;
  const span = Math.max(top - lo, 1);
  // 分数都是整数，刻度也用整数步长，避免出现 102.5 这种刻度
  const step = niceStep(span / 4, !values.every(Number.isInteger));
  const min = Math.max(0, Math.floor((lo - step * 0.4) / step) * step);
  const max = Math.ceil((top + step * 0.4) / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return { min, max: max - min < 1 ? min + 1 : max, ticks };
}

export default function TrendChart({
  mocks,
  goals,
}: {
  mocks: MockExam[];
  goals?: Goals;
}) {
  const [active, setActive] = useState<SeriesKey>("total");
  const sorted = useMemo(() => sortByDateAsc(mocks), [mocks]);
  const values = useMemo(() => seriesValues(mocks, active), [mocks, active]);
  const dates = useMemo(() => seriesDates(mocks), [mocks]);

  if (!sorted.length) return null;

  const goal =
    active === "total" ? MAIN_TARGET : (goals?.[active] ?? null);
  const { min, max, ticks } = axisRange(values, goal);
  const range = max - min || 1;

  const w = 640;
  const h = 200;
  const padL = 44;
  const padR = 22;
  const padT = 18;
  const padB = 32;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const xOf = (i: number) =>
    values.length === 1
      ? padL + plotW / 2
      : padL + (i / (values.length - 1)) * plotW;
  const yOf = (v: number) => padT + (1 - (v - min) / range) * plotH;

  const points = values.map((v, i) => `${xOf(i)},${yOf(v)}`).join(" ");
  const area = `${padL},${padT + plotH} ${points} ${xOf(values.length - 1)},${padT + plotH}`;

  const gridValues = ticks;
  const last = values.length - 1;
  const goalY = goal != null && goal >= min && goal <= max ? yOf(goal) : null;
  const labelStep = values.length > 8 ? 2 : 1;

  const tabs: SeriesKey[] = ["total", ...SUBJECTS.map((s) => s.id)];

  return (
    <div className="trend-chart">
      <div className="trend-tabs" role="tablist">
        {tabs.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={active === k}
            className={active === k ? "is-active" : ""}
            onClick={() => setActive(k)}
          >
            {LABELS[k]}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="trend-svg"
        role="img"
        aria-label={`${LABELS[active]}趋势（${values.join(" → ")}）`}
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map((gv) => (
          <g key={gv}>
            <line
              x1={padL}
              y1={yOf(gv)}
              x2={w - padR}
              y2={yOf(gv)}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text x={8} y={yOf(gv) + 4} className="trend-axis-label">
              {gv}
            </text>
          </g>
        ))}

        {goalY != null && (
          <>
            <line
              x1={padL}
              y1={goalY}
              x2={w - padR}
              y2={goalY}
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeDasharray="6 5"
              opacity="0.65"
            />
            <text
              x={padL + 6}
              y={goalY - 7}
              textAnchor="start"
              className="trend-goal-label"
            >
              目标 {goal}
            </text>
          </>
        )}

        {values.length > 1 && (
          <polygon points={area} fill="url(#trend-fill)" stroke="none" />
        )}

        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />

        {values.map((v, i) => (
          <g key={`${dates[i]}-${i}`}>
            <circle
              cx={xOf(i)}
              cy={yOf(v)}
              r={i === last ? 5 : 3.5}
              fill={i === last ? "var(--accent)" : "var(--surface)"}
              stroke="var(--accent)"
              strokeWidth="2"
            />
            {i === last ? (
              <text
                x={xOf(i)}
                y={yOf(v) - 12}
                textAnchor="end"
                className="trend-point-label"
              >
                {v}
              </text>
            ) : null}
            {i % labelStep === 0 || i === last ? (
              <text
                x={xOf(i)}
                y={h - 10}
                textAnchor="middle"
                className="trend-axis-label"
              >
                {mmdd(dates[i])}
              </text>
            ) : null}
          </g>
        ))}
      </svg>

      <p className="trend-labels">
        {values.map((v, i) => (
          <span key={`${dates[i]}-${v}-${i}`}>
            {i > 0 ? "→ " : ""}
            {v}
          </span>
        ))}
        {goal != null && <span className="trend-goal-chip">目标 {goal}</span>}
      </p>
    </div>
  );
}
