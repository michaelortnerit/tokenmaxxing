import { useMemo } from "react";

import { enumerateDays, formatDay, formatUsd } from "./scale";

/**
 * GitHub-style activity heatmap: daily spend intensity, weeks left to
 * right, Mon/Wed/Fri row labels, 5-step scale on the day's spend.
 */

interface HeatmapProps {
  accent: string;
  /** date -> spend */
  byDate: Map<string, number>;
  first: string;
  last: string;
}

const CELL = 11;
const GAP = 2;
const LEFT = 28;
const TOP = 16;

function Heatmap({ accent, byDate, first, last }: HeatmapProps) {
  const { cells, max, monthLabels, weeks } = useMemo(() => {
    const allDays = enumerateDays(first, last);
    // Pad so the first column starts on Sunday (UTC day-of-week).
    const firstDow = new Date(`${first}T00:00:00Z`).getUTCDay();
    const padded: (string | null)[] = [...Array.from({ length: firstDow }, () => null), ...allDays];
    const weekCount = Math.ceil(padded.length / 7);
    const grid = Array.from({ length: weekCount }, (_, week) =>
      Array.from({ length: 7 }, (_, dow) => padded[week * 7 + dow] ?? null),
    );

    const labels: { label: string; week: number }[] = [];
    grid.forEach((column, week) => {
      const firstOfMonth = column.find((day) => day?.endsWith("-01"));
      if (firstOfMonth !== undefined && firstOfMonth !== null) {
        labels.push({ label: formatDay(firstOfMonth).split(" ")[1] ?? "", week });
      }
    });
    if (labels.length === 0 && allDays[0] !== undefined) {
      labels.push({ label: formatDay(allDays[0]).split(" ")[1] ?? "", week: 0 });
    }

    return {
      cells: grid,
      max: Math.max(...allDays.map((day) => byDate.get(day) ?? 0), 0),
      monthLabels: labels,
      weeks: weekCount,
    };
  }, [byDate, first, last]);

  const intensity = (value: number): number => {
    if (value <= 0 || max <= 0) {
      return 0;
    }
    const ratio = value / max;

    return ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
  };

  const opacities = [0, 0.25, 0.5, 0.75, 1] as const;
  const width = LEFT + weeks * (CELL + GAP);
  const height = TOP + 7 * (CELL + GAP);

  return (
    <svg className="block max-w-full" role="img" viewBox={`0 0 ${width} ${height}`} width={width}>
      {monthLabels.map(({ label, week }) => (
        <text
          className="fill-current opacity-45"
          fontSize={9}
          key={`${label}-${week}`}
          x={LEFT + week * (CELL + GAP)}
          y={10}
        >
          {label}
        </text>
      ))}
      {(["Mon", "Wed", "Fri"] as const).map((label, index) => (
        <text
          className="fill-current opacity-45"
          fontSize={9}
          key={label}
          x={0}
          y={TOP + (index * 2 + 1) * (CELL + GAP) + CELL - 2}
        >
          {label}
        </text>
      ))}
      {cells.map((column, week) =>
        column.map((day, dow) => {
          if (day === null) {
            return null;
          }
          const value = byDate.get(day) ?? 0;
          const level = intensity(value);
          return (
            <rect
              fill={level === 0 ? "currentColor" : accent}
              height={CELL}
              key={day}
              opacity={level === 0 ? 0.08 : opacities[level]}
              rx={2}
              width={CELL}
              x={LEFT + week * (CELL + GAP)}
              y={TOP + dow * (CELL + GAP)}
            >
              <title>{`${formatDay(day)} — ${formatUsd(value)}`}</title>
            </rect>
          );
        }),
      )}
    </svg>
  );
}

export { Heatmap };
