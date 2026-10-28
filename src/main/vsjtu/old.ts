// 旧版云录播（Canvas LTI 外部工具）只读接入：用 Canvas 令牌完成 LTI 1.1 启动，
// 在 courses.sjtu.edu.cn 建立会话后读取历史课程录像。旧系统已停止维护，失败按普通错误上抛。
import { createHash } from 'node:crypto';
import type { ClassroomVideo } from '../../shared/vsjtu';
import { getCampusSession } from '../campus';
import { loadCanvasToken } from '../credentials';

const OLD_ORIGIN = 'https://courses.sjtu.edu.cn';
const OLD_TOOL_ID = 18717;
const SESSION_TTL_MS = 20 * 60 * 1000;
const LIST_TTL_MS = 5 * 60 * 1000;
const STREAM_TTL_MS = 10 * 60 * 1000;
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};
const MEDIA_HOSTS = new Set(['videos.sjtu.edu.cn', 'live.sjtu.edu.cn']);

interface OldSession {
  canvasCourseId: string;
  cookies: string;
  playerUrl: string;
  expiresAt: number;
}
interface OldVideoEntry {
  courseId: number;
  oldVideoId: string;
}
interface OldStream {
  view: number;
  duration: number;
  url: string;
}

const sessions = new Map<number, OldSession>();
const lists = new Map<number, { videos: ClassroomVideo[]; expiresAt: number }>();
const streams = new Map<number, { list: OldStream[]; expiresAt: number }>();
const videoIds = new Map<string, number>();
const videoIndex = new Map<number, OldVideoEntry>();

function mergeCookies(base: string, setCookies: string[]): string {
  const jar = new Map<string, string>();
  for (const part of base.split('; ')) {
    if (!part) continue;
    const [name = '', ...rest] = part.split('=');
    jar.set(name.trim(), rest.join('='));
  }
  for (const cookie of setCookies) {
    const [pair] = cookie.split(';');
    if (!pair) continue;
    const [name = '', ...rest] = pair.split('=');
    jar.set(name.trim(), rest.join('='));
  }
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function setCookiesOf(response: Response): string[] {
  return response.headers.getSetCookie?.() ?? [];
}

function requireToken(): string {
  const token = loadCanvasToken();
  if (!token) throw new Error('请先在设置中连接 Canvas，旧版录播需要 Canvas 令牌');
  return token;
}

async function postOld(session: OldSession, path: string, data: Record<string, string>) {
  const response = await fetch(`${OLD_ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      ...BROWSER_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Origin: OLD_ORIGIN,
      Referer: session.playerUrl,
      ...(session.cookies ? { Cookie: session.cookies } : {}),
    },
    body: new URLSearchParams(data).toString(),
    redirect: 'manual',
  });
  const text = await response.text();
  let payload: {
    code?: number;
    desc?: string;
    body?: { list?: unknown[]; videoPlayResponseVoList?: unknown[] };
  };
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    throw new Error('旧版录播返回了非 JSON 数据，接口可能已变更');
  }
  if (!payload || payload.code !== 200) throw new Error(`旧版录播：${payload?.desc || '请求失败'}`);
  return payload.body ?? {};
}

async function launchOldSession(courseId: number): Promise<OldSession> {
  const cached = sessions.get(courseId);
  if (cached && cached.expiresAt > Date.now()) return cached;
  const token = requireToken();
  const campus = await getCampusSession();
  const launchUrl =
    `https://oc.sjtu.edu.cn/api/v1/courses/${courseId}/external_tools/sessionless_launch` +
    `?id=${OLD_TOOL_ID}&launch_type=course_navigation`;
  const launchResponse = await campus.fetch(launchUrl, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'manual',
  });
  if (!launchResponse.ok) throw new Error(`旧版录播启动失败（HTTP ${launchResponse.status}）`);
  const launch = JSON.parse(await launchResponse.text()) as { url?: string; name?: string };
  if (!launch.url) throw new Error('旧版录播启动地址缺失，接口可能已变更');

  const launchPage = await campus.fetch(launch.url, { redirect: 'manual' });
  const launchHtml = await launchPage.text();
  const formMatch = launchHtml.match(/<form action="([^"]+)"[\s\S]*?<\/form>/);
  if (!formMatch) throw new Error('旧版录播启动表单缺失，接口可能已变更');
  const fields = [...formMatch[0].matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)].map(
    (match) => [match[1]!, match[2] ?? ''] as [string, string],
  );
  if (!fields.length) throw new Error('旧版录播启动表单为空，接口可能已变更');

  let response = await fetch(formMatch[1]!, {
    method: 'POST',
    headers: {
      ...BROWSER_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://oc.sjtu.edu.cn',
      Referer: 'https://oc.sjtu.edu.cn/',
    },
    body: new URLSearchParams(fields).toString(),
    redirect: 'manual',
  });
  let cookies = mergeCookies('', setCookiesOf(response));
  let playerUrl = response.headers.get('location') ?? '';
  let playerHtml = '';
  for (let index = 0; playerUrl && index < 6; index++) {
    response = await fetch(playerUrl, {
      headers: { ...BROWSER_HEADERS, ...(cookies ? { Cookie: cookies } : {}) },
      redirect: 'manual',
    });
    cookies = mergeCookies(cookies, setCookiesOf(response));
    playerHtml = await response.text();
    const next = response.headers.get('location');
    if (!next || ![301, 302, 303, 307, 308].includes(response.status)) break;
    playerUrl = next;
  }
  if (!playerHtml) throw new Error('旧版录播页面为空，接口可能已变更');
  const canvasCourseId = (playerUrl.match(/canvasCourseId=([^&]+)/) ?? [])[1];
  if (!canvasCourseId) throw new Error('旧版录播课程标识缺失，接口可能已变更');
  const session: OldSession = {
    canvasCourseId,
    cookies,
    playerUrl,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(courseId, session);
  return session;
}

function syntheticVideoId(courseId: number, oldVideoId: string): number {
  const key = `${courseId}:${oldVideoId}`;
  const existing = videoIds.get(key);
  if (existing !== undefined) return existing;
  const digest = createHash('sha1').update(key).digest();
  let value = -((digest.readUInt32BE(0) % 2_000_000_000) + 1);
  while (videoIndex.has(value)) value -= 1;
  videoIds.set(key, value);
  videoIndex.set(value, { courseId, oldVideoId });
  return value;
}

export async function listOldVideos(canvasCourseId: number): Promise<ClassroomVideo[]> {
  const cached = lists.get(canvasCourseId);
  if (cached && cached.expiresAt > Date.now()) return cached.videos;
  const session = await launchOldSession(canvasCourseId);
  const body = await postOld(session, '/lti/vodVideo/findVodVideoList', {
    pageIndex: '1',
    pageSize: '1000',
    canvasCourseId: session.canvasCourseId,
  });
  const rows = Array.isArray(body.list) ? body.list : [];
  const videos: ClassroomVideo[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const video = row as Record<string, unknown>;
    const oldVideoId = typeof video.videoId === 'string' ? video.videoId : '';
    if (!oldVideoId) continue;
    const title = typeof video.videoName === 'string' ? video.videoName : '';
    const lecture = title.match(/\(第(\d+)讲\)/)?.[1];
    videos.push({
      id: syntheticVideoId(canvasCourseId, oldVideoId),
      start: typeof video.courseBeginTime === 'string' ? video.courseBeginTime : '',
      end: '',
      room: typeof video.classroomName === 'string' ? video.classroomName : '',
      period: lecture ? `第${lecture}讲` : '',
      source: 'old',
    });
  }
  videos.sort((a, b) => b.start.localeCompare(a.start));
  lists.set(canvasCourseId, { videos, expiresAt: Date.now() + LIST_TTL_MS });
  return videos;
}

async function oldStreamsOf(canvasCourseId: number, videoId: number): Promise<OldStream[]> {
  const entry = videoIndex.get(videoId);
  if (!entry || entry.courseId !== canvasCourseId)
    throw new Error('旧版录像不存在，请重新选择课程');
  const cached = streams.get(videoId);
  if (cached && cached.expiresAt > Date.now()) return cached.list;
  const session = await launchOldSession(canvasCourseId);
  const body = await postOld(session, '/lti/vodVideo/getVodVideoInfos', {
    playTypeHls: 'true',
    id: entry.oldVideoId,
    isAudit: 'true',
  });
  const rows = Array.isArray(body.videoPlayResponseVoList) ? body.videoPlayResponseVoList : [];
  const list: OldStream[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const stream = row as Record<string, unknown>;
    const url = [stream.rtmpUrlHdv, stream.rtmpUrlFluency, stream.rtmpUrlDefault].find(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
    if (!url) continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:' || !MEDIA_HOSTS.has(parsed.hostname))
      throw new Error('旧版录播返回了不支持的媒体地址');
    list.push({
      view: list.length + 1,
      duration:
        typeof stream.videPlayTime === 'number' && Number.isFinite(stream.videPlayTime)
          ? stream.videPlayTime
          : 0,
      url: parsed.href,
    });
  }
  if (!list.length) throw new Error('暂未获取到可播放录像，请稍后重试');
  streams.set(videoId, { list, expiresAt: Date.now() + STREAM_TTL_MS });
  return list;
}

export async function getOldStreams(canvasCourseId: number, videoId: number): Promise<OldStream[]> {
  return oldStreamsOf(canvasCourseId, videoId);
}

export async function getOldDownloadUrl(
  canvasCourseId: number,
  videoId: number,
  view: number,
): Promise<string> {
  const list = await oldStreamsOf(canvasCourseId, videoId);
  const stream = list.find((item) => item.view === view);
  if (!stream) throw new Error('该画面暂不可用');
  return stream.url;
}
