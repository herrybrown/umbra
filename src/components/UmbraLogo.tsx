"use client";

import { useId } from "react";

interface Props {
  size?: number;
  className?: string;
}

export function UmbraLogo({ size = 28, className }: Props) {
  const id = useId().replace(/:/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <clipPath id={`${id}clip`}>
          <circle cx="16" cy="16" r="13" />
        </clipPath>
        <radialGradient
          id={`${id}grad`}
          cx="88%"
          cy="50%"
          r="70%"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0%" stopColor="#ddd6fe" />
          <stop offset="45%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#2e1065" />
        </radialGradient>
      </defs>

      {/* Clipped to outer circle boundary */}
      <g clipPath={`url(#${id}clip)`}>
        {/* Full circle filled with the gradient — bright at the right edge */}
        <circle cx="16" cy="16" r="13" fill={`url(#${id}grad)`} />
        {/* Dark crescent cover offset to the left — leaves a crescent on the right */}
        <circle cx="11" cy="16" r="12" fill="#09010f" />
      </g>

      {/* Outer ring */}
      <circle
        cx="16"
        cy="16"
        r="13"
        stroke="#7c3aed"
        strokeWidth="1.5"
        fill="none"
        strokeOpacity="0.65"
      />
    </svg>
  );
}
