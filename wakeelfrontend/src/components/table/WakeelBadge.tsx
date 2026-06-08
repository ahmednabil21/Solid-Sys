import React from 'react';
import type { LucideIcon } from 'lucide-react';

type BadgeColor = 'success' | 'error' | 'warning' | 'gray' | 'primary';

const colorClasses: Record<BadgeColor, string> = {
  success:
    'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-500/30',
  error: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-500/30',
  warning:
    'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-500/30',
  gray: 'bg-gray-100 text-gray-700 ring-gray-500/20 dark:bg-gray-700/60 dark:text-gray-200 dark:ring-gray-500/30',
  primary:
    'bg-primary-50 text-primary-700 ring-primary-600/20 dark:bg-primary-900/30 dark:text-primary-200 dark:ring-primary-500/30',
};

export function WakeelBadge({
  children,
  color = 'gray',
  icon: Icon,
  size = 'sm',
  className = '',
}: {
  children: React.ReactNode;
  color?: BadgeColor;
  icon?: LucideIcon;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const sizeClass = size === 'md' ? 'px-2.5 py-1 text-sm gap-1.5' : 'px-2 py-0.5 text-xs gap-1';
  return (
    <span
      className={`wakeel-badge inline-flex items-center rounded-full font-medium ring-1 ring-inset ${sizeClass} ${colorClasses[color]} ${className}`.trim()}
    >
      {Icon ? <Icon className={size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden /> : null}
      {children}
    </span>
  );
}
