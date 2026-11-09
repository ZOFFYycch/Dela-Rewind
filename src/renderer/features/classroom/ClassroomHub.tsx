import { useState } from 'react';
import { Archive, History, MonitorPlay } from 'lucide-react';
import { LevelShell, type LevelNavItem } from '../../components/level-shell';
import { ClassroomView } from './ClassroomView';
import { OldClassroomView } from '../old-classroom/OldClassroomView';
import { ArchiveHub } from '../archive/ArchiveHub';

type ClassroomTab = 'new' | 'old' | 'archive';

const items: LevelNavItem<ClassroomTab>[] = [
  { id: 'new', label: '新版课堂视频', icon: MonitorPlay },
  { id: 'old', label: '旧版课堂视频', icon: History },
  { id: 'archive', label: '课堂视频归档', icon: Archive },
];

function initialTab(): ClassroomTab {
  const stored = localStorage.getItem('dela.classroom.tab');
  return stored === 'old' || stored === 'archive' ? stored : 'new';
}

export function ClassroomHub() {
  const [tab, setTab] = useState<ClassroomTab>(initialTab);
  const select = (next: ClassroomTab) => {
    setTab(next);
    try {
      localStorage.setItem('dela.classroom.tab', next);
    } catch {
      /* 只影响下次打开时的默认页 */
    }
  };

  return (
    <LevelShell
      active={tab}
      icon={MonitorPlay}
      items={items}
      onSelect={select}
      storageKey="dela.classroom.sidebar"
      title="课堂视频"
    >
      {tab === 'new' && <ClassroomView />}
      {tab === 'old' && <OldClassroomView />}
      {tab === 'archive' && <ArchiveHub />}
    </LevelShell>
  );
}
