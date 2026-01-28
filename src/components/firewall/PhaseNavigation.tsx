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
    <div className="flex flex-col gap-4">
      {/* Phase indicators */}
      <div className="flex flex-col gap-2">
        {phases.map((p, idx) => (
          <div key={p.phase} className="flex flex-col">
            <button
              onClick={() => onPhaseChange(p.phase)}
              disabled={p.phase > currentPhase && !canProceed}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full",
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
              <span className="font-medium text-left">{p.label}</span>
            </button>
            {idx < phases.length - 1 && (
              <ChevronDown className="w-5 h-5 my-1 mx-auto text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
        {currentPhase < 3 && (
          <Button
            onClick={() => onPhaseChange((currentPhase + 1) as Phase)}
            disabled={!canProceed}
            className="w-full"
          >
            Volgende fase
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
        {currentPhase > 1 && (
          <Button
            variant="outline"
            onClick={() => onPhaseChange((currentPhase - 1) as Phase)}
            className="w-full"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Vorige fase
          </Button>
        )}
      </div>
    </div>
  );
}
