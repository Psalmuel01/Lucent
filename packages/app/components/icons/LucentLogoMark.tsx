"use client";

import { SVGProps } from "react";

interface Props extends SVGProps<SVGSVGElement> {
  size?: number;
  showBg?: boolean;
}

/** Open-padlock brand mark — the shackle is drawn open, mid-swing. */
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
      {showBg && <rect width="48" height="48" rx="12" fill="#000000" />}
      {/* Open shackle arc — swung open to the right */}
      <path
        d="M15 22 L15 15 A9 9 0 0 1 33 15 L33 18"
        stroke="#FBBF24"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Lock body */}
      <rect x="10" y="22" width="28" height="19" rx="5" fill="#FBBF24" />
      {/* Keyhole */}
      <circle cx="24" cy="30.5" r="3.5" fill="#000000" />
      <rect x="22.5" y="30" width="3" height="5.5" rx="1.5" fill="#000000" />
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
