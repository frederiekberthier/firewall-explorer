import { memo } from 'react';
import { NetworkNode, SimulationPacket } from '@/types/firewall';

interface ConnectionLineProps {
  from: NetworkNode;
  to: NetworkNode;
  packet?: SimulationPacket;
  isActive?: boolean;
}

export const ConnectionLine = memo(function ConnectionLine({
  from,
  to,
  packet,
  isActive = false
}: ConnectionLineProps) {
  const isPacketOnThisLine = packet && (
    (packet.sourceId === from.id && packet.destinationId === to.id) ||
    (packet.sourceId === to.id && packet.destinationId === from.id) ||
    (packet.direction === 'request' && from.type === 'router') ||
    (packet.direction === 'reply' && to.type === 'router')
  );

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
        strokeDasharray={isActive ? '0' : '0'}
        className="transition-all duration-300"
      />

      {/* Animated flow dots */}
      <circle r="4" fill="hsl(var(--primary)/0.5)">
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          path={`M${from.x},${from.y} L${to.x},${to.y}`}
        />
      </circle>

      {/* Packet indicator */}
      {isPacketOnThisLine && packet && (
        <circle
          r="8"
          fill={packet.status === 'dropped' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
          className="animate-pulse"
        >
          <animateMotion
            dur="1s"
            repeatCount="1"
            path={`M${from.x},${from.y} L${to.x},${to.y}`}
            keyPoints={`${packet.progress};${packet.progress}`}
            keyTimes="0;1"
          />
        </circle>
      )}
    </g>
  );
});
