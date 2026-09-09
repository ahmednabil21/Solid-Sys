import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const APP_NAME = 'Solid Links';

/** ترتيب من الأطول للأقصر لمطابقة المسارات الفرعية أولاً */
const PAGE_TITLES: Array<{ match: string | RegExp; title: string }> = [
  { match: '/login', title: 'تسجيل الدخول' },
  { match: '/register-agent', title: 'تسجيل وكيل' },
  { match: '/system-pricing', title: 'أسعار النظام' },
  { match: '/subscriber-info', title: 'معلومات المشترك' },

  { match: '/admin/main-agent/sub-agents/subscribers', title: 'المشتركين' },
  { match: '/admin/main-agent/sub-agents/renewals', title: 'التفعيلات' },
  { match: '/admin/main-agent/sub-agents/debts', title: 'الديون' },
  { match: '/admin/main-agent/sub-agents/daily-account', title: 'الحسابات' },
  { match: '/admin/main-agent/sub-agents/new', title: 'إضافة مكتب فرعي' },
  { match: /^\/admin\/main-agent\/sub-agents\/[^/]+\/edit$/, title: 'تعديل مكتب فرعي' },
  { match: '/admin/main-agent/sub-agents', title: 'المكاتب الفرعية' },

  { match: /^\/admin\/subscribers\/[^/]+$/, title: 'تفاصيل المشترك' },
  { match: '/admin/subscribers', title: 'المشتركين' },
  { match: '/admin/receipts', title: 'التفعيلات' },
  { match: '/admin/debts', title: 'الديون' },
  { match: '/admin/pin-cards', title: 'كروت الشحن PIN' },
  { match: '/admin/packages', title: 'الباقات' },
  { match: '/admin/maintenance-requests', title: 'طلبات الصيانة' },

  { match: '/admin/materials/sales-history', title: 'سجل المبيعات' },
  { match: '/admin/materials/disbursed', title: 'شاشة البيع' },
  { match: '/admin/materials', title: 'إدارة المواد' },

  { match: '/admin/reports', title: 'الحسابات' },
  { match: '/admin/expenses/office', title: 'المصاريف العامة' },
  { match: '/admin/expenses/salary-sheet', title: 'كشوفات الموظفين' },
  { match: '/admin/balance', title: 'الرصيد' },
  { match: '/admin/activity-log', title: 'سجل الحركات' },
  { match: '/admin/receipt-handover', title: 'الاستلام والتسليم' },
  { match: '/admin/customer-invoices', title: 'فواتير العملاء' },

  { match: '/admin/employees/tasks', title: 'مهام الموظفين' },
  { match: '/admin/employees', title: 'عرض الموظفين' },

  { match: '/admin/monthly-reports', title: 'التقارير الشهرية' },
  { match: '/admin/isolated-monthly-accounts', title: 'حسابات شهرية معزولة' },

  { match: '/admin/dashboard', title: 'لوحة التحكم' },
  { match: '/admin/settings', title: 'الإعدادات' },
  { match: '/admin/agents', title: 'الوكلاء' },
  { match: '/admin/users', title: 'المستخدمين' },
  { match: '/admin/system-message', title: 'رسالة النظام' },
  { match: '/admin/excel-import', title: 'الاستيراد' },
  { match: '/admin/resellers', title: 'الرسيلرات' },

  { match: '/', title: 'الصفحة الرئيسية' },
];

function resolvePageTitle(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';

  for (const entry of PAGE_TITLES) {
    if (typeof entry.match === 'string') {
      if (entry.match === '/') {
        if (path === '/') return entry.title;
        continue;
      }
      if (path === entry.match || path.startsWith(`${entry.match}/`)) {
        return entry.title;
      }
    } else if (entry.match.test(path)) {
      return entry.title;
    }
  }

  return APP_NAME;
}

function ensureFavicon(href: string) {
  let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = href;

  let apple = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
  if (!apple) {
    apple = document.createElement('link');
    apple.rel = 'apple-touch-icon';
    document.head.appendChild(apple);
  }
  apple.href = href;
}

/** يحدّث عنوان تب المتصفح حسب الصفحة، ويضبط شعار النظام كأيقونة التب. */
const DocumentTitle: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
    ensureFavicon(`${publicUrl}/solid-links-logo.png`);
  }, []);

  useEffect(() => {
    const pageTitle = resolvePageTitle(location.pathname);
    document.title = pageTitle === APP_NAME ? APP_NAME : `${pageTitle} | ${APP_NAME}`;
  }, [location.pathname]);

  return null;
};

export default DocumentTitle;
