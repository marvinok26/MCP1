import { createHash } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import { optionalEnv, requiredEnv } from './config.js';

export type ReportingSystem = 'ulterpos' | 'tranquil' | 'ulternet' | 'social-apps' | 'renegade';
type GoogleScope = 'https://www.googleapis.com/auth/analytics.readonly' | 'https://www.googleapis.com/auth/webmasters.readonly';
type AnalyticsRow = { dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> };
type SearchRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

const tokenUrl = 'https://oauth2.googleapis.com/token';
const analyticsApi = 'https://analyticsdata.googleapis.com/v1beta';
const searchApi = 'https://searchconsole.googleapis.com/webmasters/v3';
const maxDateRangeDays = 90;
const maxResponseBytes = 512 * 1024;
const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();
const tokenRequests = new Map<string, Promise<string>>();

function parseMap(name: string): Map<ReportingSystem, string> {
  const raw = optionalEnv(name);
  const result = new Map<ReportingSystem, string>();
  if (!raw) return result;
  for (const entry of raw.split(',')) {
    const separator = entry.indexOf('=');
    if (separator < 1 || separator === entry.length - 1) throw new Error(`${name} must contain comma-separated system=value entries`);
    const system = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (!['ulterpos', 'tranquil', 'ulternet', 'social-apps', 'renegade'].includes(system)) throw new Error(`${name} contains an unknown system key`);
    if (result.has(system as ReportingSystem)) throw new Error(`${name} contains a duplicate system key`);
    result.set(system as ReportingSystem, value);
  }
  return result;
}

function reportingConfig(scope: GoogleScope) {
  const email = requiredEnv('GOOGLE_REPORTING_SERVICE_ACCOUNT_EMAIL');
  const privateKey = requiredEnv('GOOGLE_REPORTING_SERVICE_ACCOUNT_PRIVATE_KEY').replace(/\\n/g, '\n');
  if (!email.includes('@') || !privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error('Google reporting credentials are not configured correctly');
  }
  return { email, privateKey, scope };
}

function configuredProperty(system: ReportingSystem, key: 'GOOGLE_ANALYTICS_PROPERTY_IDS' | 'GOOGLE_SEARCH_CONSOLE_SITES'): string {
  const value = parseMap(key).get(system);
  if (!value) throw new Error(`Google reporting is not configured for ${system}`);
  if (key === 'GOOGLE_ANALYTICS_PROPERTY_IDS' && !/^\d{5,20}$/.test(value)) {
    throw new Error(`The GA4 property ID for ${system} must be numeric; it is different from the G- measurement ID`);
  }
  if (key === 'GOOGLE_SEARCH_CONSOLE_SITES') {
    if (value.startsWith('sc-domain:')) {
      if (!/^sc-domain:[a-z0-9.-]+$/i.test(value)) throw new Error(`The Search Console domain property for ${system} is invalid`);
    } else {
      let url: URL;
      try { url = new URL(value); } catch { throw new Error(`The Search Console site URL for ${system} is invalid`); }
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
        throw new Error(`The Search Console site URL for ${system} must be an HTTPS property URL without credentials, query, or fragment`);
      }
    }
  }
  return value;
}

function configuredAnalyticsStreamId(system: ReportingSystem): string {
  const value = parseMap('GOOGLE_ANALYTICS_STREAM_IDS').get(system);
  if (!value || !/^\d{5,20}$/.test(value)) {
    throw new Error(`A numeric GA4 stream ID is required for ${system} to keep reports scoped to that site`);
  }
  return value;
}

function streamDimensionFilter(streamId: string) {
  return {
    filter: {
      fieldName: 'streamId',
      stringFilter: { matchType: 'EXACT', value: streamId },
    },
  };
}

function validateDateRange(startDate: string, endDate: string): void {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(startDate) || !datePattern.test(endDate)) throw new Error('Dates must use YYYY-MM-DD format');
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.toISOString().slice(0, 10) !== startDate || end.toISOString().slice(0, 10) !== endDate) {
    throw new Error('The date range contains an invalid calendar date');
  }
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (startDate > endDate || endDate > today || days > maxDateRangeDays) {
    throw new Error(`Choose a date range from 1 to ${maxDateRangeDays} days ending today or earlier`);
  }
}

async function serviceToken(scope: GoogleScope): Promise<string> {
  const { email, privateKey } = reportingConfig(scope);
  const keyId = createHash('sha256').update(privateKey).digest('hex').slice(0, 16);
  const cacheKey = `${email}:${keyId}:${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken;
  const existing = tokenRequests.get(cacheKey);
  if (existing) return existing;

  const pending = (async () => {
    const now = Math.floor(Date.now() / 1000);
    const assertion = await new SignJWT({ scope })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(email)
      .setAudience(tokenUrl)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(await importPKCS8(privateKey, 'RS256'));
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await readJson(response);
    if (!response.ok || typeof payload.access_token !== 'string' || typeof payload.expires_in !== 'number') {
      throw new Error('Google reporting authentication failed; check the service account configuration');
    }
    tokenCache.set(cacheKey, { accessToken: payload.access_token, expiresAt: Date.now() + payload.expires_in * 1000 });
    return payload.access_token;
  })();
  tokenRequests.set(cacheKey, pending);
  try { return await pending; } finally { tokenRequests.delete(cacheKey); }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > maxResponseBytes) throw new Error('Google reporting response exceeded the configured size limit');
  const reader = response.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > maxResponseBytes) {
      await reader.cancel();
      throw new Error('Google reporting response exceeded the configured size limit');
    }
    chunks.push(value);
  }
  const body = new TextDecoder().decode(Buffer.concat(chunks, byteLength));
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* Convert provider responses into a safe generic error below. */ }
  return {};
}

async function googlePost(url: string, scope: GoogleScope, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await serviceToken(scope)}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('Google denied read access; verify that the service account was granted Viewer access to this property');
    if (response.status === 429 || response.status >= 500) throw new Error(`Google reporting is temporarily unavailable (HTTP ${response.status})`);
    throw new Error(`Google reporting rejected the request (HTTP ${response.status}); check the property and API configuration`);
  }
  return payload;
}

function resultRows(payload: Record<string, unknown>): AnalyticsRow[] {
  return Array.isArray(payload.rows) ? payload.rows as AnalyticsRow[] : [];
}

function safeMetric(value: string | undefined): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function analyticsTotal(payload: Record<string, unknown>): Record<string, number> {
  const totals = Array.isArray(payload.totals) ? payload.totals[0] as AnalyticsRow | undefined : undefined;
  const values = totals?.metricValues ?? [];
  return Object.fromEntries(values.map((metric, index) => [['sessions', 'activeUsers', 'keyEvents'][index]!, safeMetric(metric.value)]));
}

function analyticsItems(payload: Record<string, unknown>, labels: string[]): Array<Record<string, string | number>> {
  return resultRows(payload).map((row) => {
    const item: Record<string, string | number> = {};
    labels.forEach((label, index) => { item[label] = row.dimensionValues?.[index]?.value ?? ''; });
    ['sessions', 'activeUsers', 'keyEvents'].forEach((label, index) => {
      const value = row.metricValues?.[index]?.value;
      if (value !== undefined) item[label] = safeMetric(value);
    });
    return item;
  });
}

export async function analyticsChannelSummary(system: ReportingSystem, startDate: string, endDate: string) {
  validateDateRange(startDate, endDate);
  const propertyId = configuredProperty(system, 'GOOGLE_ANALYTICS_PROPERTY_IDS');
  const streamId = configuredAnalyticsStreamId(system);
  const payload = await googlePost(`${analyticsApi}/properties/${propertyId}:runReport`, 'https://www.googleapis.com/auth/analytics.readonly', {
    dateRanges: [{ startDate, endDate }],
    dimensionFilter: streamDimensionFilter(streamId),
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'keyEvents' }],
    metricAggregations: ['TOTAL'],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: '25',
  });
  return { system, startDate, endDate, totals: analyticsTotal(payload), channels: analyticsItems(payload, ['channel']) };
}

export async function analyticsLandingPageSummary(system: ReportingSystem, startDate: string, endDate: string) {
  validateDateRange(startDate, endDate);
  const propertyId = configuredProperty(system, 'GOOGLE_ANALYTICS_PROPERTY_IDS');
  const streamId = configuredAnalyticsStreamId(system);
  const payload = await googlePost(`${analyticsApi}/properties/${propertyId}:runReport`, 'https://www.googleapis.com/auth/analytics.readonly', {
    dateRanges: [{ startDate, endDate }],
    dimensionFilter: streamDimensionFilter(streamId),
    dimensions: [{ name: 'landingPage' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'keyEvents' }],
    metricAggregations: ['TOTAL'],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: '25',
  });
  return {
    system, startDate, endDate, totals: analyticsTotal(payload),
    landingPages: analyticsItems(payload, ['path']).map((row) => ({ ...row, path: String(row.path).split(/[?#]/, 1)[0]?.slice(0, 300) ?? '/' })),
  };
}

function safePage(value: string | undefined): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return '[omitted]';
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch { return '[omitted]'; }
}

function searchRows(payload: Record<string, unknown>): SearchRow[] {
  return Array.isArray(payload.rows) ? payload.rows as SearchRow[] : [];
}

export async function searchPerformanceSummary(system: ReportingSystem, startDate: string, endDate: string) {
  validateDateRange(startDate, endDate);
  const site = configuredProperty(system, 'GOOGLE_SEARCH_CONSOLE_SITES');
  const endpoint = `${searchApi}/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  const scope: GoogleScope = 'https://www.googleapis.com/auth/webmasters.readonly';
  const [totalResponse, pagesResponse] = await Promise.all([
    googlePost(endpoint, scope, { startDate, endDate, type: 'web' }),
    googlePost(endpoint, scope, { startDate, endDate, type: 'web', dimensions: ['page'], rowLimit: 25 }),
  ]);
  const total = searchRows(totalResponse)[0];
  const pages = searchRows(pagesResponse).map((row) => ({
    page: safePage(row.keys?.[0]),
    clicks: Number.isFinite(row.clicks) ? row.clicks : 0,
    impressions: Number.isFinite(row.impressions) ? row.impressions : 0,
    ctr: Number.isFinite(row.ctr) ? row.ctr : 0,
    averagePosition: Number.isFinite(row.position) ? row.position : 0,
  }));
  return {
    system, startDate, endDate,
    totals: {
      clicks: Number.isFinite(total?.clicks) ? total?.clicks ?? 0 : 0,
      impressions: Number.isFinite(total?.impressions) ? total?.impressions ?? 0 : 0,
      ctr: Number.isFinite(total?.ctr) ? total?.ctr ?? 0 : 0,
      averagePosition: Number.isFinite(total?.position) ? total?.position ?? 0 : 0,
    },
    topPages: pages,
    note: 'Search queries and visitor identifiers are excluded; Search Console page rows are limited to its top 25 results.',
  };
}
