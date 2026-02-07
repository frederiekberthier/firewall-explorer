import { useState } from 'react';
import { NetworkNode, FirewallRule, FirewallPolicy } from '@/types/firewall';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, GripVertical, Plus, ShieldCheck, ShieldX, ArrowRight, Download, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RuleEditorProps {
  nodes: NetworkNode[];
  rules: FirewallRule[];
  firewallPolicy: FirewallPolicy;
  onPolicyChange: (policy: FirewallPolicy) => void;
  onAddRule: (rule: Omit<FirewallRule, 'id' | 'order'>) => void;
  onDeleteRule: (id: string) => void;
  onReorderRules: (startIndex: number, endIndex: number) => void;
}

export function RuleEditor({
  nodes,
  rules,
  firewallPolicy,
  onPolicyChange,
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
    if (!sourceId || !destinationId) return;
    // Allow same source and destination if one is a wildcard
    const isWildcard = (id: string) => id.startsWith('ANY');
    if (sourceId === destinationId && !isWildcard(sourceId)) return;

    onAddRule({
      sourceId,
      destinationId,
      connectionType,
      action
    });

    setSourceId('');
    setDestinationId('');
  };

  const getNodeName = (id: string) => {
    if (id === 'ANY') return 'ANY';
    if (id === 'ANY_VLAN') return 'ANY VLAN';
    if (id === 'ANY_HOST') return 'ANY HOST';
    if (id === 'ANY_INTERNET') return 'ANY INTERNET';
    return nodes.find(n => n.id === id)?.name || 'Onbekend';
  };

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

  const getMikrotikAddressParam = (nodeId: string, paramType: 'src' | 'dst') => {
    const prefix = paramType === 'src' ? 'src-address-list' : 'dst-address-list';

    // Handle wildcards - return empty string for wildcards (no restriction)
    if (nodeId === 'ANY_VLAN') return '';
    if (nodeId === 'ANY_HOST') return '';
    if (nodeId === 'ANY_INTERNET') return '';
    if (nodeId === 'ANY') return '';

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return '';

    // Only use address-list for specific nodes
    const listName = node.name.toLowerCase().replace(/\s+/g, '_');
    return `${prefix}=${listName}`;
  };

  const handleExportRules = () => {
    // Collect all unique address lists needed
    const addressLists = new Set<string>();
    rules.forEach(rule => {
      const sourceNode = nodes.find(n => n.id === rule.sourceId);
      const destNode = nodes.find(n => n.id === rule.destinationId);

      if (sourceNode) addressLists.add(sourceNode.name);
      if (destNode) addressLists.add(destNode.name);
    });

    // Generate address-list definitions
    const addressListConfig = Array.from(addressLists)
      .map(nodeName => {
        const node = nodes.find(n => n.name === nodeName);
        if (!node) return '';

        const listName = nodeName.toLowerCase().replace(/\s+/g, '_');

        if (node.type === 'internet') {
          return `# Address list for ${nodeName}\n/ip firewall address-list add list=${listName} address=0.0.0.0/0 comment="${nodeName} - adjust to actual external networks"`;
        } else if (node.type === 'vlan') {
          return `# Address list for ${nodeName}\n/ip firewall address-list add list=${listName} address=192.168.x.0/24 comment="${nodeName} - adjust to actual VLAN subnet"`;
        } else if (node.type === 'host') {
          return `# Address list for ${nodeName}\n/ip firewall address-list add list=${listName} address=192.168.x.x comment="${nodeName} - adjust to actual host IP"`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');

    const mikrotikConfig = rules
      .sort((a, b) => a.order - b.order)
      .map((rule, index) => {
        const source = getNodeName(rule.sourceId);
        const destination = getNodeName(rule.destinationId);
        const srcParam = getMikrotikAddressParam(rule.sourceId, 'src');
        const dstParam = getMikrotikAddressParam(rule.destinationId, 'dst');
        const connectionState = rule.connectionType === 'new' ? 'new' : 'established,related';
        const action = rule.action === 'allow' ? 'accept' : 'drop';

        // Generate comment for readability
        const comment = `Rule ${index + 1}: ${source} -> ${destination} (${rule.connectionType})`;

        // Build the rule with only non-empty parameters
        const params = [
          'chain=forward',
          srcParam,
          dstParam,
          `connection-state=${connectionState}`,
          `action=${action}`,
          `comment="${comment}"`
        ].filter(Boolean).join(' ');

        return `/ip firewall filter add ${params}`;
      })
      .join('\n');

    // Create full configuration file with header
    const fullConfig = `# MikroTik RouterOS Firewall Configuration
# Generated on ${new Date().toLocaleString('nl-NL')}
# Total rules: ${rules.length}
#
# INSTRUCTIONS:
# 1. First, create address lists for each network entity referenced in your rules
# 2. Update the placeholder IP addresses (192.168.x.x) with your actual network addresses
# 3. Then apply the firewall filter rules
#
# Step 1: Define Address Lists
# =============================

${addressListConfig}

# Step 2: Apply Firewall Filter Rules
# ====================================

${mikrotikConfig}

# End of configuration
`;

    // Create and download file
    const blob = new Blob([fullConfig], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firewall-rules-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Firewall Policy Selection */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Firewall Strategie (Default Policy)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Kies de standaard actie wanneer een pakket geen enkele regel matcht:
          </p>
          <Select value={firewallPolicy} onValueChange={(v: FirewallPolicy) => onPolicyChange(v)}>
            <SelectTrigger className="w-full font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border">
              <SelectItem value="block-all">
                <div className="flex items-center gap-2">
                  <ShieldX className="w-4 h-4 text-destructive" />
                  <span>Block All (Default Deny) - Veiliger</span>
                </div>
              </SelectItem>
              <SelectItem value="allow-all">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                  <span>Allow All (Default Allow) - Minder veilig</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="p-3 bg-card rounded-lg border">
            {firewallPolicy === 'block-all' ? (
              <p className="text-sm text-foreground">
                <strong className="text-destructive">Block All:</strong> Alle verkeer wordt standaard <strong>geblokkeerd</strong> tenzij expliciet toegestaan door een regel.
                Dit is de meest veilige strategie. Deze aanpak wordt gebruikt door oa Cisco.
              </p>
            ) : (
              <p className="text-sm text-foreground">
                <strong className="text-green-600">Allow All:</strong> Alle verkeer wordt standaard <strong>toegestaan</strong> tenzij expliciet geblokkeerd door een regel.
                Dit is minder veilig maar flexibeler. Deze aanpak wordt gebruikt door oa Mikrotik.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

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
                  <SelectItem value="ANY_VLAN">ANY VLAN</SelectItem>
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
                  <SelectItem value="ANY_VLAN">ANY VLAN</SelectItem>
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
            disabled={!sourceId || !destinationId}
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Firewall regels ({rules.length})</CardTitle>
              <p className="text-sm text-muted-foreground">
                Versleep regels om de volgorde aan te passen. Regels worden van boven naar beneden geëvalueerd. Standaard geldt een allow policy.
              </p>
            </div>
            {rules.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportRules}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export naar MikroTik
              </Button>
            )}
          </div>
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
