import { useNetworkState } from '@/hooks/useNetworkState';
import { NetworkCanvas } from './NetworkCanvas';
import { NodeToolbar } from './NodeToolbar';
import { RuleEditor } from './RuleEditor';
import { SimulationPanel } from './SimulationPanel';
import { PhaseNavigation } from './PhaseNavigation';
import { Button } from '@/components/ui/button';
import { RotateCcw, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function FirewallSimulator() {
  const {
    phase,
    setPhase,
    nodes,
    connections,
    selectedNodeId,
    setSelectedNodeId,
    rules,
    simulation,
    setSimulation,
    addNode,
    updateNode,
    deleteNode,
    addRule,
    deleteRule,
    reorderRules,
    resetNetwork
  } = useNetworkState();

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const canProceed = phase === 1 
    ? nodes.length > 1 
    : phase === 2 
    ? true 
    : true;

  const phaseDescriptions = {
    1: 'Bouw je netwerk door nodes toe te voegen. Klik op Internet, VLAN of Host om ze aan de router te koppelen. Voor hosts: selecteer eerst een router of VLAN.',
    2: 'Definieer firewall regels. Kies bron, doel, type (new/related) en actie (allow/drop). Versleep regels om de volgorde aan te passen.',
    3: 'Test je regels! Selecteer bron en doel, en bekijk hoe de firewall je regels evalueert bij TCP communicatie.'
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Firewall Simulator
              </h1>
              <p className="text-sm text-muted-foreground">
                Leer hoe stateful firewall regels werken
              </p>
            </div>
            
            <Button variant="outline" onClick={resetNetwork}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Phase navigation */}
        <PhaseNavigation
          currentPhase={phase}
          onPhaseChange={setPhase}
          canProceed={canProceed}
        />

        {/* Phase description */}
        <div className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border">
          <HelpCircle className="w-5 h-5 text-primary mt-0.5" />
          <p className="text-sm text-foreground">
            {phaseDescriptions[phase]}
          </p>
        </div>

        {/* Phase 1: Network building */}
        {phase === 1 && (
          <div className="space-y-4">
            <NodeToolbar
              onAddNode={addNode}
              selectedNodeType={selectedNode?.type || null}
            />
            <NetworkCanvas
              nodes={nodes}
              connections={connections}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onUpdateNode={updateNode}
              onDeleteNode={deleteNode}
              isEditable={true}
            />
          </div>
        )}

        {/* Phase 2: Rule creation */}
        {phase === 2 && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Je netwerk</h3>
              <NetworkCanvas
                nodes={nodes}
                connections={connections}
                selectedNodeId={null}
                onSelectNode={() => {}}
                onUpdateNode={() => {}}
                onDeleteNode={() => {}}
                isEditable={false}
              />
            </div>
            <RuleEditor
              nodes={nodes}
              rules={rules}
              onAddRule={addRule}
              onDeleteRule={deleteRule}
              onReorderRules={reorderRules}
            />
          </div>
        )}

        {/* Phase 3: Simulation */}
        {phase === 3 && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Je netwerk</h3>
              <NetworkCanvas
                nodes={nodes}
                connections={connections}
                selectedNodeId={null}
                onSelectNode={() => {}}
                onUpdateNode={() => {}}
                onDeleteNode={() => {}}
                isEditable={false}
                packet={simulation || undefined}
              />
              
              {/* Show current rules for reference */}
              <div className="p-4 bg-card rounded-xl border border-border">
                <h4 className="font-medium mb-3">Actieve regels:</h4>
                {rules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Geen regels gedefinieerd</p>
                ) : (
                  <div className="space-y-1 text-sm">
                    {rules.sort((a, b) => a.order - b.order).map((rule, idx) => (
                      <div key={rule.id} className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground">{idx + 1}.</span>
                        <span>{nodes.find(n => n.id === rule.sourceId)?.name}</span>
                        <span className="text-muted-foreground">→</span>
                        <span>{nodes.find(n => n.id === rule.destinationId)?.name}</span>
                        <span className="text-muted-foreground">({rule.connectionType})</span>
                        <span className={rule.action === 'allow' ? 'text-primary' : 'text-destructive'}>
                          {rule.action.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <SimulationPanel
              nodes={nodes}
              rules={rules}
              simulation={simulation}
              onSimulationChange={setSimulation}
            />
          </div>
        )}
      </main>
    </div>
  );
}
