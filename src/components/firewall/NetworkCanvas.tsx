import { useRef, useCallback, useState } from 'react';
import { NetworkNode, Connection, SimulationPacket } from '@/types/firewall';
import { NetworkNodeComponent } from './NetworkNode';
import { ConnectionLine } from './ConnectionLine';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react';

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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<{
    nodeId: string;
    startX: number;
    startY: number;
    nodeStartX: number;
    nodeStartY: number;
  } | null>(null);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

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
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!dragState) return;

    const dx = (e.clientX - dragState.startX) / zoom;
    const dy = (e.clientY - dragState.startY) / zoom;

    onUpdateNode(dragState.nodeId, {
      x: dragState.nodeStartX + dx,
      y: dragState.nodeStartY + dy
    });
  }, [dragState, onUpdateNode, isPanning, panStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
    setIsPanning(false);
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Start panning when clicking on empty canvas area
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).tagName === 'rect' || (e.target as HTMLElement).tagName === 'path') {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const getNodeById = (id: string) => nodes.find(n => n.id === id);

  return (
    <div
      ref={canvasRef}
      className={`relative w-full h-[700px] bg-gradient-to-br from-background to-muted/30 rounded-xl border border-border overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      onClick={() => !isPanning && onSelectNode(null)}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-card/90 backdrop-blur-sm rounded-lg border border-border p-1 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
          title="Zoom uit"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs font-medium text-muted-foreground min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => { e.stopPropagation(); handleZoomReset(); }}
          title="Reset zoom en positie"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Pan hint */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-card/80 backdrop-blur-sm rounded-lg border border-border px-2 py-1 shadow-sm">
        <Move className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Sleep om te pannen</span>
      </div>

      {/* Zoomable and pannable content wrapper */}
      <div
        className="absolute inset-0 origin-center transition-transform duration-100"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
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
      </div>

      {/* Empty state hint */}
      {nodes.length === 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-muted-foreground bg-card/80 px-4 py-2 rounded-lg border border-border z-10">
          Voeg nodes toe met de knoppen hierboven
        </div>
      )}
    </div>
  );
}
