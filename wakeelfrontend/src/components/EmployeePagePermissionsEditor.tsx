import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { apiService } from '../services/api';
import { EmployeePagePermissionSet } from '../types';
import { normalizePagePermissions, mergeEmployeePermissionCatalog } from '../utils/employeePermissions';

interface EmployeePagePermissionsEditorProps {
  value: EmployeePagePermissionSet[];
  onChange: (value: EmployeePagePermissionSet[]) => void;
}

const EmployeePagePermissionsEditor: React.FC<EmployeePagePermissionsEditorProps> = ({
  value,
  onChange,
}) => {
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState('');

  const { data: catalog, isLoading } = useQuery({
    queryKey: ['employee-permission-catalog'],
    queryFn: () => apiService.getEmployeePermissionCatalog(),
  });

  const normalizedValue = useMemo(() => normalizePagePermissions(value), [value]);
  const pages = useMemo(
    () => mergeEmployeePermissionCatalog(catalog).pages,
    [catalog]
  );

  const getActionsForPage = (page: string) =>
    normalizedValue.find((p) => p.page === page)?.actions ?? [];

  const setPageActions = (page: string, actions: string[]) => {
    const next = normalizedValue.filter((p) => p.page !== page);
    if (actions.length > 0) {
      next.push({ page, actions: Array.from(new Set(actions)) });
    }
    onChange(next.sort((a, b) => a.page.localeCompare(b.page)));
  };

  const toggleAction = (page: string, action: string, checked: boolean) => {
    const current = getActionsForPage(page);
    const next = checked ? [...current, action] : current.filter((a) => a !== action);
    setPageActions(page, next);
  };

  const selectedPageDef = pages.find((p) => p.page === selectedPage);

  if (isLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">جاري تحميل الصلاحيات...</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">صلاحيات الصفحات</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        اختر الصفحة أولاً ثم حدّد الصلاحيات المطلوبة لها.
      </p>

      <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            الصفحة
          </label>
          <select
            value={selectedPage}
            onChange={(e) => setSelectedPage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm"
          >
            <option value="">— اختر الصفحة —</option>
            {pages.map((p) => (
              <option key={p.page} value={p.page}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {selectedPageDef && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
              صلاحيات {selectedPageDef.label}
            </p>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
              {selectedPageDef.actions.map((action) => {
                const checked = getActionsForPage(selectedPageDef.page).includes(action.action);
                return (
                  <label
                    key={action.action}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleAction(selectedPageDef.page, action.action, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    {action.label}
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {normalizedValue.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">الصلاحيات المحددة</p>
          {normalizedValue.map((set) => {
            const pageDef = pages.find((p) => p.page === set.page);
            const isOpen = expandedPage === set.page;
            return (
              <div
                key={set.page}
                className="rounded-md border border-gray-200 dark:border-gray-600 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedPage(isOpen ? null : set.page)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 text-sm font-medium text-gray-800 dark:text-gray-200"
                >
                  <span>{pageDef?.label ?? set.page}</span>
                  <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {set.actions.length} صلاحية
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-3 py-2 space-y-1 border-t border-gray-200 dark:border-gray-600">
                    {set.actions.map((actionKey) => {
                      const actionLabel =
                        pageDef?.actions.find((a) => a.action === actionKey)?.label ?? actionKey;
                      return (
                        <label
                          key={actionKey}
                          className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                        >
                          <input
                            type="checkbox"
                            checked
                            onChange={() => toggleAction(set.page, actionKey, false)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          {actionLabel}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeePagePermissionsEditor;
