import { useMemo, useState } from "react";

import { formatDay, formatUsd, linearScale, niceMax } from "./scale";

/**
 * Daily spend, one bar per day stacked by model family — the centerpiece
 * chart of the profile dashboard. Hover reveals the per-family breakdown.
 */

interface StackedDay {
  date: string;
  /** family -> spend, families pre-sorted by overall rank. */
  segments: { color: string; family: string; value: number }[];
  total: number;
}

const WIDTH = 940;
const HEIGHT = 220;
const AXIS = 44;
const TICKS = 4;

function StackedBars({ days }: { days: StackedDay[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = useMemo(() => niceMax(Math.max(...days.map((day) => day.total), 0)), [days]);
  const y = linearScale(max, HEIGHT);
  const slot = (WIDTH - AXIS) / Math.max(days.length, 1);
  const barWidth = Math.max(Math.min(slot * 0.72, 16), 1.25);

  const monthStarts = useMemo(
    () =>
      days.flatMap((day, index) =>
        day.date.endsWith("-01") || index === 0 ? [{ date: day.date, index }] : [],
      ),
    [days],
  );

  const active = hovered === null ? null : days[hovered];

  return (
    <div className="relative">
      <svg
        className="block w-full"
        onMouseLeave={() => setHovered(null)}
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT + 24}`}
      >
        {Array.from({ length: TICKS + 1 }, (_, tick) => {
          const value = (max / TICKS) * tick;
          const yPos = HEIGHT - y(value);
          return (
            <g key={tick}>
              <line
                stroke="currentColor"
                strokeOpacity={tick === 0 ? 0.28 : 0.09}
                x1={AXIS}
                x2={WIDTH}
                y1={yPos}
                y2={yPos}
              />
              <text
                className="fill-current opacity-45"
                fontSize={10}
                textAnchor="end"
                x={AXIS - 6}
                y={yPos + 3}
              >
                {formatUsd(value)}
              </text>
            </g>
          );
        })}

        {days.map((day, index) => {
          const x = AXIS + slot * index + (slot - barWidth) / 2;
          let cursor = HEIGHT;
          return (
            <g key={day.date} onMouseEnter={() => setHovered(index)}>
              {/* Invisible hover target spanning the full column height. */}
              <rect fill="transparent" height={HEIGHT} width={slot} x={AXIS + slot * index} y={0} />
              {day.segments.map((segment) => {
                const height = y(segment.value);
                cursor -= height;
                return (
                  <rect
                    fill={segment.color}
                    height={Math.max(height, 0)}
                    key={segment.family}
                    opacity={hovered === null || hovered === index ? 1 : 0.45}
                    rx={1}
                    width={barWidth}
                    x={x}
                    y={cursor}
                  />
                );
              })}
            </g>
          );
        })}

        {monthStarts.map(({ date, index }) => (
          <text
            className="fill-current opacity-45"
            fontSize={10}
            key={date}
            textAnchor="middle"
            x={AXIS + slot * index + slot / 2}
            y={HEIGHT + 16}
          >
            {formatDay(date).split(" ")[1]}
          </text>
        ))}
      </svg>

      {active !== null && active !== undefined ? (
        <div
          className="pointer-events-none absolute top-0 z-10 w-56 rounded-lg border border-border bg-card p-3 text-xs shadow-lg"
          style={{
            left: `${Math.min((((hovered ?? 0) + 0.5) / Math.max(days.length, 1)) * 100, 72)}%`,
          }}
        >
          <p className="font-medium">{formatDay(active.date)}</p>
          <p className="mt-1 text-muted-foreground">{formatUsd(active.total)} total</p>
          <ul className="mt-2 flex flex-col gap-1">
            {active.segments
              .filter((segment) => segment.value > 0)
              .sort((a, b) => b.value - a.value)
              .map((segment) => (
                <li className="flex items-center gap-2" key={segment.family}>
                  <span className="size-2 rounded-sm" style={{ background: segment.color }} />
                  <span className="flex-1 truncate">{segment.family}</span>
                  <span className="text-muted-foreground">{formatUsd(segment.value)}</span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Legend({ entries }: { entries: { color: string; family: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {entries.map((entry) => (
        <li className="flex items-center gap-1.5 text-xs text-muted-foreground" key={entry.family}>
          <span className="size-2 rounded-sm" style={{ background: entry.color }} />
          {entry.family}
        </li>
      ))}
    </ul>
  );
}

export { Legend, StackedBars };

export type { StackedDay };
