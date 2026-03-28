/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'farmer' | 'vendor' | 'admin';

export interface User {
  id: string;
  phone: string;
  role: UserRole;
  name: string;
  status: 'pending' | 'active' | 'suspended' | 'blocked';
}

export interface Farmer extends User {
  role: 'farmer';
  nationalId: string;
  farmSize: string;
  cropType: string;
  location: string;
  creditScore: number;
  groupId?: string;
  /** Demo-only: stored for mock login; never expose to client after auth */
  password?: string;
}

export interface Vendor extends User {
  role: 'vendor';
  businessName: string;
  ownerName: string;
  location: string;
}

export interface Admin extends User {
  role: 'admin';
}

export interface Product {
  id: string;
  vendorId: string;
  name: string;
  category: 'Seeds' | 'Fertilizers' | 'Pesticides' | 'Tools';
  price: number;
  stock: number;
}

export type LoanStatus = 'Pending' | 'Approved' | 'Paid to Vendor' | 'Delivered' | 'Repaid' | 'Rejected';

export type RepaymentChannel = 'M-Pesa' | 'Telebirr';

export interface Loan {
  id: string;
  farmerId: string;
  vendorId: string;
  productId: string;
  productName: string;
  amount: number;
  status: LoanStatus;
  createdAt: string;
  repaymentDate?: string;
  /** When set, farmer should repay by this date (set when order is delivered) */
  repayBy?: string;
  /** One-time due reminder already sent */
  dueReminderSent?: boolean;
  repaymentMethod?: RepaymentChannel;
}

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
  repaymentRate: number;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
}
