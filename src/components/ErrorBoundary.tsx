import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defence: without it, any error during rendering unmounts the
 * whole React tree and leaves a blank page. Shows what happened and offers
 * to try again (keeps the current state) or to reload (starts clean).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Onverwachte fout in de simulator:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md space-y-4 rounded-xl border border-destructive/30 bg-card p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="text-lg font-semibold text-foreground">Er ging iets mis in de simulator</h1>
          <p className="text-sm text-muted-foreground">
            Probeer het opnieuw. Lukt dat niet, herlaad dan de pagina — je netwerk en regels gaan daarbij
            wel verloren.
          </p>
          <p className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground break-words">{error.message}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              Opnieuw proberen
            </Button>
            <Button onClick={() => window.location.reload()}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Pagina herladen
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
