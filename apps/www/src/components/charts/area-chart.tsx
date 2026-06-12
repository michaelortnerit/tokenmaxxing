import { useMemo } from "react";

import { formatUsd, linearScale, niceMax } from "./scale";

/** Cumulative spend: a single area path with the final total labelled. */

interface AreaPoint {
  date: string;
  value: number;
}

const WIDTH = 460;
const HEIGHT = 170;
const AXIS = 44;
const TICKS = 4;

function AreaChart({ accent, points }: { accent: string; points: AreaPoint[] }) {
  const max = useMemo(() => niceMax(Math.max(...points.map((point) => point.value), 0)), [points]);
  const y = linearScale(max, HEIGHT - 18);
  const step = (WIDTH - AXIS) / Math.max(points.length - 1, 1);

  const coords = points.map((point, index) => ({
    x: AXIS + step * index,
    y: HEIGHT - y(point.value),
  }));
  const line = coords.map(({ x, y: yPos }, index) => `${index === 0 ? "M" : "L"}${x},${yPos}`);
  const area = [...line, `L${coords.at(-1)?.x ?? AXIS},${HEIGHT}`, `L${AXIS},${HEIGHT}`, "Z"];
  const last = points.at(-1);
  const lastCoord = coords.at(-1);

  return (
    <svg className="block w-full" role="img" viewBox={`0 0 ${WIDTH} ${HEIGHT + 8}`}>
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
      {points.length > 1 ? (
        <>
          <path d={area.join(" ")} fill={accent} opacity={0.15} />
          <path d={line.join(" ")} fill="none" stroke={accent} strokeWidth={1.5} />
        </>
      ) : null}
      {last !== undefined && lastCoord !== undefined ? (
        <text
          className="fill-current"
          fontSize={11}
          fontWeight={600}
          textAnchor="end"
          x={WIDTH - 2}
          y={Math.max(lastCoord.y - 8, 12)}
        >
          {formatUsd(last.value)}
        </text>
      ) : null}
    </svg>
  );
}

export { AreaChart };

export type { AreaPoint };
