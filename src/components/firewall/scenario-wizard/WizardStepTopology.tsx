import { useState } from 'react';
import { WizardDraft, WizardVlan, findTopologyNameIssues } from '@/lib/scenarioWizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, X, Network, Globe } from 'lucide-react';

interface WizardStepTopologyProps {
  draft: WizardDraft;
  onChange: (updates: Partial<WizardDraft>) => void;
}

export function WizardStepTopology({ draft, onChange }: WizardStepTopologyProps) {
  const [newHostByVlan, setNewHostByVlan] = useState<Record<number, string>>({});

  const updateVlans = (vlans: WizardVlan[]) => onChange({ vlans });

  const addVlan = () => updateVlans([...draft.vlans, { name: '', hosts: [] }]);

  const updateVlanName = (index: number, name: string) => {
    updateVlans(draft.vlans.map((v, i) => (i === index ? { ...v, name } : v)));
  };

  const removeVlan = (index: number) => {
    updateVlans(draft.vlans.filter((_, i) => i !== index));
  };

  const addHost = (vlanIndex: number) => {
    const hostName = (newHostByVlan[vlanIndex] ?? '').trim();
    if (!hostName) return;
    updateVlans(draft.vlans.map((v, i) => (i === vlanIndex ? { ...v, hosts: [...v.hosts, hostName] } : v)));
    setNewHostByVlan(prev => ({ ...prev, [vlanIndex]: '' }));
  };

  const removeHost = (vlanIndex: number, hostIndex: number) => {
    updateVlans(draft.vlans.map((v, i) =>
      i === vlanIndex ? { ...v, hosts: v.hosts.filter((_, hi) => hi !== hostIndex) } : v
    ));
  };

  const issues = findTopologyNameIssues(draft.vlans);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Bouw het netwerk op met VLAN's en hosts — dit wordt automatisch aangemaakt (met echte
        subnetten) zodra je het scenario laadt.
      </p>

      <label className="flex items-center gap-2 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50 w-fit">
        <Checkbox
          checked={draft.internet}
          onCheckedChange={(checked) => onChange({ internet: checked === true })}
        />
        <Globe className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">Dit netwerk heeft internettoegang</span>
      </label>

      <div className="space-y-3">
        {draft.vlans.map((vlan, vlanIndex) => (
          <Card key={vlanIndex}>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-3">
              <Network className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input
                placeholder="VLAN-naam, bv. DATA"
                value={vlan.name}
                onChange={(e) => updateVlanName(vlanIndex, e.target.value)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeVlan(vlanIndex)}
                aria-label="VLAN verwijderen"
                className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {vlan.hosts.map((host, hostIndex) => (
                  <Badge key={hostIndex} variant="outline" className="flex items-center gap-1 pr-1">
                    {host}
                    <button
                      onClick={() => removeHost(vlanIndex, hostIndex)}
                      aria-label={`${host} verwijderen`}
                      className="hover:bg-muted rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Hostnaam toevoegen, bv. PC 1"
                  value={newHostByVlan[vlanIndex] ?? ''}
                  onChange={(e) => setNewHostByVlan(prev => ({ ...prev, [vlanIndex]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHost(vlanIndex); } }}
                  // Committing only on Enter/click-+ meant a typed-but-not-
                  // submitted host name silently vanished if you moved on
                  // (e.g. clicked "Volgende") without noticing — add it on
                  // blur too, so leaving the field never loses text.
                  onBlur={() => addHost(vlanIndex)}
                  className="h-8 text-sm"
                />
                <Button variant="outline" size="sm" onClick={() => addHost(vlanIndex)} aria-label="Host toevoegen">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addVlan}>
        <Plus className="w-4 h-4 mr-2" />
        VLAN toevoegen
      </Button>

      {issues.length > 0 && (
        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-1">
          {issues.map((issue, i) => (
            <p key={i} className="text-sm text-destructive">{issue}</p>
          ))}
        </div>
      )}
    </div>
  );
}
