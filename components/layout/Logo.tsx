"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * Round brand mark. Falls back to a styled text monogram when
 * /logo.png is missing or fails to load, so the header never
 * shows a broken-image icon.
 */
export function LogoMark({ size = 36, className }: LogoMarkProps) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn(
          "rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20",
          className
        )}
        aria-label="DTT Hardware"
      >
        <span
          className="font-extrabold tracking-tight text-white select-none"
          style={{ fontSize: Math.round(size * 0.34), lineHeight: 1 }}
        >
          DTT
        </span>
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={cn("rounded-full overflow-hidden bg-white shrink-0", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="DTT Hardware logo"
        width={size}
        height={size}
        className="w-full h-full object-cover"
        onError={() => setBroken(true)}
      />
    </div>
  );
}
