// Define role constants to avoid hardcoding role names throughout the app.
// This improves maintainability and reduces bugs due to typos.
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  TEAMLEADER: 'teamleader',
  TEAMMEMBER: 'teammember',
};

// Define path constants to centralize route definitions.
// Makes it easier to change paths in one place without refactoring multiple files.
export const PATHS = {
  DASHBOARD: '/dashboard',
  USERS: '/users',
  ATTENDANCE: '/attendance',
  MEMBER_ATTENDANCE: '/memberAttendance',

  //Inventroy
  STOCK_COUNT: '/inventory/stock-count',
  WASTE_MANAGEMENT: '/inventory/waste-management',
  INVENTORY_RECORDS: '/inventory/inventoryrecords',
  STOCK_MOVEMENT: '/inventory/stock-movement',

  //Team Member
  VIEWDETAILS: '/viewDetails',

  //Item Management 
  CATEGORIES: '/itemsmanagement/categories',
  ITEMS: '/itemsmanagement/items',
  SAUCES: '/itemsmanagement/sauces',

  //Cash Management 
  CASH_MANAGEMENT_OPEN_CASHIER: '/cash-management/open-cashier',
  CASH_MANAGEMENT_CLOSE_CASHIER: '/cash-management/close-cashier',
  CASH_MANAGEMENT_BANKING: '/cash-management/banking',
  CASH_MANAGEMENT_SAFE_COUNT: '/cash-management/safe-count',
  CASH_MANAGEMENT_TRANSFER_FLOATS: '/cash-management/transfer-floats',
  CASH_MANAGEMENT_MONEY_MOVEMENT:'/cash-management/money-movement',
  
  //Reports  
  TRACK_INVETORY_WASTE: '/reports/trackingWaste',
  TOTAL_SALE_PER_ITEM: '/reports/totalsaleperitem',
  WEEKLY_SALE: '/reports/weeklySale',
  HOURSLY_SALE: '/reports/hourlySale',
  CUSTOMER_TREND: '/reports/customerTrend',
  MONTHLY_SALE: '/reports/monthlySale',
  CUSTOMER_REPORT: '/reports/customerreports',
  KOT: '/reports/kot',
};

// Utility function to return the dashboard path.
// Useful for cases where you might later want to change or add logic to route generation.
export const getDashboardPath = () => '/dashboard';
