// 上游 Dela 只读更新检查：只报告官方版本，不下载、不安装。
import { app, BrowserWindow, ipcMain } from 'electron';
import { checkWorkspaceSender } from '../ipc';
import type { UpstreamUpdateSnapshot } from '../../shared/update';

const FEED_URL = 'https://openlist.frameneo.com/sd/Dela_latest_release/latest.yml';
const FEED_TIMEOUT_MS = 15_000;

let snapshot: UpstreamUpdateSnapshot | null = null;
let pending: Promise<UpstreamUpdateSnapshot> | null = null;

function currentState(): UpstreamUpdateSnapshot {
  snapshot ??= {
    phase: 'idle',
    currentVersion: app.getVersion(),
    latestVersion: null,
    checkedAt: null,
    detail: null,
  };
  return snapshot;
}

function broadcast(next: UpstreamUpdateSnapshot): UpstreamUpdateSnapshot {
  snapshot = next;
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('update:upstream-state', next);
  }
  return next;
}

function parseVersion(text: string): string | null {
  const match = /^\s*version:\s*['"]?([^'"\s]+)['"]?\s*$/m.exec(text);
  return match?.[1] ?? null;
}

function isNewer(latest: string, current: string): boolean {
  const left = latest.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const right = current.split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

async function check(): Promise<UpstreamUpdateSnapshot> {
  if (pending) return pending;
  pending = (async () => {
    const current = currentState();
    broadcast({ ...current, phase: 'checking', detail: null });
    try {
      const response = await fetch(FEED_URL, {
        headers: { Accept: 'text/yaml,text/plain,*/*' },
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const latest = parseVersion(await response.text());
      if (!latest) throw new Error('更新信息格式已变化');
      return broadcast({
        ...current,
        phase: isNewer(latest, current.currentVersion) ? 'available' : 'up-to-date',
        latestVersion: latest,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      return broadcast({
        ...current,
        phase: 'error',
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pending = null;
    }
  })();
  return pending;
}

export function registerUpstreamUpdateIpc(): void {
  ipcMain.handle('update:upstream-get-state', (event) => {
    checkWorkspaceSender(event);
    return currentState();
  });
  ipcMain.handle('update:upstream-check', (event) => {
    checkWorkspaceSender(event);
    return check();
  });
}
