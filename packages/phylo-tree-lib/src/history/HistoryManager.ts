export type HistoryAction = 'push' | 'undo' | 'redo' | 'reset' | 'clear';

export interface HistoryChangeEvent<T> {
  action: HistoryAction;
  value: T;
  canUndo: boolean;
  canRedo: boolean;
  undoSize: number;
  redoSize: number;
}

export interface HistoryManagerOptions {
  maxSize?: number;
}

/**
 * Универсальный менеджер истории состояния.
 * Используется для undo/redo в UI без дублирования стековой логики.
 */
export class HistoryManager<T> {
  private readonly maxSize: number;
  private readonly undoStack: T[] = [];
  private readonly redoStack: T[] = [];
  private currentValue: T;
  private readonly listeners = new Set<(event: HistoryChangeEvent<T>) => void>();

  constructor(initialValue: T, options?: HistoryManagerOptions) {
    this.currentValue = initialValue;
    const value = options?.maxSize ?? 50;
    this.maxSize = Number.isFinite(value) && value > 0 ? Math.floor(value) : 50;
  }

  get value(): T {
    return this.currentValue;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  push(nextValue: T): boolean {
    if (Object.is(nextValue, this.currentValue)) {
      return false;
    }

    this.undoStack.push(this.currentValue);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.currentValue = nextValue;
    this.redoStack.length = 0;
    this.emit('push');
    return true;
  }

  undo(): T | null {
    const prev = this.undoStack.pop();
    if (typeof prev === 'undefined') {
      return null;
    }

    this.redoStack.push(this.currentValue);
    this.currentValue = prev;
    this.emit('undo');
    return this.currentValue;
  }

  redo(): T | null {
    const next = this.redoStack.pop();
    if (typeof next === 'undefined') {
      return null;
    }

    this.undoStack.push(this.currentValue);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.currentValue = next;
    this.emit('redo');
    return this.currentValue;
  }

  reset(value: T): void {
    this.currentValue = value;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.emit('reset');
  }

  clearHistory(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.emit('clear');
  }

  onChange(listener: (event: HistoryChangeEvent<T>) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(action: HistoryAction): void {
    const event: HistoryChangeEvent<T> = {
      action,
      value: this.currentValue,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoSize: this.undoStack.length,
      redoSize: this.redoStack.length,
    };
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
