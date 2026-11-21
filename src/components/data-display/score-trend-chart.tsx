"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import type { MonthlyScoreRecord } from "@/types";

interface ScoreTrendChartProps {
  records: MonthlyScoreRecord[];
}

export function ScoreTrendChart({ records }: ScoreTrendChartProps) {
  if (records.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
        title="No monthly score history yet"
        description="Your published monthly score progression will appear here after your first scored cycle."
      />
    );
  }

  const chronological = [...records].sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  return (
    <div className="rounded-lg border border-border bg-white p-5 space-y-4">
      <h3 className="font-heading text-base font-bold text-[#002855]">
        Monthly score progression
      </h3>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chronological}
            margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e6ebf2"
            />
            <XAxis
              dataKey="monthLabel"
              tick={{ fontSize: 12, fill: "#4c5a6d" }}
              axisLine={{ stroke: "#dde3ec" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, "dataMax + 10"]}
              tick={{ fontSize: 12, fill: "#4c5a6d" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#dde3ec",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#0f1c2e",
              }}
              formatter={(value) => [`${value} pts`, "Monthly score"]}
            />
            <Area
              type="monotone"
              dataKey="totalScore"
              stroke="#772583"
              strokeWidth={2.5}
              fill="#f5edf7"
              fillOpacity={0.65}
              dot={{ r: 4, fill: "#772583", strokeWidth: 2, stroke: "#ffffff" }}
              activeDot={{ r: 6, fill: "#00629b" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
