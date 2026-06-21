import {
  Component,
  Suspense,
  type ComponentType,
  type ErrorInfo,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';
import { ModuleLoadingFallback } from './ModuleLoadingFallback';

interface ModuleLoadErrorProps {
  onRetry?: () => void;
}

export function ModuleLoadError({ onRetry }: ModuleLoadErrorProps) {
  return (
    <div className="page-content">
      <div
        className="analytics-state analytics-state-error"
        data-testid="module-load-error"
        role="alert"
      >
        <p>Não foi possível carregar esta página.</p>
        <p>
          Atualize o navegador (F5) ou tente novamente. Se o problema persistir após uma
          nova versão do sistema, use um refresh forçado (Ctrl+F5).
        </p>
        {onRetry ? (
          <button type="button" className="cadastro-btn primary" onClick={onRetry}>
            Tentar novamente
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface ModuleLoadErrorBoundaryProps {
  children: ReactNode;
}

interface ModuleLoadErrorBoundaryState {
  hasError: boolean;
}

export class ModuleLoadErrorBoundary extends Component<
  ModuleLoadErrorBoundaryProps,
  ModuleLoadErrorBoundaryState
> {
  state: ModuleLoadErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ModuleLoadErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Module load error:', error, info);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <ModuleLoadError onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

interface LazyModuleRouteProps {
  Page: LazyExoticComponent<ComponentType>;
}

export function LazyModuleRoute({ Page }: LazyModuleRouteProps) {
  return (
    <ModuleLoadErrorBoundary>
      <Suspense fallback={<ModuleLoadingFallback />}>
        <Page />
      </Suspense>
    </ModuleLoadErrorBoundary>
  );
}
