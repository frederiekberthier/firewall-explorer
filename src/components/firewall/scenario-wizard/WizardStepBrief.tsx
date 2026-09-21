import { useMemo } from 'react';
import { WizardDraft, slugify, uniqueSlug } from '@/lib/scenarioWizard';
import { SCENARIOS } from '@/data/scenarios';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WizardStepBriefProps {
  draft: WizardDraft;
  onChange: (updates: Partial<WizardDraft>) => void;
}

export function WizardStepBrief({ draft, onChange }: WizardStepBriefProps) {
  const slug = useMemo(
    () => uniqueSlug(slugify(draft.title), SCENARIOS.map(s => s.meta.id)),
    [draft.title]
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Begin met een titel en de doorlopende opdrachttekst zoals je die aan studenten zou geven —
        gewoon lopende tekst, geen technisch formaat nodig.
      </p>

      <div className="space-y-2">
        <Label htmlFor="wizard-title">Titel</Label>
        <Input
          id="wizard-title"
          placeholder="bv. Kantoor met camerabewaking"
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
        {draft.title.trim() && (
          <p className="text-xs text-muted-foreground">id: <code>{slug}</code></p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="wizard-markdown">Opdrachttekst</Label>
        <Textarea
          id="wizard-markdown"
          className="h-40"
          placeholder="Beschrijf de situatie: welke netwerken zijn er, wie moet waarbij kunnen, en waarom..."
          value={draft.markdown}
          onChange={(e) => onChange({ markdown: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Moeilijkheidsgraad (optioneel)</Label>
        <Select
          value={draft.difficulty ?? 'none'}
          onValueChange={(v) => onChange({ difficulty: v === 'none' ? undefined : (v as 'basis' | 'gevorderd') })}
        >
          <SelectTrigger className="w-full md:w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border">
            <SelectItem value="none">Geen</SelectItem>
            <SelectItem value="basis">Basis</SelectItem>
            <SelectItem value="gevorderd">Gevorderd</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
