/**
 * تحليل ملف JSON من sas_fetch_users.py (-o subscribers-export.json)
 * الصيغة: { data: [...], provider: "sas", mode: "...", includeAllStatuses: true }
 */

export interface ParsedSasExportFile {
  data: unknown[];
  fullPayload: Record<string, unknown>;
  count: number;
}

export function parseSasExportJsonText(text: string): ParsedSasExportFile {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    throw new Error('الملف فارغ.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('الملف ليس JSON صالحاً.');
  }

  let data: unknown[] = [];
  let fullPayload: Record<string, unknown>;

  if (Array.isArray(parsed)) {
    data = parsed;
    fullPayload = {
      data: parsed,
      provider: 'sas',
      mode: 'subscriptions-all',
      includeAllStatuses: true,
    };
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      data = obj.data;
      fullPayload = { ...obj };
    } else if (Array.isArray(obj.Data)) {
      data = obj.Data as unknown[];
      fullPayload = { ...obj, data: obj.Data };
    } else {
      throw new Error('لم يُعثَر على حقل data[] في الملف. شغّل sas_fetch_users.py مع -o');
    }
  } else {
    throw new Error('صيغة الملف غير مدعومة.');
  }

  if (!data.length) {
    throw new Error('قائمة data[] فارغة — لا يوجد مشتركون للاستيراد.');
  }

  return { data, fullPayload, count: data.length };
}

export async function readSasExportJsonFile(file: File): Promise<ParsedSasExportFile> {
  const text = await file.text();
  return parseSasExportJsonText(text);
}
