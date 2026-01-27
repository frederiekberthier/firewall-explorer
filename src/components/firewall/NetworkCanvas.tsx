import { useRef, useCallback, useState } from 'react';
import { NetworkNode, Connection, SimulationPacket } from '@/types/firewall';
import { NetworkNodeComponent } from './NetworkNode';
import { ConnectionLine } from './ConnectionLine';

interface NetworkCanvasProps {
  nodes: NetworkNode[];
  connections: Connection[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onUpdateNode: (id: string, updates: Partial<NetworkNode>) => void;
  onDeleteNode: (id: string) => void;
  isEditable: boolean;
  packet?: SimulationPacket;
  activeConnectionIds?: string[];
}

export function NetworkCanvas({
  nodes,
  connections,
  selectedNodeId,
  onSelectNode,
  onUpdateNode,
  onDeleteNode,
  isEditable,
  packet,
  activeConnectionIds = []
}: NetworkCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    nodeId: string;
    startX: number;
    startY: number;
    nodeStartX: number;
    nodeStartY: number;
  } | null>(null);

  const handleDragStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (!isEditable) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.type === 'router') return;
    
    setDragState({
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      nodeStartX: node.x,
      nodeStartY: node.y
    });
  }, [nodes, isEditable]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState) return;
    
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    
    onUpdateNode(dragState.nodeId, {
      x: dragState.nodeStartX + dx,
      y: dragState.nodeStartY + dy
    });
  }, [dragState, onUpdateNode]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  const getNodeById = (id: string) => nodes.find(n => n.id === id);

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-[500px] bg-gradient-to-br from-background to-muted/30 rounded-xl border border-border overflow-hidden"
      onClick={() => onSelectNode(null)}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid pattern */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
              opacity="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {connections.map(conn => {
          const fromNode = getNodeById(conn.fromId);
          const toNode = getNodeById(conn.toId);
          if (!fromNode || !toNode) return null;
          
          return (
            <ConnectionLine
              key={conn.id}
              from={fromNode}
              to={toNode}
              packet={packet}
              isActive={activeConnectionIds.includes(conn.id)}
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {nodes.map(node => (
        <NetworkNodeComponent
          key={node.id}
          node={node}
          isSelected={selectedNodeId === node.id}
          onSelect={() => onSelectNode(node.id)}
          onUpdate={(updates) => onUpdateNode(node.id, updates)}
          onDelete={() => onDeleteNode(node.id)}
          onDragStart={(e) => handleDragStart(node.id, e)}
          isEditable={isEditable}
        />
      ))}

      {/* Empty state hint */}
      {nodes.length === 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-muted-foreground bg-card/80 px-4 py-2 rounded-lg border border-border">
          Voeg nodes toe met de knoppen hierboven
        </div>
      )}
    </div>
  );
}
