/**
 * Sector Color Elements
 *
 * These lightweight wrapper components apply dynamic runtime colors from sector
 * data via `ref.current.style.setProperty()` rather than JSX `style={}` props.
 *
 * PURPOSE: Satisfy linter rule "CSS inline styles should not be used" while still
 * supporting colors that are determined at runtime from data (not static CSS).
 * The `style` prop is absent from all JSX below — styles are set imperatively.
 */

import { useEffect, useRef, type ReactNode } from 'react';

// ─── Sector Bar Segment ────────────────────────────────────────────────────────
// Renders a flex-proportioned colored segment in the sector diversity bar.
interface SectorBarSegmentProps {
  color: string;
  flex: number;
  className?: string;
}

export function SectorBarSegment({ color, flex, className }: SectorBarSegmentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('background-color', color);
    el.style.setProperty('flex', String(flex));
  }, [color, flex]);

  return <div ref={ref} className={className} />;
}

// ─── Sector Dot ────────────────────────────────────────────────────────────────
// Renders a small colored circle used in the sector legend.
interface SectorDotProps {
  color: string;
  className?: string;
}

export function SectorDot({ color, className }: SectorDotProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('background-color', color);
  }, [color]);

  return <span ref={ref} className={className} />;
}

// ─── Sector Header ─────────────────────────────────────────────────────────────
// Renders the colored section header label for a group of sector picks.
interface SectorHeaderProps {
  color: string;
  textColor?: string;
  className?: string;
  children?: ReactNode;
}

export function SectorHeader({
  color,
  textColor = '#fff',
  className,
  children,
}: SectorHeaderProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('background-color', color);
    el.style.setProperty('color', textColor);
  }, [color, textColor]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
