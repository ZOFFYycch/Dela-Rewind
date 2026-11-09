import { useState } from 'react';
import { Archive, CloudUpload, TableProperties } from 'lucide-react';
import { LevelShell, type LevelNavItem } from '../../components/level-shell';
import { ArchiveStatsView } from './ArchiveStatsView';

type ArchiveTab = 'stats' | 'transfer';

const items: LevelNavItem<ArchiveTab>[] = [
  { id: 'stats', label: '统计', icon: TableProperties },
  { id: 'transfer', label: '传输', icon: CloudUpload },
];

export function ArchiveHub() {
  const [tab, setTab] = useState<ArchiveTab>(() =>
    localStorage.getItem('dela.archive.tab') === 'transfer' ? 'transfer' : 'stats',
  );
  const select = (next: ArchiveTab) => {
    setTab(next);
    try {
      localStorage.setItem('dela.archive.tab', next);
    } catch {
      /* 只影响下次打开时的默认页 */
    }
  };

  return (
    <LevelShell
      active={tab}
      icon={Archive}
      items={items}
      onSelect={select}
      storageKey="dela.archive.sidebar"
      title="课堂视频归档"
    >
      {tab === 'stats' ? (
        <ArchiveStatsView />
      ) : (
        <div className="grid h-full place-items-center p-6 text-center">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold text-ink">传输</h2>
            <p className="text-13 text-ink-3">下载与百度网盘传输将在统计完成后接入。</p>
          </div>
        </div>
      )}
    </LevelShell>
  );
}
