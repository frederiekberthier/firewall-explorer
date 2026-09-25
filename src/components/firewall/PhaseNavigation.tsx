import { Phase } from '@/types/firewall';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Network, Shield, Play, ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react';

interface PhaseNavigationProps {
  currentPhase: Phase;
  onPhaseChange: (phase: Phase) => void;
  canProceed: boolean;
}

const phases = [
  { phase: 1 as Phase, label: 'Netwerk opbouw', icon: Network },
  { phase: 2 as Phase, label: 'Firewall regels', icon: Shield },
  { phase: 3 as Phase, label: 'Simulatie', icon: Play }
];

export function PhaseNavigation({ currentPhase, onPhaseChange, canProceed }: PhaseNavigationProps) {
  return (
    <nav aria-label="Fases" className="flex flex-col gap-3 md:gap-4">
      {/* Phase indicators: a row on small screens, a column in the sidebar */}
      <ol className="flex flex-row md:flex-col gap-1 md:gap-2">
        {phases.map((p, idx) => (
          <li key={p.phase} className="flex flex-row md:flex-col items-center md:items-stretch flex-1 min-w-0">
            <button
              onClick={() => onPhaseChange(p.phase)}
              disabled={p.phase > currentPhase && !canProceed}
              aria-current={currentPhase === p.phase ? 'step' : undefined}
              className={cn(
                "flex items-center justify-center md:justify-start gap-2 md:gap-3 px-2 py-2 md:px-4 md:py-3 rounded-lg transition-all w-full min-w-0",
                currentPhase === p.phase
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : currentPhase > p.phase
                    ? "bg-primary/10 text-foreground"
                    : "bg-muted text-muted-foreground",
                p.phase <= currentPhase && "hover:opacity-80 cursor-pointer",
                p.phase > currentPhase && !canProceed && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                currentPhase === p.phase
                  ? "bg-primary-foreground text-primary"
                  : currentPhase > p.phase
                    ? "bg-primary/20 text-primary"
                    : "bg-muted-foreground/20 text-muted-foreground"
              )}>
                <p.icon className="w-4 h-4" />
              </div>
              {/* Label is visually hidden on the narrowest screens, but stays the button's accessible name */}
              <span className="sr-only sm:not-sr-only font-medium text-left text-sm md:text-base truncate">{p.label}</span>
            </button>
            {idx < phases.length - 1 && (
              <>
                <ChevronRight className="md:hidden w-4 h-4 mx-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                <ChevronDown className="hidden md:block w-5 h-5 my-1 mx-auto text-muted-foreground" aria-hidden="true" />
              </>
            )}
          </li>
        ))}
      </ol>

      {/* Navigation buttons: "Vorige" left / "Volgende" right on small screens */}
      <div className="flex flex-row-reverse md:flex-col gap-2 md:mt-4 md:pt-4 md:border-t border-border">
        {currentPhase < 3 && (
          <Button
            onClick={() => onPhaseChange((currentPhase + 1) as Phase)}
            disabled={!canProceed}
            className="flex-1 md:flex-none md:w-full"
          >
            Volgende fase
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
        {currentPhase > 1 && (
          <Button
            variant="outline"
            onClick={() => onPhaseChange((currentPhase - 1) as Phase)}
            className="flex-1 md:flex-none md:w-full"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Vorige fase
          </Button>
        )}
      </div>
    </nav>
  );
}
