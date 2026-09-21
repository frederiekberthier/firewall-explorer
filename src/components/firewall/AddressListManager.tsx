import { useState } from 'react';
import { NetworkNode, AddressList } from '@/types/firewall';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { List, Plus, Trash2 } from 'lucide-react';

interface AddressListManagerProps {
  nodes: NetworkNode[];
  addressLists: AddressList[];
  onAddAddressList: (name: string, memberIds: string[]) => void;
  onDeleteAddressList: (id: string) => void;
}

/**
 * Lets a student group multiple VLANs/hosts into one named address list, so
 * one rule can target the whole group instead of one rule per member — the
 * "gebruik adreslijsten waar mogelijk" idiom from the course, made explicit
 * in the rule editor instead of only happening implicitly at export time.
 */
export function AddressListManager({ nodes, addressLists, onAddAddressList, onDeleteAddressList }: AddressListManagerProps) {
  const [name, setName] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const candidateNodes = nodes.filter(n => n.type === 'vlan' || n.type === 'host');

  const toggleMember = (id: string, checked: boolean) => {
    setMemberIds(prev => (checked ? [...prev, id] : prev.filter(m => m !== id)));
  };

  const handleCreate = () => {
    if (!name.trim() || memberIds.length === 0) return;
    onAddAddressList(name.trim(), memberIds);
    setName('');
    setMemberIds([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <List className="w-5 h-5" />
          Adreslijsten
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Groepeer meerdere VLAN's/hosts onder één naam, zodat je er met één regel naar kan verwijzen.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {addressLists.length > 0 && (
          <div className="space-y-2">
            {addressLists.map(list => (
              <div key={list.id} className="flex items-center gap-2 p-2 rounded-lg border border-border flex-wrap">
                <span className="font-medium text-sm">{list.name}</span>
                {list.memberIds.map(memberId => {
                  const member = nodes.find(n => n.id === memberId);
                  return member ? (
                    <Badge key={memberId} variant="outline" className="text-xs">{member.name}</Badge>
                  ) : null;
                })}
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDeleteAddressList(list.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {candidateNodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Voeg eerst VLAN's of hosts toe om een adreslijst te kunnen maken.</p>
        ) : (
          <div className="space-y-3 pt-2 border-t border-border/50">
            <Input
              placeholder="Naam van de lijst, bv. trusted-devices"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {candidateNodes.map(node => (
                <label
                  key={node.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={memberIds.includes(node.id)}
                    onCheckedChange={(checked) => toggleMember(node.id, checked === true)}
                  />
                  <span className="text-sm">{node.name}</span>
                </label>
              ))}
            </div>
            <Button size="sm" onClick={handleCreate} disabled={!name.trim() || memberIds.length === 0}>
              <Plus className="w-4 h-4 mr-2" />
              Lijst aanmaken
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
