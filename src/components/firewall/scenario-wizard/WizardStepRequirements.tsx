import { WizardDraft } from '@/lib/scenarioWizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

interface WizardStepRequirementsProps {
  draft: WizardDraft;
  onChange: (updates: Partial<WizardDraft>) => void;
}

export function WizardStepRequirements({ draft, onChange }: WizardStepRequirementsProps) {
  const addRequirement = () => {
    onChange({
      requirements: [...draft.requirements, { key: crypto.randomUUID(), text: '' }]
    });
  };

  const updateRequirement = (key: string, text: string) => {
    onChange({
      requirements: draft.requirements.map(r => (r.key === key ? { ...r, text } : r))
    });
  };

  const removeRequirement = (key: string) => {
    onChange({ requirements: draft.requirements.filter(r => r.key !== key) });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Som de vereisten op waaraan de firewallregels van een student moeten voldoen — één per
        regel, in gewone taal. Het nummer (R1, R2, ...) wordt automatisch toegekend.
      </p>

      <div className="space-y-2">
        {draft.requirements.map((req, index) => (
          <div key={req.key} className="flex items-center gap-2">
            <span className="w-8 flex-shrink-0 text-xs font-mono text-muted-foreground">
              R{index + 1}
            </span>
            <Input
              placeholder="bv. DATA mag naar internet"
              value={req.text}
              onChange={(e) => updateRequirement(req.key, e.target.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeRequirement(req.key)}
              className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {draft.requirements.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Nog geen vereisten toegevoegd.</p>
        )}
      </div>

      <Button variant="outline" size="sm" onClick={addRequirement}>
        <Plus className="w-4 h-4 mr-2" />
        Vereiste toevoegen
      </Button>
    </div>
  );
}
