import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';
import { apiService, ApiService } from '../services/api';
import { showError, showSuccess } from '../utils/notifications';

type Props = {
  open: boolean;
  onClose: () => void;
  regionId: string;
  resellerId: string;
  regionName?: string;
  resellerName?: string;
  agentId?: string;
};

const SubscriberRegionExcelExport: React.FC<Props> = ({
  open,
  onClose,
  regionId,
  resellerId,
  regionName,
  resellerName,
  agentId,
}) => {
  const [exporting, setExporting] = useState(false);

  const canExport = !!regionId && !!resellerId;

  const handleExport = async () => {
    if (!canExport) {
      showError('بيانات ناقصة', 'يرجى اختيار المنطقة والرسيلر من البطاقات أعلى الصفحة.');
      return;
    }

    setExporting(true);
    try {
      const { blob, fileName } = await apiService.exportSubscribersToExcel(regionId, resellerId, agentId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      showSuccess('تم التصدير', 'تم تنزيل ملف Excel بنجاح');
      onClose();
    } catch (error) {
      showError('فشل التصدير', ApiService.showError(error));
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !exporting && onClose()}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">تصدير المشتركين إلى Excel</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3 text-sm space-y-1">
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">المنطقة:</span>{' '}
              {regionName || (regionId ? regionId : '— غير محددة —')}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">الرسيلر:</span>{' '}
              {resellerName || (resellerId ? resellerId : '— غير محدد —')}
            </p>
          </div>

          {!canExport && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>يرجى اختيار المنطقة والرسيلر من البطاقات أعلى الصفحة قبل التصدير.</p>
            </div>
          )}

          <p className="text-sm text-gray-600 dark:text-gray-400">
            سيتم تنزيل ملف Excel يحتوي على المشتركين الموجودين في النظام للمنطقة والرسيلر المحددين، بالأعمدة:
            معرف الاشتراك، المشترك، اسم المستخدم، رقم هاتف المشترك، منطقة المشترك.
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[44px]"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!canExport || exporting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري التصدير...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>تنزيل Excel</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriberRegionExcelExport;
