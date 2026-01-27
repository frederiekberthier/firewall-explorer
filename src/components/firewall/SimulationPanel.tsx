import { useState, useEffect, useCallback } from 'react';
import { NetworkNode, FirewallRule, SimulationPacket } from '@/types/firewall';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, RotateCcw, ShieldCheck, ShieldX, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimulationPanelProps {
  nodes: NetworkNode[];
  rules: FirewallRule[];
  simulation: SimulationPacket | null;
  onSimulationChange: (packet: SimulationPacket | null) => void;
}

interface RuleCheckResult {
  ruleId: string;
  matched: boolean;
  action: 'allow' | 'drop' | 'continue';
  reason: string;
}

export function SimulationPanel({
  nodes,
  rules,
  simulation,
  onSimulationChange
}: SimulationPanelProps) {
  const [sourceId, setSourceId] = useState<string>('');
  const [destinationId, setDestinationId] = useState<string>('');
  const [ruleChecks, setRuleChecks] = useState<RuleCheckResult[]>([]);
  const [currentCheckIndex, setCurrentCheckIndex] = useState<number>(-1);
  const [finalResult, setFinalResult] = useState<'allowed' | 'dropped' | null>(null);
  const [phase, setPhase] = useState<'idle' | 'request' | 'checking' | 'response' | 'complete'>('idle');

  const availableNodes = nodes.filter(n => n.type !== 'router');
  const getNodeName = (id: string) => nodes.find(n => n.id === id)?.name || 'Onbekend';

  const checkRules = useCallback((srcId: string, dstId: string, isReply: boolean): RuleCheckResult[] => {
    const results: RuleCheckResult[] = [];
    
    for (const rule of rules.sort((a, b) => a.order - b.order)) {
      const srcName = getNodeName(rule.sourceId);
      const dstName = getNodeName(rule.destinationId);
      const packetSrcName = getNodeName(srcId);
      const packetDstName = getNodeName(dstId);

      // Check if rule matches this packet
      const directMatch = rule.sourceId === srcId && rule.destinationId === dstId;
      const reverseMatch = rule.sourceId === dstId && rule.destinationId === srcId;
      
      if (directMatch && rule.connectionType === 'new' && !isReply) {
        results.push({
          ruleId: rule.id,
          matched: true,
          action: rule.action,
          reason: `Regel matcht: ${srcName} → ${dstName} (new connection) → ${rule.action.toUpperCase()}`
        });
        break;
      } else if ((directMatch || reverseMatch) && rule.connectionType === 'related' && isReply) {
        results.push({
          ruleId: rule.id,
          matched: true,
          action: rule.action,
          reason: `Regel matcht: gerelateerd verkeer van ${packetSrcName} → ${packetDstName} (related) → ${rule.action.toUpperCase()}`
        });
        break;
      } else if (directMatch || reverseMatch) {
        results.push({
          ruleId: rule.id,
          matched: false,
          action: 'continue',
          reason: `Regel ${srcName} → ${dstName}: type mismatch (${rule.connectionType} vs ${isReply ? 'reply' : 'new'}), ga verder...`
        });
      } else {
        results.push({
          ruleId: rule.id,
          matched: false,
          action: 'continue',
          reason: `Regel ${srcName} → ${dstName}: geen match met ${packetSrcName} → ${packetDstName}, ga verder...`
        });
      }
    }

    // If no rule matched, default deny
    if (results.length === 0 || results.every(r => !r.matched)) {
      results.push({
        ruleId: 'default',
        matched: true,
        action: 'drop',
        reason: 'Geen matchende regel gevonden. Default actie: DROP (implicit deny)'
      });
    }

    return results;
  }, [rules, getNodeName]);

  const startSimulation = useCallback(() => {
    if (!sourceId || !destinationId) return;

    setPhase('request');
    setRuleChecks([]);
    setCurrentCheckIndex(-1);
    setFinalResult(null);

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
  }, [sourceId, destinationId, checkRules, onSimulationChange]);

  // Animate through rule checks
  useEffect(() => {
    if (phase !== 'checking' || currentCheckIndex < 0) return;

    const timer = setTimeout(() => {
      const check = ruleChecks[currentCheckIndex];
      
      if (check.matched) {
        setFinalResult(check.action === 'allow' ? 'allowed' : 'dropped');
        
        if (check.action === 'allow') {
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
            setPhase('complete');
          }, 1500);
        } else {
          setPhase('complete');
          onSimulationChange(null);
        }
      } else if (currentCheckIndex < ruleChecks.length - 1) {
        setCurrentCheckIndex(prev => prev + 1);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [phase, currentCheckIndex, ruleChecks, sourceId, destinationId, onSimulationChange]);

  const resetSimulation = () => {
    setPhase('idle');
    setRuleChecks([]);
    setCurrentCheckIndex(-1);
    setFinalResult(null);
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bron</label>
              <Select value={sourceId} onValueChange={setSourceId} disabled={phase !== 'idle'}>
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
              <Select value={destinationId} onValueChange={setDestinationId} disabled={phase !== 'idle'}>
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
                phase === 'response' ? "bg-primary/20 text-primary" : "bg-muted"
              )}>
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Reply</span>
              </div>
            </div>

            {/* Rule checks */}
            {ruleChecks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Firewall regel evaluatie:</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {ruleChecks.slice(0, currentCheckIndex + 1).map((check, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-lg border text-sm transition-all",
                        check.matched && check.action === 'allow' && "bg-primary/10 border-primary/30",
                        check.matched && check.action === 'drop' && "bg-destructive/10 border-destructive/30",
                        !check.matched && "bg-muted/50 border-border"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {check.matched ? (
                          check.action === 'allow' ? (
                            <ShieldCheck className="w-4 h-4 text-primary mt-0.5" />
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
            {finalResult && (
              <div className={cn(
                "p-4 rounded-lg text-center",
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
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
