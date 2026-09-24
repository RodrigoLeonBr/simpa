import '@testing-library/jest-dom/vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

// jsdom's getContext returns null; ECharts' canvas painter then null-derefs.
// Minimal 2D-context stub so tests can render the real <EChart> without crashing.
HTMLCanvasElement.prototype.getContext = function getContextStub(
  this: HTMLCanvasElement,
) {
  return {
    canvas: this,
    fillRect() {},
    clearRect() {},
    getImageData: () => ({ data: [] }),
    putImageData() {},
    createImageData: () => [],
    setTransform() {},
    drawImage() {},
    save() {},
    fillText() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    stroke() {},
    translate() {},
    scale() {},
    rotate() {},
    arc() {},
    fill() {},
    measureText: () => ({ width: 0 }),
    transform() {},
    rect() {},
    clip() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    setLineDash() {},
  };
} as unknown as typeof HTMLCanvasElement.prototype.getContext;
