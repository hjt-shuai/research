/**
 * 服务端抓取与解析（仅在 Route Handler 中使用，不要被客户端组件 import）。
 *
 * 设计要点：
 *  - 浏览器直接抓官网会被 CORS 拦，所以同步走 Frontend → /api/sync → 官网；
 *  - 只读取公开页面，不绕过任何登录/验证；被安全策略拦截时如实返回失败；
 *  - 用正文化摘要的 sha256 作为 contentHash 做变化检测（§10）；
 *  - 记录最终落点域名，跳转到非官方域名会标记出来（§37）。
 */

import { createHash } from "node:crypto";

export type FetchedDoc = { title: string; url: string; date: string | null };

export type FetchOutcome = {
  ok: boolean;
  status: number | null;
  finalUrl: string | null;
  finalDomain: string | null;
  officialDomainOk: boolean;
  title: string | null;
  publishedAt: string | null;
  notPublished: boolean;
  blocked: boolean;
  docCount: number | null;
  contentHash: string | null;
  docs: FetchedDoc[];
  error: string | null;
  bytes: number;
  ms: number;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 KaoyanPersonalReader/1.0";

const MAX_BYTES = 3 * 1024 * 1024;

export function sameSite(a: string, b: string): boolean {
  const norm = (x: string) => x.toLowerCase().replace(/^www\./, "");
  if (!a || !b) return false;
  const x = norm(a);
  const y = norm(b);
  return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`);
}

function stripNoise(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

function detectCharset(contentType: string, head: string): string {
  const fromHeader = /charset=([\w-]+)/i.exec(contentType)?.[1];
  const fromMeta = /charset=["']?([\w-]+)/i.exec(head)?.[1];
  const raw = (fromHeader || fromMeta || "utf-8").toLowerCase();
  if (raw.includes("gb2312") || raw.includes("gbk") || raw.includes("gb18030")) return "gb18030";
  return "utf-8";
}

function decode(buf: Uint8Array, contentType: string): string {
  const head = Buffer.from(buf.subarray(0, 2048)).toString("latin1");
  const charset = detectCharset(contentType, head);
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

function toAbsolute(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

const DATE_PATTERNS = [
  /(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/,
  /(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
];

function findDate(raw: string): string | null {
  if (!raw) return null;
  for (const re of DATE_PATTERNS) {
    const m = re.exec(raw);
    if (m) {
      const [, y, mo, d] = m;
      return `${y}-${String(Number(mo)).padStart(2, "0")}-${String(Number(d)).padStart(2, "0")}`;
    }
  }
  return null;
}

const NAV_JUNK = new Set([
  "首页", "研究生院", "在线投稿", "管理登陆", "管理登录", "更多", "更多>>", "下载", "登录", "注册",
  "上一页", "下一页", "返回", "English", "联系我们", "网站地图", "打印", "关闭", "分享", "首页 >>",
]);

function looksLikeNav(text: string): boolean {
  const t = text.replace(/\s+/g, "");
  if (NAV_JUNK.has(t)) return true;
  if (t.length <= 3) return true;
  if (/^(首页|返回|更多|下载|登录|上一页|下一页)/.test(t)) return true;
  return false;
}

/** 列表页里真正有用的条目：优先「有日期 + 中文标题」，过滤导航链接 */
function extractDocs(html: string, base: string): FetchedDoc[] {
  const out: FetchedDoc[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const url = toAbsolute(m[1], base);
    if (!url) continue;
    const text = stripNoise(m[2]);
    if (!text || text.length < 4) continue;
    if (looksLikeNav(text)) continue;
    // 过滤前端模板残留（如 {{item.title}}）
    if (/[{}]/.test(text)) continue;
    // 日期可能出现在链接文字之后（列表页常见：标题 … 2025-10-09）
    const after = stripNoise(html.slice(m.index + m[0].length, m.index + m[0].length + 220));
    const date = findDate(text) ?? findDate(after);
    const isArticle = /\/info\/\d+\/\d+\.htm|\/tzgg\/|\/xwzx\/|\/\d{4}\/\d{2}\//.test(url);
    // 既没有日期、又不是文章型链接、标题又短的，基本是栏目菜单，丢弃
    if (!date && !isArticle && text.length < 10) continue;
    out.push({ title: text.slice(0, 120), url, date });
    if (out.length >= 60) break;
  }
  // 有日期的排前面（新的在前），没有日期的保持页面顺序放在后面
  return out.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
}

function pickTitle(html: string, text: string): string | null {
  const t = /<title[^>]*>([\s\S]{0,200}?)<\/title>/i.exec(html)?.[1];
  if (t && stripNoise(t)) return stripNoise(t);
  const m = /(电子科技大学[^ ]{0,40}20\d{2}\s*年[^ ]{0,30})/.exec(text);
  return m ? m[1] : null;
}

function pickPublishedAt(text: string): string | null {
  const near = /(发布日期|发布时间|发布于|时间)[：:\s]{0,4}([^ ]{0,24})/.exec(text);
  if (near) {
    const d = findDate(near[2]);
    if (d) return d;
  }
  return null;
}

const NOT_PUBLISHED_RE = /(尚未开放|未开放|暂未开放|尚未公布|暂未公布|还未发布|尚未发布|待公布|暂无数据)/;

export async function fetchSource(
  url: string,
  officialDomain: string,
  opts: { timeoutMs?: number; kind?: string } = {},
): Promise<FetchOutcome> {
  const started = Date.now();
  const base: FetchOutcome = {
    ok: false,
    status: null,
    finalUrl: null,
    finalDomain: null,
    officialDomainOk: false,
    title: null,
    publishedAt: null,
    notPublished: false,
    blocked: false,
    docCount: null,
    contentHash: null,
    docs: [],
    error: null,
    bytes: 0,
    ms: 0,
  };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ...base, error: "URL 无效", ms: Date.now() - started };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ...base, error: "仅支持 http/https", ms: Date.now() - started };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9",
      },
    });
    clearTimeout(timer);

    const ab = await res.arrayBuffer();
    const bytes = ab.byteLength;
    const html = decode(
      new Uint8Array(ab).subarray(0, MAX_BYTES),
      res.headers.get("content-type") ?? "",
    );
    const text = stripNoise(html);
    const finalUrl = res.url || parsed.toString();
    const finalDomain = new URL(finalUrl).host;
    const docs = extractDocs(html, finalUrl);
    // 招生目录类页面：官网原文出现「尚未开放」即视为未发布（官方原文，可作证据）
    const notPublished = opts.kind === "YEAR_CATALOG" && NOT_PUBLISHED_RE.test(text);
    // 只有明确的拦截特征才算失败；正文短的 SPA 页面（如研招目录查询系统）是正常页面
    const blocked =
      res.status === 202 ||
      res.status === 403 ||
      res.status === 429 ||
      res.status === 503 ||
      /(系统检测|安全验证|请开启JavaScript|access denied|verify you are human|Just a moment)/i.test(text) ||
      (bytes < 1200 && text.length < 200);

    const hash = createHash("sha256")
      .update(text.slice(0, 200_000))
      .update("|")
      .update(docs.map((d) => `${d.title}@${d.date ?? ""}`).join(";").slice(0, 50_000))
      .digest("hex");

    return {
      ok: res.ok && !blocked,
      status: res.status,
      finalUrl,
      finalDomain,
      officialDomainOk: sameSite(finalDomain, officialDomain || finalDomain),
      title: pickTitle(html, text),
      publishedAt: pickPublishedAt(text),
      notPublished,
      blocked,
      docCount: docs.length,
      contentHash: hash,
      docs: docs.slice(0, 40),
      error: blocked
        ? `页面疑似被安全策略拦截（HTTP ${res.status}${bytes < 1200 ? "，响应过短" : ""}），已保留上一次成功数据`
        : res.ok
          ? null
          : `HTTP ${res.status}`,
      bytes,
      ms: Date.now() - started,
    };
  } catch (e) {
    const err = e as Error & { cause?: Error };
    const msg =
      err.name === "AbortError"
        ? "请求超时（>20s）"
        : err.cause?.message || err.message || "网络错误";
    return { ...base, error: msg, ms: Date.now() - started };
  }
}
