import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Terminal } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AgentTrust ErrorBoundary caught unhandled error:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[380px] flex-col items-center justify-center rounded-lg border border-kali-critical/40 bg-kali-card p-8 text-center shadow-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-kali-critical/60 bg-[#331418] text-kali-critical mb-4">
            <AlertOctagon className="h-6 w-6" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-kali-critical">[CRITICAL_UI_FAULT]</span>
            <h2 className="text-sm font-bold text-white">Component Telemetry Exception</h2>
          </div>
          <p className="mt-2 max-w-lg font-mono text-xs text-slate-400 bg-kali-bg p-3 rounded border border-kali-border break-all">
            {this.state.error?.message || 'An unexpected runtime error occurred inside this command widget.'}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => this.setState({ hasError: false })}
              className="inline-flex items-center gap-2 rounded border border-kali-border bg-kali-elevated px-4 py-2 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:bg-kali-secondary hover:text-white transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 text-kali-primary" />
              Reload Widget
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded border border-transparent bg-kali-primary px-4 py-2 font-mono text-xs font-semibold text-white hover:bg-kali-secondaryBlue transition-colors"
            >
              <Terminal className="h-3.5 w-3.5" />
              Reboot Command Console
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
