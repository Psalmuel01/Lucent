"use client";

import { SVGProps } from "react";

interface Props extends SVGProps<SVGSVGElement> {
  size?: number;
  showBg?: boolean;
}

/** Sparkle / radiance mark — a four-point star of light, for "Lucent" (shining, luminous). */
export function LucentLogoMark({ size = 32, showBg = true, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {showBg && <rect width="48" height="48" rx="12" fill="#080808" />}
      {/* Primary sparkle */}
      <path
        d="M25.5 6 L28.6 20.4 L42 24 L28.6 27.6 L25.5 42 L22.4 27.6 L9 24 L22.4 20.4 Z"
        fill="#FBBF24"
      />
      {/* Companion glint, upper-right */}
      <path d="M36 8 L37.4 12.6 L42 14 L37.4 15.4 L36 20 L34.6 15.4 L30 14 L34.6 12.6 Z" fill="#FBBF24" />
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
