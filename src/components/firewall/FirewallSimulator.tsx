import { useNetworkState } from '@/hooks/useNetworkState';
import { NetworkCanvas } from './NetworkCanvas';
import { NodeToolbar } from './NodeToolbar';
import { RuleEditor } from './RuleEditor';
import { SimulationPanel } from './SimulationPanel';
import { PhaseNavigation } from './PhaseNavigation';
import { Button } from '@/components/ui/button';
import { RotateCcw, HelpCircle, Mail, MapPin, Phone, ExternalLink } from 'lucide-react';
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
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="h-9 w-9" />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Firewall Simulator
              </h1>
              <p className="text-xs text-muted-foreground">
                Leer hoe stateful firewall regels werken
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={resetNetwork}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Phase navigation */}
        <aside className="w-64 border-r border-border bg-card/50 sticky top-[65px] h-[calc(100vh-65px)] p-6">
          <PhaseNavigation
            currentPhase={phase}
            onPhaseChange={setPhase}
            canProceed={canProceed}
          />
        </aside>

        <main className="flex-1 container py-6 space-y-6">
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
                selectedNodeName={selectedNode?.name}
                nodes={nodes}
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
                  onSelectNode={() => { }}
                  onUpdateNode={() => { }}
                  onDeleteNode={() => { }}
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
                  onSelectNode={() => { }}
                  onUpdateNode={() => { }}
                  onDeleteNode={() => { }}
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

      {/* Footer */}
      <footer className="border-t border-border bg-card/80 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Graduaat Internet of Things
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Howest Hogeschool West-Vlaanderen - Campus Kortrijk
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Sint-Martenslatemlaan 2B, 8500 Kortrijk</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>+32 56 24 12 90</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    <a href="mailto:iot@howest.be" className="hover:text-primary transition-colors">
                      iot@howest.be
                    </a>
                  </div>
                </div>
              </div>

              <a
                href="https://www.howest.be/nl/opleidingen/graduaat/internet-of-things"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-primary hover:underline whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Meer info over de opleiding
              </a>
            </div>

            <div className="border-t border-border/50 pt-3">
              <p className="text-xs text-muted-foreground text-center">
                © {new Date().getFullYear()} Howest - Hogeschool West-Vlaanderen
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
