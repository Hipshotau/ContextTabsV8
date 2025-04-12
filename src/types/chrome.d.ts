// Type definitions for Chrome's sidePanel API
// This extends the standard chrome type definitions

declare namespace chrome {
  export namespace sidePanel {
    export interface SidePanelOptions {
      path?: string;
      enabled?: boolean;
    }

    export interface PanelInfo {
      windowId: number;
      path: string;
      enabled: boolean;
    }

    export interface OpenOptions {
      windowId?: number;
      path?: string;
    }

    export interface CloseOptions {
      windowId: number;
    }

    export function getOptions(): Promise<SidePanelOptions>;
    export function setOptions(options: SidePanelOptions): Promise<void>;
    export function open(options?: OpenOptions): Promise<void>;
    export function close(options: CloseOptions): Promise<void>;
    export function getAll(): Promise<PanelInfo[]>;
  }
} 