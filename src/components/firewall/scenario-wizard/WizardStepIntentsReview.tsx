import { WizardDraft, WizardIntentChoice, IntentEndpointOption, intentEndpointOptions } from '@/lib/scenarioWizard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Info } from 'lucide-react';

interface WizardStepIntentsReviewProps {
  draft: WizardDraft;
  onChange: (updates: Partial<WizardDraft>) => void;
}

const WILDCARD_VALUES = ['ANY_VLAN', 'ANY_HOST', 'ANY_INTERNET', 'ANY'];

function EndpointSelect({
  options,
  value,
  onValueChange,
  placeholder
}: {
  options: IntentEndpointOption[];
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
}) {
  const wildcards = options.filter(o => WILDCARD_VALUES.includes(o.value));
  const concrete = options.filter(o => !WILDCARD_VALUES.includes(o.value));

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-44">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-popover border border-border">
        {wildcards.length > 0 && (
          <SelectGroup>
            <SelectLabel>Alles van een soort</SelectLabel>
            {wildcards.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectGroup>
        )}
        {concrete.length > 0 && (
          <SelectGroup>
            <SelectLabel>Netwerk-elementen</SelectLabel>
            {concrete.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

export function WizardStepIntentsReview({ draft, onChange }: WizardStepIntentsReviewProps) {
  const options = intentEndpointOptions(draft);
  const filledRequirements = draft.requirements.filter(r => r.text.trim() !== '');

  const setChoice = (key: string, updates: Partial<WizardIntentChoice>) => {
    const current: WizardIntentChoice = draft.intentChoices[key] ?? { from: '', to: '', expect: 'allow', state: 'new' };
    onChange({ intentChoices: { ...draft.intentChoices, [key]: { ...current, ...updates } } });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Bepaal per vereiste welk verkeer wel of niet toegelaten mag zijn — dit wordt automatisch
          getest zodra een student regels opstelt.
        </p>

        <div className="flex items-start gap-2 p-3 rounded-lg border border-border bg-muted/30">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Kies zelf of je <strong>nieuw verkeer</strong> test (een verbinding die net start) of
            <strong> bestaand verkeer</strong> (het antwoord op een verbinding die al liep —
            established/related). Zo test je de twee stappen van een stateful firewall apart, net
            zoals een student ze ook apart moet leren herkennen. Kies <strong>"Elke VLAN"</strong>
            of <strong>"Elke host"</strong> als bron of doel om één check op al die elementen
            tegelijk toe te passen, i.p.v. per element een aparte vereiste te maken.
          </p>
        </div>

        {options.length < 2 ? (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5">
            <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground">
              Voeg in de vorige stap minstens twee netwerk-elementen toe (VLAN, host of internettoegang)
              om hier een controle te kunnen opstellen.
            </p>
          </div>
        ) : filledRequirements.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nog geen vereisten om te koppelen.</p>
        ) : (
          <div className="space-y-3">
            {filledRequirements.map((req, index) => {
              const choice = draft.intentChoices[req.key];
              return (
                <div key={req.key} className="p-3 rounded-lg border border-border space-y-2">
                  <p className="text-xs text-muted-foreground">R{index + 1}: {req.text}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Select
                      value={choice?.state ?? 'new'}
                      onValueChange={(v) => setChoice(req.key, { state: v as 'new' | 'established' })}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="new">Nieuw verkeer</SelectItem>
                        <SelectItem value="established">Bestaand verkeer</SelectItem>
                      </SelectContent>
                    </Select>

                    <span className="text-muted-foreground">van</span>

                    <EndpointSelect
                      options={options}
                      value={choice?.from ?? ''}
                      onValueChange={(v) => setChoice(req.key, { from: v })}
                      placeholder="Bron..."
                    />

                    <Select
                      value={choice?.expect ?? 'allow'}
                      onValueChange={(v) => setChoice(req.key, { expect: v as 'allow' | 'drop' })}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border">
                        <SelectItem value="allow">mag verbinden met</SelectItem>
                        <SelectItem value="drop">mag niet verbinden met</SelectItem>
                      </SelectContent>
                    </Select>

                    <EndpointSelect
                      options={
                        // A concrete node can't sensibly be picked on both
                        // sides — but a wildcard picked as bron should stay
                        // selectable as doel too (e.g. "Elke VLAN mag niet
                        // verbinden met Elke VLAN" tests that no VLAN can
                        // reach another VLAN; identical-node self-pairs are
                        // already skipped by the grading engine).
                        WILDCARD_VALUES.includes(choice?.from ?? '')
                          ? options
                          : options.filter(o => o.value !== choice?.from)
                      }
                      value={choice?.to ?? ''}
                      onValueChange={(v) => setChoice(req.key, { to: v })}
                      placeholder="Doel..."
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">{draft.title.trim() || 'Naamloos scenario'}</h4>
          {draft.difficulty && <Badge variant="outline" className="text-[10px]">{draft.difficulty}</Badge>}
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap">{draft.markdown.trim() || '—'}</p>

        {filledRequirements.length > 0 && (
          <ul className="text-sm space-y-1 list-disc list-inside">
            {filledRequirements.map((r, i) => (
              <li key={r.key}><span className="text-muted-foreground font-mono text-xs mr-1">R{i + 1}</span>{r.text}</li>
            ))}
          </ul>
        )}

        <ul className="text-sm space-y-0.5">
          <li>Internet: {draft.internet ? 'ja' : 'nee'}</li>
          {draft.vlans.map((v, i) => (
            <li key={i}>{v.name || '(naamloos)'}{v.hosts.length > 0 ? ` (${v.hosts.join(', ')})` : ''}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
