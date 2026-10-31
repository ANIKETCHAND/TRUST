import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

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
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-rose-800/80 bg-rose-950/20 p-8 text-center backdrop-blur">
          <AlertOctagon className="h-10 w-10 text-rose-400" />
          <h2 className="mt-3 text-base font-bold text-white">Component Telemetry Failure</h2>
          <p className="mt-1 max-w-md text-xs text-slate-400">
            {this.state.error?.message || 'An unexpected rendering error occurred inside this security module.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry Component Render
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
