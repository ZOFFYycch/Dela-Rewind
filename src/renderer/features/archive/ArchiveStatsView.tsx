import { useMemo } from 'react';
import { Download, Loader2, Radar, Square } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useArchiveStats, type ArchiveRow } from './stats-store';

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${minutes}:${String(rest).padStart(2, '0')}`;
}

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** 课堂视频归档统计：只盘点，不下载。任务状态在页面外，离开页面不丢。 */
export function ArchiveStatsView() {
  const rows = useArchiveStats((state) => state.rows);
  const scanning = useArchiveStats((state) => state.scanning);
  const progress = useArchiveStats((state) => state.progress);
  const percent = useArchiveStats((state) => state.percent);
  const error = useArchiveStats((state) => state.error);
  const scan = useArchiveStats((state) => state.scan);
  const cancel = useArchiveStats((state) => state.cancel);

  const summary = useMemo(() => {
    const valid = rows.filter((row) => row.bytes !== null);
    return {
      videos: new Set(rows.map((row) => `${row.source}:${row.term}:${row.course}:${row.video}`))
        .size,
      views: rows.length,
      bytes: valid.reduce((sum, row) => sum + (row.bytes ?? 0), 0),
      failed: rows.length - valid.length,
      newRows: rows.filter((row) => row.source === '新版').length,
      oldRows: rows.filter((row) => row.source === '旧版').length,
    };
  }, [rows]);

  const exportCsv = () => {
    const header = ['来源', '学期', '课程', '视频', '教师', '画面', '时长秒', '字节数', '状态'];
    const lines = [
      header,
      ...rows.map((row) => [
        row.source,
        row.term,
        row.course,
        row.video,
        row.teacher,
        row.view,
        Math.round(row.duration),
        row.bytes ?? '',
        row.status,
      ]),
    ].map((line) => line.map(csvCell).join(','));
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dela-rewind-archive-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line/60 px-4 py-3">
        <Button disabled={scanning} onClick={() => void scan()} size="sm">
          {scanning ? <Loader2 className="animate-spin" /> : <Radar />}
          {scanning ? '统计中…' : '开始统计'}
        </Button>
        {scanning && (
          <Button onClick={cancel} size="sm" variant="secondary">
            <Square />
            取消
          </Button>
        )}
        <Button disabled={rows.length === 0} onClick={exportCsv} size="sm" variant="secondary">
          <Download />
          导出 CSV
        </Button>
        <span className="text-xs text-ink-3">
          {progress || '统计新版与旧版课堂视频，两路画面分别记录'}
        </span>
      </div>

      <div className="h-1 shrink-0 bg-hover-2">
        <div
          className="h-full bg-ink transition-[width] duration-300"
          style={{ width: `${Math.max(scanning ? 2 : 0, percent)}%` }}
        />
      </div>

      {error && <p className="px-4 py-2 text-13 text-bui-danger">{error}</p>}

      <div className="shrink-0 border-b border-line/60 px-4 py-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="视频数" value={summary.videos} />
          <Stat label="画面数" value={summary.views} />
          <Stat label="总大小" value={formatBytes(summary.bytes)} />
          <Stat label="失败/未知" value={summary.failed} />
        </div>
        <p className="mt-2 text-xs text-ink-3">
          新版 {summary.newRows} 路画面 · 旧版 {summary.oldRows} 路画面 · 新旧重叠分别统计
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-13">
          <thead className="sticky top-0 bg-surface text-xs text-ink-3">
            <tr>
              {['来源', '学期', '课程', '视频', '教师', '画面', '时长', '大小', '状态'].map(
                (name) => (
                  <th className="border-b border-line/60 px-3 py-2 font-medium" key={name}>
                    {name}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: ArchiveRow, index) => (
              <tr className="border-b border-line/40" key={`${row.source}-${index}`}>
                <td className="px-3 py-2">{row.source}</td>
                <td className="px-3 py-2">{row.term}</td>
                <td className="max-w-56 truncate px-3 py-2">{row.course}</td>
                <td className="max-w-48 truncate px-3 py-2">{row.video}</td>
                <td className="max-w-40 truncate px-3 py-2">{row.teacher || '—'}</td>
                <td className="px-3 py-2">{row.view}</td>
                <td className="px-3 py-2">{formatDuration(row.duration)}</td>
                <td className="px-3 py-2">{formatBytes(row.bytes)}</td>
                <td className="px-3 py-2 text-ink-3">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !scanning && (
          <p className="px-4 py-10 text-center text-13 text-ink-3">还没有统计结果。</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-card border border-line/60 bg-inset/40 px-3 py-2">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}
