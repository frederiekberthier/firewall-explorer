import { useRef, useCallback, useState, useEffect } from 'react';
import { NetworkNode, Connection, SimulationPacket } from '@/types/firewall';
import { NetworkNodeComponent } from './NetworkNode';
import { ConnectionLine } from './ConnectionLine';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Move, Maximize } from 'lucide-react';
import { fitView, MIN_ZOOM, MAX_ZOOM } from '@/lib/layout';

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

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, MAX_ZOOM));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, MIN_ZOOM));
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Latest nodes for the fit effects below, without re-running them on every
  // drag step (a node move changes `nodes` but must not re-fit the view).
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const applyFit = useCallback((onlyIfOverflowing: boolean) => {
    const el = canvasRef.current;
    if (!el) return;
    const fit = fitView(nodesRef.current, el.clientWidth, el.clientHeight);
    if (onlyIfOverflowing && fit.fitsAtIdentity) return;
    setZoom(fit.zoom);
    setPan(fit.pan);
  }, []);

  // Fit automatically when the network would not fit at 100% — on a narrow
  // screen, or after loading a scenario with many VLANs — both on first render
  // and whenever nodes are added or removed.
  useEffect(() => {
    applyFit(true);
  }, [nodes.length, applyFit]);

  useEffect(() => {
    const onResize = () => applyFit(true);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [applyFit]);

  const handleDragStart = useCallback((nodeId: string, e: React.PointerEvent) => {
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

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
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

  const handlePointerUp = useCallback(() => {
    setDragState(null);
    setIsPanning(false);
  }, []);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    // Start panning when clicking on empty canvas area. The background grid
    // and connection-line <svg> layers have pointer-events:none (so clicks
    // reach nodes drawn on top of them), which means a click on empty space
    // never actually lands on those <svg>/<rect>/<path> elements — it lands
    // on the pan/zoom wrapper <div> right behind them. Marking that wrapper
    // (and the canvas root) explicitly is what the tagName check above was
    // trying, and failing, to detect.
    const target = e.target as HTMLElement;
    if (target.dataset.panSurface === 'true') {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const getNodeById = (id: string) => nodes.find(n => n.id === id);

  return (
    <div
      ref={canvasRef}
      data-pan-surface="true"
      // Pointer events (not mouse events) so dragging and panning also work
      // with touch and pen; touch-none stops the browser from scrolling the
      // page instead. A touch pointer is implicitly captured by the element it
      // started on, so its move/up events still bubble up to this handler.
      className={`relative w-full h-[60vh] min-h-[360px] md:h-[700px] touch-none bg-gradient-to-br from-background to-muted/30 rounded-xl border border-border overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      onClick={() => !isPanning && onSelectNode(null)}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
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
          onClick={(e) => { e.stopPropagation(); applyFit(false); }}
          title="Passend maken"
        >
          <Maximize className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => { e.stopPropagation(); handleZoomReset(); }}
          title="Reset zoom en positie"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Pan hint */}
      <div className="absolute bottom-3 left-3 z-20 hidden sm:flex items-center gap-1.5 bg-card/80 backdrop-blur-sm rounded-lg border border-border px-2 py-1 shadow-sm">
        <Move className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Sleep om te pannen</span>
      </div>

      {/* Zoomable and pannable content wrapper */}
      <div
        data-pan-surface="true"
        className="absolute inset-0 origin-center transition-transform duration-100"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {/* Grid pattern — oversized so it still fills the view when zoomed out */}
        <svg
          className="absolute pointer-events-none"
          style={{ left: -2000, top: -2000, width: 'calc(100% + 4000px)', height: 'calc(100% + 4000px)' }}
        >
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

        {/* Connection lines — overflow-visible so lines to nodes outside the
            canvas-sized box (visible after zooming out) are not clipped */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
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
