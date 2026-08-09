import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CreditCard,
  MapPinned,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react';
import OperationalFiltersBar from '../filters/OperationalFiltersBar';
import { WakeelBadge } from '../table/WakeelBadge';
import {
  AgentRegion,
  AgentReseller,
  EmployeeTask,
  EmployeeTaskStatus,
  EmployeeTaskType,
  RenewalReceipt,
} from '../../types';

export const dashPanel =
  'bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700';

function taskTypeLabel(type: EmployeeTaskType): string {
  if (type === EmployeeTaskType.SubscriberInstallation) return 'تنصيب مشترك';
  if (type === EmployeeTaskType.SubscriberMaintenance) return 'صيانة مشترك';
  if (type === EmployeeTaskType.AmountReception) return 'استلام مبلغ';
  return 'اخرى';
}

function taskStatusBadge(status: EmployeeTaskStatus): { label: string; color: 'success' | 'warning' | 'primary' } {
  if (status === EmployeeTaskStatus.Pending) return { label: 'معلقة', color: 'warning' };
  if (status === EmployeeTaskStatus.Accepted) return { label: 'مقبولة', color: 'primary' };
  return { label: 'مكتملة', color: 'success' };
}

interface DashboardCreditBalanceCardProps {
  label: string;
  amount: number;
  formatNumber: (n: number, opts?: { suffix?: string }) => string;
  onClick?: () => void;
}

export const DashboardCreditBalanceCard: React.FC<DashboardCreditBalanceCardProps> = ({
  label,
  amount,
  formatNumber,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="relative w-full overflow-hidden rounded-2xl p-5 sm:p-6 text-white text-right shadow-xl shadow-indigo-950/20 transition-transform hover:-translate-y-0.5"
    style={{
      background: 'linear-gradient(135deg, #0b1220 0%, #1e1b4b 45%, #3730a3 100%)',
    }}
  >
    <div className="pointer-events-none absolute -top-12 -left-12 h-44 w-44 rounded-full bg-white/5" />
    <div className="pointer-events-none absolute -bottom-16 -right-10 h-52 w-52 rounded-full bg-indigo-400/10" />
    <div className="relative flex items-start justify-between gap-3">
      <div
        className="h-9 w-12 rounded-md opacity-95"
        style={{ background: 'linear-gradient(135deg, #fcd34d 0%, #d97706 100%)' }}
        aria-hidden
      />
      <div className="text-left">
        <div className="text-[10px] font-bold tracking-[0.25em] opacity-70">WAKEEL</div>
        <div className="mt-1 flex items-center gap-1 text-[10px] opacity-60">
          <Users className="h-3 w-3" />
          <span>Balance</span>
        </div>
      </div>
    </div>
    <p className="relative mt-6 text-xs opacity-75">{label}</p>
    <p className="relative mt-1 text-3xl sm:text-4xl font-bold tracking-tight">
      {formatNumber(amount, { suffix: ' د.ع' })}
    </p>
    <p className="relative mt-8 text-[11px] tracking-[0.2em] opacity-45" dir="ltr">
      IQD •••• •••• ••••
    </p>
  </button>
);

interface DashboardRegionResellerFiltersProps {
  regions: AgentRegion[];
  resellers: AgentReseller[];
  selectedRegionId: string;
  selectedResellerId: string;
  onRegionClick: (regionId: string) => void;
  onResellerClick: (resellerId: string) => void;
  showRegions: boolean;
  showResellers: boolean;
}

export const DashboardRegionResellerFilters: React.FC<DashboardRegionResellerFiltersProps> = ({
  regions,
  resellers,
  selectedRegionId,
  selectedResellerId,
  onRegionClick,
  onResellerClick,
  showRegions,
  showResellers,
}) => (
  <OperationalFiltersBar
    regions={showRegions ? regions : []}
    resellers={showResellers ? resellers : []}
    selectedRegionId={selectedRegionId}
    selectedResellerId={selectedResellerId}
    onRegionSelect={onRegionClick}
    onResellerSelect={onResellerClick}
  />
);

export interface RegionalDashboardStat {
  id: string;
  name: string;
  total: number;
  active: number;
  expired: number;
  expiringWithin3Days: number;
  incomingAmount: number;
  totalDebtAmount: number;
  totalMaterialSales: number;
  isLoading?: boolean;
  hasError?: boolean;
}

interface DashboardRegionalOverviewProps {
  regions: RegionalDashboardStat[];
  selectedRegionId: string;
  formatNumber: (n: number, opts?: { suffix?: string }) => string;
  onRegionClick: (regionId: string) => void;
}

export const DashboardRegionalOverview: React.FC<DashboardRegionalOverviewProps> = ({
  regions,
  selectedRegionId,
  formatNumber,
  onRegionClick,
}) => {
  if (!regions.length) return null;

  return (
    <section aria-label="إحصائيات المناطق">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">أداء المناطق</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            اضغط على أي منطقة لتطبيقها على كل مؤشرات لوحة التحكم.
          </p>
        </div>
        <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
          {regions.length} {regions.length === 1 ? 'منطقة' : 'مناطق'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {regions.map((region) => {
          const isSelected = selectedRegionId === region.id;
          const activeRate = region.total > 0 ? Math.round((region.active / region.total) * 100) : 0;

          return (
            <button
              key={region.id}
              type="button"
              onClick={() => onRegionClick(region.id)}
              className={`${dashPanel} min-h-[244px] p-4 text-right transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                isSelected ? 'border-primary-500 ring-1 ring-primary-500/30' : ''
              }`}
              aria-pressed={isSelected}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                  <MapPinned className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-gray-900 dark:text-white">{region.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {isSelected ? 'المنطقة المحددة حالياً' : 'عرض تفاصيل المنطقة'}
                  </p>
                </div>
              </div>

              {region.isLoading ? (
                <div className="mt-7 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  جاري تحميل الإحصائيات...
                </div>
              ) : region.hasError ? (
                <div className="mt-7 flex items-center justify-center gap-2 text-sm text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4" />
                  تعذر تحميل بيانات المنطقة
                </div>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-gray-50 p-2.5 dark:bg-gray-900/35">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Users className="h-3.5 w-3.5" />
                        المشتركون
                      </div>
                      <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{formatNumber(region.total)}</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-2.5 dark:bg-emerald-950/25">
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">الفعالون</p>
                      <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                        {formatNumber(region.active)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-700 dark:text-gray-200">{activeRate}% فعال</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        منتهي: {formatNumber(region.expired)} · قريب الانتهاء: {formatNumber(region.expiringWithin3Days)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${activeRate}%` }} />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-xs dark:border-gray-700">
                    <div>
                      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <Wallet className="h-3.5 w-3.5" />
                        الوارد
                      </span>
                      <p className="mt-1 font-bold text-gray-900 dark:text-white">
                        {formatNumber(region.incomingAmount, { suffix: ' د.ع' })}
                      </p>
                    </div>
                    <div>
                      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <CreditCard className="h-3.5 w-3.5" />
                        الديون
                      </span>
                      <p className="mt-1 font-bold text-gray-900 dark:text-white">
                        {formatNumber(region.totalDebtAmount, { suffix: ' د.ع' })}
                      </p>
                    </div>
                    <div>
                      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <ShoppingCart className="h-3.5 w-3.5" />
                        المواد
                      </span>
                      <p className="mt-1 font-bold text-gray-900 dark:text-white">
                        {formatNumber(region.totalMaterialSales, { suffix: ' د.ع' })}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};

interface DashboardOperationalOverviewProps {
  cashAmount: number;
  masterAmount: number;
  balance: number;
  balanceDeduction: number;
  formatNumber: (n: number, opts?: { suffix?: string }) => string;
}

export const DashboardOperationalOverview: React.FC<DashboardOperationalOverviewProps> = ({
  cashAmount,
  masterAmount,
  balance,
  balanceDeduction,
  formatNumber,
}) => {
  const paymentTotal = cashAmount + masterAmount;
  const cashPercent = paymentTotal > 0 ? Math.round((cashAmount / paymentTotal) * 100) : 0;
  const isLowBalance = balance <= 100_000;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="مؤشرات العمليات">
      <div className={`${dashPanel} p-5`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">طرق دفع التفعيلات</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">توزيع مبالغ الاشتراكات خلال الفترة</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/35 dark:text-sky-300">
            <CreditCard className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
          <div className="bg-emerald-500 transition-all" style={{ width: `${cashPercent}%` }} />
          <div className="bg-violet-500 transition-all" style={{ width: `${100 - cashPercent}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <PaymentMethodMetric label="نقدي" amount={cashAmount} percent={cashPercent} colorClass="bg-emerald-500" formatNumber={formatNumber} />
          <PaymentMethodMetric label="ماستر" amount={masterAmount} percent={100 - cashPercent} colorClass="bg-violet-500" formatNumber={formatNumber} />
        </div>
      </div>

      <div className={`${dashPanel} p-5`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">رصيد التفعيل</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">الرصيد المتاح والاستقطاع ضمن الفترة</p>
          </div>
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isLowBalance ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/35 dark:text-amber-300' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/35 dark:text-indigo-300'}`}>
            <Wallet className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/35">
            <p className="text-xs text-gray-500 dark:text-gray-400">الرصيد الحالي</p>
            <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{formatNumber(balance, { suffix: ' د.ع' })}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/35">
            <p className="text-xs text-gray-500 dark:text-gray-400">الاستقطاع</p>
            <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{formatNumber(balanceDeduction, { suffix: ' د.ع' })}</p>
          </div>
        </div>
        <p className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${isLowBalance ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
          <AlertCircle className="h-3.5 w-3.5" />
          {isLowBalance ? 'تنبيه: الرصيد منخفض ويحتاج إلى تعبئة.' : 'الرصيد ضمن المستوى الآمن.'}
        </p>
      </div>
    </section>
  );
};

const PaymentMethodMetric: React.FC<{
  label: string;
  amount: number;
  percent: number;
  colorClass: string;
  formatNumber: (n: number, opts?: { suffix?: string }) => string;
}> = ({ label, amount, percent, colorClass, formatNumber }) => (
  <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-700">
    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
      {label}
      <span className="mr-auto font-semibold text-gray-700 dark:text-gray-200">{percent}%</span>
    </div>
    <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">{formatNumber(amount, { suffix: ' د.ع' })}</p>
  </div>
);

interface DebtAgingMetric {
  label: string;
  amount: number;
  colorClass: string;
}

interface DebtDebtorMetric {
  name: string;
  amount: number;
}

interface DashboardDebtInsightsProps {
  totalDebt: number;
  subscriptionDebt: number;
  serviceFeesDebt: number;
  collectedAmount: number;
  overdueAmount: number;
  aging: DebtAgingMetric[];
  topDebtors: DebtDebtorMetric[];
  formatNumber: (n: number, opts?: { suffix?: string }) => string;
}

export const DashboardDebtInsights: React.FC<DashboardDebtInsightsProps> = ({
  totalDebt,
  subscriptionDebt,
  serviceFeesDebt,
  collectedAmount,
  overdueAmount,
  aging,
  topDebtors,
  formatNumber,
}) => {
  const maxAgingAmount = Math.max(...aging.map((item) => item.amount), 1);

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-5" aria-label="تحليل الديون">
      <div className={`${dashPanel} p-5 xl:col-span-3`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">تحليل الديون</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">المتبقي والتحصيل وأعمار الديون</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/35 dark:text-rose-300">
            <CreditCard className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DebtMetric label="إجمالي المتبقي" amount={totalDebt} formatNumber={formatNumber} />
          <DebtMetric label="ديون الاشتراكات" amount={subscriptionDebt} formatNumber={formatNumber} />
          <DebtMetric label="ديون الأجور" amount={serviceFeesDebt} formatNumber={formatNumber} />
          <DebtMetric label="المسدد بالفترة" amount={collectedAmount} formatNumber={formatNumber} colorClass="text-emerald-600 dark:text-emerald-300" />
        </div>
        <div className="mt-5 rounded-xl bg-rose-50/70 p-3 dark:bg-rose-950/20">
          <p className="text-xs text-rose-700 dark:text-rose-300">ديون مستحقة أو متأخرة</p>
          <p className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-300">{formatNumber(overdueAmount, { suffix: ' د.ع' })}</p>
        </div>
        <div className="mt-5 space-y-3">
          {aging.map((item) => (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-300">{item.label}</span>
                <span className="font-bold text-gray-900 dark:text-white">{formatNumber(item.amount, { suffix: ' د.ع' })}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div className={`h-full rounded-full ${item.colorClass}`} style={{ width: `${Math.max(item.amount > 0 ? 5 : 0, Math.round((item.amount / maxAgingAmount) * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${dashPanel} overflow-hidden xl:col-span-2`}>
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">أعلى المدينين</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">بحسب المبلغ المتبقي</p>
        </div>
        {topDebtors.length ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/70">
            {topDebtors.map((debtor, index) => (
              <div key={`${debtor.name}-${index}`} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {index + 1}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">{debtor.name}</p>
                <p className="shrink-0 text-sm font-bold text-rose-600 dark:text-rose-300">{formatNumber(debtor.amount, { suffix: ' د.ع' })}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[250px] items-center justify-center px-5 text-center text-sm text-gray-500 dark:text-gray-400">
            لا توجد ديون معلقة ضمن الفلاتر الحالية
          </div>
        )}
      </div>
    </section>
  );
};

const DebtMetric: React.FC<{
  label: string;
  amount: number;
  formatNumber: (n: number, opts?: { suffix?: string }) => string;
  colorClass?: string;
}> = ({
  label,
  amount,
  formatNumber,
  colorClass = 'text-gray-900 dark:text-white',
}) => (
  <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/35">
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    <p className={`mt-1 text-base font-bold ${colorClass}`}>{formatNumber(amount, { suffix: ' د.ع' })}</p>
  </div>
);

interface SummaryCardProps {
  title: string;
  value: string;
  changePercent?: number;
}

export const DashboardSummaryAmounts: React.FC<{ items: SummaryCardProps[] }> = ({ items }) => (
  <section>
    <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">ملخص المبالغ</h2>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className={`${dashPanel} p-5`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">{item.title}</p>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{item.value}</p>
          {item.changePercent != null && (
            <p className={`mt-2 text-xs font-semibold ${item.changePercent >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
              {item.changePercent >= 0 ? '+' : ''}{item.changePercent}% مقارنة بالفترة السابقة
            </p>
          )}
        </div>
      ))}
    </div>
  </section>
);

interface FinancialBarItem {
  label: string;
  value: number;
  barClass: string;
}

interface DashboardFinancialSummaryProps {
  items: FinancialBarItem[];
  formatNumber: (n: number, opts?: { suffix?: string }) => string;
}

export const DashboardFinancialSummary: React.FC<DashboardFinancialSummaryProps> = ({ items, formatNumber }) => {
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className={`${dashPanel} p-5 h-full`}>
      <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">الملخص المالي</h3>
      <div className="space-y-4">
        {items.map((item) => {
          const width = Math.max(4, Math.round((item.value / maxValue) * 100));
          return (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-gray-900 dark:text-white" dir="ltr">
                  {formatNumber(item.value, { suffix: ' د.ع' })}
                </span>
                <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700/80">
                <div className={`h-full rounded-full ${item.barClass}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface SubscriberBarItem {
  label: string;
  value: number;
  barClass: string;
}

interface DashboardSubscriberChartProps {
  items: SubscriberBarItem[];
  formatNumber: (n: number) => string;
}

export const DashboardSubscriberChart: React.FC<DashboardSubscriberChartProps> = ({ items, formatNumber }) => {
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className={`${dashPanel} p-5 h-full`}>
      <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">حالة المشتركين</h3>
      <div className="flex items-end justify-around gap-2 sm:gap-4 pt-2 pb-1 min-h-[220px]">
        {items.map((item) => {
          const heightPct = item.value > 0 ? Math.max(12, Math.round((item.value / maxValue) * 100)) : 4;
          return (
            <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-36 w-full max-w-[64px] items-end justify-center">
                <div
                  className={`w-full rounded-t-xl ${item.barClass}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">{formatNumber(item.value)}</span>
              <span className="text-center text-[11px] leading-tight text-gray-500 dark:text-gray-400">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface DashboardRecentTasksTableProps {
  tasks: EmployeeTask[];
}

export const DashboardRecentTasksTable: React.FC<DashboardRecentTasksTableProps> = ({ tasks }) => (
  <div className={`${dashPanel} overflow-hidden`}>
    <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">احدث المهام للموظفين</h3>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full text-right text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900/30">
            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">اسم الموظف</th>
            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">نوع المهمة</th>
            <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">حالة المهمة</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                لا توجد مهام حديثة
              </td>
            </tr>
          ) : (
            tasks.map((task) => {
              const badge = taskStatusBadge(task.status);
              return (
                <tr
                  key={task.id}
                  className="border-b border-gray-50 last:border-0 dark:border-gray-700/60"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {task.employeeFullName || task.employeeName || task.employeeUserName || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{taskTypeLabel(task.taskType)}</td>
                  <td className="px-4 py-3">
                    <WakeelBadge color={badge.color}>{badge.label}</WakeelBadge>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  </div>
);

interface DashboardRecentActivationsTableProps {
  receipts: RenewalReceipt[];
  formatNumber: (n: number, opts?: { suffix?: string }) => string;
  formatDate: (value: string | Date) => string;
  isLoading?: boolean;
}

export const DashboardRecentActivationsTable: React.FC<DashboardRecentActivationsTableProps> = ({
  receipts,
  formatNumber,
  formatDate,
  isLoading = false,
}) => (
  <section className={`${dashPanel} overflow-hidden`}>
    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">آخر التفعيلات</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">أحدث العمليات المنفذة ضمن النطاق الحالي</p>
      </div>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/35 dark:text-blue-300">
        <ReceiptText className="h-4 w-4" />
      </span>
    </div>
    {isLoading ? (
      <div className="space-y-3 p-5">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700/50" />
        ))}
      </div>
    ) : receipts.length === 0 ? (
      <div className="flex min-h-[240px] flex-col items-center justify-center px-5 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
          <ReceiptText className="h-6 w-6" />
        </span>
        <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">لا توجد تفعيلات حديثة</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">جرّب تعديل الفترة أو فلتر المنطقة.</p>
      </div>
    ) : (
      <div className="divide-y divide-gray-100 dark:divide-gray-700/70">
        {receipts.map((receipt) => {
          const paidAmount = receipt.amountPaid ?? receipt.finalPrice ?? 0;
          const hasRemainingAmount = Number(receipt.remainingAmount ?? 0) > 0;
          const name = receipt.subscriberName || 'مشترك غير محدد';
          const initials = name.trim().slice(0, 1);

          return (
            <article key={receipt.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 text-sm font-bold text-white shadow-sm">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
                  <p className="shrink-0 text-sm font-bold text-gray-900 dark:text-white" dir="ltr">
                    {formatNumber(paidAmount, { suffix: ' د.ع' })}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="max-w-[140px] truncate">{receipt.newProfileName || 'باقة غير محددة'}</span>
                  <span className="hidden h-1 w-1 rounded-full bg-gray-300 sm:inline-block dark:bg-gray-600" />
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" />
                    {formatDate(receipt.renewalDate || receipt.createdAt)}
                  </span>
                  {receipt.performedByFullName && (
                    <>
                      <span className="hidden h-1 w-1 rounded-full bg-gray-300 sm:inline-block dark:bg-gray-600" />
                      <span className="truncate">بواسطة {receipt.performedByFullName}</span>
                    </>
                  )}
                </div>
              </div>
              <span
                className={`hidden shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium sm:inline-flex ${
                  hasRemainingAmount
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300'
                }`}
              >
                <CheckCircle2 className="h-3 w-3" />
                {hasRemainingAmount ? 'جزئي' : 'مستلم'}
              </span>
            </article>
          );
        })}
      </div>
    )}
  </section>
);

interface DashboardHeaderProps {
  userName: string;
  lastUpdated: Date;
  onRefresh: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ userName, lastUpdated, onRefresh }) => (
  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary-700 via-primary-600 to-indigo-700 p-5 text-white shadow-lg shadow-primary-950/15 sm:p-6">
    <div className="pointer-events-none absolute -left-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
    <div className="pointer-events-none absolute -bottom-20 right-1/3 h-48 w-48 rounded-full bg-indigo-300/10" />
    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-primary-50">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,0.15)]" />
          البيانات محدّثة
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">مرحباً، {userName}</h1>
        <p className="mt-2 text-sm text-primary-100">
          نظرة سريعة على أداء المشتركين والعمليات المالية.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-xs text-primary-100">
          آخر تحديث<br />
          <span className="font-semibold text-white">{lastUpdated.toLocaleTimeString('ar-EG')}</span>
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-50"
        >
          <RefreshCw className="h-4 w-4" />
          <span>تحديث</span>
        </button>
      </div>
    </div>
  </div>
);
