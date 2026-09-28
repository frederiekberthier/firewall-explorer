import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNetworkState } from '@/hooks/useNetworkState';
import { NetworkCanvas } from './NetworkCanvas';
import { NodeToolbar } from './NodeToolbar';
import { RuleEditor } from './RuleEditor';
import { SimulationPanel } from './SimulationPanel';
import { PhaseTabs, PhaseStepButtons } from './PhaseNavigation';
import { PHASES } from '@/lib/phases';
import { ScenarioPanel } from './ScenarioPanel';
import { Button } from '@/components/ui/button';
import { RotateCcw, Mail, MapPin, Phone, ExternalLink } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getNodeName } from '@/lib/nodeNames';
import { cn } from '@/lib/utils';
import { findScenario } from '@/data/scenarios';

export function FirewallSimulator() {
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const {
    phase,
    setPhase,
    nodes,
    connections,
    selectedNodeId,
    setSelectedNodeId,
    firewallPolicy,
    setFirewallPolicy,
    rules,
    simulation,
    setSimulation,
    addNode,
    updateNode,
    deleteNode,
    addRule,
    deleteRule,
    reorderRules,
    resetNetwork,
    activeScenario,
    loadScenario,
    clearScenario,
    addressLists,
    addAddressList,
    deleteAddressList
  } = useNetworkState();

  // A link with ?s=<scenario-id> auto-loads that scenario, so a teacher can
  // share one URL per exercise instead of walking students through the
  // catalogue every time.
  useEffect(() => {
    const scenarioId = searchParams.get('s');
    if (!scenarioId) return;
    const scenario = findScenario(scenarioId);
    if (scenario) loadScenario(scenario);
  }, [searchParams, loadScenario]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const canProceed = phase === 1
    ? nodes.length > 1
    : phase === 2
      ? true
      : true;

  const phaseDescriptions = {
    1: 'Bouw je netwerk door nodes toe te voegen. Klik op Internet, VLAN of Host om ze aan de router te koppelen. Voor hosts: selecteer eerst een router of VLAN.',
    2: 'Kies eerst je firewall strategie (Allow All of Block All), en definieer daarna firewall regels. De strategie bepaalt wat er gebeurt als geen enkele regel matcht.',
    3: 'Test je regels! Selecteer bron en doel, en bekijk hoe de firewall je regels evalueert bij TCP communicatie.'
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header: dark bar with the wordmark, the phases as tabs and Reset — the
          same header as the other Graduaat IoT apps. */}
      <header className="sticky top-0 z-20 bg-bar text-bar-foreground">
        <div className="container flex flex-wrap items-center justify-between gap-x-6">
          <div className="flex items-baseline gap-1 py-2.5 font-heading text-2xl font-extrabold tracking-tight">
            <span className="text-primary" aria-hidden="true">/</span>firewall
            <span className="ml-2 hidden font-sans text-xs font-normal text-bar-muted sm:inline">Graduaat IoT</span>
          </div>

          <div className="order-last -mx-5 w-[calc(100%+2.5rem)] border-t border-white/10 px-1 md:order-none md:mx-0 md:ml-auto md:w-auto md:border-0 md:px-0">
            <PhaseTabs currentPhase={phase} onPhaseChange={setPhase} canProceed={canProceed} />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { resetNetwork(); setActiveRuleId(null); }}
            className="text-bar-foreground hover:bg-primary hover:text-primary-foreground"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        </div>
      </header>

      <main className="flex-1 w-full container pt-8 pb-12 space-y-6">
        {/* Page title per phase, with the step buttons */}
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-link">
              Fase {phase} van 3 · Firewall Simulator
            </p>
            <h1 className="text-[clamp(1.75rem,1.3rem+2vw,2.5rem)]">{PHASES[phase - 1].title}</h1>
            <p className="mt-2 max-w-[65ch] text-muted-foreground">{phaseDescriptions[phase]}</p>
          </div>
          <PhaseStepButtons currentPhase={phase} onPhaseChange={setPhase} canProceed={canProceed} />
        </section>

          <ScenarioPanel
            activeScenario={activeScenario}
            onLoadScenario={loadScenario}
            onClearScenario={clearScenario}
          />

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
                firewallPolicy={firewallPolicy}
                activeScenario={activeScenario}
                addressLists={addressLists}
                onPolicyChange={setFirewallPolicy}
                onAddRule={addRule}
                onDeleteRule={deleteRule}
                onReorderRules={reorderRules}
                onAddAddressList={addAddressList}
                onDeleteAddressList={deleteAddressList}
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
                <div className="p-4 bg-card rounded-lg border border-border shadow-soft">
                  <h4 className="font-medium mb-3">Actieve regels:</h4>
                  {rules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Geen regels gedefinieerd</p>
                  ) : (
                    <div className="space-y-1 text-sm">
                      {(() => {
                        const sortedRules = [...rules].sort((a, b) => a.order - b.order);
                        const matchedRule = sortedRules.find(r => r.id === activeRuleId);
                        return sortedRules.map((rule, idx) => {
                          const isActive = rule.id === activeRuleId;
                          const isUnreached = matchedRule ? rule.order > matchedRule.order : false;
                          return (
                            <div
                              key={rule.id}
                              className={cn(
                                "flex items-center gap-2 px-1.5 py-0.5 rounded",
                                isActive && "bg-primary/10 ring-1 ring-primary/40",
                                isUnreached && "opacity-40"
                              )}
                            >
                              <span className="font-mono text-muted-foreground">{idx + 1}.</span>
                              <span>{getNodeName(nodes, rule.sourceId, addressLists)}</span>
                              <span className="text-muted-foreground">→</span>
                              <span>{getNodeName(nodes, rule.destinationId, addressLists)}</span>
                              <span className="text-muted-foreground">({rule.connectionStates.join(',')})</span>
                              <span className={rule.action === 'allow' ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                                {rule.action.toUpperCase()}
                              </span>
                              {isUnreached && (
                                <span className="text-xs text-muted-foreground italic">niet bereikt</span>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              </div>

              <SimulationPanel
                nodes={nodes}
                rules={rules}
                firewallPolicy={firewallPolicy}
                addressLists={addressLists}
                simulation={simulation}
                onSimulationChange={setSimulation}
                onActiveRuleChange={setActiveRuleId}
              />
            </div>
          )}
      </main>

      {/* Footer */}
      <footer className="bg-bar px-5 pb-4 pt-6 text-sm text-bar-muted">
        <div className="container flex flex-wrap items-center justify-between gap-4 px-0">
          <div>
            <h3 className="mb-1 text-base text-bar-foreground">Graduaat Internet of Things</h3>
            <p className="mb-2">Howest Hogeschool West-Vlaanderen - Campus Kortrijk</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Sint-Martenslatemlaan 2B, 8500 Kortrijk
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                +32 56 24 12 90
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <a href="mailto:iot@howest.be" className="text-inherit no-underline hover:text-primary">iot@howest.be</a>
              </span>
            </div>
          </div>

          <a
            href="https://www.howest.be/nl/opleidingen/graduaat/internet-of-things"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border-2 border-primary px-4 font-heading font-extrabold text-bar-foreground no-underline transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Meer info over de opleiding
          </a>
        </div>

        <p className="container mt-4 border-t border-white/10 px-0 pt-4 text-center">
          © {new Date().getFullYear()} Howest - Hogeschool West-Vlaanderen
        </p>
      </footer>
    </div>
  );
}
