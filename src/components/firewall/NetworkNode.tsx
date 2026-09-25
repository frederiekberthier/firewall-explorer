import { memo, useState, useRef, useEffect } from 'react';
import { NetworkNode as NetworkNodeType } from '@/types/firewall';
import { Globe, Router, Network, Monitor, Trash2, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface NetworkNodeProps {
  node: NetworkNodeType;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<NetworkNodeType>) => void;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  isEditable: boolean;
}

const nodeIcons = {
  router: Router,
  internet: Globe,
  vlan: Network,
  host: Monitor
};

const nodeColors = {
  router: 'bg-primary text-primary-foreground',
  internet: 'bg-secondary text-secondary-foreground',
  vlan: 'bg-accent text-accent-foreground border-2 border-primary/30',
  host: 'bg-card text-card-foreground border border-border'
};

export const NetworkNodeComponent = memo(function NetworkNodeComponent({
  node,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDragStart,
  isEditable
}: NetworkNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = nodeIcons[node.type];

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    onUpdate({ name: editName.trim() || node.name });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(node.name);
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        'absolute flex flex-col items-center gap-2 cursor-pointer transition-all duration-200',
        isSelected && 'scale-110'
      )}
      style={{
        left: node.x,
        top: node.y,
        transform: 'translate(-50%, -50%)'
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerDown={isEditable && node.type !== 'router' ? onDragStart : undefined}
    >
      <div
        className={cn(
          'relative flex items-center justify-center w-16 h-16 rounded-xl shadow-md transition-all duration-200',
          nodeColors[node.type],
          isSelected && 'ring-4 ring-primary/50 shadow-lg'
        )}
      >
        <Icon className="w-8 h-8" />
        
        {isEditable && node.type !== 'router' && isSelected && (
          <div className="absolute -top-2 -right-2 flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              aria-label={`${node.name} hernoemen`}
              title="Hernoemen"
              className="w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label={`${node.name} verwijderen`}
              title="Verwijderen"
              className="w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-80 transition-opacity"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="flex items-center gap-1 bg-card rounded-lg p-1 shadow-lg border border-border">
          <Input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-6 w-24 text-xs px-2"
            aria-label="Nieuwe naam"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
          <button onClick={handleSave} aria-label="Naam opslaan" title="Opslaan" className="p-1 hover:bg-muted rounded">
            <Check className="w-3 h-3 text-primary" />
          </button>
          <button onClick={handleCancel} aria-label="Hernoemen annuleren" title="Annuleren" className="p-1 hover:bg-muted rounded">
            <X className="w-3 h-3 text-destructive" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-sm font-medium bg-card/90 px-2 py-1 rounded shadow-sm border border-border/50">
            {node.name}
          </span>
          {node.type === 'vlan' && node.subnet && (
            <span className="text-[10px] text-muted-foreground bg-card/70 px-1.5 rounded">
              VLAN {node.vlanId} · {node.subnet}
            </span>
          )}
          {node.type === 'host' && node.ip && (
            <span className="text-[10px] text-muted-foreground bg-card/70 px-1.5 rounded">
              {node.ip}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
