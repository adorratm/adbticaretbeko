import { cn } from "./cn";

export type ChartPoint = { label: string; value: number };

export function BarChart({
  data,
  height = 160,
  className,
  color = "#0056b3",
}: {
  data: ChartPoint[];
  height?: number;
  className?: string;
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const width = Math.max(data.length * 56, 240);
  const pad = 28;
  const chartH = height - pad;

  return (
    <svg
      className={cn("adb-chart adb-animate-fade", className)}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Bar chart"
    >
      {data.map((d, i) => {
        const barW = 28;
        const x = 20 + i * 56;
        const h = (d.value / max) * (chartH - 8);
        const y = chartH - h;
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={4}
              fill={color}
              style={{ transition: "height 0.4s ease, y 0.4s ease" }}
            >
              <title>
                {d.label}: {d.value}
              </title>
            </rect>
            <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="#727784">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Sparkline({
  values,
  width = 180,
  height = 48,
  color = "#0056b3",
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * width;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className={cn("adb-chart adb-animate-fade", className)} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" points={points} />
    </svg>
  );
}
