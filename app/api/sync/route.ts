import { fetchSource } from "@/lib/sync/parse";

/**
 * 同步 API（服务端执行，绕开浏览器 CORS 限制）
 *
 * POST /api/sync
 * body: { targets: [{ id, url, officialDomain, kind, year }] }
 * 返回: { ok, at, results: [{ id, ...FetchOutcome }] }
 *
 * 说明：只在本地 next 服务里跑，只读取公开页面；任何失败都会如实返回，
 * 由前端决定「保留旧数据 + 标记同步失败」，服务端不做任何写库操作。
 *
 * 注意：本项目启用了 cacheComponents，Route Handler 不能再声明 `runtime` /
 * `dynamic` 段配置（Next 16 会直接报错），因此这里保持默认（Node + 动态执行）。
 */

type Target = {
  id: string;
  url: string;
  officialDomain?: string;
  kind?: string;
  year?: number | null;
};

const MAX_TARGETS = 12;
const CONCURRENCY = 3;

function sanitizeTargets(raw: unknown): Target[] {
  if (!Array.isArray(raw)) return [];
  const out: Target[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const url = typeof o.url === "string" ? o.url : "";
    if (!id || !url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({
      id,
      url,
      officialDomain: typeof o.officialDomain === "string" ? o.officialDomain : "",
      kind: typeof o.kind === "string" ? o.kind : "DOC_LIST",
      year: typeof o.year === "number" ? o.year : null,
    });
    if (out.length >= MAX_TARGETS) break;
  }
  return out;
}

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const targets = sanitizeTargets((body as { targets?: unknown } | null)?.targets);
  if (!targets.length) {
    return Response.json({ ok: false, error: "没有可检查的目标（targets 为空）" }, { status: 400 });
  }

  const queue = [...targets];
  const results: (Record<string, unknown> & { id: string })[] = [];

  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (;;) {
      const target = queue.shift();
      if (!target) return;
      const outcome = await fetchSource(target.url, target.officialDomain ?? "", {
        kind: target.kind,
        timeoutMs: 20000,
      });
      results.push({ id: target.id, year: target.year ?? null, sourceUrl: target.url, ...outcome });
    }
  });

  await Promise.all(workers);

  return Response.json({
    ok: true,
    at: new Date().toISOString(),
    checked: results.length,
    results,
  });
}

export async function GET() {
  return Response.json({
    ok: true,
    hint: "POST { targets: [{ id, url, officialDomain, kind, year }] } —— 服务端抓取官方页面并返回标题/发布时间/文档列表/contentHash",
  });
}
