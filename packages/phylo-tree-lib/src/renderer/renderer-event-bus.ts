import type { EventHandler, RendererEvent, RendererEventMap } from './core/types';

export class RendererEventBus {
  private handlers: { [K in RendererEvent]: Set<EventHandler<RendererEventMap[K]>> } = {
    nodeClick: new Set(),
    nodeHover: new Set(),
    backgroundClick: new Set(),
  };

  on<K extends RendererEvent>(event: K, handler: EventHandler<RendererEventMap[K]>): void {
    this.handlers[event].add(handler);
  }

  off<K extends RendererEvent>(event: K, handler: EventHandler<RendererEventMap[K]>): void {
    this.handlers[event].delete(handler);
  }

  emit<K extends RendererEvent>(event: K, payload: RendererEventMap[K], e: MouseEvent): void {
    for (const handler of this.handlers[event]) {
      handler(payload, e);
    }
  }

  clear(): void {
    this.handlers.nodeClick.clear();
    this.handlers.nodeHover.clear();
    this.handlers.backgroundClick.clear();
  }
}
