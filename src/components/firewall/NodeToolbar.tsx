import { Globe, Network, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NodeToolbarProps {
  onAddNode: (type: 'internet' | 'vlan' | 'host') => void;
  selectedNodeType: string | null;
  disabled?: boolean;
}

export function NodeToolbar({ onAddNode, selectedNodeType, disabled }: NodeToolbarProps) {
  const canAddHost = selectedNodeType === 'router' || selectedNodeType === 'vlan';

  return (
    <div className="flex flex-wrap gap-2 p-4 bg-card rounded-xl shadow-md border border-border">
      <span className="w-full text-sm font-medium text-muted-foreground mb-2">
        Voeg nodes toe:
      </span>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onAddNode('internet')}
        disabled={disabled}
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
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onAddNode('host')}
        disabled={disabled || !canAddHost}
        className={cn(
          "flex items-center gap-2",
          canAddHost && "ring-2 ring-primary/50"
        )}
      >
        <Monitor className="w-4 h-4" />
        Host
        {!canAddHost && (
          <span className="text-xs text-muted-foreground ml-1">
            (selecteer router/VLAN)
          </span>
        )}
      </Button>
    </div>
  );
}
