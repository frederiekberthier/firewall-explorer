import { Phase } from '@/types/firewall';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Network, Shield, Play, ChevronRight, ChevronLeft } from 'lucide-react';

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
      <div className="flex items-center justify-center gap-2">
        {phases.map((p, idx) => (
          <div key={p.phase} className="flex items-center">
            <button
              onClick={() => onPhaseChange(p.phase)}
              disabled={p.phase > currentPhase && !canProceed}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                currentPhase === p.phase
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : currentPhase > p.phase
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground",
                p.phase <= currentPhase && "hover:opacity-80 cursor-pointer"
              )}
            >
              <p.icon className="w-4 h-4" />
              <span className="font-medium">{p.label}</span>
            </button>
            {idx < phases.length - 1 && (
              <ChevronRight className="w-5 h-5 mx-2 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-center gap-4">
        {currentPhase > 1 && (
          <Button
            variant="outline"
            onClick={() => onPhaseChange((currentPhase - 1) as Phase)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Vorige fase
          </Button>
        )}
        
        {currentPhase < 3 && (
          <Button
            onClick={() => onPhaseChange((currentPhase + 1) as Phase)}
            disabled={!canProceed}
          >
            Volgende fase
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
