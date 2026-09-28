import { useMemo } from 'react';
import { NetworkNode, FirewallRule, FirewallPolicy, AddressList } from '@/types/firewall';
import { Scenario } from '@/types/scenario';
import { gradeScenario, summarizeRequirements, RequirementSummary, LintFinding } from '@/lib/scenarioGrading';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Circle, AlertTriangle, Info, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScenarioSelfTestProps {
  scenario: Scenario;
  nodes: NetworkNode[];
  rules: FirewallRule[];
  firewallPolicy: FirewallPolicy;
  addressLists?: AddressList[];
}

const STATUS_LABEL = { pass: 'voldaan', fail: 'niet voldaan', untested: 'niet automatisch getest' } as const;

function RequirementRow({ summary }: { summary: RequirementSummary }) {
  const { requirement, status, results, failing, skipped } = summary;
  return (
    <li className="space-y-0.5" data-status={status}>
      <div className="flex items-start gap-2 text-sm">
        {status === 'untested' ? (
          <Circle className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        ) : status === 'pass' ? (
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" aria-hidden="true" />
        ) : (
          <XCircle className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" aria-hidden="true" />
        )}
        <span>
          <span className="sr-only">{STATUS_LABEL[status]}: </span>
          <span className="text-muted-foreground font-mono text-xs mr-1">{requirement.id}</span>
          {requirement.text}
          {results.length > 1 && (
            <span className="text-xs text-muted-foreground ml-1">
              ({results.length - failing.length}/{results.length} controles)
            </span>
          )}
        </span>
      </div>
      {status === 'untested' && skipped.map(result => (
        <p key={result.intent.id} className="text-xs text-muted-foreground italic pl-6">{result.reason}</p>
      ))}
      {/* Every failing check, not just the first one, each with its own reason. */}
      {failing.map(result => (
        <p key={result.intent.id} className="text-xs text-muted-foreground pl-6">
          {results.length > 1 && result.intent.description ? `${result.intent.description}: ` : ''}
          {result.reason}
        </p>
      ))}
    </li>
  );
}

function LintRow({ finding }: { finding: LintFinding }) {
  const Icon = finding.severity === 'warning' ? AlertTriangle : Info;
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', finding.severity === 'warning' ? 'text-orange-600' : 'text-muted-foreground')} />
      <span>{finding.message}</span>
    </li>
  );
}

/**
 * Live self-test, meant to sit right next to the rule list a student is
 * actually editing (not up top with the brief) — the checklist updates as
 * rules are added/reordered, no separate "run test" action needed.
 */
export function ScenarioSelfTest({ scenario, nodes, rules, firewallPolicy, addressLists = [] }: ScenarioSelfTestProps) {
  const report = useMemo(
    () => gradeScenario(scenario, nodes, rules, firewallPolicy, addressLists),
    [scenario, nodes, rules, firewallPolicy, addressLists]
  );

  // Count requirements, not intents, so the badge always matches the list.
  const summaries = summarizeRequirements(scenario, report);
  const tested = summaries.filter(s => s.status !== 'untested');
  const passCount = tested.filter(s => s.status === 'pass').length;
  const allPass = tested.length > 0 && passCount === tested.length;

  return (
    <div
      className={cn(
        'rounded-xl border-2 p-4 space-y-3 transition-colors',
        tested.length === 0
          ? 'border-border bg-card' // nothing can be checked automatically: neutral, not "failing"
          : allPass ? 'border-primary/40 bg-primary/5' : 'border-destructive/30 bg-destructive/5'
      )}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4" />
          Zelftest
        </h4>
        {tested.length > 0 && (
          <Badge className={allPass ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'}>
            {passCount}/{tested.length} voldaan
          </Badge>
        )}
      </div>

      {tested.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Dit scenario bevat geen automatische controles — kijk de vereisten zelf na in de simulatie.
        </p>
      )}

      <ul className="space-y-2">
        {summaries.map(summary => <RequirementRow key={summary.requirement.id} summary={summary} />)}
      </ul>

      {report.lintFindings.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border/50">
          <h5 className="text-xs font-medium text-muted-foreground">Hygiëne</h5>
          <ul className="space-y-1.5">
            {report.lintFindings.map(finding => (
              <LintRow key={finding.id} finding={finding} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
