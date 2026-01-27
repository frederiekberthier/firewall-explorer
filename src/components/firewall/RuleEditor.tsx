import { useState } from 'react';
import { NetworkNode, FirewallRule } from '@/types/firewall';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, GripVertical, Plus, ShieldCheck, ShieldX, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RuleEditorProps {
  nodes: NetworkNode[];
  rules: FirewallRule[];
  onAddRule: (rule: Omit<FirewallRule, 'id' | 'order'>) => void;
  onDeleteRule: (id: string) => void;
  onReorderRules: (startIndex: number, endIndex: number) => void;
}

export function RuleEditor({
  nodes,
  rules,
  onAddRule,
  onDeleteRule,
  onReorderRules
}: RuleEditorProps) {
  const [sourceId, setSourceId] = useState<string>('');
  const [destinationId, setDestinationId] = useState<string>('');
  const [connectionType, setConnectionType] = useState<'new' | 'related'>('new');
  const [action, setAction] = useState<'allow' | 'drop'>('allow');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const availableNodes = nodes.filter(n => n.type !== 'router');

  const handleAddRule = () => {
    if (!sourceId || !destinationId || sourceId === destinationId) return;
    
    onAddRule({
      sourceId,
      destinationId,
      connectionType,
      action
    });
    
    setSourceId('');
    setDestinationId('');
  };

  const getNodeName = (id: string) => nodes.find(n => n.id === id)?.name || 'Onbekend';

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      onReorderRules(dragIndex, index);
      setDragIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  return (
    <div className="space-y-6">
      {/* Add rule form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nieuwe regel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bron</label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  {availableNodes.map(node => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Doel</label>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  {availableNodes.filter(n => n.id !== sourceId).map(node => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={connectionType} onValueChange={(v: 'new' | 'related') => setConnectionType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="related">Related</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Actie</label>
              <Select value={action} onValueChange={(v: 'allow' | 'drop') => setAction(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  <SelectItem value="allow">Allow</SelectItem>
                  <SelectItem value="drop">Drop</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleAddRule}
            disabled={!sourceId || !destinationId || sourceId === destinationId}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Regel toevoegen
          </Button>
        </CardContent>
      </Card>

      {/* Rules list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Firewall regels ({rules.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Versleep regels om de volgorde aan te passen. Regels worden van boven naar beneden geëvalueerd.
          </p>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Geen regels. Voeg je eerste firewall regel toe.
            </div>
          ) : (
            <div className="space-y-2">
              {rules.sort((a, b) => a.order - b.order).map((rule, index) => (
                <div
                  key={rule.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border bg-card transition-all",
                    dragIndex === index && "opacity-50 scale-95"
                  )}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                  
                  <span className="w-6 h-6 flex items-center justify-center bg-muted rounded text-xs font-mono">
                    {index + 1}
                  </span>

                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{getNodeName(rule.sourceId)}</Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <Badge variant="outline">{getNodeName(rule.destinationId)}</Badge>
                    
                    <Badge variant="secondary" className="ml-2">
                      {rule.connectionType}
                    </Badge>
                    
                    <Badge
                      className={cn(
                        rule.action === 'allow' 
                          ? 'bg-primary/20 text-primary border-primary/30' 
                          : 'bg-destructive/20 text-destructive border-destructive/30'
                      )}
                    >
                      {rule.action === 'allow' ? (
                        <ShieldCheck className="w-3 h-3 mr-1" />
                      ) : (
                        <ShieldX className="w-3 h-3 mr-1" />
                      )}
                      {rule.action}
                    </Badge>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteRule(rule.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
