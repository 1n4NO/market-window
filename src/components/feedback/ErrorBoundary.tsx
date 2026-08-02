import { Component, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Card } from '../layout/Card';
import { ErrorNotice } from './ErrorNotice';
import { IconButton } from '../layout/IconButton';

export interface ErrorBoundaryRenderProps {
  error: Error;
  reset: () => void;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle: string;
  fallbackMessage: string;
  fallbackActionLabel?: string;
  onFallbackAction?: () => void;
  resetKeys?: readonly unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (!this.state.error || !this.props.resetKeys || !prevProps.resetKeys) {
      return;
    }
    const hasChanged =
      this.props.resetKeys.length !== prevProps.resetKeys.length ||
      this.props.resetKeys.some((value, index) => !Object.is(value, prevProps.resetKeys?.[index]));
    if (hasChanged) {
      this.setState({ error: null });
    }
  }

  reset = (): void => {
    this.setState({ error: null });
    this.props.onFallbackAction?.();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <Card className="p-5 sm:p-6">
          <ErrorNotice title={this.props.fallbackTitle} message={this.props.fallbackMessage} />
          <div className="mt-3 flex flex-wrap gap-2">
            <IconButton onClick={this.reset} tone="subtle" type="button">
              <RotateCcw className="h-4 w-4" />
              {this.props.fallbackActionLabel ?? 'Try again'}
            </IconButton>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}
