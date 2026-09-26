import { useState, useEffect, useCallback, useId } from 'react';
import { NetworkNode, FirewallRule, SimulationPacket, FirewallPolicy, AddressList } from '@/types/firewall';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, RotateCcw, ShieldCheck, ShieldX, ShieldAlert, ArrowRight, ArrowLeft, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNodeName as getNodeNameForNodes } from '@/lib/nodeNames';
import { evaluateConnection, ConnectionEvaluation, ConnectionStage, RuleCheckResult, OUTPUT_CHAIN_RULE_ID } from '@/lib/firewallEngine';

interface SimulationPanelProps {
  nodes: NetworkNode[];
  rules: FirewallRule[];
  firewallPolicy: FirewallPolicy;
  addressLists?: AddressList[];
  simulation: SimulationPacket | null;
  onSimulationChange: (packet: SimulationPacket | null) => void;
  onActiveRuleChange?: (ruleId: string | null) => void;
}

interface ConnectionEntry {
  id: string;
  sourceId: string;
  destinationId: string;
  state: 'established';
}

// 'traveling': the packet of the current stage is on its way (animation);
// 'checking': the firewall walks through the rules for that packet.
type SimPhase = 'idle' | 'traveling' | 'checking' | 'complete';

// The three packets a stateful firewall sees for one connection (as in a TCP
// handshake). All three must pass, as on a real router.
const STAGES: ConnectionStage[] = ['request', 'reply', 'followUp'];
const STAGE_INFO: Record<ConnectionStage, { label: string; title: string }> = {
  request: { label: 'Verzoek', title: 'verzoek (new)' },
  reply: { label: 'Antwoord', title: 'antwoord (established)' },
  followUp: { label: 'Vervolg', title: 'vervolgpakketten (established)' }
};
const NO_CHECKS_SHOWN: Record<ConnectionStage, number> = { request: -1, reply: -1, followUp: -1 };

// Synthetic results (security rule, default policy, chain output) are not
// entries in the rule list, so there is nothing to highlight for them.
const SYNTHETIC_RULE_IDS = ['security-internet-block', 'default', OUTPUT_CHAIN_RULE_ID];

function CheckList({ title, checks, shown }: { title: string; checks: RuleCheckResult[]; shown: number }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {checks.slice(0, shown + 1).map((check, idx) => (
          <div
            key={idx}
            className={cn(
              "p-3 rounded-lg border text-sm transition-all",
              check.matched && check.action === 'allow' && "bg-primary/10 border-primary/30",
              check.matched && (check.action === 'drop' || check.action === 'reject') && "bg-destructive/10 border-destructive/30",
              !check.matched && "bg-muted/50 border-border"
            )}
          >
            <div className="flex items-start gap-2">
              {check.matched ? (
                check.action === 'allow' ? (
                  <ShieldCheck className="w-4 h-4 text-primary mt-0.5" />
                ) : check.action === 'reject' ? (
                  <ShieldAlert className="w-4 h-4 text-destructive mt-0.5" />
                ) : (
                  <ShieldX className="w-4 h-4 text-destructive mt-0.5" />
                )
              ) : (
                <span className="w-4 h-4 text-muted-foreground">→</span>
              )}
              <span>{check.reason}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SimulationPanel({
  nodes,
  rules,
  firewallPolicy,
  addressLists = [],
  simulation,
  onSimulationChange,
  onActiveRuleChange
}: SimulationPanelProps) {
  const fieldId = useId();
  const [sourceId, setSourceId] = useState<string>('');
  const [destinationId, setDestinationId] = useState<string>('');
  const [evaluation, setEvaluation] = useState<ConnectionEvaluation | null>(null);
  const [stage, setStage] = useState<ConnectionStage>('request');
  // Per stage: index of the last rule check revealed so far (-1 = none yet).
  const [shownChecks, setShownChecks] = useState<Record<ConnectionStage, number>>(NO_CHECKS_SHOWN);
  const [finalResult, setFinalResult] = useState<'allowed' | 'dropped' | null>(null);
  const [finalNote, setFinalNote] = useState<string | null>(null);
  const [connectionTable, setConnectionTable] = useState<ConnectionEntry[]>([]);
  const [phase, setPhase] = useState<SimPhase>('idle');

  const availableNodes = nodes.filter(n => n.type !== 'router');
  const routerNode = nodes.find(n => n.type === 'router');
  // The router is an optional simulation destination — testing "can this
  // host/VLAN reach the router itself" (chain input) is opt-in, not a
  // required part of the inter-VLAN/host traffic this simulator focuses on.
  const destinationNodes = routerNode ? [...availableNodes, routerNode] : availableNodes;
  const getNodeName = useCallback((id: string) => getNodeNameForNodes(nodes, id, addressLists), [nodes, addressLists]);

  // The whole connection is evaluated up front by the pure engine
  // (src/lib/firewallEngine.ts); this component only animates the result
  // stage by stage.
  const packetFor = useCallback((forStage: ConnectionStage): SimulationPacket => {
    const isReply = forStage === 'reply';
    return {
      id: `sim-${Date.now()}`,
      sourceId: isReply ? destinationId : sourceId,
      destinationId: isReply ? sourceId : destinationId,
      progress: 0,
      direction: isReply ? 'reply' : 'request',
      status: 'traveling'
    };
  }, [sourceId, destinationId]);

  const startSimulation = useCallback(() => {
    if (!sourceId || !destinationId) return;

    setEvaluation(evaluateConnection({ nodes, rules, addressLists, firewallPolicy, sourceId, destinationId }));
    setStage('request');
    setShownChecks(NO_CHECKS_SHOWN);
    setFinalResult(null);
    setFinalNote(null);
    onActiveRuleChange?.(null);
    onSimulationChange(packetFor('request'));
    setPhase('traveling');
  }, [sourceId, destinationId, nodes, rules, addressLists, firewallPolicy, onSimulationChange, onActiveRuleChange, packetFor]);

  const notifyActiveRule = useCallback((ruleId: string) => {
    onActiveRuleChange?.(SYNTHETIC_RULE_IDS.includes(ruleId) ? null : ruleId);
  }, [onActiveRuleChange]);

  // Packet travel animation; the cleanup cancels it when the simulation is
  // reset or restarted mid-way.
  useEffect(() => {
    if (phase !== 'traveling') return;
    const timer = setTimeout(() => {
      setShownChecks(prev => ({ ...prev, [stage]: 0 }));
      setPhase('checking');
    }, 1500);
    return () => clearTimeout(timer);
  }, [phase, stage]);

  // Walk through the rule checks of the current stage, one per tick.
  useEffect(() => {
    if (phase !== 'checking' || !evaluation) return;
    const checks = evaluation[stage];
    const index = shownChecks[stage];
    if (!checks || index < 0) return;

    const timer = setTimeout(() => {
      const check = checks[index];

      if (!check.matched) {
        if (index < checks.length - 1) setShownChecks(prev => ({ ...prev, [stage]: index + 1 }));
        return;
      }

      notifyActiveRule(check.ruleId);

      if (check.action === 'allow') {
        if (stage === 'request') {
          // Connection accepted: register it in the connection table (conntrack)
          // so the next packets can be evaluated as established traffic.
          setConnectionTable(prev => [
            ...prev,
            { id: `conn-${Date.now()}`, sourceId, destinationId, state: 'established' }
          ]);
        }
        const next = STAGES[STAGES.indexOf(stage) + 1];
        if (next && evaluation[next]) {
          setStage(next);
          onSimulationChange(packetFor(next));
          setPhase('traveling');
        } else {
          setFinalResult('allowed');
          setPhase('complete');
          onSimulationChange(null);
        }
        return;
      }

      // drop or reject
      const src = getNodeName(sourceId);
      const dst = getNodeName(destinationId);
      const refused = check.action === 'reject' ? 'actief geweigerd (REJECT)' : 'geblokkeerd';
      setFinalResult('dropped');
      if (stage === 'request') {
        if (check.action === 'reject') {
          setFinalNote(
            'De regel gebruikt REJECT: de firewall stuurt een actieve weigering terug ' +
            '(bv. "destination unreachable"), in tegenstelling tot DROP dat het pakket stil negeert.'
          );
        }
      } else if (stage === 'reply') {
        setFinalNote(
          `Het verzoek werd toegelaten, maar het antwoord (${dst} → ${src}) werd ${refused}: ` +
          'er is geen regel die established/related verkeer in die richting toestaat.'
        );
      } else {
        setFinalNote(
          `Verzoek en antwoord kwamen door, maar de vervolgpakketten van ${src} (${src} → ${dst}, established) ` +
          `werden ${refused}. Op een echte router breekt de verbinding dan af: ook de client stuurt na het ` +
          'eerste pakket established verkeer, dus ook die richting heeft een established-regel nodig.'
        );
      }
      setPhase('complete');
      onSimulationChange(null);
    }, 1200);

    return () => clearTimeout(timer);
  }, [phase, stage, shownChecks, evaluation, sourceId, destinationId, onSimulationChange, notifyActiveRule, packetFor, getNodeName]);

  const resetSimulation = () => {
    setPhase('idle');
    setEvaluation(null);
    setStage('request');
    setShownChecks(NO_CHECKS_SHOWN);
    setFinalResult(null);
    setFinalNote(null);
    onActiveRuleChange?.(null);
    onSimulationChange(null);
  };

  return (
    <div className="space-y-6">
      {/* Control panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="w-5 h-5" />
            Simuleer communicatie
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show current firewall policy */}
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 text-sm">
              {firewallPolicy === 'block-all' ? (
                <>
                  <ShieldX className="w-4 h-4 text-destructive" />
                  <span className="font-medium">Actieve policy:</span>
                  <Badge variant="destructive">Block All (Default Deny)</Badge>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                  <span className="font-medium">Actieve policy:</span>
                  <Badge className="bg-green-600">Allow All (Default Allow)</Badge>
                </>
              )}
            </div>
          </div>

          {/* Security rule info */}
          <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <div className="flex items-start gap-2">
              <ShieldX className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-foreground">
                <strong className="text-orange-600">Security regel:</strong> Nieuw verkeer van Internet naar
                interne netwerken (VLAN/Host) wordt <strong>altijd geblokkeerd</strong>, tenzij je
                een expliciete ALLOW regel hebt gemaakt.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor={`${fieldId}-source`} className="text-sm font-medium">Bron</label>
              <Select value={sourceId} onValueChange={setSourceId} disabled={phase !== 'idle'}>
                <SelectTrigger id={`${fieldId}-source`}>
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
              <label htmlFor={`${fieldId}-destination`} className="text-sm font-medium">Doel</label>
              <Select value={destinationId} onValueChange={setDestinationId} disabled={phase !== 'idle'}>
                <SelectTrigger id={`${fieldId}-destination`}>
                  <SelectValue placeholder="Selecteer..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  {destinationNodes.filter(n => n.id !== sourceId).map(node => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.type === 'router' ? `${node.name} (beheer)` : node.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={startSimulation}
              disabled={!sourceId || !destinationId || phase !== 'idle'}
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              Start simulatie
            </Button>

            <Button
              variant="outline"
              onClick={resetSimulation}
              disabled={phase === 'idle'}
              aria-label="Simulatie resetten"
              title="Simulatie resetten"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Simulation status */}
      {phase !== 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Simulatie status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stage indicator: the three packets of one connection */}
            <div className="flex flex-wrap items-center gap-2">
              {STAGES.map((st, idx) => (
                <div key={st} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg",
                      phase !== 'complete' && stage === st ? "bg-primary/20 text-primary" : "bg-muted"
                    )}
                    aria-current={phase !== 'complete' && stage === st ? 'step' : undefined}
                  >
                    {st === 'reply' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    <span className="text-sm font-medium">{STAGE_INFO[st].label}</span>
                  </div>
                  {idx < STAGES.length - 1 && <span className="text-muted-foreground" aria-hidden="true">›</span>}
                </div>
              ))}
            </div>

            {/* Rule checks per stage, with the packet's real direction */}
            {evaluation && STAGES.map(st => {
              const checks = evaluation[st];
              if (!checks || shownChecks[st] < 0) return null;
              const [from, to] = st === 'reply' ? [destinationId, sourceId] : [sourceId, destinationId];
              return (
                <CheckList
                  key={st}
                  title={`Firewall regel evaluatie — ${STAGE_INFO[st].title}: ${getNodeName(from)} → ${getNodeName(to)}`}
                  checks={checks}
                  shown={shownChecks[st]}
                />
              );
            })}

            {/* Final result */}
            {phase === 'complete' && finalResult && (
              <div className={cn(
                "p-4 rounded-lg text-center space-y-2",
                finalResult === 'allowed' ? "bg-primary/20" : "bg-destructive/20"
              )}>
                <Badge
                  className={cn(
                    "text-lg py-2 px-4",
                    finalResult === 'allowed'
                      ? "bg-primary text-primary-foreground"
                      : "bg-destructive text-destructive-foreground"
                  )}
                >
                  {finalResult === 'allowed' ? (
                    <>
                      <ShieldCheck className="w-5 h-5 mr-2" />
                      Communicatie TOEGESTAAN
                    </>
                  ) : (
                    <>
                      <ShieldX className="w-5 h-5 mr-2" />
                      Communicatie GEBLOKKEERD
                    </>
                  )}
                </Badge>
                {finalNote && (
                  <p className="text-xs text-muted-foreground">{finalNote}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Connection table (conntrack) */}
      {connectionTable.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Network className="w-5 h-5" />
              Connectietabel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Verbindingen die door een <strong>new</strong>-regel zijn toegelaten, worden hier bijgehouden.
              Alle volgende pakketten van zo'n verbinding — het antwoord én de vervolgpakketten van de
              client — hebben de state <strong>established</strong> (of <strong>related</strong>).
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bron</TableHead>
                  <TableHead>Bestemming</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connectionTable.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>{getNodeName(entry.sourceId)}</TableCell>
                    <TableCell>{getNodeName(entry.destinationId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">established</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
