"use client";

import { SVGProps } from "react";

interface Props extends SVGProps<SVGSVGElement> {
  size?: number;
  showBg?: boolean;
}

export function LucentLogoMark({ size = 32, showBg = true, ...props }: Props) {
  const r = size * 0.42;
  const cx = size / 2;
  const cy = size / 2;
  const ri = r * 0.62;
  const rc = r * 0.18;
  const bgColor = showBg ? "#080808" : "transparent";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {showBg && <rect width={size} height={size} rx={size * 0.25} fill={bgColor} />}
      {/* Full circle base */}
      <circle cx={cx} cy={cy} r={r} fill="#000000" />
      {/* Right half revealed in yellow */}
      <path
        d={`M${cx} ${cy - r} A${r} ${r} 0 0 1 ${cx} ${cy + r} Z`}
        fill="#FBBF24"
      />
      {/* Inner ring black left half */}
      <path
        d={`M${cx} ${cy - ri} A${ri} ${ri} 0 0 0 ${cx} ${cy + ri} Z`}
        fill="#000000"
      />
      {/* Inner ring dark right half */}
      <path
        d={`M${cx} ${cy - ri} A${ri} ${ri} 0 0 1 ${cx} ${cy + ri} Z`}
        fill="#1A1200"
      />
      {/* Centre dot — the hidden core */}
      <circle cx={cx} cy={cy} r={rc} fill="#FBBF24" opacity={0.4} />
      {/* Vertical divider */}
      <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="#000000" strokeWidth={size * 0.035} />
    </svg>
  );
}

export function LucentWordmark({ height = 24 }: { height?: number }) {
  return (
    <div className="flex items-center gap-2.5" style={{ height }}>
      <LucentLogoMark size={height} />
      <span
        className="font-display font-semibold tracking-tight text-text-primary"
        style={{ fontSize: height * 0.7, lineHeight: 1 }}
      >
        Lucent
      </span>
    </div>
  );
}
