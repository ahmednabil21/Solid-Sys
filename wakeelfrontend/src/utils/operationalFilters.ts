import type { AgentReseller } from '../types';

export const OPERATIONAL_REGION_STORAGE_KEY = 'selectedOperationalRegionId';
export const OPERATIONAL_RESELLER_STORAGE_KEY = 'selectedOperationalResellerId';

export interface RegionResellerFilterParams {
  regionId?: string;
  resellerId?: string;
}

/**
 * يبني معاملات فلترة المنطقة/الرسيلr للـ API:
 * - regionId فقط → كل رسيلrز المنطقة (RegionResellerFilter في الباكند)
 * - regionId + resellerId → رسيلr واحد ضمن المنطقة (يُتحقق من الانتماء في الباكند)
 * - resellerId فقط → يُضاف regionId تلقائياً من بيانات الرسيلr
 */
export function buildRegionResellerFilterParams(
  regionId?: string | null,
  resellerId?: string | null,
  resellers: AgentReseller[] = []
): RegionResellerFilterParams {
  const region = (regionId ?? '').trim();
  const reseller = (resellerId ?? '').trim();

  if (reseller) {
    const match = resellers.find((r) => r.id === reseller);
    const resellerRegionId = (match?.regionId ?? '').trim();
    if (region && resellerRegionId && region !== resellerRegionId) {
      return { regionId: region };
    }
    if (region) {
      return { regionId: region, resellerId: reseller };
    }
    if (resellerRegionId) {
      return { regionId: resellerRegionId, resellerId: reseller };
    }
    return { resellerId: reseller };
  }

  if (region) {
    return { regionId: region };
  }

  return {};
}

export function filterResellersByRegion(
  resellers: AgentReseller[],
  regionId?: string | null
): AgentReseller[] {
  const region = (regionId ?? '').trim();
  if (!region) return resellers;
  return resellers.filter((r) => r.regionId === region);
}

export function loadStoredOperationalRegionId(): string {
  try {
    return localStorage.getItem(OPERATIONAL_REGION_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveStoredOperationalRegionId(regionId: string): void {
  try {
    if (regionId) localStorage.setItem(OPERATIONAL_REGION_STORAGE_KEY, regionId);
    else localStorage.removeItem(OPERATIONAL_REGION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function loadStoredOperationalResellerId(): string {
  try {
    return localStorage.getItem(OPERATIONAL_RESELLER_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveStoredOperationalResellerId(resellerId: string): void {
  try {
    if (resellerId) localStorage.setItem(OPERATIONAL_RESELLER_STORAGE_KEY, resellerId);
    else localStorage.removeItem(OPERATIONAL_RESELLER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** يتحقق من جلسة واتساب للرسيلr أو أي رسيلr أو جلسة الوكيل (للتوافق) */
export function hasOperationalWhatsAppSession(
  resellers: AgentReseller[],
  resellerId?: string | null,
  agentSessionId?: string | null
): boolean {
  const trimmedResellerId = (resellerId ?? '').trim();
  if (trimmedResellerId) {
    const match = resellers.find((r) => r.id === trimmedResellerId);
    if (match?.whatsAppSessionId?.trim()) return true;
  }
  if (resellers.some((r) => r.whatsAppSessionId?.trim())) return true;
  return !!(agentSessionId ?? '').trim();
}
