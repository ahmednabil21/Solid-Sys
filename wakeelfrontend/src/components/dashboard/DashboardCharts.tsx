import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { dashPanel } from './DashboardWidgets';

export interface DashboardChartValue {
  label: string;
  value: number;
  color: string;
}

export interface DashboardTimelineValue {
  label: string;
  activations: number;
  expirations: number;
}

export interface DashboardDistributionValue {
  label: string;
  value: number;
}

interface DashboardChartsProps {
  subscriberValues: DashboardChartValue[];
  financialValues: DashboardChartValue[];
  formatNumber: (value: number, options?: { suffix?: string }) => string;
}

const tooltipStyle = {
  borderRadius: '12px',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  boxShadow: '0 10px 25px -12px rgba(15, 23, 42, 0.35)',
};

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  subscriberValues,
  financialValues,
  formatNumber,
}) => {
  const subscriberTotal = subscriberValues.reduce((sum, item) => sum + item.value, 0);
  const hasSubscriberData = subscriberTotal > 0;
  const hasFinancialData = financialValues.some((item) => item.value > 0);

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-5" aria-label="رسوم لوحة التحكم">
      <div className={`${dashPanel} min-h-[330px] p-5 xl:col-span-2`}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">حالة المشتركين</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">نظرة سريعة على حالة قاعدة المشتركين</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
            <PieChartIcon className="h-4 w-4" />
          </span>
        </div>

        {hasSubscriberData ? (
          <div className="relative h-[245px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subscriberValues}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {subscriberValues.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [formatNumber(Number(value ?? 0)), 'العدد']}
                  contentStyle={tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1" dir="rtl">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(subscriberTotal)}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">مشترك</span>
            </div>
          </div>
        ) : (
          <EmptyChartState label="لا توجد بيانات مشتركين ضمن الفلاتر الحالية" />
        )}

        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
          {subscriberValues.map((item) => (
            <div key={item.label} className="flex min-w-0 items-center gap-1.5 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate text-gray-500 dark:text-gray-400">{item.label}</span>
              <span className="mr-auto font-bold text-gray-800 dark:text-gray-200">{formatNumber(item.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`${dashPanel} min-h-[330px] p-5 xl:col-span-3`}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">المؤشرات المالية</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">مقارنة مبالغ الفترة المحددة</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300">
            <BarChart3 className="h-4 w-4" />
          </span>
        </div>

        {hasFinancialData ? (
          <div className="h-[255px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialValues} margin={{ top: 14, right: 8, left: 8, bottom: 4 }} barSize={32}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  interval={0}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(value) => formatNumber(value)}
                  width={52}
                />
                <Tooltip
                  formatter={(value) => [formatNumber(Number(value ?? 0), { suffix: ' د.ع' }), 'المبلغ']}
                  contentStyle={tooltipStyle}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                <Bar dataKey="value" name="المبلغ" radius={[8, 8, 0, 0]}>
                  {financialValues.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartState label="لا توجد مبالغ ضمن الفترة المحددة" />
        )}
      </div>
    </section>
  );
};

interface DashboardSubscriberAnalyticsProps {
  trend: DashboardTimelineValue[];
  distributions: {
    regions: DashboardDistributionValue[];
    resellers: DashboardDistributionValue[];
    profiles: DashboardDistributionValue[];
    statuses: DashboardDistributionValue[];
  };
  formatNumber: (value: number) => string;
}

export const DashboardSubscriberAnalytics: React.FC<DashboardSubscriberAnalyticsProps> = ({
  trend,
  distributions,
  formatNumber,
}) => (
  <section className="grid grid-cols-1 gap-4 xl:grid-cols-5" aria-label="تحليلات المشتركين">
    <div className={`${dashPanel} min-h-[335px] p-5 xl:col-span-3`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">التفعيلات والانتهاءات</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">عرض يومي أو شهري وفق الفترة المحددة</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/35 dark:text-indigo-300">
          <BarChart3 className="h-4 w-4" />
        </span>
      </div>
      {trend.length ? (
        <div className="h-[255px]" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 12, right: 4, left: 0, bottom: 4 }} barGap={4}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} width={32} />
              <Tooltip
                formatter={(value) => [formatNumber(Number(value ?? 0)), '']}
                contentStyle={tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
              <Bar dataKey="activations" name="تفعيلات" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expirations" name="انتهاءات" fill="#f43f5e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChartState label="لا توجد عمليات ضمن الفترة المحددة" />
      )}
    </div>

    <div className={`${dashPanel} p-5 xl:col-span-2`}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">توزيع المشتركين</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">أكثر الفئات انتشاراً ضمن البيانات الحالية</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DistributionList title="المناطق" values={distributions.regions} formatNumber={formatNumber} />
        <DistributionList title="الرسيلرات" values={distributions.resellers} formatNumber={formatNumber} />
        <DistributionList title="الباقات" values={distributions.profiles} formatNumber={formatNumber} />
        <DistributionList title="الحالة" values={distributions.statuses} formatNumber={formatNumber} />
      </div>
    </div>
  </section>
);

const DistributionList: React.FC<{
  title: string;
  values: DashboardDistributionValue[];
  formatNumber: (value: number) => string;
}> = ({ title, values, formatNumber }) => (
  <div className="min-w-0">
    <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">{title}</p>
    {values.length ? (
      <div className="space-y-1.5">
        {values.slice(0, 3).map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">{item.label}</span>
            <span className="font-bold text-gray-900 dark:text-white">{formatNumber(item.value)}</span>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-xs text-gray-400 dark:text-gray-500">لا توجد بيانات</p>
    )}
  </div>
);

const EmptyChartState: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex h-[245px] items-center justify-center text-center text-sm text-gray-500 dark:text-gray-400">
    {label}
  </div>
);
