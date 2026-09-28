import { useState, Dispatch, SetStateAction } from 'react';
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
import { WizardSession, createWizardSession, isDraftStarted } from '@/lib/scenarioWizard';
import { validateScenario } from '@/lib/scenarioValidation';

// Enough to point at the problem without flooding the dialog.
const MAX_ERRORS_SHOWN = 8;

interface ScenarioPanelProps {
  activeScenario: Scenario | null;
  onLoadScenario: (scenario: Scenario) => void;
  onClearScenario: () => void;
}

type PickerMode = 'list' | 'wizard';

interface ScenarioPickerProps {
  onLoadScenario: (scenario: Scenario) => void;
  wizardSession: WizardSession;
  onWizardSessionChange: Dispatch<SetStateAction<WizardSession>>;
}

function ScenarioPicker({ onLoadScenario, wizardSession, onWizardSessionChange }: ScenarioPickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>('list');
  const [pasted, setPasted] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const draftStarted = isDraftStarted(wizardSession.draft);

  const handlePick = (scenario: Scenario) => {
    onLoadScenario(scenario);
    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setMode('list');
  };

  const handleLoadPasted = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(pasted);
    } catch (e) {
      setErrors([`Dit is geen geldige JSON: ${e instanceof Error ? e.message : 'onbekende fout'}`]);
      return;
    }
    const result = validateScenario(parsed);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    handlePick(result.scenario);
    setPasted('');
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
          <ScenarioWizard
            session={wizardSession}
            onSessionChange={onWizardSessionChange}
            onLoadScenario={(scenario) => {
              handlePick(scenario);
              // Done: the next "Nieuw scenario opbouwen" starts from scratch.
              onWizardSessionChange(createWizardSession());
            }}
            onCancel={() => setMode('list')}
          />
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

            {draftStarted ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => setMode('wizard')} className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  Verder met je concept{wizardSession.draft.title.trim() ? `: ${wizardSession.draft.title.trim()}` : ''}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onWizardSessionChange(createWizardSession())}>
                  Concept verwijderen
                </Button>
              </div>
            ) : (
              <Button onClick={() => setMode('wizard')} className="flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                Nieuw scenario opbouwen
              </Button>
            )}

            <details className="pt-2 border-t border-border group">
              <summary className="text-sm font-medium flex items-center gap-2 cursor-pointer select-none list-none">
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                <ClipboardPaste className="w-4 h-4" />
                Geavanceerd: JSON plakken
              </summary>
              <div className="space-y-2 mt-2">
                <Textarea
                  value={pasted}
                  onChange={(e) => { setPasted(e.target.value); setErrors([]); }}
                  placeholder='{"meta": {"id": "...", "title": "..."}, "brief": {...}, "topology": {...}}'
                  className="font-mono text-xs h-32"
                />
                {errors.length > 0 && (
                  <div role="alert" className="text-xs text-destructive space-y-1">
                    <p className="font-medium">Dit scenario kan niet geladen worden:</p>
                    <ul className="list-disc pl-4 space-y-0.5 font-mono">
                      {errors.slice(0, MAX_ERRORS_SHOWN).map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                    {errors.length > MAX_ERRORS_SHOWN && (
                      <p>… en nog {errors.length - MAX_ERRORS_SHOWN} andere.</p>
                    )}
                  </div>
                )}
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
  // Lives here (always mounted) rather than in the dialog or the picker: the
  // picker is rendered in two places below and remounts when a scenario is
  // loaded or cleared, which would otherwise lose a half-built draft too.
  const [wizardSession, setWizardSession] = useState<WizardSession>(createWizardSession);
  const picker = (
    <ScenarioPicker
      onLoadScenario={onLoadScenario}
      wizardSession={wizardSession}
      onWizardSessionChange={setWizardSession}
    />
  );

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
          {picker}
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
            {picker}
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
