import { EmployeePagePermissionSet, User, UserRole } from '../types';

export type DashboardPageKey =
  | 'Dashboard'
  | 'Subscribers'
  | 'MaintenanceRequests'
  | 'Activations'
  | 'Debts'
  | 'Accounts'
  | 'Packages'
  | 'MaterialsAndSales'
  | 'EmployeeManagement'
  | 'GeneralExpenses'
  | 'Balance'
  | 'CustomerInvoices'
  | 'Settings';

export interface AdminRoutePermissionRule {
  pathPrefix: string;
  page?: DashboardPageKey;
  viewAction?: string;
  anyAction?: boolean;
  legacyCheck?: (user: User) => boolean;
}

export const ADMIN_ROUTE_PERMISSIONS: AdminRoutePermissionRule[] = [
  {
    pathPrefix: '/admin/dashboard',
    page: 'Dashboard',
    viewAction: 'view',
    legacyCheck: (u) => u.canAccessSubscriberDashboard !== false,
  },
  {
    pathPrefix: '/admin/subscribers',
    page: 'Subscribers',
    viewAction: 'view',
    legacyCheck: (u) => !!(u.canViewAllSubscribers || u.canAccessSubscriberDashboard),
  },
  {
    pathPrefix: '/admin/maintenance-requests',
    page: 'MaintenanceRequests',
    viewAction: 'view',
    legacyCheck: () => true,
  },
  {
    pathPrefix: '/admin/receipts',
    page: 'Activations',
    viewAction: 'view',
    legacyCheck: (u) => u.canAccessInvoices !== false,
  },
  {
    pathPrefix: '/admin/debts',
    page: 'Debts',
    viewAction: 'view',
    legacyCheck: (u) => u.canPayDebt !== false,
  },
  {
    pathPrefix: '/admin/reports',
    page: 'Accounts',
    viewAction: 'view',
    legacyCheck: (u) => u.canAccessAccounts !== false,
  },
  {
    pathPrefix: '/admin/packages',
    page: 'Packages',
    viewAction: 'view',
    legacyCheck: (u) =>
      u.canAccessExpensesAndSalarySheet !== false || u.canAccessSubscriberDashboard !== false,
  },
  {
    pathPrefix: '/admin/materials',
    page: 'MaterialsAndSales',
    viewAction: 'view',
    legacyCheck: (u) =>
      !!(u.canAddMaterial || u.canDisburseMaterial || u.canManageMaterialsAndSales),
  },
  {
    pathPrefix: '/admin/employees/tasks',
    page: 'EmployeeManagement',
    anyAction: true,
    legacyCheck: (u) => !!u.canReceiveTaskRequests,
  },
  {
    pathPrefix: '/admin/employees',
    page: 'EmployeeManagement',
    viewAction: 'view',
    legacyCheck: (u) =>
      !!(u.canManageEmployeeTasks || u.canManageMaterialsAndSales || u.canReceiveTaskRequests),
  },
  {
    pathPrefix: '/admin/expenses/salary-sheet',
    page: 'EmployeeManagement',
    viewAction: 'viewSalarySheets',
    legacyCheck: (u) => u.canAccessExpensesAndSalarySheet !== false,
  },
  {
    pathPrefix: '/admin/expenses/office',
    page: 'GeneralExpenses',
    viewAction: 'view',
    legacyCheck: (u) => u.canAccessExpensesAndSalarySheet !== false,
  },
  {
    pathPrefix: '/admin/balance',
    page: 'Balance',
    viewAction: 'view',
    legacyCheck: (u) => u.canAccessAccounts !== false,
  },
  {
    pathPrefix: '/admin/activity-log',
    anyAction: true,
    legacyCheck: () => true,
  },
  {
    pathPrefix: '/admin/receipt-handover',
    page: 'Accounts',
    viewAction: 'view',
    legacyCheck: (u) => u.canAccessAccounts !== false,
  },
  {
    pathPrefix: '/admin/customer-invoices',
    page: 'CustomerInvoices',
    anyAction: true,
    legacyCheck: (u) => u.canAccessInvoices !== false,
  },
  {
    pathPrefix: '/admin/settings',
    page: 'Settings',
    anyAction: true,
    legacyCheck: (u) =>
      u.canAccessExpensesAndSalarySheet !== false || u.canAccessSubscriberDashboard !== false,
  },
];

export function normalizePagePermissions(
  sets?: EmployeePagePermissionSet[] | null
): EmployeePagePermissionSet[] {
  if (!sets?.length) return [];
  return sets
    .map((s) => ({
      page: s.page,
      actions: Array.from(new Set((s.actions ?? []).filter(Boolean))),
    }))
    .filter((s) => s.page && s.actions.length > 0);
}

export function usesPagePermissions(user: User | null | undefined): boolean {
  return normalizePagePermissions(user?.pagePermissions).length > 0;
}

export function getPageActions(user: User | null | undefined, page: string): string[] {
  const set = normalizePagePermissions(user?.pagePermissions).find((p) => p.page === page);
  return set?.actions ?? [];
}

export function hasPageAction(
  user: User | null | undefined,
  page: string,
  action: string
): boolean {
  if (!user || user.role !== UserRole.Employee) return true;
  if (usesPagePermissions(user)) {
    return getPageActions(user, page).includes(action);
  }
  return hasLegacyPageAction(user, page, action);
}

export function hasAnyPageAction(user: User | null | undefined, page: string): boolean {
  if (!user || user.role !== UserRole.Employee) return true;
  if (usesPagePermissions(user)) {
    return getPageActions(user, page).length > 0;
  }
  return hasLegacyAnyPageAction(user, page);
}

function hasLegacyPageAction(user: User, page: string, action: string): boolean {
  switch (page) {
    case 'Dashboard':
      return action === 'view' && !!user.canAccessSubscriberDashboard;
    case 'Subscribers':
      if (action === 'view') return !!(user.canViewAllSubscribers || user.canAccessSubscriberDashboard);
      if (action === 'add' || action === 'edit') return !!user.canEditSubscriber;
      if (action === 'delete') return !!user.canDeleteSubscriber;
      if (action === 'activate' || action === 'sync') return !!user.canActivateSubscriber;
      if (action === 'details') return !!user.canViewAllSubscribers;
      return false;
    case 'MaintenanceRequests':
      return action === 'view' || action === 'accept';
    case 'Activations':
      if (action === 'view' || action === 'print') return !!user.canAccessInvoices;
      if (action === 'delete') return !!user.canAccessAccounts;
      return false;
    case 'Debts':
      return !!user.canPayDebt;
    case 'Accounts':
      return !!user.canAccessAccounts;
    case 'Packages':
      return user.canAccessExpensesAndSalarySheet !== false;
    case 'MaterialsAndSales':
      if (action === 'view') return !!(user.canAddMaterial || user.canDisburseMaterial || user.canManageMaterialsAndSales);
      if (action === 'add') return !!user.canAddMaterial;
      if (action === 'sell' || action === 'return') return !!user.canDisburseMaterial;
      return !!user.canManageMaterialsAndSales;
    case 'EmployeeManagement':
      if (action === 'view') return !!(user.canManageEmployeeTasks || user.canManageMaterialsAndSales);
      if (['addTask', 'editTask', 'deleteTask'].includes(action)) return !!user.canReceiveTaskRequests;
      if (['viewSalarySheets', 'addSalary', 'advance', 'deduction'].includes(action)) {
        return !!user.canAccessExpensesAndSalarySheet;
      }
      return !!user.canManageEmployeeTasks;
    case 'GeneralExpenses':
      return !!user.canAccessExpensesAndSalarySheet;
    case 'Balance':
      return !!user.canAccessAccounts;
    case 'CustomerInvoices':
      return !!user.canAccessInvoices;
    case 'Settings':
      return user.canAccessExpensesAndSalarySheet !== false || user.canAccessSubscriberDashboard !== false;
    default:
      return false;
  }
}

function hasLegacyAnyPageAction(user: User, page: string): boolean {
  const catalogActions: Record<string, string[]> = {
    Dashboard: ['view'],
    Subscribers: ['view', 'add', 'edit', 'delete', 'activate', 'details', 'sync'],
    MaintenanceRequests: ['view', 'accept'],
    Activations: ['view', 'print', 'delete'],
    Debts: ['view', 'add', 'edit', 'delete', 'pay'],
    Accounts: ['view', 'delete'],
    Packages: ['view', 'add', 'edit', 'delete'],
    MaterialsAndSales: ['view', 'add', 'edit', 'delete', 'sell', 'return', 'salesLog', 'printInvoice'],
    EmployeeManagement: [
      'view', 'addEmployee', 'editEmployee', 'deleteEmployee', 'addTask', 'deleteTask', 'editTask',
      'viewSalarySheets', 'addSalary', 'advance', 'deduction',
    ],
    GeneralExpenses: ['view', 'add', 'edit'],
    Balance: ['view', 'topUp', 'edit', 'delete'],
    CustomerInvoices: ['addCustomer', 'addInvoice', 'editInvoice', 'deleteInvoice', 'printInvoice', 'payInvoice'],
    Settings: ['whatsapp', 'activationUpload', 'phoneUpdateUpload', 'excelImport', 'resellersLinks', 'serviceFees', 'whatsappLink'],
  };
  return (catalogActions[page] ?? []).some((a) => hasLegacyPageAction(user, page, a));
}

export function employeeCanAccessAdminPath(user: User | null | undefined, path: string): boolean {
  if (!user || user.role !== UserRole.Employee) return true;

  const rule = ADMIN_ROUTE_PERMISSIONS.find(
    (r) => path === r.pathPrefix || path.startsWith(`${r.pathPrefix}/`)
  );
  if (!rule) return true;

  if (usesPagePermissions(user) && rule.page) {
    if (rule.anyAction) return hasAnyPageAction(user, rule.page);
    if (rule.viewAction) return hasPageAction(user, rule.page, rule.viewAction);
    return hasAnyPageAction(user, rule.page);
  }

  if (rule.legacyCheck) return rule.legacyCheck(user);
  return true;
}

export function employeeHasAnySubscriberAccess(user: User | null | undefined): boolean {
  if (!user || user.role !== UserRole.Employee) return true;
  if (usesPagePermissions(user)) {
    return hasAnyPageAction(user, 'Subscribers') || hasPageAction(user, 'Dashboard', 'view');
  }
  return !!(
    user.canActivateSubscriber ||
    user.canEditSubscriber ||
    user.canDeleteSubscriber ||
    user.canPayDebt ||
    user.canViewAllSubscribers
  );
}

export function employeeCanAccessDashboard(user: User | null | undefined): boolean {
  if (!user || user.role !== UserRole.Employee) return true;
  return employeeCanAccessAdminPath(user, '/admin/dashboard');
}

export function employeeCanAccessEmployeeTasks(user: User | null | undefined): boolean {
  if (!user || user.role !== UserRole.Employee) return true;
  if (usesPagePermissions(user)) {
    return hasAnyPageAction(user, 'EmployeeManagement');
  }
  return !!user.canReceiveTaskRequests;
}

export function employeeCanAccessExpenseFeatures(user: User | null | undefined): boolean {
  if (!user || user.role !== UserRole.Employee) return true;
  if (usesPagePermissions(user)) {
    return (
      hasAnyPageAction(user, 'GeneralExpenses') ||
      hasPageAction(user, 'EmployeeManagement', 'viewSalarySheets') ||
      hasPageAction(user, 'EmployeeManagement', 'addSalary') ||
      hasPageAction(user, 'EmployeeManagement', 'advance') ||
      hasPageAction(user, 'EmployeeManagement', 'deduction')
    );
  }
  return user.canAccessExpensesAndSalarySheet !== false;
}

export function employeeCanReceiveTaskRequests(user: User | null | undefined): boolean {
  if (!user || user.role !== UserRole.Employee) return true;
  if (usesPagePermissions(user)) {
    return ['addTask', 'editTask', 'deleteTask'].some((a) =>
      hasPageAction(user, 'EmployeeManagement', a)
    );
  }
  return !!user.canReceiveTaskRequests;
}

export function employeeShowOnlyTasksInSidebar(user: User | null | undefined): boolean {
  if (!user || user.role !== UserRole.Employee) return false;
  return (
    employeeCanAccessEmployeeTasks(user) &&
    !employeeHasAnySubscriberAccess(user) &&
    !employeeCanAccessExpenseFeatures(user)
  );
}
