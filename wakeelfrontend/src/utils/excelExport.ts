import * as XLSX from 'xlsx-js-style';

const CENTER_ALIGN = {
  horizontal: 'center' as const,
  vertical: 'center' as const,
};

/**
 * إنشاء ملف Excel (xlsx) من مصفوفة صفوف
 * @param data مصفوفة ثنائية: الصف الأول = الرؤوس، الباقي = البيانات
 * @param sheetName اسم الورقة (افتراضي: Sheet1)
 * @param options تنسيق اختياري: محاذاة في الوسط وعرض الأعمدة
 */
export function createXlsxBlob(
  data: (string | number)[][],
  sheetName = 'Sheet1',
  options?: { alignCenter?: boolean; colWidths?: number[] }
): Blob {
  const ws = XLSX.utils.aoa_to_sheet(data);

  if (options?.alignCenter) {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[cellRef];
        if (cell) {
          ws[cellRef] = {
            ...cell,
            s: {
              ...(typeof cell.s === 'object' ? cell.s : {}),
              alignment: CENTER_ALIGN,
            },
          };
        }
      }
    }
  }

  if (options?.colWidths && options.colWidths.length > 0) {
    ws['!cols'] = options.colWidths.map((w) => ({ wch: Math.max(w, 8) }));
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** نفس لون التمييز الأخضر الافتراضي في Excel (مثل الباكند: RGB 198,239,206) */
const CASHBACK_HIGHLIGHT_FILL = { patternType: 'solid' as const, fgColor: { rgb: 'C6EFCE' } };
const RTL_ALIGN = { horizontal: 'right' as const, vertical: 'center' as const };
const ACTIVATION_TYPE_COL = 1; // عمود «نوع التفعيل» (B)
const LAST_DATA_COL = 8; // I

/**
 * تقرير كاش باك من aoa: يُلوّن الصفوف حيث عمود نوع التفعيل = تطبيق الوطني او ماستر (أعمدة A–I) — نفس ftth_cashback_report.py.
 * الصف 0 = رؤوس؛ الصفوف التالية حتى نهاية المصفوفة تُعالج للتلوين حسب عمود B.
 */
export function createCashbackReportXlsxBlob(
  data: (string | number)[][],
  sheetName = 'تقرير الكاش باك',
  options?: { colWidths?: number[]; subscriberMasterActivationLabel?: string }
): Blob {
  const label = options?.subscriberMasterActivationLabel ?? 'تطبيق الوطني او ماستر';
  const ws = XLSX.utils.aoa_to_sheet(data);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  for (let R = range.s.r; R <= range.e.r; R += 1) {
    const bRef = XLSX.utils.encode_cell({ r: R, c: ACTIVATION_TYPE_COL });
    const bCell = ws[bRef];
    const bVal = bCell?.v != null ? String(bCell.v).trim() : '';
    const highlight = R > 0 && bVal === label;

    for (let C = 0; C <= LAST_DATA_COL; C += 1) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellRef];
      const baseStyle = {
        alignment: RTL_ALIGN,
        ...(R === 0 ? { font: { bold: true } } : {}),
        ...(highlight ? { fill: CASHBACK_HIGHLIGHT_FILL } : {}),
      };
      if (cell) {
        ws[cellRef] = {
          ...cell,
          s: {
            ...(typeof cell.s === 'object' && cell.s ? cell.s : {}),
            ...baseStyle,
          },
        };
      } else if (highlight) {
        ws[cellRef] = { t: 's', v: '', s: baseStyle };
      }
    }
  }

  if (options?.colWidths && options.colWidths.length > 0) {
    ws['!cols'] = options.colWidths.map((w) => ({ wch: Math.max(w, 8) }));
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
