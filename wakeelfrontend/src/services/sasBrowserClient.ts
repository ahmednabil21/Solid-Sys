/**
 * جلب مشتركي SAS مباشرة من المتصفح (يتجاوز حظر Cloudflare على سيرفر الباكند).
 * مسارات jt.iq: POST admin/api/index.php/api/login ثم admin/api/index.php/api/index/user
 */

export const SAS_LOGIN_PATH = 'admin/api/index.php/api/login';
export const SAS_USERS_PATH = 'admin/api/index.php/api/index/user';

export function normalizeSasBaseUrl(url: string): string {
  return (url || '').trim().replace(/\/+$/, '');
}

function sasLoginUrl(baseUrl: string): string {
  return `${normalizeSasBaseUrl(baseUrl)}/${SAS_LOGIN_PATH}`;
}

function sasUsersUrl(baseUrl: string): string {
  return `${normalizeSasBaseUrl(baseUrl)}/${SAS_USERS_PATH}`;
}

export interface SasBrowserLoginResult {
  token: string;
  status?: number;
}

export interface SasBrowserUsersPage {
  data: unknown[];
  last_page?: number;
  current_page?: number;
  total?: number;
}

function parseJsonSafe(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`استجابة SAS ليست JSON صالحاً: ${text.slice(0, 200)}`);
  }
}

/** تسجيل دخول SAS من المتصفح — نفس طلب DevTools على ftth.jt.iq */
export async function sasBrowserLogin(
  baseUrl: string,
  username: string,
  password: string
): Promise<SasBrowserLoginResult> {
  const res = await fetch(sasLoginUrl(baseUrl), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text?.trim() || `فشل تسجيل الدخول — HTTP ${res.status}`);
  }
  const body = parseJsonSafe(text);
  const token = body.token;
  if (typeof token !== 'string' || !token.trim()) {
    const msg = typeof body.message === 'string' ? body.message : 'لم يُرجَع token من SAS';
    throw new Error(msg);
  }
  return {
    token: token.trim(),
    status: typeof body.status === 'number' ? body.status : undefined,
  };
}

async function sasBrowserFetchUsersPageOnce(
  baseUrl: string,
  token: string,
  page: number,
  perPage: number,
  mode: 'json' | 'form' | 'multipart'
): Promise<SasBrowserUsersPage> {
  const url = sasUsersUrl(baseUrl);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  let res: Response;
  if (mode === 'json') {
    res = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, per_page: perPage }),
    });
  } else if (mode === 'form') {
    const fd = new URLSearchParams();
    fd.set('page', String(page));
    fd.set('per_page', String(perPage));
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: fd,
    });
  } else {
    const fd = new FormData();
    fd.append('page', String(page));
    fd.append('per_page', String(perPage));
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: fd,
    });
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(text?.trim() || `فشل جلب المشتركين — HTTP ${res.status}`);
  }
  const body = parseJsonSafe(text);
  const data = Array.isArray(body.data) ? body.data : [];
  return {
    data,
    last_page: typeof body.last_page === 'number' ? body.last_page : undefined,
    current_page: typeof body.current_page === 'number' ? body.current_page : undefined,
    total: typeof body.total === 'number' ? body.total : undefined,
  };
}

async function sasBrowserFetchUsersPage(
  baseUrl: string,
  token: string,
  page: number,
  perPage: number
): Promise<SasBrowserUsersPage> {
  const modes: Array<'json' | 'form' | 'multipart'> = ['json', 'multipart', 'form'];
  let lastErr: Error | null = null;
  for (const mode of modes) {
    try {
      return await sasBrowserFetchUsersPageOnce(baseUrl, token, page, perPage, mode);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error('فشل جلب صفحة المشتركين من SAS');
}

/** جلب كل صفحات المشتركين */
export async function sasBrowserFetchAllUsers(
  baseUrl: string,
  token: string,
  perPage = 100,
  onProgress?: (page: number, totalPages: number, loaded: number) => void
): Promise<unknown[]> {
  const all: unknown[] = [];
  let page = 1;
  let lastPage = 1;

  while (page <= lastPage) {
    const resp = await sasBrowserFetchUsersPage(baseUrl, token, page, perPage);
    if (resp.data.length) all.push(...resp.data);
    lastPage = resp.last_page ?? page;
    onProgress?.(page, lastPage, all.length);
    if (!resp.data.length || page >= lastPage) break;
    page += 1;
  }

  return all;
}

/** حزمة تصدير جاهزة للباكند — نفس شكل sas_fetch_users.py */
export function buildSasExportPayload(data: unknown[]): Record<string, unknown> {
  return {
    data,
    provider: 'sas',
    mode: 'subscriptions-all',
    includeAllStatuses: true,
  };
}
