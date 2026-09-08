"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GRID = "rgba(15, 23, 42, 0.07)";
const AXIS_TEXT = "#334155"; // slate-700

/** Status color palette matching the luxury firm light theme */
const STATUS_COLORS: Record<string, { main: string; gradient: string }> = {
  Filed: { main: "#0284c7", gradient: "url(#gradFiled)" },
  "Under Trial": { main: "#0ea5e9", gradient: "url(#gradTrial)" },
  Judgment: { main: "#7e22ce", gradient: "url(#gradJudgment)" },
  Appeal: { main: "#dc2626", gradient: "url(#gradAppeal)" },
  Closed: { main: "#059669", gradient: "url(#gradClosed)" },
};

const axisProps = {
  stroke: GRID,
  tick: { fill: AXIS_TEXT, fontSize: 12, fontWeight: 700 },
  tickLine: false,
} as const;

/** Shared glassmorphic tooltip with active highlight in light mode. */
function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; payload?: Record<string, unknown> }>;
  label?: string | number;
  unit: string;
}) {
  if (!active || !payload?.length) return null;

  const value = payload[0]?.value ?? 0;
  const numeric = typeof value === "number" ? value : Number(value);

  return (
    <div className="rounded-xl border-2 border-sky-400/40 bg-white/95 backdrop-blur-xl px-4 py-3 shadow-xl ring-1 ring-slate-900/5">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-black text-sky-700">{numeric}</span>
        <span className="text-xs font-extrabold text-slate-800">
          {numeric === 1 ? unit : `${unit}s`}
        </span>
      </div>
    </div>
  );
}

export function CasesPerAdvocateChart({
  data,
}: {
  data: Array<{ name: string; open: number }>;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-base font-bold text-slate-500">No cases yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 28, bottom: 4, left: 12 }}
        barCategoryGap={8}
      >
        <defs>
          <linearGradient id="advocateGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0284c7" stopOpacity={0.85} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={1} />
          </linearGradient>
        </defs>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} {...axisProps} />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          {...axisProps}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(15, 23, 42, 0.03)" }}
          content={<ChartTooltip unit="open case" />}
        />
        <Bar
          dataKey="open"
          fill="url(#advocateGrad)"
          radius={[0, 6, 6, 0]}
          maxBarSize={22}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CasesByStatusChart({
  data,
}: {
  data: Array<{ label: string; count: number }>;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-base font-bold text-slate-500">No cases yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={data}
        margin={{ top: 12, right: 8, bottom: 4, left: 0 }}
        barCategoryGap={12}
      >
        <defs>
          <linearGradient id="gradFiled" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0284c7" stopOpacity={1} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.8} />
          </linearGradient>
          <linearGradient id="gradTrial" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={1} />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity={0.85} />
          </linearGradient>
          <linearGradient id="gradJudgment" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7e22ce" stopOpacity={1} />
            <stop offset="100%" stopColor="#c084fc" stopOpacity={0.8} />
          </linearGradient>
          <linearGradient id="gradAppeal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" stopOpacity={1} />
            <stop offset="100%" stopColor="#f87171" stopOpacity={0.8} />
          </linearGradient>
          <linearGradient id="gradClosed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity={1} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" {...axisProps} axisLine={false} interval={0} />
        <YAxis allowDecimals={false} {...axisProps} width={36} />
        <Tooltip
          cursor={{ fill: "rgba(15, 23, 42, 0.03)" }}
          content={<ChartTooltip unit="case" />}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {data.map((entry) => {
            const config = STATUS_COLORS[entry.label] ?? {
              main: "#0284c7",
              gradient: "url(#gradTrial)",
            };
            return <Cell key={entry.label} fill={config.gradient} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CaseIntakeChart({
  data,
}: {
  data: Array<{ label: string; count: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="intakeArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0284c7" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#0284c7" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" {...axisProps} axisLine={false} interval={0} />
        <YAxis allowDecimals={false} {...axisProps} width={36} />
        <Tooltip content={<ChartTooltip unit="new case" />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#0284c7"
          strokeWidth={3.5}
          fill="url(#intakeArea)"
          dot={{ r: 4.5, fill: "#0284c7", stroke: "#ffffff", strokeWidth: 2 }}
          activeDot={{ r: 7.5, fill: "#0284c7", stroke: "#ffffff", strokeWidth: 2.5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
