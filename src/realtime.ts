import { RecordModel } from 'pocketbase';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export interface WsRealtimeHandlers {
  onGame: (action: string, record: RecordModel) => void;
  onTxn: (action: string, record: RecordModel) => void;
  onPlayer: (action: string, record: RecordModel) => void;
  onStatus?: (status: WsStatus) => void;
}

const TOPICS = ['games/*', 'transactions/*', 'players/*'];

export const connectWsRealtime = (handlers: WsRealtimeHandlers): (() => void) => {
  let ws: WebSocket | null = null;
  let alive = true;
  let backoff = 1000;
  let reconnectTimer: number | null = null;
  let lastStatus: WsStatus | null = null;

  const setStatus = (s: WsStatus) => {
    if (lastStatus === s) return;
    lastStatus = s;
    handlers.onStatus?.(s);
  };

  const scheduleReconnect = () => {
    if (!alive || reconnectTimer !== null) return;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, backoff);
    backoff = Math.min(backoff * 1.6, 15000);
  };

  const connect = () => {
    if (!alive) return;
    setStatus('connecting');
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;

    try {
      ws = new WebSocket(url);
    } catch {
      setStatus('disconnected');
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      backoff = 1000;
    };

    ws.onmessage = (e) => {
      let msg: { type?: string; topic?: string; action?: string; record?: RecordModel };
      try {
        msg = JSON.parse(typeof e.data === 'string' ? e.data : '');
      } catch {
        return;
      }
      if (msg.type === 'ready') {
        setStatus('connected');
        ws?.send(JSON.stringify({ type: 'subscribe', subscriptions: TOPICS }));
      } else if (msg.type === 'event' && msg.action && msg.record) {
        const topic = String(msg.topic ?? '');
        if (topic.startsWith('games')) handlers.onGame(msg.action, msg.record);
        else if (topic.startsWith('transactions')) handlers.onTxn(msg.action, msg.record);
        else if (topic.startsWith('players')) handlers.onPlayer(msg.action, msg.record);
      }
    };

    ws.onclose = () => {
      ws = null;
      setStatus('disconnected');
      scheduleReconnect();
    };

    ws.onerror = () => {
      // close fires after error; reconnect is scheduled there.
    };
  };

  connect();

  return () => {
    alive = false;
    if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
    try { ws?.close(); } catch {}
  };
};
