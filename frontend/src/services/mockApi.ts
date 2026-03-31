/**
 * AgriCredit API client — replaces localStorage mock with backend integration.
 */

import {
  Farmer,
  Vendor,
  Loan,
  Product,
  Group,
  Notification,
  UserRole,
  LoanStatus,
  RepaymentChannel,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

function getToken(): string | null {
  return localStorage.getItem('agri_token');
}

function sessionUser(): any {
  const raw = localStorage.getItem('agri_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchJson(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.message || body.error || res.statusText || 'Request failed';
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return body;
}

function scaleCreditScore(n: number): number {
  if (n == null || Number.isNaN(n)) return 500;
  if (n < 150) return Math.min(850, Math.max(0, n * 10));
  return n;
}

function mapLoanStatus(s: string): LoanStatus {
  const key = String(s ?? '')
    .trim()
    .toLowerCase();
  const m: Record<string, LoanStatus> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    disbursed: 'Paid to Vendor',
    delivered: 'Delivered',
    repaid: 'Repaid',
  };
  return m[key] || 'Pending';
}

function mapFarmer(u: any): Farmer {
  const st = String(u.status || u.accountStatus || 'active').toLowerCase();
  let status: Farmer['status'] = 'active';
  if (st === 'suspended') status = 'suspended';
  else if (st === 'blocked') status = 'blocked';
  else if (st === 'pending') status = 'pending';

  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    role: 'farmer',
    nationalId: u.nationalId || '',
    farmSize: u.farmSize != null ? String(u.farmSize) : '',
    cropType: u.cropType || '',
    location: u.location || '',
    creditScore: scaleCreditScore(u.creditScore ?? 50),
    groupId: u.groupId || undefined,
    status,
  };
}

function mapLoan(raw: any): Loan {
  const repayments = raw.repayments || [];
  const st = String(raw.status || '').toLowerCase();
  const paid = repayments
    .filter((r: { status?: string }) => String(r.status).toLowerCase() === 'success')
    .reduce((s: number, r: { amount: number }) => {
      const a = Number(r.amount);
      return s + (Number.isFinite(a) ? a : 0);
    }, 0);
  const amountNum = Number(raw.amount);
  const principal = Number.isFinite(amountNum) ? amountNum : 0;
  const remainingBalance = Math.max(0, principal - paid);
  return {
    id: raw.id,
    farmerId: raw.userId,
    vendorId: raw.vendorId || '',
    productId: raw.productId || '',
    productName: raw.productName || raw.purpose || 'Loan',
    amount: principal,
    status: mapLoanStatus(raw.status),
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
    repaymentDate: st === 'repaid' ? new Date(raw.updatedAt).toISOString() : undefined,
    repayBy: raw.repayBy
      ? new Date(raw.repayBy).toISOString()
      : raw.dueDate
        ? new Date(raw.dueDate).toISOString()
        : undefined,
    dueReminderSent: undefined,
    repaymentMethod: undefined,
    remainingBalance,
  };
}

/** Same farmer as loan owner (IDs from API / Mongo may differ in type). */
export function loanBelongsToFarmer(loan: Loan, farmerId: string): boolean {
  return String(loan.farmerId) === String(farmerId);
}

/** Delivered and still has balance — show Repay. */
export function canFarmerRepayLoan(loan: Loan): boolean {
  if (String(loan.status).toLowerCase() !== 'delivered') return false;
  const bal = Number(loan.remainingBalance ?? loan.amount);
  return Number.isFinite(bal) && bal >= 1;
}

export const syncFarmerRepaymentDueReminders = async (_farmerId: string): Promise<void> => {
  /* Server-side reminders can be added later */
};

export const getBlockedVendorIdsForFarmer = async (): Promise<string[]> => {
  try {
    const body = await fetchJson('/user/blocked-vendors');
    return body.data?.vendorIds || [];
  } catch {
    return [];
  }
};

/** Kept for compatibility; prefer filtering with blockedVendorIds from the API. */
export const isFarmerBlockedByVendor = (_vendorId: string, _farmerId: string): boolean => false;

export const registerFarmer = async (
  data: Partial<Farmer>
): Promise<{ success: boolean; message: string }> => {
  try {
    await fetchJson('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        phone: data.phone,
        nationalId: data.nationalId,
        password: (data as { password?: string }).password,
        farmSize: data.farmSize,
        cropType: data.cropType,
        location: data.location,
      }),
    });
    return { success: true, message: 'Registration successful' };
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : 'Registration failed' };
  }
};

export const registerVendor = async (
  data: Partial<Vendor> & { password?: string }
): Promise<{ success: boolean; message: string }> => {
  try {
    await fetchJson('/auth/register/vendor', {
      method: 'POST',
      body: JSON.stringify({
        businessName: data.businessName,
        ownerName: data.ownerName,
        phone: data.phone,
        password: data.password,
        location: data.location,
        walletNumber: data.phone,
      }),
    });
    return { success: true, message: 'Registration successful. Waiting for admin approval.' };
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : 'Registration failed' };
  }
};

export const loginUser = async (
  phone: string,
  role: UserRole,
  password?: string
): Promise<{ success: boolean; user?: any; message?: string; token?: string }> => {
  try {
    const body = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password: password ?? '' }),
    });
    const { user, token, vendorId } = body.data;
    const backendRole = user.role === 'user' ? 'farmer' : user.role;
    if (backendRole !== role) {
      return {
        success: false,
        message: 'This account does not match the selected role tab.',
      };
    }
    const normalized = {
      ...user,
      role: backendRole,
      vendorProfileId: vendorId ?? undefined,
      creditScore: scaleCreditScore(user.creditScore ?? 50),
      businessName: user.role === 'vendor' ? user.name : undefined,
      ownerName: user.role === 'vendor' ? user.name : undefined,
    };
    return { success: true, user: normalized, token };
  } catch (e: unknown) {
    return {
      success: false,
      message: e instanceof Error ? e.message : 'Login failed',
    };
  }
};

export const getFarmers = async (): Promise<Farmer[]> => {
  const u = sessionUser();
  if (!u) return [];
  if (u.role === 'admin') {
    const body = await fetchJson('/admin/farmers');
    return (body.data?.farmers || []).map(mapFarmer);
  }
  if (u.role === 'vendor') {
    const body = await fetchJson('/vendor/farmers');
    return (body.data?.farmers || []).map(mapFarmer);
  }
  return [];
};

export const getVendors = async (): Promise<Vendor[]> => {
  const u = sessionUser();
  if (!u) return [];
  if (u.role === 'admin') {
    const body = await fetchJson('/admin/vendors');
    return body.data?.vendors || [];
  }
  const body = await fetchJson('/vendors');
  return body.data?.vendors || [];
};

export const getLoans = async (): Promise<Loan[]> => {
  const u = sessionUser();
  if (!u) return [];
  let path = '/user/loans';
  if (u.role === 'admin') path = '/admin/loans';
  if (u.role === 'vendor') path = '/vendor/loans';
  const body = await fetchJson(path);
  return (body.data?.loans || []).map(mapLoan);
};

export const getProducts = async (): Promise<Product[]> => {
  const u = sessionUser();
  if (!u) return [];
  if (u.role === 'admin') {
    const body = await fetchJson('/admin/products');
    return (body.data?.products || []).map((p: any) => ({
      id: p.id,
      vendorId: p.vendorId,
      name: p.name,
      category: p.category as Product['category'],
      price: p.price,
      stock: p.stock,
    }));
  }
  if (u.role === 'vendor') {
    const body = await fetchJson('/vendor/products');
    return (body.data?.products || []).map((p: any) => ({
      id: p.id,
      vendorId: p.vendorId,
      name: p.name,
      category: p.category as Product['category'],
      price: p.price,
      stock: p.stock,
    }));
  }
  const body = await fetchJson('/user/catalog/products');
  return (body.data?.products || []).map((p: any) => ({
    id: p.id,
    vendorId: p.vendorId,
    name: p.name,
    category: p.category as Product['category'],
    price: p.price,
    stock: p.stock,
  }));
};

export const getGroups = async (): Promise<Group[]> => {
  const u = sessionUser();
  if (!u) return [];
  if (u.role === 'admin') {
    const body = await fetchJson('/admin/groups');
    return body.data?.groups || [];
  }
  const body = await fetchJson('/user/group');
  const g = body.data?.group;
  return g ? [g] : [];
};

export const getNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const body = await fetchJson('/notifications');
    const rows = body.data?.notifications || [];
    return rows.map((n: any) => ({
      id: n.id,
      userId: n.userId,
      title: n.title,
      message: n.message,
      type: n.type as Notification['type'],
      read: n.read,
      createdAt: new Date(n.createdAt).toISOString(),
    }));
  } catch {
    return [];
  }
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  await fetchJson('/notifications/read-all', { method: 'POST' });
};

export const requestLoan = async (
  _farmerId: string,
  vendorId: string,
  productId: string,
  amount: number
): Promise<{ success: boolean; message?: string }> => {
  try {
    const body = await fetchJson('/loan/request', {
      method: 'POST',
      body: JSON.stringify({
        vendorId,
        productId,
        amount,
      }),
    });
    return { success: true, message: body.message };
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : 'Request failed' };
  }
};

/** M-Pesa block returned from POST /mpesa/repay (STK + local record). */
export type MpesaRepaymentInfo = {
  ok?: boolean;
  reference?: string;
  stkAccountRef?: string;
  simulated?: boolean;
  stkInitiated?: boolean;
  message?: string;
  customerMessage?: string | null;
  checkoutRequestId?: string | null;
  displayHint?: string;
  responseCode?: string | null;
  phoneUsed?: string;
  mock?: boolean;
};

export const repayLoan = async (
  loanId: string,
  _channel?: RepaymentChannel,
  amountOverride?: number,
  /** M-Pesa STK handset (Postman PhoneNumber / PartyA). Omitted → backend uses account phone. */
  mpesaPhone?: string
): Promise<{
  success: boolean;
  message?: string;
  mpesa?: MpesaRepaymentInfo;
}> => {
  try {
    const loans = await getLoans();
    const loan = loans.find((l) => l.id === loanId);
    const max = loan?.remainingBalance ?? loan?.amount ?? 0;
    let amount =
      amountOverride != null && Number(amountOverride) > 0
        ? Number(amountOverride)
        : max;
    if (amount > max) amount = max;
    if (amount <= 0 || !loan) {
      return { success: false, message: 'Nothing to repay on this loan.' };
    }
    const payload: Record<string, unknown> = { loanId, amount };
    const p = mpesaPhone != null ? String(mpesaPhone).trim() : '';
    if (p) payload.phone = p;
    const body = await fetchJson('/mpesa/repay', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      success: true,
      message: body.message,
      mpesa: body.data?.mpesa,
    };
  } catch (e: unknown) {
    return {
      success: false,
      message: e instanceof Error ? e.message : 'Repayment failed',
    };
  }
};

export const createRepayDemoLoan = async (): Promise<{
  success: boolean;
  message?: string;
}> => {
  try {
    const body = await fetchJson('/user/dev/create-repay-demo-loan', { method: 'POST' });
    return { success: true, message: body.message || 'Demo loan created' };
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : 'Failed to create demo loan' };
  }
};

export const confirmLoanReceived = async (
  loanId: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    const body = await fetchJson(`/user/loan/${loanId}/confirm-received`, { method: 'POST' });
    return { success: true, message: body.message || 'Confirmed' };
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : 'Failed' };
  }
};

export const addProduct = async (product: Partial<Product>): Promise<void> => {
  await fetchJson('/vendor/products', {
    method: 'POST',
    body: JSON.stringify({
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
    }),
  });
};

export const updateProduct = async (productId: string, data: Partial<Product>): Promise<void> => {
  await fetchJson(`/vendor/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

export const deleteProduct = async (productId: string): Promise<void> => {
  await fetchJson(`/vendor/products/${productId}`, { method: 'DELETE' });
};

export const updateOrderStatus = async (loanId: string, status: LoanStatus): Promise<void> => {
  if (status === 'Delivered') {
    await fetchJson(`/vendor/loan/${loanId}/confirm-delivery`, { method: 'POST' });
  }
};

export const approveVendor = async (vendorId: string): Promise<void> => {
  await fetchJson(`/admin/vendors/${vendorId}/verify`, { method: 'POST' });
};

export const rejectVendor = async (vendorId: string): Promise<void> => {
  await fetchJson(`/admin/vendors/${vendorId}/reject`, { method: 'POST' });
};

export const deleteVendor = async (vendorId: string): Promise<void> => {
  await fetchJson(`/admin/vendors/${vendorId}`, { method: 'DELETE' });
};

export const approveLoan = async (loanId: string): Promise<void> => {
  await fetchJson(`/admin/loan/${loanId}/approve`, { method: 'POST' });
  try {
    await fetchJson(`/admin/loan/${loanId}/disburse`, { method: 'POST' });
  } catch {
    /* Disburse often fails in sandbox (M-Pesa B2C). Loan stays Approved — use Disburse again from Admin → Loans. */
  }
};

export const disburseLoan = async (loanId: string): Promise<void> => {
  await fetchJson(`/admin/loan/${loanId}/disburse`, { method: 'POST' });
};

export const rejectLoan = async (loanId: string): Promise<void> => {
  await fetchJson(`/admin/loan/${loanId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Rejected by admin' }),
  });
};

export const updateFarmerStatus = async (
  farmerId: string,
  status: 'active' | 'suspended' | 'blocked'
): Promise<void> => {
  await fetchJson(`/admin/farmers/${farmerId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
};

export const vendorBlockFarmer = async (vendorId: string, farmerId: string): Promise<void> => {
  await fetchJson('/vendor/blocks', {
    method: 'POST',
    body: JSON.stringify({ farmerId }),
  });
};

export const vendorUnblockFarmer = async (vendorId: string, farmerId: string): Promise<void> => {
  await fetchJson(`/vendor/blocks/${farmerId}`, { method: 'DELETE' });
};

export const getBlockedFarmerIdsForVendor = async (vendorId: string): Promise<string[]> => {
  try {
    const body = await fetchJson('/vendor/blocks');
    return body.data?.farmerIds || [];
  } catch {
    return [];
  }
};
