export type VideoSource = 'new' | 'old';

export interface VideoCourse {
  /** 新版为 v.sjtu 教学班 id；仅旧版有录像的课程用负的 Canvas 课程 id。 */
  id: number;
  code: string;
  name: string;
  /** 同一门课同时有 Canvas 旧版录像时，记录 Canvas 课程 id。 */
  oldCourseId?: number;
}
/** 交大视频的学年学期，用于按学期浏览往期课程录像。 */
export interface VideoTerm {
  /** 新版学期 id；只有 Canvas 有数据的学期用负数合成 id。 */
  id: number;
  /** 官方学期名，如「2025-2026 Spring」。 */
  name: string;
  current: boolean;
}
export interface ClassroomVideo {
  id: number;
  start: string;
  end: string;
  room: string;
  period: string;
  /** 旧版 Canvas 录播的合成 id 为负数；不写时按新版处理。 */
  source?: VideoSource;
}
export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
}
export interface VideoTranscript {
  videoId: number;
  segments: TranscriptSegment[];
}
export interface VideoStream {
  view: number;
  duration: number;
  /** dela-resource 播放代理地址（token 在本次应用运行期间有效），renderer 只作 video.src 使用。 */
  playbackUrl: string;
}
export interface VideoDownload {
  id: string;
  name: string;
  received: number;
  total: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
}
export interface VsjtuApi {
  connect(): Promise<{ ok: true } | { ok: false; error: string }>;
  listTerms(): Promise<VideoTerm[]>;
  /** 省略 termId 时取当前学期；传入任意学期 id 可浏览往期课程录像。 */
  listCourses(termId?: number): Promise<VideoCourse[]>;
  listVideos(courseId: number): Promise<ClassroomVideo[]>;
  /** 旧版 Canvas 录播：按 Canvas 课程 id 拉取录像列表（videos 的 id 为合成负数）。 */
  oldVideos(canvasCourseId: number): Promise<ClassroomVideo[]>;
  streams(videoId: number): Promise<VideoStream[]>;
  oldStreams(canvasCourseId: number, videoId: number): Promise<VideoStream[]>;
  transcript(videoId: number): Promise<VideoTranscript | null>;
  exportTranscript(videoId: number, title: string): Promise<{ saved: boolean }>;
  download(videoId: number, view: number, name: string): Promise<void>;
  downloadOld(canvasCourseId: number, videoId: number, view: number, name: string): Promise<void>;
  downloads(): Promise<VideoDownload[]>;
  cancelDownload(id: string): Promise<void>;
  revealDownload(id: string): Promise<void>;
  /** 课堂录像的默认保存位置；空串 = 未设置。 */
  getDownloadDirectory(): Promise<string>;
  /** 选一个默认保存位置；取消时返回当前值。 */
  chooseDownloadDirectory(): Promise<string>;
  onDownload(listener: (download: VideoDownload) => void): () => void;
}
