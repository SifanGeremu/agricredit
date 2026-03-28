/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Farmer,
  Vendor,
  Admin,
  Product,
  Loan,
  Group,
  Notification,
  UserRole,
  LoanStatus,
  RepaymentChannel,
} from '../types';

const stripFarmerPassword = (f: Farmer): Omit<Farmer, 'password'> & { password?: undefined } => {
  const { password: _p, ...rest } = f;
  return rest as Omit<Farmer, 'password'> & { password?: undefined };
};

/** Call when farmer loads app — one-time overdue reminder per loan */
export const syncFarmerRepaymentDueReminders = (farmerId: string): void => {
  const loans: Loan[] = getDB('loans');
  let changed = false;
  for (let i = 0; i < loans.length; i++) {
    const loan = loans[i];
    if (loan.farmerId !== farmerId) continue;
    if (loan.status !== 'Delivered') continue;
    if (loan.dueReminderSent) continue;
    if (!loan.repayBy) continue;
    if (Date.now() < new Date(loan.repayBy).getTime()) continue;
    loan.dueReminderSent = true;
    changed = true;
    pushNotification(
      loan.farmerId,
      'Repayment due',
      `Your loan for ${loan.productName} (₦${loan.amount.toLocaleString()}) is past the agreed date. Repay with M-Pesa or Telebirr from My Loans.`,
      'warning'
    );
  }
  if (changed) setDB('loans', loans);
};

// Helper to simulate DB using localStorage
const getDB = (key: string) => JSON.parse(localStorage.getItem(`agri_db_${key}`) || '[]');
const setDB = (key: string, data: any) => localStorage.setItem(`agri_db_${key}`, JSON.stringify(data));

/** Per-vendor block list: farmers this vendor will not accept new credit orders from */
type VendorFarmerBlock = { vendorId: string; farmerId: string };

const getVendorFarmerBlocks = (): VendorFarmerBlock[] => getDB('vendor_farmer_blocks');
const setVendorFarmerBlocks = (rows: VendorFarmerBlock[]) =>
  setDB('vendor_farmer_blocks', rows);

export const isFarmerBlockedByVendor = (vendorId: string, farmerId: string): boolean =>
  getVendorFarmerBlocks().some((b) => b.vendorId === vendorId && b.farmerId === farmerId);

export const getBlockedFarmerIdsForVendor = (vendorId: string): string[] =>
  getVendorFarmerBlocks()
    .filter((b) => b.vendorId === vendorId)
    .map((b) => b.farmerId);

export const vendorBlockFarmer = async (vendorId: string, farmerId: string): Promise<void> => {
  if (isFarmerBlockedByVendor(vendorId, farmerId)) return;
  setVendorFarmerBlocks([...getVendorFarmerBlocks(), { vendorId, farmerId }]);
};

export const vendorUnblockFarmer = async (vendorId: string, farmerId: string): Promise<void> => {
  setVendorFarmerBlocks(
    getVendorFarmerBlocks().filter(
      (b) => !(b.vendorId === vendorId && b.farmerId === farmerId)
    )
  );
};

const pushNotification = (
  userId: string,
  title: string,
  message: string,
  type: Notification['type'] = 'info'
) => {
  const all: Notification[] = getDB('notifications');
  all.push({
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userId,
    title,
    message,
    type,
    read: false,
    createdAt: new Date().toISOString(),
  });
  setDB('notifications', all);
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  const all: Notification[] = getDB('notifications');
  setDB(
    'notifications',
    all.map((n) => (n.userId === userId ? { ...n, read: true } : n))
  );
};

// Initialize Admin if not exists
const initAdmin = () => {
  const admins = getDB('admins');
  if (admins.length === 0) {
    const defaultAdmin: Admin = {
      id: 'admin-1',
      phone: '0000',
      name: 'System Admin',
      role: 'admin',
      status: 'active'
    };
    setDB('admins', [defaultAdmin]);
  }
};
initAdmin();

export const registerFarmer = async (data: Partial<Farmer>): Promise<{ success: boolean; message: string }> => {
  await new Promise(r => setTimeout(r, 800));
  const farmers = getDB('farmers');
  const newFarmer: Farmer = {
    id: `f-${Math.random().toString(36).substr(2, 9)}`,
    phone: data.phone!,
    name: data.name!,
    role: 'farmer',
    status: 'active',
    nationalId: data.nationalId!,
    farmSize: data.farmSize!,
    cropType: data.cropType!,
    location: data.location!,
    creditScore: 500,
    password: (data as Partial<Farmer>).password,
  };
  
  // Auto-assign to group
  const groups = getDB('groups');
  let assignedGroup = groups.find((g: Group) => g.memberIds.length < 5);
  if (!assignedGroup) {
    assignedGroup = {
      id: `g-${groups.length + 1}`,
      name: `Trust Group ${groups.length + 1}`,
      memberIds: [],
      repaymentRate: 100
    };
    groups.push(assignedGroup);
  }
  assignedGroup.memberIds.push(newFarmer.id);
  newFarmer.groupId = assignedGroup.id;
  
  setDB('farmers', [...farmers, newFarmer]);
  setDB('groups', groups);
  return { success: true, message: 'Registration successful' };
};

export const registerVendor = async (data: Partial<Vendor>): Promise<{ success: boolean; message: string }> => {
  await new Promise(r => setTimeout(r, 800));
  const vendors = getDB('vendors');
  const newVendor: Vendor = {
    id: `v-${Math.random().toString(36).substr(2, 9)}`,
    phone: data.phone!,
    name: data.businessName!,
    businessName: data.businessName!,
    ownerName: data.ownerName!,
    role: 'vendor',
    status: 'pending', // Requires admin approval
    location: data.location!,
  };
  setDB('vendors', [...vendors, newVendor]);
  return { success: true, message: 'Registration successful. Waiting for admin approval.' };
};

export const loginUser = async (
  phone: string,
  role: UserRole,
  password?: string
): Promise<{ success: boolean; user?: any; message?: string }> => {
  await new Promise((r) => setTimeout(r, 500));
  const collection = role === 'farmer' ? 'farmers' : role === 'vendor' ? 'vendors' : 'admins';
  const users = getDB(collection);
  const user = users.find((u: any) => u.phone === phone);

  if (!user) return { success: false, message: 'User not found' };
  if (user.status === 'pending' && role === 'vendor')
    return { success: false, message: 'Account pending admin approval' };
  if (user.status === 'suspended' || user.status === 'blocked')
    return { success: false, message: 'Account is suspended or blocked' };

  if (role === 'farmer' && user.password != null && user.password !== '') {
    if (password !== user.password) {
      return { success: false, message: 'Invalid phone or password.' };
    }
    return { success: true, user: stripFarmerPassword(user as Farmer) };
  }

  return { success: true, user: role === 'farmer' ? stripFarmerPassword(user as Farmer) : user };
};

// Farmer Actions
export const requestLoan = async (
  farmerId: string,
  vendorId: string,
  productId: string,
  amount: number
): Promise<{ success: boolean; message?: string }> => {
  await new Promise((r) => setTimeout(r, 500));
  if (isFarmerBlockedByVendor(vendorId, farmerId)) {
    return {
      success: false,
      message:
        'This vendor has blocked new credit orders from your account. Choose another vendor or contact support.',
    };
  }

  const loans = getDB('loans');
  const products = getDB('products');
  const product = products.find((p: Product) => p.id === productId);

  const newLoan: Loan = {
    id: `l-${Math.random().toString(36).substr(2, 9)}`,
    farmerId,
    vendorId,
    productId,
    productName: product?.name || 'Unknown Product',
    amount,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };
  setDB('loans', [...loans, newLoan]);

  const farmers = getDB('farmers') as Farmer[];
  const farmer = farmers.find((f) => f.id === farmerId);
  pushNotification(
    vendorId,
    'New order',
    `${farmer?.name ?? 'A farmer'} placed an order: ${newLoan.productName} (₦${amount.toLocaleString()}). Awaiting admin approval.`,
    'info'
  );
  return { success: true };
};

export const repayLoan = async (
  loanId: string,
  channel?: RepaymentChannel
): Promise<void> => {
  const loans = getDB('loans');
  const loan = loans.find((l: Loan) => l.id === loanId);
  if (loan) {
    loan.status = 'Repaid';
    loan.repaymentDate = new Date().toISOString();
    if (channel) loan.repaymentMethod = channel;
    setDB('loans', loans);

    const farmers = getDB('farmers');
    const farmer = farmers.find((f: Farmer) => f.id === loan.farmerId);
    if (farmer) {
      farmer.creditScore = Math.min(850, farmer.creditScore + 25);
      setDB('farmers', farmers);
    }
    pushNotification(
      loan.farmerId,
      'Repayment recorded',
      `₦${loan.amount.toLocaleString()} marked as repaid${channel ? ` via ${channel}` : ''}. Your credit score increased.`,
      'success'
    );
  }
};

// Vendor Actions
export const addProduct = async (product: Partial<Product>): Promise<void> => {
  const products = getDB('products');
  const newProduct: Product = {
    id: `p-${Math.random().toString(36).substr(2, 9)}`,
    vendorId: product.vendorId!,
    name: product.name!,
    category: product.category!,
    price: product.price!,
    stock: product.stock!,
  };
  setDB('products', [...products, newProduct]);
};

export const updateOrderStatus = async (loanId: string, status: LoanStatus): Promise<void> => {
  const loans = getDB('loans');
  const loan = loans.find((l: Loan) => l.id === loanId);
  if (loan) {
    loan.status = status;
    if (status === 'Delivered') {
      const due = new Date();
      due.setDate(due.getDate() + 14);
      loan.repayBy = due.toISOString();
      pushNotification(
        loan.farmerId,
        'Order delivered',
        `${loan.productName} was delivered. Please repay ₦${loan.amount.toLocaleString()} when ready (due ${due.toLocaleDateString()}).`,
        'warning'
      );
    }
    setDB('loans', loans);
  }
};

// Admin Actions
export const approveVendor = async (vendorId: string): Promise<void> => {
  const vendors = getDB('vendors');
  const vendor = vendors.find((v: Vendor) => v.id === vendorId);
  if (vendor) {
    vendor.status = 'active';
    setDB('vendors', vendors);
  }
};

export const approveLoan = async (loanId: string): Promise<void> => {
  const loans = getDB('loans');
  const loan = loans.find((l: Loan) => l.id === loanId);
  if (loan) {
    loan.status = 'Paid to Vendor';
    setDB('loans', loans);
    pushNotification(
      loan.vendorId,
      'Payment received',
      `₦${loan.amount.toLocaleString()} for ${loan.productName} was sent to your account. Confirm delivery when the farmer receives the goods.`,
      'success'
    );
    pushNotification(
      loan.farmerId,
      'Loan approved',
      `Your credit for ${loan.productName} (₦${loan.amount.toLocaleString()}) was approved. Payment was sent to the vendor for your inputs.`,
      'success'
    );
  }
};

export const rejectLoan = async (loanId: string): Promise<void> => {
  const loans = getDB('loans');
  const loan = loans.find((l: Loan) => l.id === loanId);
  if (loan) {
    loan.status = 'Rejected';
    setDB('loans', loans);
    pushNotification(
      loan.farmerId,
      'Loan not approved',
      `Your request for ${loan.productName} (₦${loan.amount.toLocaleString()}) was rejected. You may try again or choose another vendor.`,
      'error'
    );
  }
};

export const suspendFarmer = async (farmerId: string): Promise<void> => {
  const farmers = getDB('farmers');
  const farmer = farmers.find((f: Farmer) => f.id === farmerId);
  if (farmer) {
    farmer.status = farmer.status === 'suspended' ? 'active' : 'suspended';
    setDB('farmers', farmers);
  }
};

export const updateFarmerStatus = async (
  farmerId: string,
  status: 'active' | 'suspended' | 'blocked'
): Promise<void> => {
  const farmers = getDB('farmers');
  const farmer = farmers.find((f: Farmer) => f.id === farmerId);
  if (farmer) {
    farmer.status = status;
    setDB('farmers', farmers);
  }
};

export const deleteVendor = async (vendorId: string): Promise<void> => {
  const vendors = getDB('vendors');
  const filtered = vendors.filter((v: Vendor) => v.id !== vendorId);
  setDB('vendors', filtered);
  const products = getDB('products');
  setDB(
    'products',
    products.filter((p: Product) => p.vendorId !== vendorId)
  );
};

export const rejectVendor = async (vendorId: string): Promise<void> => {
  const vendors = getDB('vendors');
  const vendor = vendors.find((v: Vendor) => v.id === vendorId);
  if (vendor) {
    vendor.status = 'blocked';
    setDB('vendors', vendors);
  }
};

export const deleteProduct = async (productId: string): Promise<void> => {
  const products = getDB('products');
  const filtered = products.filter((p: Product) => p.id !== productId);
  setDB('products', filtered);
};

export const updateProduct = async (productId: string, data: Partial<Product>): Promise<void> => {
  const products = getDB('products');
  const index = products.findIndex((p: Product) => p.id === productId);
  if (index !== -1) {
    products[index] = { ...products[index], ...data };
    setDB('products', products);
  }
};

// Generic Getters
export const getFarmers = () => getDB('farmers');
export const getVendors = () => getDB('vendors');
export const getLoans = () => getDB('loans');
export const getProducts = () => getDB('products');
export const getGroups = () => getDB('groups');
export const getNotifications = (userId: string) => getDB('notifications').filter((n: Notification) => n.userId === userId);
