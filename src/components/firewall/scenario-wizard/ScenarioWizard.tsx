import { useMemo, useState } from 'react';
import { Scenario } from '@/types/scenario';
import {
  WizardDraft,
  createEmptyDraft,
  buildScenarioFromDraft,
  availableNodeNames,
  findTopologyNameIssues
} from '@/lib/scenarioWizard';
import { WizardStepBrief } from './WizardStepBrief';
import { WizardStepRequirements } from './WizardStepRequirements';
import { WizardStepTopology } from './WizardStepTopology';
import { WizardStepIntentsReview } from './WizardStepIntentsReview';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Download, ArrowLeft, ArrowRight, X } from 'lucide-react';

interface ScenarioWizardProps {
  onLoadScenario: (scenario: Scenario) => void;
  onCancel: () => void;
}

const STEP_LABELS = ['Uitleg', 'Vereisten', 'Topologie', 'Intents'] as const;
type Step = 1 | 2 | 3 | 4;

function downloadScenarioAsJson(scenario: Scenario) {
  const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${scenario.meta.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ScenarioWizard({ onLoadScenario, onCancel }: ScenarioWizardProps) {
  const [draft, setDraft] = useState<WizardDraft>(createEmptyDraft());
  const [step, setStep] = useState<Step>(1);
  const [maxReachedStep, setMaxReachedStep] = useState<Step>(1);

  const updateDraft = (updates: Partial<WizardDraft>) => setDraft(prev => ({ ...prev, ...updates }));

  const canAdvanceFrom: Record<Step, boolean> = useMemo(() => {
    const hasFilledRequirement = draft.requirements.some(r => r.text.trim() !== '');
    const hasVlans = draft.vlans.length > 0;
    const namesFilled = draft.vlans.every(v => v.name.trim() !== '' && v.hosts.every(h => h.trim() !== ''));
    const noNameIssues = findTopologyNameIssues(draft.vlans).length === 0;

    return {
      1: draft.title.trim() !== '' && draft.markdown.trim() !== '',
      2: hasFilledRequirement,
      3: hasVlans && namesFilled && noNameIssues,
      4: false // step 4 has no "volgende" — it's the last step
    };
  }, [draft]);

  const canCommit = useMemo(() => {
    const filled = draft.requirements.filter(r => r.text.trim() !== '');
    if (filled.length === 0 || availableNodeNames(draft).length < 2) return false;
    return filled.every(r => {
      const choice = draft.intentChoices[r.key];
      return !!choice?.from && !!choice?.to;
    });
  }, [draft]);

  const goNext = () => {
    if (!canAdvanceFrom[step]) return;
    const next = Math.min(step + 1, 4) as Step;
    setStep(next);
    setMaxReachedStep(prev => (next > prev ? next : prev));
  };

  const goBack = () => setStep(prev => Math.max(prev - 1, 1) as Step);

  const handleLoad = () => {
    onLoadScenario(buildScenarioFromDraft(draft));
  };

  const handleDownload = () => {
    downloadScenarioAsJson(buildScenarioFromDraft(draft));
  };

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {STEP_LABELS.map((label, i) => {
            const stepNum = (i + 1) as Step;
            const reached = stepNum <= maxReachedStep;
            return (
              <button
                key={label}
                onClick={() => reached && setStep(stepNum)}
                disabled={!reached}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  stepNum === step
                    ? 'bg-primary text-primary-foreground border-primary'
                    : reached
                      ? 'bg-muted hover:bg-muted/70 border-border cursor-pointer'
                      : 'bg-muted/40 text-muted-foreground border-border cursor-not-allowed'
                )}
              >
                {stepNum}. {label}
              </button>
            );
          })}
        </div>
        <Progress value={(step / 4) * 100} className="h-1.5" />
      </div>

      {/* Active step */}
      {step === 1 && <WizardStepBrief draft={draft} onChange={updateDraft} />}
      {step === 2 && <WizardStepRequirements draft={draft} onChange={updateDraft} />}
      {step === 3 && <WizardStepTopology draft={draft} onChange={updateDraft} />}
      {step === 4 && <WizardStepIntentsReview draft={draft} onChange={updateDraft} />}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <Button variant="ghost" onClick={step === 1 ? onCancel : goBack}>
          {step === 1 ? (
            <>
              <X className="w-4 h-4 mr-2" />
              Annuleren
            </>
          ) : (
            <>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Vorige
            </>
          )}
        </Button>

        {step < 4 ? (
          <Button onClick={goNext} disabled={!canAdvanceFrom[step]}>
            Volgende
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDownload} disabled={!canCommit}>
              <Download className="w-4 h-4 mr-2" />
              Downloaden als JSON
            </Button>
            <Button onClick={handleLoad} disabled={!canCommit}>
              Scenario laden
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
