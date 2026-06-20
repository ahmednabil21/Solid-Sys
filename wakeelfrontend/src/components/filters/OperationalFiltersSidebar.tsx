import React, { useState } from 'react';
import { ChevronDown, MapPin, Radio } from 'lucide-react';
import { AgentRegion, AgentReseller, ServiceType } from '../../types';

export type OperationalFiltersSidebarProps = {
  regions: AgentRegion[];
  resellers: AgentReseller[];
  selectedRegionId: string;
  selectedResellerId: string;
  onRegionSelect: (regionId: string) => void;
  onResellerSelect: (resellerId: string) => void;
  showResellerServiceType?: boolean;
  className?: string;
};

function resellerServiceLabel(serviceType?: ServiceType): string {
  if (serviceType === ServiceType.Ftth) return 'FTTH';
  if (serviceType === ServiceType.Sas) return 'SAS';
  return 'Earthlink';
}

const OperationalFiltersSidebar: React.FC<OperationalFiltersSidebarProps> = ({
  regions,
  resellers,
  selectedRegionId,
  selectedResellerId,
  onRegionSelect,
  onResellerSelect,
  showResellerServiceType = true,
  className = '',
}) => {
  const [regionsOpen, setRegionsOpen] = useState(true);
  const [resellersOpen, setResellersOpen] = useState(true);

  if (regions.length === 0 && resellers.length === 0) return null;

  const itemBase =
    'w-full text-right px-2.5 py-1.5 rounded-lg text-xs transition-colors truncate';
  const itemInactive =
    'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800';
  const itemRegionActive =
    'bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 font-semibold';
  const itemResellerActive =
    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 font-semibold';

  return (
    <aside
      className={`rounded-2xl border border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm shadow-sm p-3 space-y-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto ${className}`}
    >
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-1">فلترة المنطقة</p>

      {regions.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setRegionsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-1 py-1 text-sm font-semibold text-gray-800 dark:text-gray-200"
          >
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary-500" />
              المناطق
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${regionsOpen ? '' : '-rotate-90'}`} />
          </button>
          {regionsOpen && (
            <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
              <button
                type="button"
                onClick={() => onRegionSelect('')}
                className={`${itemBase} ${!selectedRegionId ? itemRegionActive : itemInactive}`}
              >
                الكل
              </button>
              {regions.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => onRegionSelect(region.id)}
                  title={region.name}
                  className={`${itemBase} ${
                    selectedRegionId === region.id ? itemRegionActive : itemInactive
                  }`}
                >
                  {region.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {resellers.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setResellersOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-1 py-1 text-sm font-semibold text-gray-800 dark:text-gray-200"
          >
            <span className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-emerald-500" />
              الرسيلرز
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${resellersOpen ? '' : '-rotate-90'}`} />
          </button>
          {resellersOpen && (
            <div className="mt-1 space-y-0.5 max-h-56 overflow-y-auto">
              <button
                type="button"
                onClick={() => onResellerSelect('')}
                className={`${itemBase} ${!selectedResellerId ? itemResellerActive : itemInactive}`}
              >
                الكل
              </button>
              {resellers.map((reseller) => (
                <button
                  key={reseller.id}
                  type="button"
                  onClick={() => onResellerSelect(reseller.id)}
                  title={reseller.name}
                  className={`${itemBase} ${
                    selectedResellerId === reseller.id ? itemResellerActive : itemInactive
                  }`}
                >
                  <span className="block truncate">{reseller.name}</span>
                  {showResellerServiceType && (
                    <span className="block text-[10px] opacity-70 truncate">
                      {resellerServiceLabel(reseller.serviceType)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default OperationalFiltersSidebar;
