import type { CSSProperties } from 'react';
import { useId } from 'react';

import type { Plates } from '@/lib/note';

interface BanknoteProps {
  plates: Plates;
  initials: string;
  serial: string;
  checking?: boolean;
}

const W = 700;
const H = 320;

function advanceOf(size: number, tracking: number): number {
  return size * 0.6 + tracking;
}

function lathe(count: number, d: number, rx: number, ry: number, phase = 0) {
  return Array.from({ length: count }, (_, i) => ({
    key: i,
    rotation: phase + (i * 360) / count,
    d,
    rx,
    ry,
  }));
}

function step(i: number): CSSProperties {
  return { '--i': i } as CSSProperties;
}

export function Banknote({ plates, initials, serial, checking = false }: BanknoteProps) {
  const uid = useId().replace(/:/g, '');
  const grainId = `grain-${uid}`;
  const paperClipId = `paper-${uid}`;
  const medallionClipId = `medallion-${uid}`;
  const scanId = `scan-${uid}`;
  const sealArcId = `seal-${uid}`;

  const { engraved, numbered, backed, sealed } = plates;

  const yes = 'true';
  const no = 'false';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id={grainId} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>

        <clipPath id={paperClipId}>
          <rect x="0" y="0" width={W} height={H} rx="10" />
        </clipPath>

        <clipPath id={medallionClipId}>
          <ellipse cx="150" cy="182" rx="74" ry="78" />
        </clipPath>

        <linearGradient id={scanId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--color-primary)" stopOpacity="0.42" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>

        <path
          id={sealArcId}
          fill="none"
          d="M 490,172 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0"
        />
      </defs>

      <rect
        x="0"
        y="0"
        width={W}
        height={H}
        rx="10"
        className="fill-note-paper stroke-note-paper-edge"
        strokeWidth="1"
      />
      <rect
        x="0"
        y="0"
        width={W}
        height={H}
        rx="10"
        filter={`url(#${grainId})`}
        opacity="0.055"
      />

      <g className="stroke-note-muted" strokeWidth="0.9" opacity="0.5">
        {[
          [12, 12],
          [688, 12],
          [12, 308],
          [688, 308],
        ].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} />
            <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} />
          </g>
        ))}
      </g>

      <g data-printed={engraved ? no : yes}>
        <rect
          x="22"
          y="22"
          width="656"
          height="276"
          rx="6"
          fill="none"
          strokeDasharray="7 7"
          strokeWidth="1"
          className="pl-ink stroke-note-muted"
          opacity="0.55"
        />
      </g>

      <g data-printed={backed ? yes : no}>
        <g transform="translate(490 172)" className="stroke-note-line" fill="none" opacity="0.62">
          {lathe(30, 30, 82, 27).map((ring) => (
            <ellipse
              key={ring.key}
              cx={ring.d}
              cy="0"
              rx={ring.rx}
              ry={ring.ry}
              transform={`rotate(${ring.rotation})`}
              pathLength={1}
              strokeWidth="0.55"
              className="pl-draw"
              style={step(ring.key)}
            />
          ))}
        </g>
      </g>

      <g data-printed={sealed ? yes : no}>
        <g transform="translate(490 172)" className="stroke-note-line" fill="none" opacity="0.5">
          {lathe(24, 26, 76, 25, 7.5).map((ring) => (
            <ellipse
              key={ring.key}
              cx={ring.d}
              cy="0"
              rx={ring.rx}
              ry={ring.ry}
              transform={`rotate(${ring.rotation})`}
              pathLength={1}
              strokeWidth="0.5"
              className="pl-draw"
              style={step(ring.key)}
            />
          ))}
        </g>
      </g>

      <g data-printed={engraved ? yes : no}>
        <rect
          x="22"
          y="22"
          width="656"
          height="276"
          rx="6"
          fill="none"
          pathLength={1}
          strokeWidth="1.6"
          className="pl-draw stroke-note-ink"
          style={step(0)}
        />
        <rect
          x="32"
          y="32"
          width="636"
          height="256"
          rx="3"
          fill="none"
          pathLength={1}
          strokeWidth="0.7"
          className="pl-draw stroke-note-line"
          style={step(1)}
        />

        <text
          x="52"
          y="68"
          className="pl-ink fill-note-ink font-note"
          fontSize="31"
          fontWeight="600"
          letterSpacing="0.13em"
          style={step(3)}
        >
          FINANÇAS
        </text>
        <text
          x="54"
          y="87"
          className="pl-ink fill-note-muted font-serial"
          fontSize="8.5"
          letterSpacing="0.44em"
          style={step(4)}
        >
          CARTEIRA PESSOAL
        </text>

        <g fill="none" className="stroke-note-ink">
          <ellipse
            cx="150"
            cy="182"
            rx="74"
            ry="78"
            pathLength={1}
            strokeWidth="1.4"
            className="pl-draw"
            style={step(2)}
          />
          <ellipse
            cx="150"
            cy="182"
            rx="66"
            ry="70"
            pathLength={1}
            strokeWidth="0.6"
            className="pl-draw stroke-note-line"
            style={step(3)}
          />
        </g>

        <g transform="translate(150 182)" className="stroke-note-line" fill="none" opacity="0.55">
          {lathe(18, 16, 56, 30).map((ring) => (
            <ellipse
              key={ring.key}
              cx={ring.d}
              cy="0"
              rx={ring.rx}
              ry={ring.ry}
              transform={`rotate(${ring.rotation})`}
              pathLength={1}
              strokeWidth="0.45"
              className="pl-draw"
              style={step(4 + ring.key)}
            />
          ))}
        </g>

        <g clipPath={`url(#${medallionClipId})`} className="stroke-note-ink">
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={i}
              x1="76"
              y1={226 + i * 4}
              x2="224"
              y2={226 + i * 4}
              pathLength={1}
              strokeWidth="1.1"
              opacity={0.14 + i * 0.06}
              className="pl-draw"
              style={step(6 + i)}
            />
          ))}
        </g>

        {initials && (
          <g className="pl-ink" style={step(6)}>
            <ellipse cx="150" cy="184" rx="40" ry="34" className="fill-note-paper" opacity="0.92" />
            <text
              x="150"
              y="188"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-note-ink font-note"
              fontSize="62"
              fontWeight="600"
              letterSpacing="0.02em"
            >
              {initials}
            </text>
          </g>
        )}

      </g>

      <g data-printed={numbered ? yes : no}>
        <SerialText serial={serial} x={52} y={282} size={15} tracking={3} />
        <SerialText
          serial={serial}
          x={650 - serial.length * advanceOf(13, 2.4)}
          y={68}
          size={13}
          tracking={2.4}
        />

        <text
          x="300"
          y="282"
          className="pl-ink fill-note-muted font-serial"
          fontSize="5.2"
          letterSpacing="0.05em"
          style={step(16)}
        >
          {'finanças·carteira·'.repeat(6)}
        </text>

        <text
          transform="translate(658 110) rotate(90)"
          className="pl-ink fill-note-muted font-serial"
          fontSize="6.5"
          letterSpacing="0.32em"
          style={step(17)}
        >
          CÉDULA PESSOAL · SÉRIE ÚNICA
        </text>
      </g>

      <g data-printed={sealed ? yes : no}>
        {Array.from({ length: 9 }, (_, i) => (
          <line
            key={i}
            x1="286"
            y1={36 + i * 28}
            x2="286"
            y2={56 + i * 28}
            pathLength={1}
            strokeWidth="4.5"
            strokeLinecap="round"
            className="pl-draw stroke-note-thread"
            style={step(i)}
            opacity="0.8"
          />
        ))}

        <circle cx="490" cy="172" r="54" className="pl-ink fill-note-paper" style={step(6)} />

        <g className="pl-stamp">
          <circle
            cx="490"
            cy="172"
            r="50"
            fill="none"
            strokeWidth="1.6"
            className="stroke-note-ink"
          />
          <circle
            cx="490"
            cy="172"
            r="45"
            fill="none"
            strokeWidth="3"
            strokeDasharray="1.4 5.03"
            className="stroke-note-ink"
            opacity="0.75"
          />
          <circle
            cx="490"
            cy="172"
            r="39"
            fill="none"
            strokeWidth="0.6"
            className="stroke-note-line"
          />

          <text className="fill-note-ink font-serial" fontSize="8.2" letterSpacing="0.24em">
            <textPath href={`#${sealArcId}`} startOffset="25%" textAnchor="middle">
              AUTÊNTICA · FINANÇAS
            </textPath>
          </text>

          <g transform="translate(490 172)" className="stroke-note-ink" fill="none" opacity="0.75">
            {lathe(12, 5, 17, 6).map((ring) => (
              <ellipse
                key={ring.key}
                cx={ring.d}
                cy="0"
                rx={ring.rx}
                ry={ring.ry}
                transform={`rotate(${ring.rotation})`}
                strokeWidth="0.5"
              />
            ))}
          </g>
        </g>
      </g>

      {checking && (
        <g clipPath={`url(#${paperClipId})`}>
          <rect
            x="0"
            y="0"
            width="150"
            height={H}
            fill={`url(#${scanId})`}
            className="note-scan"
          />
        </g>
      )}
    </svg>
  );
}

function SerialText({
  serial,
  x,
  y,
  size,
  tracking,
}: {
  serial: string;
  x: number;
  y: number;
  size: number;
  tracking: number;
}) {
  const advance = advanceOf(size, tracking);

  return (
    <g className="fill-note-ink font-serial" fontSize={size} fontWeight="700">
      {[...serial].map((char, i) =>
        char === ' ' ? null : (
          <text
            key={i}
            x={x + i * advance}
            y={y}
            className="pl-digit"
            style={step(i)}
          >
            {char}
          </text>
        ),
      )}
    </g>
  );
}
