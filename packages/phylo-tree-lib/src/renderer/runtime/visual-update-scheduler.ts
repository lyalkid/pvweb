export class VisualUpdateScheduler<T> {
  private rafId: number | null = null;
  private pendingValue: T | null = null;

  constructor(private readonly onFlush: (value: T) => void) {}

  schedule(value: T): void {
    this.pendingValue = value;
    if (this.rafId !== null) {
      return;
    }

    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = null;
      const next = this.pendingValue;
      this.pendingValue = null;
      if (next !== null) {
        this.onFlush(next);
      }
    });
  }

  clear(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pendingValue = null;
  }
}
