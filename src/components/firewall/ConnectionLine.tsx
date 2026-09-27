import { memo } from 'react';
import { NetworkNode } from '@/types/firewall';

interface ConnectionLineProps {
  from: NetworkNode;
  to: NetworkNode;
  /** Part of the path of the packet currently being simulated. */
  isActive?: boolean;
}

export const ConnectionLine = memo(function ConnectionLine({
  from,
  to,
  isActive = false
}: ConnectionLineProps) {
  return (
    <g>
      {/* Connection line */}
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={isActive ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
        strokeWidth={isActive ? 3 : 2}
        className="transition-all duration-300"
        data-active={isActive || undefined}
      />

      {/* Animated flow dots */}
      <circle r="4" fill="hsl(var(--primary)/0.5)">
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          path={`M${from.x},${from.y} L${to.x},${to.y}`}
        />
      </circle>
    </g>
  );
});
