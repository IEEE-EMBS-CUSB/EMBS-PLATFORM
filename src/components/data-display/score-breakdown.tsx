"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import type { ScoreComponent, ScoreComponentKey } from "@/types";

interface ScoreBreakdownProps {
  components: ScoreComponent[];
  totalScore: number;
  monthLabel: string;
  showChart?: boolean;
  compact?: boolean;
}

const COMPONENT_COLORS: Record<ScoreComponentKey, string> = {
  attendance: "#00629b",
  tasks: "#772583",
  projects: "#007377",
  hackathons: "#009ca6",
  delivered_sessions: "#002855",
  bonuses: "#78be20",
};

export function ScoreBreakdown({
  components,
  totalScore,
  monthLabel,
  showChart = true,
  compact = false,
}: ScoreBreakdownProps) {
  if (components.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-5 w-5" aria-hidden="true" />}
        title="No score breakdown available"
        description={`Component scores for ${monthLabel} have not been published yet.`}
      />
    );
  }

  const maxObserved = Math.max(
    1,
    ...components.map((c) => c.maxPoints ?? c.points)
  );

  return (
    <div className="rounded-lg border border-border bg-white p-4 sm:p-5 space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3.5">
        <h3 className="font-heading text-base font-bold text-[#002855]">
          {monthLabel} score breakdown
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Total
          </span>
          <span className="font-heading text-xl font-bold text-[#772583] tabular-nums">
            {totalScore}
          </span>
        </div>
      </div>

      {/* Desktop & tablet Recharts bar chart (hidden on narrow mobile where inline bars below read far cleaner) */}
      {showChart && (
        <div
          className={
            compact ? "hidden h-52 w-full sm:block" : "hidden h-60 w-full sm:block"
          }
          aria-hidden="true"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={components}
              layout="vertical"
              margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#e6ebf2"
              />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: "#4c5a6d" }}
                axisLine={{ stroke: "#dde3ec" }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={132}
                tick={{ fontSize: 12, fill: "#0f1c2e" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "#f5edf7", fillOpacity: 0.45 }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderColor: "#dde3ec",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#0f1c2e",
                }}
                formatter={(value) => [`${value} pts`, "Score"]}
              />
              <Bar dataKey="points" radius={[0, 4, 4, 0]} barSize={18}>
                {components.map((component) => (
                  <Cell
                    key={component.key}
                    fill={COMPONENT_COLORS[component.key]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Mobile-native visual bars + crisp numbers (also serves as accessible list on all screens) */}
      <dl
        className={
          compact
            ? "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:border-t sm:border-border sm:pt-4 md:grid-cols-3"
            : "divide-y divide-border sm:border-t sm:border-border"
        }
      >
        {components.map((component) => {
          const scoreDisplay =
            component.maxPoints !== undefined
              ? `${component.points} / ${component.maxPoints}`
              : component.key === "bonuses"
                ? `+${component.points}`
                : `${component.points}`;

          const denom = component.maxPoints ?? maxObserved;
          const pct = Math.min(100, Math.max(4, Math.round((component.points / denom) * 100)));

          return (
            <div
              key={component.key}
              className={compact ? "space-y-1.5" : "space-y-1.5 py-3"}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: COMPONENT_COLORS[component.key] }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <dt className="text-sm font-semibold text-foreground sm:text-xs">
                      {component.label}
                    </dt>
                    {!compact && component.detail && (
                      <dd className="mt-0.5 text-xs text-muted-foreground">
                        {component.detail}
                      </dd>
                    )}
                  </div>
                </div>
                <dd className="shrink-0 font-heading text-sm font-bold text-[#002855] tabular-nums">
                  {scoreDisplay}
                </dd>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted sm:hidden"
                aria-hidden="true"
              >
                <div
                  className="embs-bar-fill h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: COMPONENT_COLORS[component.key],
                  }}
                />
              </div>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
