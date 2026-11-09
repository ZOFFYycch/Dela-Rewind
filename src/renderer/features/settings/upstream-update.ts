// 上游 Dela 版本提示：只读，不触发下载或安装。
import { create } from 'zustand';
import type { UpstreamUpdateSnapshot } from '../../../shared/update';

interface UpstreamUpdateState {
  snapshot: UpstreamUpdateSnapshot | null;
  attach: () => void;
  check: () => Promise<void>;
}

let attached = false;

export const useUpstreamUpdate = create<UpstreamUpdateState>((set, get) => ({
  snapshot: null,
  attach: () => {
    if (attached) return;
    const api = window.dela?.update;
    if (!api || typeof api.upstreamGetState !== 'function') return;
    attached = true;
    void api.upstreamGetState().then((snapshot) => {
      set({ snapshot });
      if (snapshot.phase === 'idle') void get().check();
    });
    api.onUpstreamState((snapshot) => set({ snapshot }));
  },
  check: async () => {
    const api = window.dela?.update;
    if (!api) return;
    try {
      const snapshot = await api.upstreamCheck();
      set({ snapshot });
    } catch {
      set({
        snapshot: {
          phase: 'error',
          currentVersion: get().snapshot?.currentVersion ?? '',
          latestVersion: null,
          checkedAt: null,
          detail: '检查上游版本失败',
        },
      });
    }
  },
}));
