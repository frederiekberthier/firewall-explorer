import { Globe, Network, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NetworkNode } from '@/types/firewall';

interface NodeToolbarProps {
  onAddNode: (type: 'internet' | 'vlan' | 'host') => void;
  selectedNodeType: string | null;
  selectedNodeName?: string;
  disabled?: boolean;
  nodes: NetworkNode[];
}

export function NodeToolbar({ onAddNode, selectedNodeType, selectedNodeName, disabled, nodes }: NodeToolbarProps) {
  const canAddHost = selectedNodeType === 'router' || selectedNodeType === 'vlan';
  const hasInternet = nodes.some(node => node.type === 'internet');

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 bg-card rounded-xl shadow-md border border-border">
      <span className="text-sm font-medium text-muted-foreground">
        Voeg nodes toe:
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onAddNode('internet')}
        disabled={disabled || hasInternet}
        className="flex items-center gap-2"
      >
        <Globe className="w-4 h-4" />
        Internet
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onAddNode('vlan')}
        disabled={disabled}
        className="flex items-center gap-2"
      >
        <Network className="w-4 h-4" />
        VLAN
      </Button>

      <div className="flex items-center gap-2">
        <Button
          variant={canAddHost ? "default" : "outline"}
          size="sm"
          onClick={() => onAddNode('host')}
          disabled={disabled || !canAddHost}
          className={cn(
            "flex items-center gap-2",
            canAddHost && "shadow-md"
          )}
        >
          <Monitor className="w-4 h-4" />
          Host
        </Button>
        {canAddHost ? (
          <span className="text-xs text-primary font-medium">
            → koppelen aan {selectedNodeName}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            (selecteer eerst router of VLAN)
          </span>
        )}
      </div>
    </div>
  );
}
