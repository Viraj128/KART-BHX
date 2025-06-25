// Import role constants and path constants to ensure consistency and avoid hardcoding
import { ROLES, PATHS } from './roles';

// Navigation items used for rendering the sidebar or menu dynamically based on user role
export const NAV_ITEMS = [
  {
    // Main dashboard visible to all roles
    label: 'Dashboard',
    path: PATHS.DASHBOARD,
    roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER, ROLES.TEAMMEMBER]
  },
  {
    // User Management visible only to Admins and Managers
    label: 'User Management',
    path: PATHS.USERS,
    roles: [ROLES.ADMIN, ROLES.MANAGER]
  },
  {
    // Attendance page available to all roles
    label: 'Attendance',
    path: PATHS.ATTENDANCE,
    roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
  },
  {
    // Attendance page available to all roles
    label: 'Member Attendance',
    path: PATHS.MEMBER_ATTENDANCE,
    roles: [ROLES.TEAMMEMBER , ROLES.TEAMLEADER , ROLES.MANAGER]
  },
  {
    label: 'View Details',
    path: PATHS.VIEWDETAILS,
    roles: [ROLES.TEAMMEMBER]
  },
  {
    // Inventory is a collapsible section with sub-items, only for Admin, Manager, and Team Leader
    label: 'Inventory',
    subItems: [
      {
        // Sub-navigation for Stock Count under Inventory
        label: 'Stock Count',
        path: PATHS.STOCK_COUNT,
        roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
      },
      {
        // Sub-navigation for Waste Management
        label: 'Waste Management',
        path: PATHS.WASTE_MANAGEMENT,
        roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
      },
      {
        // Sub-navigation for Stock Movement
        label: 'Stock Movement',
        path: PATHS.STOCK_MOVEMENT,
        roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
      }, {
        // Sub-navigation for Stock Movement
        label: 'Inventory Records',
        path: PATHS.INVENTORY_RECORDS,
        roles: [ROLES.ADMIN]
      }
    ],
    // Only show the Inventory section for these roles
    roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
  },
  {
    label: 'Cash Management',
    subItems: [
      {
        label: 'Overview',
        path: PATHS.CASH_MANAGEMENT,
        roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
      },
      {
        label: 'Open Cashier',
        path: PATHS.CASH_MANAGEMENT_OPEN_CASHIER,
        roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
      },
      {
        label: 'Close Cashier',
        path: PATHS.CASH_MANAGEMENT_CLOSE_CASHIER,
        roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
      },
      {
        label: 'Banking',
        path: PATHS.CASH_MANAGEMENT_BANKING,
        roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
      },
      {
        label: 'Safe Count',
        path: PATHS.CASH_MANAGEMENT_SAFE_COUNT,
        roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
      },
      {
        label: 'Transfer Floats',
        path: PATHS.CASH_MANAGEMENT_TRANSFER_FLOATS,
        roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
      },
      {
        label: 'Money Movement',
        path: PATHS.CASH_MANAGEMENT_MONEY_MOVEMENT,
        roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
      }
    ],
    roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
  },
  {
    // ItemsManagement is a collapsible section with sub-items, only for Admin
    label: 'itemsmanagement',
    subItems: [
      {
        label: 'Categories',
        path: PATHS.CATEGORIES,
        roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
      },
      {
        label: 'Items',
        path: PATHS.ITEMS,
        roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
      },
      {
        label: 'Sauces',
        path: PATHS.SAUCES,
        roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
      }
    ],
    // Only show the ItemsManagement section for these roles
    roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TEAMLEADER]
  }, {
    //Reports Section 
    label: 'reports',
    subItems: [
      {
        label: 'Tracking Waste Report',
        path: PATHS.TRACK_INVETORY_WASTE,
        roles: [ROLES.ADMIN, ROLES.MANAGER]
      }, {
        label: 'Total Sales Report',
        path: PATHS.TOTAL_SALE_PER_ITEM,
        roles: [ROLES.ADMIN, ROLES.MANAGER]
      },
      {
        label: 'Monthly Sales Report',
        path: PATHS.MONTHLY_SALE,
        roles: [ROLES.ADMIN, ROLES.MANAGER]
      },
      {
        label: 'Weekly Sales Report',
        path: PATHS.WEEKLY_SALE,
        roles: [ROLES.ADMIN, ROLES.MANAGER]
      },
      {
        label: 'Hourly Sales Report',
        path: PATHS.HOURSLY_SALE,
        roles: [ROLES.ADMIN, ROLES.MANAGER]
      },
      {
        label: 'Customer Trend Report',
        path: PATHS.CUSTOMER_TREND,
        roles: [ROLES.ADMIN, ROLES.MANAGER]
      },
       {
        label: 'KOT Report ',
        path: PATHS.KOT,
        roles: [ROLES.ADMIN]
      },
       {
        label: 'Customer Reports',
        path: PATHS.CUSTOMER_REPORT,
        roles: [ROLES.ADMIN]
      }
    ],
    roles: [ROLES.ADMIN, ROLES.MANAGER]
  }
];
