import type { UpdateApi, UpdateSnapshot, UpstreamUpdateSnapshot } from '../shared/update';
import { invoke, on } from './lib';

export const update = {
  getState: () => invoke('update:get-state'),
  check: () => invoke('update:check'),
  download: () => invoke('update:download'),
  install: () => invoke('update:install'),
  deferInstall: () => invoke('update:defer-install'),
  openDownloadPage: () => invoke('update:open-download-page'),
  upstreamGetState: () => invoke('update:upstream-get-state'),
  upstreamCheck: () => invoke('update:upstream-check'),
  onState: (listener: (state: UpdateSnapshot) => void) =>
    on<UpdateSnapshot>('update:state', listener),
  onUpstreamState: (listener: (state: UpstreamUpdateSnapshot) => void) =>
    on<UpstreamUpdateSnapshot>('update:upstream-state', listener),
} satisfies UpdateApi;
