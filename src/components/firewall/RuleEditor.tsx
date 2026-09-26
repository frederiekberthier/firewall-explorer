import { useState, useEffect, useId } from 'react';
import { NetworkNode, FirewallRule, FirewallPolicy, ConnState, RuleAction, AddressList } from '@/types/firewall';
import { Scenario } from '@/types/scenario';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, GripVertical, Plus, ShieldCheck, ShieldX, ShieldAlert, ArrowRight, Download, Shield, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNodeName as getNodeNameForNodes } from '@/lib/nodeNames';
import { buildMikrotikConfig } from '@/lib/mikrotikExport';
import { ScenarioSelfTest } from './ScenarioSelfTest';
import { AddressListManager } from './AddressListManager';

const CONNECTION_STATE_OPTIONS: { value: ConnState; label: string; hint: string }[] = [
  { value: 'new', label: 'New', hint: 'eerste pakket van een nieuwe verbinding' },
  { value: 'established', label: 'Established', hint: 'antwoord op een bestaande verbinding' },
  { value: 'related', label: 'Related', hint: 'hoort bij een bestaande verbinding (bv. ICMP-fout, FTP-data)' },
  { value: 'invalid', label: 'Invalid', hint: 'kan niet aan een verbinding gekoppeld worden' },
  { value: 'untracked', label: 'Untracked', hint: 'connection tracking staat uit voor dit verkeer' },
];

interface RuleEditorProps {
  nodes: NetworkNode[];
  rules: FirewallRule[];
  firewallPolicy: FirewallPolicy;
  activeScenario?: Scenario | null;
  addressLists: AddressList[];
  onPolicyChange: (policy: FirewallPolicy) => void;
  onAddRule: (rule: Omit<FirewallRule, 'id' | 'order'>) => void;
  onDeleteRule: (id: string) => void;
  onReorderRules: (startIndex: number, endIndex: number) => void;
  onAddAddressList: (name: string, memberIds: string[]) => void;
  onDeleteAddressList: (id: string) => void;
}

export function RuleEditor({
  nodes,
  rules,
  firewallPolicy,
  activeScenario,
  addressLists,
  onPolicyChange,
  onAddRule,
  onDeleteRule,
  onReorderRules,
  onAddAddressList,
  onDeleteAddressList
}: RuleEditorProps) {
  const [sourceId, setSourceId] = useState<string>('');
  const [destinationId, setDestinationId] = useState<string>('');
  const [connectionStates, setConnectionStates] = useState<ConnState[]>(['new']);
  const [action, setAction] = useState<RuleAction>('allow');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Set by the up/down buttons: which button should get focus back once the
  // moved rule has re-rendered at its new position.
  const [pendingFocus, setPendingFocus] = useState<{ ruleId: string; direction: 'up' | 'down' } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const fieldId = useId();

  const availableNodes = nodes.filter(n => n.type !== 'router');
  const routerNode = nodes.find(n => n.type === 'router');
  // The router is an optional destination — most rules are inter-VLAN/host
  // traffic and never need it. Choosing it lets you (optionally) practice
  // "who may manage the router" (chain input), without forcing that on
  // anyone who just wants forward rules between VLANs/hosts.
  const destinationNodes = routerNode ? [...availableNodes, routerNode] : availableNodes;

  const isWildcardId = (id: string) => id.startsWith('ANY');

  const toggleConnectionState = (state: ConnState, checked: boolean) => {
    setConnectionStates(prev =>
      checked ? [...prev, state] : prev.filter(s => s !== state)
    );
  };

  const handleAddRule = () => {
    if (!sourceId || !destinationId || connectionStates.length === 0) return;
    // Allow same source and destination if one is a wildcard
    if (sourceId === destinationId && !isWildcardId(sourceId)) return;

    onAddRule({
      sourceId,
      destinationId,
      connectionStates,
      action
    });

    setSourceId('');
    setDestinationId('');
  };

  const getNodeName = (id: string) => getNodeNameForNodes(nodes, id, addressLists);

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

  // Keyboard/touch alternative to drag-and-drop: move a rule one place.
  const moveRule = (ruleId: string, index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= rules.length) return;
    onReorderRules(index, target);
    setPendingFocus({ ruleId, direction });
    setAnnouncement(`Regel ${index + 1} verplaatst naar positie ${target + 1} van ${rules.length}.`);
  };

  // React may re-insert the moved row's DOM node, which drops focus; put it
  // back on the same button, or on its sibling once the rule hits the top/bottom.
  useEffect(() => {
    if (!pendingFocus) return;
    const { ruleId, direction } = pendingFocus;
    const other = direction === 'up' ? 'down' : 'up';
    const button = document.getElementById(`${fieldId}-${ruleId}-${direction}`) as HTMLButtonElement | null;
    const fallback = document.getElementById(`${fieldId}-${ruleId}-${other}`) as HTMLButtonElement | null;
    (button && !button.disabled ? button : fallback)?.focus();
    setPendingFocus(null);
  }, [rules, pendingFocus, fieldId]);

  const handleExportRules = () => {
    const fullConfig = buildMikrotikConfig({ nodes, rules, addressLists, firewallPolicy });

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
            <SelectTrigger className="w-full font-medium" aria-label="Default policy">
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

      {/* Security rule warning */}
      <Card className="border-2 border-orange-500/30 bg-orange-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <ShieldX className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-semibold text-orange-600">Belangrijke Security Regel</h4>
              <p className="text-sm text-foreground">
                Nieuw verkeer van <strong>Internet</strong> naar interne netwerken (<strong>VLAN</strong> of <strong>Host</strong>)
                wordt <strong>altijd standaard geblokkeerd</strong>, ongeacht de gekozen firewall strategie.
              </p>
              <p className="text-sm text-foreground">
                💡 Wil je inkomend internetverkeer toestaan? Maak dan een expliciete <strong className="text-green-600">ALLOW</strong> regel
                met Internet als bron en je VLAN of Host als bestemming.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddressListManager
        nodes={nodes}
        addressLists={addressLists}
        onAddAddressList={onAddAddressList}
        onDeleteAddressList={onDeleteAddressList}
      />

      {/* Add rule form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nieuwe regel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor={`${fieldId}-source`} className="text-sm font-medium">Bron</label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger id={`${fieldId}-source`}>
                  <SelectValue placeholder="Selecteer..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  <SelectItem value="ANY_VLAN">ANY VLAN</SelectItem>
                  {availableNodes.map(node => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.name}
                    </SelectItem>
                  ))}
                  {addressLists.map(list => (
                    <SelectItem key={list.id} value={list.id}>
                      📋 {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor={`${fieldId}-destination`} className="text-sm font-medium">Doel</label>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger id={`${fieldId}-destination`}>
                  <SelectValue placeholder="Selecteer..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  <SelectItem value="ANY_VLAN">ANY VLAN</SelectItem>
                  {destinationNodes.filter(n => n.id !== sourceId).map(node => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.type === 'router' ? `${node.name} (beheer)` : node.name}
                    </SelectItem>
                  ))}
                  {addressLists.filter(l => l.id !== sourceId).map(list => (
                    <SelectItem key={list.id} value={list.id}>
                      📋 {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {routerNode && destinationId === routerNode.id && (
                <p className="text-xs text-muted-foreground">
                  Optioneel: dit is een chain <strong>input</strong>-regel (toegang tot de router zelf), geen
                  verplicht onderdeel — de meeste oefeningen gebruiken enkel VLAN/host-bestemmingen.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor={`${fieldId}-action`} className="text-sm font-medium">Actie</label>
              <Select value={action} onValueChange={(v: RuleAction) => setAction(v)}>
                <SelectTrigger id={`${fieldId}-action`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  <SelectItem value="allow">Allow</SelectItem>
                  <SelectItem value="drop">Drop</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                </SelectContent>
              </Select>
              {action === 'reject' && (
                <p className="text-xs text-muted-foreground">
                  Reject stuurt een actieve weigering terug; Drop negeert het pakket stil.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <span id={`${fieldId}-states`} className="text-sm font-medium">Connection state(s)</span>
            <div role="group" aria-labelledby={`${fieldId}-states`} className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {CONNECTION_STATE_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className="flex items-start gap-2 p-2 rounded-lg border border-border cursor-pointer hover:bg-muted/50"
                  title={opt.hint}
                >
                  <Checkbox
                    checked={connectionStates.includes(opt.value)}
                    onCheckedChange={(checked) => toggleConnectionState(opt.value, checked === true)}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
            {connectionStates.length === 0 && (
              <p className="text-xs text-destructive">Selecteer minstens één connection state.</p>
            )}
          </div>

          <Button
            onClick={handleAddRule}
            disabled={!sourceId || !destinationId || connectionStates.length === 0}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Firewall regels ({rules.length})</CardTitle>
              <p className="text-sm text-muted-foreground">
                Versleep regels of gebruik de pijltjes om de volgorde aan te passen. Regels worden van boven naar beneden geëvalueerd. Matcht geen enkele regel, dan geldt je default policy:{' '}
                <strong>{firewallPolicy === 'block-all' ? 'Block All' : 'Allow All'}</strong>.
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
              <p className="sr-only" aria-live="polite">{announcement}</p>
              {[...rules].sort((a, b) => a.order - b.order).map((rule, index) => (
                <div
                  key={rule.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "flex items-center gap-2 sm:gap-3 p-3 rounded-lg border bg-card transition-all",
                    dragIndex === index && "opacity-50 scale-95"
                  )}
                >
                  <GripVertical className="hidden sm:block w-4 h-4 flex-shrink-0 text-muted-foreground cursor-grab" aria-hidden="true" />

                  <div className="flex flex-col flex-shrink-0">
                    <Button
                      id={`${fieldId}-${rule.id}-up`}
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={() => moveRule(rule.id, index, 'up')}
                      aria-label={`Regel ${index + 1} omhoog verplaatsen`}
                      title="Omhoog"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      id={`${fieldId}-${rule.id}-down`}
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === rules.length - 1}
                      onClick={() => moveRule(rule.id, index, 'down')}
                      aria-label={`Regel ${index + 1} omlaag verplaatsen`}
                      title="Omlaag"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>

                  <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center bg-muted rounded text-xs font-mono">
                    {index + 1}
                  </span>

                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{getNodeName(rule.sourceId)}</Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <Badge variant="outline">{getNodeName(rule.destinationId)}</Badge>

                    {nodes.find(n => n.id === rule.destinationId)?.type === 'router' && (
                      <Badge variant="outline" className="border-dashed">chain: input</Badge>
                    )}

                    {rule.connectionStates.map(state => (
                      <Badge key={state} variant="secondary" className="ml-2">
                        {state}
                      </Badge>
                    ))}

                    <Badge
                      className={cn(
                        rule.action === 'allow'
                          ? 'bg-primary/20 text-primary border-primary/30'
                          : 'bg-destructive/20 text-destructive border-destructive/30'
                      )}
                    >
                      {rule.action === 'allow' ? (
                        <ShieldCheck className="w-3 h-3 mr-1" />
                      ) : rule.action === 'reject' ? (
                        <ShieldAlert className="w-3 h-3 mr-1" />
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
                    aria-label={`Regel ${index + 1} verwijderen`}
                    title="Verwijderen"
                    className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {activeScenario && (
        <ScenarioSelfTest
          scenario={activeScenario}
          nodes={nodes}
          rules={rules}
          firewallPolicy={firewallPolicy}
          addressLists={addressLists}
        />
      )}
    </div>
  );
}
