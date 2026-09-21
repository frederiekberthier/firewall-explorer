import { useMemo } from 'react';
import { NetworkNode, FirewallRule, FirewallPolicy, AddressList } from '@/types/firewall';
import { Scenario } from '@/types/scenario';
import { gradeScenario, IntentResult, LintFinding } from '@/lib/scenarioGrading';
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

function RequirementRow({ text, requirementId, result }: { text: string; requirementId: string; result?: IntentResult }) {
  return (
    <li className="space-y-0.5">
      <div className="flex items-start gap-2 text-sm">
        {!result ? (
          <Circle className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
        ) : result.pass ? (
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
        )}
        <span>
          <span className="text-muted-foreground font-mono text-xs mr-1">{requirementId}</span>
          {text}
        </span>
      </div>
      {result && !result.pass && (
        <p className="text-xs text-muted-foreground pl-6">{result.reason}</p>
      )}
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

  const passCount = report.intentResults.filter(r => r.pass).length;
  const allPass = report.intentResults.length > 0 && passCount === report.intentResults.length;

  return (
    <div
      className={cn(
        'rounded-xl border-2 p-4 space-y-3 transition-colors',
        allPass ? 'border-primary/40 bg-primary/5' : 'border-destructive/30 bg-destructive/5'
      )}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4" />
          Zelftest
        </h4>
        {report.intentResults.length > 0 && (
          <Badge className={allPass ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'}>
            {passCount}/{report.intentResults.length} voldaan
          </Badge>
        )}
      </div>

      <ul className="space-y-2">
        {scenario.brief.requirements.map(req => {
          const intent = scenario.intents?.find(i => i.requirementId === req.id);
          const result = intent ? report.intentResults.find(r => r.intent.id === intent.id) : undefined;
          return <RequirementRow key={req.id} text={req.text} requirementId={req.id} result={result} />;
        })}
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
