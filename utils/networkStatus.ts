type NetworkStatusListener = (online: boolean) => void;

export class NetworkStatusManager {
  private static instance: NetworkStatusManager;
  private online: boolean = true;
  private listeners: Set<NetworkStatusListener> = new Set();

  private constructor() {}

  public static getInstance(): NetworkStatusManager {
    if (!NetworkStatusManager.instance) {
      NetworkStatusManager.instance = new NetworkStatusManager();
    }
    return NetworkStatusManager.instance;
  }

  public isOnline(): boolean {
    return this.online;
  }

  public setOnline(isOnline: boolean): void {
    if (this.online !== isOnline) {
      this.online = isOnline;
      this.notifyListeners();
    }
  }

  public subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.online);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.online);
      } catch (err) {
        console.error("Error in network status listener:", err);
      }
    }
  }
}

export const networkStatusManager = NetworkStatusManager.getInstance();
