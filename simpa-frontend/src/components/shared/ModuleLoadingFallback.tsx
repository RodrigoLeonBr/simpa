export function ModuleLoadingFallback() {
  return (
    <div className="page-content">
      <div className="analytics-state" data-testid="module-loading-fallback">
        Carregando módulo…
      </div>
    </div>
  );
}
