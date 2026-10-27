export interface GridCraftFilePayload {
  name: string;
  bytes: ArrayBuffer;
}

export interface GridCraftEventListener {
  onReady?: (version: string) => void;
  onSave?: (file: GridCraftFilePayload) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onError?: (error: string) => void;
}

export class GridCraftBridge {
  private iframe: HTMLIFrameElement | null = null;
  private listeners: GridCraftEventListener = {};
  private isReady = false;
  private pendingWorkbook: { name: string; bytes: ArrayBuffer | Uint8Array } | null = null;

  constructor(listeners?: GridCraftEventListener) {
    if (listeners) {
      this.listeners = listeners;
    }
    this.handleWindowMessage = this.handleWindowMessage.bind(this);
  }

  public attach(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
    window.addEventListener('message', this.handleWindowMessage);
  }

  public detach() {
    window.removeEventListener('message', this.handleWindowMessage);
    this.iframe = null;
    this.isReady = false;
    this.pendingWorkbook = null;
  }

  public updateListeners(listeners: GridCraftEventListener) {
    this.listeners = { ...this.listeners, ...listeners };
  }

  public get ready(): boolean {
    return this.isReady;
  }

  private handleWindowMessage(event: MessageEvent) {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'gridcraft:ready':
        this.isReady = true;
        this.listeners.onReady?.(data.version || '0.11.1');
        if (this.pendingWorkbook) {
          const { name, bytes } = this.pendingWorkbook;
          this.pendingWorkbook = null;
          this.openWorkbook(name, bytes);
        }
        break;

      case 'gridcraft:save':
        this.listeners.onSave?.({
          name: data.name || 'workbook.xlsx',
          bytes: data.bytes,
        });
        break;

      case 'gridcraft:dirty':
        this.listeners.onDirtyChange?.(Boolean(data.dirty));
        break;

      case 'gridcraft:failed':
        this.listeners.onError?.(data.error || 'Failed to initialize GridCraft');
        break;
    }
  }

  /**
   * Send a workbook to GridCraft to open and populate cells
   */
  public openWorkbook(name: string, bytes: ArrayBuffer | Uint8Array) {
    if (!this.isReady || !this.iframe || !this.iframe.contentWindow) {
      // Queue workbook to open the moment GridCraft engine fires ready
      this.pendingWorkbook = { name, bytes };
      return;
    }

    const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

    this.iframe.contentWindow.postMessage(
      {
        type: 'gridcraft:open',
        name,
        bytes: uint8,
      },
      '*'
    );
  }

  /**
   * Tell GridCraft in the iframe to execute a background save
   */
  public triggerSave() {
    if (!this.iframe || !this.iframe.contentWindow) return;
    this.iframe.contentWindow.postMessage({ type: 'gridcraft:trigger_save' }, '*');
  }
}
