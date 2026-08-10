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
        <main className="min-h-screen flex items-center justify-center bg-gray-950 px-6 text-center text-white">
          <div>
            <h1 className="text-2xl font-bold">Nao foi possivel carregar esta tela.</h1>
            <p className="mt-3 text-gray-400">Recarregue a pagina para tentar novamente.</p>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
