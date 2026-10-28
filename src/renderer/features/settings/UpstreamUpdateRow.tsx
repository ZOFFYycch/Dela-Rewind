import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { SettingRow } from './SettingRow';
import { useUpstreamUpdate } from './upstream-update';

/** 上游 Dela 的只读版本行：只提示同步项目，不提供下载/安装。 */
export function UpstreamUpdateRow() {
  const snapshot = useUpstreamUpdate((state) => state.snapshot);
  const attach = useUpstreamUpdate((state) => state.attach);
  const check = useUpstreamUpdate((state) => state.check);

  useEffect(() => attach(), [attach]);

  const phase = snapshot?.phase ?? 'idle';
  const status =
    phase === 'checking'
      ? '正在检查上游 Dela…'
      : phase === 'available'
        ? `上游 Dela ${snapshot?.latestVersion} 已发布，请同步 Dela Rewind 项目后重新构建`
        : phase === 'up-to-date'
          ? '上游已是最新版本'
          : phase === 'error'
            ? '暂时无法获取上游版本，请稍后重试'
            : '尚未检查上游版本';

  return (
    <SettingRow
      description={
        <span className="grid gap-0.5">
          <span>当前版本 {snapshot?.currentVersion ?? '—'}</span>
          <span role="status">{status}</span>
        </span>
      }
      settingId="check-upstream-update"
      title="上游 Dela"
    >
      <Button
        disabled={phase === 'checking'}
        onClick={() => void check()}
        size="sm"
        variant="secondary"
      >
        {phase === 'checking' ? <RefreshCw className="animate-spin" /> : null}
        检查上游
      </Button>
    </SettingRow>
  );
}
