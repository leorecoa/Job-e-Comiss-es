import React from 'react';
import { reportUnexpectedError } from '../utils/observability';

type State = { hasError: boolean };

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    reportUnexpectedError('react:error-boundary', error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <main className="ui-auth-shell min-h-screen flex items-center justify-center px-6 text-center">
          <div className="ui-surface p-8">
            <h1 className="text-2xl font-bold">Nao foi possivel carregar esta tela.</h1>
            <p className="ui-owner-help mt-3">Recarregue a pagina para tentar novamente.</p>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
