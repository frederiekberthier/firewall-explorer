import { Phase } from '@/types/firewall';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { PHASES } from '@/lib/phases';

interface PhaseNavigationProps {
  currentPhase: Phase;
  onPhaseChange: (phase: Phase) => void;
  canProceed: boolean;
}

/**
 * The three phases as tabs in the dark header bar, like the page navigation
 * of the other Graduaat IoT apps: the active phase gets a light blue bar
 * underneath. A later phase can only be opened once the current one allows it.
 */
export function PhaseTabs({ currentPhase, onPhaseChange, canProceed }: PhaseNavigationProps) {
  return (
    <nav aria-label="Fases">
      <ol className="flex">
        {PHASES.map(p => {
          const isCurrent = currentPhase === p.phase;
          const locked = p.phase > currentPhase && !canProceed;
          return (
            <li key={p.phase} className="flex-1 sm:flex-none">
              <button
                onClick={() => onPhaseChange(p.phase)}
                disabled={locked}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex w-full min-h-12 items-center justify-center gap-2 border-b-[3px] px-2 sm:px-3',
                  'font-heading font-bold text-bar-foreground transition-colors',
                  isCurrent ? 'border-primary' : 'border-transparent hover:text-primary',
                  locked && 'cursor-not-allowed opacity-50 hover:text-bar-foreground'
                )}
              >
                <span
                  className={cn(
                    'grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-xs font-extrabold',
                    isCurrent ? 'bg-primary text-primary-foreground' : 'bg-white/10 text-bar-foreground'
                  )}
                  aria-hidden="true"
                >
                  {p.phase}
                </span>
                <span className="sm:hidden">{p.short}</span>
                <span className="hidden sm:inline">{p.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** "Vorige fase" / "Volgende fase", shown with the page title of each phase. */
export function PhaseStepButtons({ currentPhase, onPhaseChange, canProceed }: PhaseNavigationProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {currentPhase > 1 && (
        <Button variant="outline" onClick={() => onPhaseChange((currentPhase - 1) as Phase)}>
          <ChevronLeft className="w-4 h-4" />
          Vorige fase
        </Button>
      )}
      {currentPhase < 3 && (
        <Button onClick={() => onPhaseChange((currentPhase + 1) as Phase)} disabled={!canProceed}>
          Volgende fase
          <ChevronRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
