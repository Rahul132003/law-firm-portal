"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Report charts.
 *
 * Encoding decisions, and why:
 *
 * - **Single-measure charts get ONE hue.** "Cases per advocate" is one
 *   measure across people; identity comes from the axis labels. Painting each
 *   bar a different colour would encode rank, which is the classic
 *   categorical-palette misuse.
 *
 * - **Case status is ordinal**, not categorical — the lifecycle runs Filed →
 *   Under Trial → Judgment → Appeal → Closed. It therefore uses a single-hue
 *   sequential ramp, light → dark, validated for lightness monotonicity,
 *   adjacent step separation and light-end contrast against white.
 *
 * - **No gradient fills.** A gradient makes the same bar height read as two
 *   different values depending on where the eye lands, and adds nothing the
 *   bar length was not already saying.
 *
 * The firm's five status accents are used for badges and the Kanban board,
 * but deliberately not here: as a five-way categorical chart palette they
 * fail adjacent CVD separation.
 */

const ACCENT = "#1e54c4"; // accent-600 — the single-series hue
const GRID = "#dfe4ea"; // hairline — recessive
const AXIS_TEXT = "#767f8d"; // muted

/**
 * Ordinal ramp for the case lifecycle: the same vivid-blue accent scale used
 * for the single-series chart, one step lighter at each stage — monotone
 * lightness, single hue, so status reads as a sequence rather than a set of
 * unrelated categories.
 */
const LIFECYCLE_RAMP = [
  "#7aa9f5",
  "#4f87ec",
  "#2f6bdc",
  "#1e54c4",
  "#17397d",
] as const;

const axisProps = {
  stroke: GRID,
  tick: { fill: AXIS_TEXT, fontSize: 11 },
  tickLine: false,
} as const;

/** Text wears ink tokens; the mark beside it carries identity. */
function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number | string;
    payload?: Record<string, unknown>;
  }>;
  label?: string | number;
  unit: string;
}) {
  if (!active || !payload?.length) return null;

  const value = payload[0]?.value ?? 0;
  const numeric = typeof value === "number" ? value : Number(value);

  return (
    <div className="rounded-md border border-hairline bg-raised px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-primary">{label}</p>
      <p className="mt-0.5 text-xs text-secondary">
        {numeric} {numeric === 1 ? unit : `${unit}s`}
      </p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted">{children}</p>;
}

export function CasesPerAdvocateChart({
  data,
}: {
  data: Array<{ name: string; open: number }>;
}) {
  if (data.length === 0) return <Empty>No cases yet.</Empty>;

  // Horizontal: advocate names are long, and this avoids rotated tick labels.
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 38)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 28, bottom: 4, left: 8 }}
        barCategoryGap={6}
      >
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} {...axisProps} />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          axisLine={false}
          {...axisProps}
        />
        <Tooltip
          cursor={{ fill: "rgba(28, 26, 23, 0.04)" }}
          content={<ChartTooltip unit="open case" />}
        />
        {/* Rounded data-end, square against the baseline. */}
        <Bar
          dataKey="open"
          fill={ACCENT}
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CasesByStatusChart({
  data,
  showValues = false,
  height = 220,
}: {
  data: Array<{ label: string; count: number }>;
  /**
   * Print the count on each column cap and drop the y-axis. Only worth it for
   * a handful of columns: with every value labelled the axis ticks become
   * redundant ink, so they come off together rather than double-encoding.
   */
  showValues?: boolean;
  height?: number;
}) {
  if (data.length === 0) return <Empty>No cases yet.</Empty>;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        // Cap labels need headroom, otherwise the tallest one clips.
        margin={{ top: showValues ? 22 : 8, right: 8, bottom: 4, left: 0 }}
        barCategoryGap={10}
      >
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" interval={0} axisLine={false} {...axisProps} />
        {showValues ? null : (
          <YAxis allowDecimals={false} width={32} {...axisProps} />
        )}
        <Tooltip
          cursor={{ fill: "rgba(28, 26, 23, 0.04)" }}
          content={<ChartTooltip unit="case" />}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {showValues ? (
            // Value sits on the cap, in ink — the bar beside it carries the
            // colour, so the number never wears the series hue.
            <LabelList
              dataKey="count"
              position="top"
              offset={8}
              fill="#4b5563" // secondary — matches --color-secondary
              fontSize={12}
              fontWeight={600}
            />
          ) : null}
          {data.map((entry, index) => (
            // Ramp position encodes lifecycle stage, not identity.
            <Cell
              key={entry.label}
              fill={LIFECYCLE_RAMP[index % LIFECYCLE_RAMP.length]}
            />
          ))}
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
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" interval={0} axisLine={false} {...axisProps} />
        <YAxis allowDecimals={false} width={32} {...axisProps} />
        <Tooltip content={<ChartTooltip unit="new case" />} />
        <Line
          type="monotone"
          dataKey="count"
          stroke={ACCENT}
          strokeWidth={2}
          dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: ACCENT, stroke: "#ffffff", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
