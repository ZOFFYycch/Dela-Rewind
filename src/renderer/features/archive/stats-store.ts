// 统计任务放在页面之外，切换页面不会丢进度；扫描仍在渲染层执行。
import { create } from 'zustand';
import { useWorkspaceStore } from '../../workspace/store';

export interface ArchiveRow {
  source: '新版' | '旧版';
  term: string;
  course: string;
  video: string;
  teacher: string;
  view: number;
  duration: number;
  bytes: number | null;
  status: string;
}

async function mediaBytes(playbackUrl: string): Promise<number | null> {
  const response = await fetch(playbackUrl, { headers: { Range: 'bytes=0-0' } });
  const range = response.headers.get('content-range');
  const total = range?.split('/')[1];
  await response.body?.cancel();
  const bytes = total ? Number(total) : Number(response.headers.get('content-length'));
  return Number.isFinite(bytes) && bytes > 0 ? bytes : null;
}

interface ArchiveStatsState {
  rows: ArchiveRow[];
  scanning: boolean;
  progress: string;
  percent: number;
  error: string;
  scan: () => Promise<void>;
  cancel: () => void;
}

let cancelled = false;

export const useArchiveStats = create<ArchiveStatsState>((set, get) => ({
  rows: [],
  scanning: false,
  progress: '',
  percent: 0,
  error: '',
  cancel: () => {
    cancelled = true;
    set({ scanning: false, progress: '已取消' });
  },
  scan: async () => {
    const api = window.dela?.vsjtu;
    if (!api || get().scanning) return;
    cancelled = false;
    set({ scanning: true, rows: [], error: '', percent: 0, progress: '准备统计…' });
    const found: ArchiveRow[] = [];
    const flush = (progress: string, percent: number) => {
      if (!cancelled) set({ rows: [...found], progress, percent });
    };
    try {
      const terms = await api.listTerms();
      const termCourses: { term: string; courses: { id: number; name: string }[] }[] = [];
      for (const [index, term] of terms.entries()) {
        if (cancelled) return;
        flush(
          `新版：读取学期 ${index + 1}/${terms.length}`,
          (index / Math.max(1, terms.length)) * 45,
        );
        try {
          termCourses.push({ term: term.name, courses: await api.listCourses(term.id) });
        } catch {
          /* 单学期失败继续 */
        }
      }
      const totalCourses = termCourses.reduce((sum, item) => sum + item.courses.length, 0);
      let done = 0;
      for (const item of termCourses) {
        for (const course of item.courses) {
          if (cancelled) return;
          flush(`新版：${item.term} / ${course.name}`, 45 * (done / Math.max(1, totalCourses)));
          done++;
          let videos;
          try {
            videos = await api.listVideos(course.id);
          } catch {
            continue;
          }
          for (const video of videos) {
            if (cancelled) return;
            let streams;
            try {
              streams = await api.streams(video.id);
            } catch {
              continue;
            }
            for (const stream of streams) {
              let bytes: number | null = null;
              let status = 'ok';
              try {
                bytes = await mediaBytes(stream.playbackUrl);
                if (bytes === null) status = '大小未知';
              } catch {
                status = '读取大小失败';
              }
              found.push({
                source: '新版',
                term: item.term,
                course: course.name,
                video: `${video.start.slice(0, 10)} 第${video.period}节`,
                teacher: '',
                view: stream.view,
                duration: stream.duration,
                bytes,
                status,
              });
            }
          }
          flush(`新版：${item.term} / ${course.name}`, 45 * (done / Math.max(1, totalCourses)));
        }
      }

      const courses = useWorkspaceStore
        .getState()
        .canvas.courses.filter((course) => course.term && course.term !== '未标注学期');
      for (const [index, course] of courses.entries()) {
        if (cancelled) return;
        flush(`旧版：${course.name}`, 45 + 55 * (index / Math.max(1, courses.length)));
        let videos;
        try {
          videos = await api.oldVideos(course.id);
        } catch {
          continue;
        }
        for (const video of videos) {
          if (cancelled) return;
          let streams;
          try {
            streams = await api.oldStreams(course.id, video.id);
          } catch {
            continue;
          }
          for (const stream of streams) {
            let bytes: number | null = null;
            let status = 'ok';
            try {
              bytes = await mediaBytes(stream.playbackUrl);
              if (bytes === null) status = '大小未知';
            } catch {
              status = '读取大小失败';
            }
            found.push({
              source: '旧版',
              term: course.term ?? '',
              course: course.name,
              video: video.period || video.start,
              teacher: video.teacher ?? '',
              view: stream.view,
              duration: stream.duration,
              bytes,
              status,
            });
          }
        }
        flush(`旧版：${course.name}`, 45 + 55 * ((index + 1) / Math.max(1, courses.length)));
      }
      if (!cancelled)
        set({
          rows: found,
          scanning: false,
          percent: 100,
          progress: `统计完成：${found.length} 路画面`,
        });
    } catch (cause) {
      set({
        scanning: false,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  },
}));
