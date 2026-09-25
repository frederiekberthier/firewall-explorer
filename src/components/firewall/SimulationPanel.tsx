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
import { checkRules as evaluatePacket, RuleCheckResult } from '@/lib/firewallEngine';

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

type SimPhase = 'idle' | 'request' | 'checking' | 'response' | 'reply-checking' | 'complete';

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
  const [ruleChecks, setRuleChecks] = useState<RuleCheckResult[]>([]);
  const [currentCheckIndex, setCurrentCheckIndex] = useState<number>(-1);
  const [replyChecks, setReplyChecks] = useState<RuleCheckResult[]>([]);
  const [currentReplyCheckIndex, setCurrentReplyCheckIndex] = useState<number>(-1);
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
  const getNodeName = (id: string) => getNodeNameForNodes(nodes, id, addressLists);

  // Thin wrapper around the pure engine (src/lib/firewallEngine.ts) — the
  // actual matching/evaluation logic lives there so it has no React
  // dependency and can be unit-tested or reused by a future batch grader.
  const checkRules = useCallback((srcId: string, dstId: string, isReply: boolean): RuleCheckResult[] =>
    evaluatePacket({ nodes, rules, addressLists, firewallPolicy, sourceId: srcId, destinationId: dstId, isReply }),
    [nodes, rules, addressLists, firewallPolicy]);

  const startSimulation = useCallback(() => {
    if (!sourceId || !destinationId) return;

    setPhase('request');
    setRuleChecks([]);
    setCurrentCheckIndex(-1);
    setReplyChecks([]);
    setCurrentReplyCheckIndex(-1);
    setFinalResult(null);
    setFinalNote(null);
    onActiveRuleChange?.(null);

    onSimulationChange({
      id: `sim-${Date.now()}`,
      sourceId,
      destinationId,
      progress: 0,
      direction: 'request',
      status: 'traveling'
    });

    // Simulate packet traveling to router
    setTimeout(() => {
      setPhase('checking');
      const checks = checkRules(sourceId, destinationId, false);
      setRuleChecks(checks);
      setCurrentCheckIndex(0);
    }, 1500);
  }, [sourceId, destinationId, checkRules, onSimulationChange, onActiveRuleChange]);

  // A rule id of 'security-internet-block' / 'default' is a synthetic fallback,
  // not an actual entry in the rule list, so it has nothing to highlight there.
  const notifyActiveRule = useCallback((ruleId: string) => {
    onActiveRuleChange?.(ruleId === 'security-internet-block' || ruleId === 'default' ? null : ruleId);
  }, [onActiveRuleChange]);

  // Animate through rule checks for the outgoing (new) request
  useEffect(() => {
    if (phase !== 'checking' || currentCheckIndex < 0) return;

    const timer = setTimeout(() => {
      const check = ruleChecks[currentCheckIndex];

      if (check.matched) {
        notifyActiveRule(check.ruleId);

        if (check.action === 'allow') {
          // Connection accepted: register it in the connection table (conntrack)
          // so the reply can later be evaluated as established/related traffic.
          setConnectionTable(prev => [
            ...prev,
            { id: `conn-${Date.now()}`, sourceId, destinationId, state: 'established' }
          ]);
          setFinalResult('allowed');

          setPhase('response');
          onSimulationChange({
            id: `sim-${Date.now()}`,
            sourceId: destinationId,
            destinationId: sourceId,
            progress: 0,
            direction: 'reply',
            status: 'traveling'
          });

          setTimeout(() => {
            setPhase('reply-checking');
            const replyResult = checkRules(sourceId, destinationId, true);
            setReplyChecks(replyResult);
            setCurrentReplyCheckIndex(0);
          }, 1500);
        } else {
          setFinalResult('dropped');
          if (check.action === 'reject') {
            setFinalNote(
              'De regel gebruikt REJECT: de firewall stuurt een actieve weigering terug ' +
              '(bv. "destination unreachable"), in tegenstelling tot DROP dat het pakket stil negeert.'
            );
          }
          setPhase('complete');
          onSimulationChange(null);
        }
      } else if (currentCheckIndex < ruleChecks.length - 1) {
        setCurrentCheckIndex(prev => prev + 1);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [phase, currentCheckIndex, ruleChecks, sourceId, destinationId, checkRules, onSimulationChange, notifyActiveRule]);

  // Animate through rule checks for the reply packet — this is the part that
  // used to be skipped entirely, which made every accepted request look
  // successful even without a matching established/related rule.
  useEffect(() => {
    if (phase !== 'reply-checking' || currentReplyCheckIndex < 0) return;

    const timer = setTimeout(() => {
      const check = replyChecks[currentReplyCheckIndex];

      if (check.matched) {
        if (check.action === 'drop' || check.action === 'reject') {
          setFinalResult('dropped');
          notifyActiveRule(check.ruleId);
          setFinalNote(
            check.action === 'reject'
              ? 'Het verzoek werd toegelaten, maar het antwoordpakket werd actief geweigerd (REJECT): ' +
                'er is geen regel die established/related verkeer voor deze verbinding toestaat.'
              : 'Het verzoek werd toegelaten, maar het antwoordpakket werd geblokkeerd: ' +
                'er is geen regel die established/related verkeer voor deze verbinding toestaat.'
          );
        } else {
          notifyActiveRule(check.ruleId);
        }
        setPhase('complete');
        onSimulationChange(null);
      } else if (currentReplyCheckIndex < replyChecks.length - 1) {
        setCurrentReplyCheckIndex(prev => prev + 1);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [phase, currentReplyCheckIndex, replyChecks, onSimulationChange, notifyActiveRule]);

  const resetSimulation = () => {
    setPhase('idle');
    setRuleChecks([]);
    setCurrentCheckIndex(-1);
    setReplyChecks([]);
    setCurrentReplyCheckIndex(-1);
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
            {/* Phase indicator */}
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg",
                phase === 'request' ? "bg-primary/20 text-primary" : "bg-muted"
              )}>
                <ArrowRight className="w-4 h-4" />
                <span className="text-sm font-medium">Request</span>
              </div>

              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg",
                phase === 'checking' ? "bg-primary/20 text-primary" : "bg-muted"
              )}>
                <ShieldCheck className="w-4 h-4" />
                <span className="text-sm font-medium">Regel check</span>
              </div>

              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg",
                (phase === 'response' || phase === 'reply-checking') ? "bg-primary/20 text-primary" : "bg-muted"
              )}>
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Reply</span>
              </div>
            </div>

            {/* Rule checks for the outgoing (new) request */}
            {ruleChecks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Firewall regel evaluatie — verzoek (new):</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {ruleChecks.slice(0, currentCheckIndex + 1).map((check, idx) => (
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
            )}

            {/* Rule checks for the reply packet (established/related) */}
            {replyChecks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Firewall regel evaluatie — antwoord (established/related):</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {replyChecks.slice(0, currentReplyCheckIndex + 1).map((check, idx) => (
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
            )}

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
              Enkel antwoordverkeer op een reeds bestaande verbinding kan matchen als
              <strong> established</strong> of <strong>related</strong>.
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
