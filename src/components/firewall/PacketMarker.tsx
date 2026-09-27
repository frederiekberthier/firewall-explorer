import { useEffect, useState } from 'react';
import { pointAlongPolyline } from '@/lib/topology';

interface PacketMarkerProps {
  /** Canvas points the packet travels through, in order. */
  points: { x: number; y: number }[];
  /** Travel time in ms; a bit shorter than the simulation's travel phase so it arrives in time. */
  durationMs?: number;
  color: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A packet moving along its path. Driven by requestAnimationFrame rather
 * than SVG <animateMotion>, whose timeline starts at page load and so does
 * not replay for a marker that is inserted later. Remount (new `key`) to
 * start a new trip. With reduced motion the packet is shown at its
 * destination right away.
 */
export function PacketMarker({ points, durationMs = 1300, color }: PacketMarkerProps) {
  const [t, setT] = useState(() => (prefersReducedMotion() ? 1 : 0));

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      setT(progress);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs]);

  const { x, y } = pointAlongPolyline(points, t);
  return (
    <circle
      cx={x}
      cy={y}
      r={8}
      fill={color}
      stroke="hsl(var(--background))"
      strokeWidth={2}
      data-testid="packet-marker"
    />
  );
}
