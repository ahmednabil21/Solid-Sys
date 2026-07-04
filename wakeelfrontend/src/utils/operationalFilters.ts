import type { AgentReseller, AgentRegion } from '../types';
import { ServiceType } from '../types';

export const OPERATIONAL_REGION_STORAGE_KEY = 'selectedOperationalRegionId';
export const OPERATIONAL_RESELLER_STORAGE_KEY = 'selectedOperationalResellerId';

/** أنماط موحّدة لشرائح فلترة المناطق/الرسيلرز (أفقي) */
export const OPERATIONAL_FILTER_CHIP_BASE =
  'flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-right transition-all min-w-[120px] shrink-0';
export const OPERATIONAL_FILTER_CHIP_INACTIVE =
  'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:border-primary-300 hover:shadow-sm';
export const OPERATIONAL_FILTER_CHIP_REGION_ACTIVE =
  'bg-primary-600 border-primary-600 text-white shadow-md shadow-primary-500/25';
export const OPERATIONAL_FILTER_CHIP_RESELLER_ACTIVE =
  'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/25';
export const OPERATIONAL_FILTER_ROW =
  'flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin';

export function getResellerServiceTypeLabel(serviceType?: ServiceType): string {
  if (serviceType === ServiceType.Ftth) return 'FTTH';
  if (serviceType === ServiceType.Sas) return 'SAS';
  return 'Earthlink';
}

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

/** يتحقق من جلسة واتساب للمنطقة أو أي منطقة أو جلسة الوكيل (للتوافق) */
export function hasOperationalWhatsAppSession(
  regions: AgentRegion[],
  regionId?: string | null,
  agentSessionId?: string | null
): boolean {
  const trimmedRegionId = (regionId ?? '').trim();
  if (trimmedRegionId) {
    const match = regions.find((r) => r.id === trimmedRegionId);
    if (match?.whatsAppSessionId?.trim()) return true;
  }
  if (regions.some((r) => r.whatsAppSessionId?.trim())) return true;
  return !!(agentSessionId ?? '').trim();
}
