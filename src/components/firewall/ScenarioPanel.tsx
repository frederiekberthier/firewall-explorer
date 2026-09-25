import { useState } from 'react';
import { Scenario } from '@/types/scenario';
import { SCENARIOS } from '@/data/scenarios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { BookOpen, Circle, FolderOpen, X, ClipboardPaste, Wand2, ChevronDown } from 'lucide-react';
import { ScenarioWizard } from './scenario-wizard/ScenarioWizard';

interface ScenarioPanelProps {
  activeScenario: Scenario | null;
  onLoadScenario: (scenario: Scenario) => void;
  onClearScenario: () => void;
}

function isValidScenario(value: unknown): value is Scenario {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<Scenario>;
  if (!s.meta?.id || !s.meta?.title) return false;
  if (!s.brief || !Array.isArray(s.brief.requirements)) return false;
  if (!s.topology || !Array.isArray(s.topology.vlans)) return false;
  // Every vlan's `hosts`, if present, must actually be an array — a string
  // or object there would otherwise crash loadScenario's .forEach later.
  if (s.topology.vlans.some(v => v.hosts !== undefined && !Array.isArray(v.hosts))) return false;
  // `intents` is optional, but if present must be an array — gradeScenario
  // otherwise crashes trying to .map over it.
  if (s.intents !== undefined && !Array.isArray(s.intents)) return false;
  return true;
}

type PickerMode = 'list' | 'wizard';

function ScenarioPicker({ onLoadScenario }: { onLoadScenario: (scenario: Scenario) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>('list');
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handlePick = (scenario: Scenario) => {
    onLoadScenario(scenario);
    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setMode('list');
  };

  const handleLoadPasted = () => {
    try {
      const parsed = JSON.parse(pasted);
      if (!isValidScenario(parsed)) {
        setError('Dit lijkt geen geldig scenario-bestand (meta.id, meta.title, brief.requirements en topology.vlans zijn verplicht).');
        return;
      }
      setError(null);
      handlePick(parsed);
      setPasted('');
    } catch {
      setError('Kon de tekst niet als JSON inlezen.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          Scenario laden
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'wizard' ? 'Nieuw scenario opbouwen' : 'Scenario laden'}</DialogTitle>
        </DialogHeader>

        {mode === 'wizard' ? (
          <ScenarioWizard onLoadScenario={handlePick} onCancel={() => setMode('list')} />
        ) : (
          <>
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Catalogus</h4>
              <div className="space-y-2">
                {SCENARIOS.map(scenario => (
                  <button
                    key={scenario.meta.id}
                    onClick={() => handlePick(scenario)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{scenario.meta.title}</span>
                      {scenario.meta.difficulty && (
                        <Badge variant="outline" className="text-[10px]">{scenario.meta.difficulty}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{scenario.brief.markdown}</p>
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={() => setMode('wizard')} className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Nieuw scenario opbouwen
            </Button>

            <details className="pt-2 border-t border-border group">
              <summary className="text-sm font-medium flex items-center gap-2 cursor-pointer select-none list-none">
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                <ClipboardPaste className="w-4 h-4" />
                Geavanceerd: JSON plakken
              </summary>
              <div className="space-y-2 mt-2">
                <Textarea
                  value={pasted}
                  onChange={(e) => { setPasted(e.target.value); setError(null); }}
                  placeholder='{"meta": {"id": "...", "title": "..."}, "brief": {...}, "topology": {...}}'
                  className="font-mono text-xs h-32"
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button size="sm" onClick={handleLoadPasted} disabled={!pasted.trim()}>
                  Scenario inladen
                </Button>
              </div>
            </details>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ScenarioPanel({ activeScenario, onLoadScenario, onClearScenario }: ScenarioPanelProps) {
  if (!activeScenario) {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <BookOpen className="w-5 h-5 flex-shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Geen scenario actief</p>
              <p className="text-xs text-muted-foreground">
                Bouw vrij verder, of laad een kant-en-klare opdracht met een voorgedefinieerd netwerk.
              </p>
            </div>
          </div>
          <ScenarioPicker onLoadScenario={onLoadScenario} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 flex-shrink-0" />
              {activeScenario.meta.title}
            </CardTitle>
            {activeScenario.meta.difficulty && (
              <Badge variant="outline" className="mt-1 text-[10px]">{activeScenario.meta.difficulty}</Badge>
            )}
          </div>
          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            <ScenarioPicker onLoadScenario={onLoadScenario} />
            <Button variant="ghost" size="icon" onClick={onClearScenario} title="Scenario sluiten" aria-label="Scenario sluiten">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground whitespace-pre-wrap">{activeScenario.brief.markdown}</p>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Vereisten</h4>
          <ul className="space-y-1.5">
            {activeScenario.brief.requirements.map(req => (
              <li key={req.id} className="flex items-start gap-2 text-sm">
                <Circle className="w-3 h-3 mt-1 text-muted-foreground flex-shrink-0" />
                <span>
                  <span className="text-muted-foreground font-mono text-xs mr-1">{req.id}</span>
                  {req.text}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground italic">
            Bij het opstellen van je firewallregels (fase 2) zie je onderaan live of elke vereiste al voldaan is.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
