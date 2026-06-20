import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

export type PageSearchDateFilterBarProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  searchPlaceholder?: string;
  fromDate?: string;
  toDate?: string;
  onFromDateChange?: (value: string) => void;
  onToDateChange?: (value: string) => void;
  fromLabel?: string;
  toLabel?: string;
  onApply: () => void;
  onClear?: () => void;
  clearLabel?: string;
  applyLabel?: string;
  showAdvancedButton?: boolean;
  onAdvancedClick?: () => void;
  advancedActive?: boolean;
  advancedLabel?: string;
  extraActions?: React.ReactNode;
  disabled?: boolean;
};

const PageSearchDateFilterBar: React.FC<PageSearchDateFilterBarProps> = ({
  searchTerm,
  onSearchTermChange,
  searchPlaceholder = 'بحث عن المشترك...',
  fromDate = '',
  toDate = '',
  onFromDateChange,
  onToDateChange,
  fromLabel = 'من تاريخ',
  toLabel = 'إلى تاريخ',
  onApply,
  onClear,
  clearLabel = 'مسح',
  applyLabel = 'بحث',
  showAdvancedButton = false,
  onAdvancedClick,
  advancedActive = false,
  advancedLabel = 'فلترة متقدمة',
  extraActions,
  disabled = false,
}) => {
  const showDates = onFromDateChange != null && onToDateChange != null;

  return (
    <div className="mb-4 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 bg-white/70 dark:bg-gray-900/40 backdrop-blur-sm p-4 shadow-sm">
      <div className="flex flex-col xl:flex-row xl:items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            بحث عن المشترك
          </label>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onApply();
              }}
              placeholder={searchPlaceholder}
              disabled={disabled}
              className="w-full pr-9 pl-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm disabled:opacity-50"
            />
          </div>
        </div>

        {showDates && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {fromLabel}
              </label>
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => onFromDateChange(e.target.value)}
                disabled={disabled}
                className="w-full min-w-[140px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {toLabel}
              </label>
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => onToDateChange(e.target.value)}
                disabled={disabled}
                className="w-full min-w-[140px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm disabled:opacity-50"
              />
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onApply}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {applyLabel}
          </button>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg text-sm disabled:opacity-50"
            >
              {clearLabel}
            </button>
          )}
          {showAdvancedButton && onAdvancedClick && (
            <button
              type="button"
              onClick={onAdvancedClick}
              disabled={disabled}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm disabled:opacity-50 ${
                advancedActive
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {advancedLabel}
            </button>
          )}
          {extraActions}
        </div>
      </div>
    </div>
  );
};

export default PageSearchDateFilterBar;
