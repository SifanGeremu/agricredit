/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Leaf, LogOut, TrendingUp, Users, CreditCard, Sprout, 
  MapPin, Ruler, Package, XCircle,
  Plus, Bell, ShieldAlert, Phone,
  BarChart3, LayoutDashboard, ShoppingBag, Settings,
  Truck, PieChart, Layers, FileDown, Activity, AlertTriangle,
  Ban, Store, Percent, CheckCircle2, CircleDollarSign, UserCheck,
  Smartphone, User
} from 'lucide-react';
import { 
  getFarmers, getVendors, getLoans, getProducts, getGroups, 
  requestLoan, repayLoan, addProduct, updateOrderStatus, approveVendor, approveLoan,
  disburseLoan,
  getNotifications, rejectLoan, rejectVendor, deleteProduct, updateProduct,
  updateFarmerStatus, deleteVendor, markAllNotificationsRead,
  vendorBlockFarmer, vendorUnblockFarmer, getBlockedFarmerIdsForVendor,
  getBlockedVendorIdsForFarmer,
  syncFarmerRepaymentDueReminders,
  canFarmerRepayLoan,
  loanBelongsToFarmer,
} from '../services/mockApi';
import { Farmer, Vendor, Admin, Loan, Product, Group, Notification, RepaymentChannel } from '../types';

// --- Shared Components ---

const Sidebar = ({ role, activeTab, setActiveTab, onLogout }: any) => {
  const menuItems = {
    farmer: [
      { id: 'overview', label: 'Overview', icon: <LayoutDashboard /> },
      { id: 'loans', label: 'My Loans', icon: <CreditCard /> },
      { id: 'group', label: 'My Group', icon: <Users /> },
      { id: 'profile', label: 'Farm Profile', icon: <Sprout /> },
    ],
    vendorMain: [
      { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard /> },
      { id: 'orders', label: 'Orders', icon: <ShoppingBag /> },
      { id: 'products', label: 'Products', icon: <Package /> },
      { id: 'stats', label: 'Sales Stats', icon: <BarChart3 /> },
    ],
    vendorFarmers: [
      { id: 'farmers-active', label: 'Active farmers', icon: <UserCheck /> },
      { id: 'farmers-blocked', label: 'Blocked farmers', icon: <Ban /> },
    ],
    admin: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
      { id: 'farmers', label: 'Farmers', icon: <Users /> },
      { id: 'vendors', label: 'Vendors', icon: <Truck /> },
      { id: 'loans', label: 'Loans', icon: <CreditCard /> },
      { id: 'groups', label: 'Groups', icon: <Layers /> },
      { id: 'reports', label: 'Reports', icon: <PieChart /> },
    ]
  };

  const items =
    role === 'admin'
      ? menuItems.admin
      : role === 'farmer'
        ? menuItems.farmer
        : [];

  const NavButton = ({ item }: { item: { id: string; label: string; icon: React.ReactNode } }) => (
    <button
      type="button"
      onClick={() => setActiveTab(item.id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        activeTab === item.id
          ? 'bg-emerald-600 text-white shadow-lg'
          : 'text-emerald-100/60 hover:bg-emerald-800 hover:text-white'
      }`}
    >
      {item.icon}
      <span className="font-medium text-left">{item.label}</span>
    </button>
  );

  return (
    <div className="w-64 bg-emerald-900 text-white flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6 flex items-center gap-2 border-b border-emerald-800">
        <Leaf className="text-emerald-400" />
        <span className="text-xl font-bold">AgriCredit</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {role === 'vendor' ? (
          <>
            {menuItems.vendorMain.map((item) => (
              <div key={item.id}>
                <NavButton item={item} />
              </div>
            ))}
            <div className="pt-4 mt-2 border-t border-emerald-800/80">
              <div className="px-4 pb-2 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                Farmers
              </div>
              <div className="space-y-2">
                {menuItems.vendorFarmers.map((item) => (
                  <div key={item.id}>
                    <NavButton item={item} />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {items.map((item: { id: string; label: string; icon: React.ReactNode }) => (
              <div key={item.id}>
                <NavButton item={item} />
              </div>
            ))}
            {role === 'farmer' && (
              <Link
                to="/repayment"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-emerald-100/80 hover:bg-emerald-800 hover:text-white transition-all border border-emerald-800/80"
              >
                <Smartphone className="w-5 h-5 shrink-0" />
                <span className="font-medium text-left">M-Pesa repay</span>
              </Link>
            )}
          </>
        )}
      </nav>
      <div className="p-4 border-t border-emerald-800">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-emerald-100/60 hover:text-red-400 transition-colors"
        >
          <LogOut />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

// --- Farmer Views ---

const farmerLoanStatusStyle = (status: Loan['status']) => {
  switch (status) {
    case 'Pending':
      return 'bg-amber-100 text-amber-800';
    case 'Approved':
      return 'bg-blue-100 text-blue-800';
    case 'Paid to Vendor':
      return 'bg-indigo-100 text-indigo-800';
    case 'Delivered':
      return 'bg-emerald-100 text-emerald-800';
    case 'Repaid':
      return 'bg-teal-100 text-teal-800';
    case 'Rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const LOAN_PIPELINE: { key: Loan['status']; label: string }[] = [
  { key: 'Pending', label: 'Pending' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Paid to Vendor', label: 'Paid to vendor' },
  { key: 'Delivered', label: 'Delivered' },
  { key: 'Repaid', label: 'Repaid' },
];

const pipelineIndex = (status: Loan['status']) => {
  if (status === 'Rejected') return -1;
  const order = ['Pending', 'Approved', 'Paid to Vendor', 'Delivered', 'Repaid'];
  return order.indexOf(status);
};

const FarmerRepaymentModal = ({
  loan,
  isOpen,
  onClose,
  onPaid,
}: {
  loan: Loan | null;
  isOpen: boolean;
  onClose: () => void;
  onPaid: (channel: RepaymentChannel, amount: number) => void | Promise<void>;
}) => {
  const [busy, setBusy] = useState(false);
  const [payAmount, setPayAmount] = useState(0);

  useEffect(() => {
    if (!loan) return;
    const raw = Number(loan.remainingBalance ?? loan.amount);
    const dueAmt = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    setPayAmount(dueAmt > 0 ? dueAmt : 0);
  }, [loan?.id, loan?.remainingBalance, loan?.amount]);

  if (!isOpen || !loan) return null;
  const dueRaw = Number(loan.remainingBalance ?? loan.amount);
  const due = Number.isFinite(dueRaw) ? Math.max(0, Math.floor(dueRaw)) : 0;
  const run = async (ch: RepaymentChannel) => {
    const amt = Math.min(Math.max(1, payAmount), Math.max(due, 1));
    setBusy(true);
    try {
      await onPaid(ch, amt);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-emerald-950/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl border border-emerald-100 overflow-hidden"
      >
        <div className="p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-emerald-900">Repayment</h2>
              <p className="text-sm text-emerald-800/60">Amount below → then M-Pesa STK</p>
            </div>
          </div>
          <p className="text-emerald-800/80 text-sm mb-4">
            <strong>{loan.productName}</strong> · max ₦{due.toLocaleString()}
          </p>
          <label className="block text-sm font-bold text-emerald-900 mb-2">Amount (₦)</label>
          <input
            type="number"
            min={1}
            max={due || undefined}
            value={Number.isFinite(payAmount) ? payAmount : 0}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') {
                setPayAmount(0);
                return;
              }
              const n = Number(v);
              if (Number.isFinite(n)) setPayAmount(Math.floor(n));
            }}
            className="w-full mb-6 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 font-bold text-emerald-950"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={
                busy ||
                due < 1 ||
                !Number.isFinite(payAmount) ||
                payAmount < 1 ||
                payAmount > due
              }
              onClick={() => void run('M-Pesa')}
              className="py-4 rounded-2xl border-2 border-emerald-600 bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {busy ? 'Processing…' : 'M-Pesa STK'}
            </button>
            <button
              type="button"
              disabled={
                busy ||
                due < 1 ||
                !Number.isFinite(payAmount) ||
                payAmount < 1 ||
                payAmount > due
              }
              onClick={() => void run('Telebirr')}
              className="py-4 rounded-2xl border-2 border-emerald-200 font-bold text-emerald-900 hover:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              Telebirr
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-4 py-3 text-emerald-600 font-bold hover:bg-emerald-50 rounded-xl"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const FarmerOverview = ({
  farmer,
  loans,
  group,
  onRepayClick,
}: {
  farmer: Farmer;
  loans: Loan[];
  group?: Group;
  onRepayClick: (loan: Loan) => void;
}) => {
  const activeLoans = loans.filter((l) => l.status !== 'Repaid' && l.status !== 'Rejected');
  const repaidLoans = loans.filter((l) => l.status === 'Repaid');

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-emerald-100">
          <div className="flex flex-wrap justify-between gap-4 items-start mb-6">
            <div>
              <h2 className="text-lg font-bold text-emerald-900 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                Profile & farm
              </h2>
              <p className="text-sm text-emerald-800/60 mt-1">
                {farmer.location} · {farmer.cropType} · {farmer.farmSize} ha
              </p>
            </div>
            <div className="text-right text-sm text-emerald-800/60">
              <div className="font-mono">{farmer.phone}</div>
              <div className="text-xs">National ID · {farmer.nationalId}</div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-bold text-emerald-800/50 uppercase tracking-wide mb-2">
                Credit score (starts at 500)
              </div>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-black text-emerald-900 tabular-nums">
                  {farmer.creditScore}
                </span>
                <span className="text-emerald-800/50 text-sm pb-1">/ 850</span>
              </div>
              <div className="mt-3 w-full bg-emerald-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-full transition-all"
                  style={{ width: `${(farmer.creditScore / 850) * 100}%` }}
                />
              </div>
              <p className="text-xs text-emerald-700 mt-2">
                +25 points per on-time repayment (mock)
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <div className="text-xs font-bold text-emerald-800/60 uppercase mb-1">Loan eligibility</div>
              <div className="text-2xl font-bold text-emerald-900">
                ₦{(farmer.creditScore * 1000).toLocaleString()}
              </div>
              <p className="text-xs text-emerald-800/70 mt-2">
                Estimated limit from your score and group trust
              </p>
            </div>
          </div>
        </div>

        <div className="bg-emerald-900 text-white p-8 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold mb-1">
              Group membership
            </div>
            <div className="text-2xl font-bold mb-2">{group?.name ?? '—'}</div>
            <div className="text-emerald-100/80 text-sm mb-4">Repayment rate (recorded)</div>
            <div className="text-4xl font-black">{group?.repaymentRate ?? 0}%</div>
            <p className="text-xs text-emerald-200/70 mt-4">
              You are auto-assigned to a group of up to 5 farmers for trust-based lending.
            </p>
          </div>
          <Users className="absolute -right-6 -bottom-6 w-40 h-40 text-emerald-800/40" />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 p-6">
        <h3 className="font-bold text-emerald-900 mb-4">Typical loan journey</h3>
        <div className="flex flex-wrap gap-2 items-center text-xs sm:text-sm">
          {LOAN_PIPELINE.map((step, i) => (
            <React.Fragment key={step.key}>
              {i > 0 && <span className="text-emerald-300">→</span>}
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 font-semibold border border-emerald-100">
                {step.label}
              </span>
            </React.Fragment>
          ))}
        </div>
        <p className="text-sm text-emerald-800/60 mt-3">
          After admin approval, payment goes to the vendor; you repay after delivery via mobile money.
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-emerald-50 flex justify-between items-center">
          <h2 className="font-bold text-emerald-900">Active loans</h2>
          <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-bold">
            {activeLoans.length} active
          </span>
        </div>
        <div className="divide-y divide-emerald-50">
          {activeLoans.length > 0 ? (
            activeLoans.map((loan) => {
              const idx = pipelineIndex(loan.status);
              return (
                <div key={loan.id} className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-bold text-emerald-900">{loan.productName}</div>
                    <div className="text-sm text-emerald-800/60">
                      ₦{loan.amount.toLocaleString()} · {new Date(loan.createdAt).toLocaleDateString()}
                    </div>
                    {loan.repayBy && loan.status === 'Delivered' && (
                      <div className="text-xs text-amber-700 font-medium mt-1">
                        Repay by {new Date(loan.repayBy).toLocaleDateString()}
                      </div>
                    )}
                    {idx >= 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {LOAN_PIPELINE.slice(0, -1).map((s, i) => (
                          <span
                            key={s.key}
                            className={`inline-block w-2 h-2 rounded-full ${
                              i <= idx ? 'bg-emerald-500' : 'bg-emerald-200'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${farmerLoanStatusStyle(
                        loan.status
                      )}`}
                    >
                      {loan.status}
                    </span>
                    {canFarmerRepayLoan(loan) && (
                      <button
                        type="button"
                        onClick={() => onRepayClick(loan)}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 flex items-center gap-2 cursor-pointer"
                      >
                        <Smartphone className="w-4 h-4" />
                        Repay with mobile money
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-emerald-800/40 italic">No active loans</div>
          )}
        </div>
      </div>

      {repaidLoans.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-emerald-50 font-bold text-emerald-900">
            Repayment history (recent)
          </div>
          <div className="divide-y divide-emerald-50">
            {repaidLoans.slice(0, 5).map((loan) => (
              <div key={loan.id} className="px-6 py-4 flex justify-between text-sm">
                <span className="font-medium text-emerald-900">{loan.productName}</span>
                <span className="text-emerald-800/70">
                  ₦{loan.amount.toLocaleString()}
                  {loan.repaymentMethod && (
                    <span className="ml-2 text-emerald-600 font-bold">· {loan.repaymentMethod}</span>
                  )}
                  {loan.repaymentDate && (
                    <span className="ml-2 text-emerald-800/50">
                      {new Date(loan.repaymentDate).toLocaleDateString()}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FarmerGroupView = ({
  group,
  farmers,
  loans,
}: {
  group?: Group;
  farmers: Farmer[];
  loans: Loan[];
}) => {
  const members = farmers.filter((f) => group?.memberIds.includes(f.id));

  const memberLoans = loans.filter((l) =>
    members.some((m) => m.id === l.farmerId)
  );
  const repaid = memberLoans.filter((l) => l.status === 'Repaid').length;
  const denom = memberLoans.filter(
    (l) => l.status !== 'Pending' && l.status !== 'Rejected'
  ).length;
  const loanBasedRate = denom ? Math.round((repaid / denom) * 100) : 100;

  return (
    <div className="space-y-6">
      <p className="text-sm text-emerald-800/60 max-w-2xl">
        Groups have up to 5 members. Your group&apos;s repayment performance is tracked from shared loan activity.
      </p>
      <div className="bg-emerald-900 text-white p-8 rounded-[2.5rem] relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2">{group?.name}</h2>
          <p className="text-emerald-100/60 mb-6">Trust-based lending circle</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold mb-1">
                Recorded rate
              </div>
              <div className="text-2xl font-bold">{group?.repaymentRate}%</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold mb-1">
                Loan-based rate
              </div>
              <div className="text-2xl font-bold">{loanBasedRate}%</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold mb-1">
                Members
              </div>
              <div className="text-2xl font-bold">{members.length}/5</div>
            </div>
          </div>
        </div>
        <Users className="absolute -right-8 -bottom-8 w-64 h-64 text-emerald-800 opacity-50" />
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-emerald-50 font-bold text-emerald-900">Group members</div>
        <div className="divide-y divide-emerald-50">
          {members.map((member) => {
            const mLoans = loans.filter((l) => l.farmerId === member.id);
            const mRep = mLoans.filter((l) => l.status === 'Repaid').length;
            const mDen = mLoans.filter(
              (l) => l.status !== 'Pending' && l.status !== 'Rejected'
            ).length;
            const perf = mDen ? Math.round((mRep / mDen) * 100) : 100;
            return (
              <div key={member.id} className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 font-bold">
                    {member.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-emerald-900">{member.name}</div>
                    <div className="text-sm text-emerald-800/60">{member.location}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-900">Score: {member.creditScore}</div>
                  <div className="text-xs text-emerald-600 font-bold">Repayment perf. {perf}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const FarmerProfileView = ({ farmer }: { farmer: Farmer }) => {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-emerald-100">
        <h2 className="text-xl font-bold text-emerald-900 mb-2">Your profile</h2>
        <p className="text-sm text-emerald-800/60 mb-6">Registered details for AgriCredit</p>
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-emerald-50">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
            {farmer.name[0]}
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-900">{farmer.name}</div>
            <div className="text-sm text-emerald-800/70">
              <Phone className="w-3 h-3 inline mr-1" />
              {farmer.phone}
            </div>
          </div>
        </div>
        <h3 className="text-sm font-bold text-emerald-800/60 uppercase tracking-wide mb-4">Farm details</h3>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-800/40 font-bold mb-1">Farm Size</div>
            <div className="flex items-center gap-2 text-emerald-900 font-bold">
              <Ruler className="text-emerald-600 w-4 h-4" />
              {farmer.farmSize} hectares
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-800/40 font-bold mb-1">Primary crop</div>
            <div className="flex items-center gap-2 text-emerald-900 font-bold">
              <Sprout className="text-emerald-600 w-4 h-4" />
              {farmer.cropType}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-800/40 font-bold mb-1">Location</div>
            <div className="flex items-center gap-2 text-emerald-900 font-bold">
              <MapPin className="text-emerald-600 w-4 h-4" />
              {farmer.location}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-800/40 font-bold mb-1">National ID</div>
            <div className="flex items-center gap-2 text-emerald-900 font-bold">
              <ShieldAlert className="text-emerald-600 w-4 h-4" />
              {farmer.nationalId}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Vendor Views ---

const vendorOrderStatusClass = (status: Loan['status']) => {
  switch (status) {
    case 'Pending':
      return 'bg-amber-100 text-amber-800';
    case 'Approved':
      return 'bg-blue-100 text-blue-800';
    case 'Paid to Vendor':
      return 'bg-indigo-100 text-indigo-800';
    case 'Delivered':
      return 'bg-emerald-100 text-emerald-800';
    case 'Repaid':
      return 'bg-teal-100 text-teal-800';
    case 'Rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const VendorStatBar = ({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs font-medium text-emerald-800/80">
      <span>{label}</span>
      <span>{value}</span>
    </div>
    <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${max ? (value / max) * 100 : 0}%` }}
      />
    </div>
  </div>
);

const VendorOverview = ({
  vendorId,
  loans,
  farmers,
  products,
  onViewOrders,
}: {
  vendorId: string;
  loans: Loan[];
  farmers: Farmer[];
  products: Product[];
  onViewOrders: () => void;
}) => {
  const mine = loans.filter((l) => l.vendorId === vendorId);
  const incoming = mine.filter((l) => l.status === 'Pending' || l.status === 'Approved').length;
  const readyToShip = mine.filter((l) => l.status === 'Paid to Vendor').length;
  const delivered = mine.filter((l) => l.status === 'Delivered' || l.status === 'Repaid').length;
  const revenue = mine
    .filter((l) => l.status !== 'Pending' && l.status !== 'Rejected')
    .reduce((a, l) => a + l.amount, 0);
  const recent = [...mine]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <p className="text-sm text-emerald-800/60">
        Incoming credit orders, payment from AgriCredit when admin approves, then confirm delivery to farmers.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100">
          <div className="flex items-center gap-2 text-emerald-800/60 text-sm font-medium mb-2">
            <ShoppingBag className="w-4 h-4" /> Awaiting approval / pay
          </div>
          <div className="text-3xl font-bold text-emerald-900">{incoming}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100">
          <div className="flex items-center gap-2 text-emerald-800/60 text-sm font-medium mb-2">
            <CircleDollarSign className="w-4 h-4" /> Ready to deliver
          </div>
          <div className="text-3xl font-bold text-indigo-900">{readyToShip}</div>
          <p className="text-xs text-emerald-800/50 mt-1">Funds received — confirm delivery</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100">
          <div className="flex items-center gap-2 text-emerald-800/60 text-sm font-medium mb-2">
            <CheckCircle2 className="w-4 h-4" /> Delivered / settled
          </div>
          <div className="text-3xl font-bold text-emerald-900">{delivered}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100">
          <div className="text-sm text-emerald-800/60 font-medium mb-2">Sales through platform</div>
          <div className="text-2xl font-bold text-emerald-900">₦{revenue.toLocaleString()}</div>
          <p className="text-xs text-emerald-800/50 mt-1">{products.filter((p) => p.vendorId === vendorId).length} SKUs in catalog</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl border border-emerald-100 p-6 shadow-sm">
          <h3 className="font-bold text-emerald-900 mb-4">Delivery pipeline</h3>
          <ul className="space-y-3 text-sm text-emerald-800/80">
            <li className="flex gap-2">
              <span className="font-bold text-emerald-900">1.</span>
              Farmer requests credit — order is <strong>Pending</strong> until admin approves.
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-emerald-900">2.</span>
              AgriCredit pays you — status <strong>Paid to Vendor</strong> (system disbursement).
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-emerald-900">3.</span>
              You ship to the farmer — tap <strong>Confirm delivery</strong> → <strong>Delivered</strong>.
            </li>
          </ul>
        </div>
        <div className="bg-emerald-900 text-white rounded-3xl p-6 shadow-lg">
          <h3 className="font-bold mb-2">Orders & notifications</h3>
          <p className="text-emerald-100/80 text-sm mb-4">
            New orders and payment-received alerts appear in the bell menu. Use Orders for full detail and actions.
          </p>
          <button
            type="button"
            onClick={onViewOrders}
            className="w-full py-3 rounded-2xl bg-white text-emerald-900 font-bold hover:bg-emerald-50 transition-colors"
          >
            Open order management
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-emerald-50 flex justify-between items-center">
          <h3 className="font-bold text-emerald-900">Recent activity</h3>
          <button type="button" onClick={onViewOrders} className="text-sm font-bold text-emerald-600 hover:underline">
            View all
          </button>
        </div>
        <div className="divide-y divide-emerald-50">
          {recent.length === 0 ? (
            <div className="p-10 text-center text-emerald-800/40 italic">No orders yet</div>
          ) : (
            recent.map((order) => {
              const farmer = farmers.find((f) => f.id === order.farmerId);
              return (
                <div key={order.id} className="px-6 py-4 flex flex-wrap justify-between gap-4 items-center">
                  <div>
                    <div className="font-bold text-emerald-900">{order.productName}</div>
                    <div className="text-sm text-emerald-800/60">
                      {farmer?.name ?? 'Farmer'} · ₦{order.amount.toLocaleString()}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${vendorOrderStatusClass(order.status)}`}>
                    {order.status}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const VendorOrders = ({
  vendorId,
  loans,
  farmers,
  onUpdateStatus,
}: {
  vendorId: string;
  loans: Loan[];
  farmers: Farmer[];
  onUpdateStatus: (id: string, status: Loan['status']) => void;
}) => {
  const [filter, setFilter] = useState<'all' | 'pipeline' | 'paid' | 'done'>('all');
  const orders = loans.filter((l: Loan) => l.vendorId === vendorId);

  const filtered = orders.filter((o) => {
    if (filter === 'pipeline') return o.status === 'Pending' || o.status === 'Approved';
    if (filter === 'paid') return o.status === 'Paid to Vendor';
    if (filter === 'done') return o.status === 'Delivered' || o.status === 'Repaid' || o.status === 'Rejected';
    return true;
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-emerald-800/60 max-w-3xl">
        Track each order from request to delivery. After admin approves the loan, AgriCredit disburses to you — then confirm when the farmer receives the goods.
      </p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'All orders'],
            ['pipeline', 'Awaiting disbursement'],
            ['paid', 'Payment received'],
            ['done', 'Delivered / closed'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              filter === id
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white border border-emerald-100 text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-emerald-50 flex justify-between items-center bg-emerald-50/30">
          <h2 className="font-bold text-emerald-900">Incoming orders</h2>
        </div>
        <div className="divide-y divide-emerald-50">
          {filtered.length > 0 ? (
            filtered.map((order: Loan) => {
              const farmer = farmers.find((f) => f.id === order.farmerId);
              return (
                <div
                  key={order.id}
                  className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600 shrink-0">
                      <Package />
                    </div>
                    <div>
                      <div className="font-bold text-emerald-900">{order.productName}</div>
                      <div className="text-sm text-emerald-800/60">
                        Farmer: <strong className="text-emerald-800">{farmer?.name ?? '—'}</strong>
                      </div>
                      <div className="text-xs font-mono text-emerald-800/50 mt-1">
                        {order.id} · ₦{order.amount.toLocaleString()} ·{' '}
                        {new Date(order.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${vendorOrderStatusClass(order.status)}`}>
                      {order.status}
                    </span>
                    {order.status === 'Paid to Vendor' && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(order.id, 'Delivered')}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm"
                      >
                        Confirm delivery
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-emerald-800/40 italic">No orders in this view</div>
          )}
        </div>
      </div>
    </div>
  );
};

const VendorStatsView = ({ vendorId, loans }: { vendorId: string; loans: Loan[] }) => {
  const vendorLoans = loans.filter((l) => l.vendorId === vendorId);
  const totalSales = vendorLoans
    .filter((l) => l.status !== 'Pending' && l.status !== 'Rejected')
    .reduce((acc, curr) => acc + curr.amount, 0);
  const pendingOrders = vendorLoans.filter((l) => l.status === 'Paid to Vendor').length;
  const completedOrders = vendorLoans.filter(
    (l) => l.status === 'Delivered' || l.status === 'Repaid'
  ).length;

  const statusKeys: Loan['status'][] = [
    'Pending',
    'Approved',
    'Paid to Vendor',
    'Delivered',
    'Repaid',
    'Rejected',
  ];
  const counts = statusKeys.map((s) => ({
    status: s,
    count: vendorLoans.filter((l) => l.status === s).length,
  }));
  const maxC = Math.max(...counts.map((c) => c.count), 1);

  return (
    <div className="space-y-8">
      <p className="text-sm text-emerald-800/60">
        Sales statistics are derived from credit orders fulfilled through AgriCredit.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100">
          <div className="text-sm text-emerald-800/60 font-medium mb-1">Total sales revenue</div>
          <div className="text-3xl font-bold text-emerald-900">₦{totalSales.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100">
          <div className="text-sm text-emerald-800/60 font-medium mb-1">Pending deliveries</div>
          <div className="text-3xl font-bold text-emerald-900">{pendingOrders}</div>
          <p className="text-xs text-emerald-800/50 mt-1">Paid to you — ship to farmer</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100">
          <div className="text-sm text-emerald-800/60 font-medium mb-1">Completed orders</div>
          <div className="text-3xl font-bold text-emerald-900">{completedOrders}</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100">
        <h3 className="font-bold text-emerald-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          Orders by status
        </h3>
        <div className="space-y-3 max-w-xl">
          {counts.map(({ status, count }) => (
            <div key={status}>
              <VendorStatBar
                label={status}
                value={count}
                max={maxC}
                color="bg-emerald-500"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const VendorFarmersActiveView = ({
  vendorId,
  loans,
  farmers,
  blockedFarmerIds,
  onBlock,
}: {
  vendorId: string;
  loans: Loan[];
  farmers: Farmer[];
  blockedFarmerIds: string[];
  onBlock: (farmerId: string) => void;
}) => {
  const blocked = new Set(blockedFarmerIds);
  const withOrders = new Set<string>();
  loans.forEach((l) => {
    if (l.vendorId === vendorId) withOrders.add(l.farmerId);
  });
  const activeIds = [...withOrders].filter((id) => !blocked.has(id));
  const rows = activeIds
    .map((id) => {
      const f = farmers.find((x) => x.id === id);
      if (!f) return null;
      const n = loans.filter((l) => l.vendorId === vendorId && l.farmerId === id).length;
      return { farmer: f, orderCount: n };
    })
    .filter(Boolean) as { farmer: Farmer; orderCount: number }[];

  return (
    <div className="space-y-4">
      <p className="text-sm text-emerald-800/60 max-w-2xl">
        Farmers who have credit orders with you and are not on your blocked list. Blocking stops them from placing new orders with your store.
      </p>
      <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
        <table className="w-full text-left min-w-[640px]">
          <thead className="bg-emerald-50/50 text-emerald-900 font-bold text-sm">
            <tr>
              <th className="px-6 py-4">Farmer</th>
              <th className="px-6 py-4">Phone</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Orders</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-emerald-800/40 italic">
                  No active farmers yet — orders will appear here after farmers buy from you.
                </td>
              </tr>
            ) : (
              rows.map(({ farmer, orderCount }) => (
                <tr key={farmer.id}>
                  <td className="px-6 py-4 font-medium text-emerald-900">{farmer.name}</td>
                  <td className="px-6 py-4 text-sm text-emerald-800/70">{farmer.phone}</td>
                  <td className="px-6 py-4 text-sm text-emerald-800/60">{farmer.location}</td>
                  <td className="px-6 py-4 font-bold">{orderCount}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            `Block ${farmer.name}? They will not be able to request new credit orders from your business.`
                          )
                        )
                          onBlock(farmer.id);
                      }}
                      className="text-sm font-bold text-red-600 hover:text-red-800"
                    >
                      Block farmer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const VendorFarmersBlockedView = ({
  farmers,
  blockedFarmerIds,
  onUnblock,
}: {
  farmers: Farmer[];
  blockedFarmerIds: string[];
  onUnblock: (farmerId: string) => void;
}) => {
  const rows = blockedFarmerIds.map((id) => {
    const f = farmers.find((x) => x.id === id);
    return { farmerId: id, farmer: f };
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-emerald-800/60 max-w-2xl">
        Blocked farmers cannot start new credit orders with your business. Existing orders stay in Orders until completed.
      </p>
      <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
        <table className="w-full text-left min-w-[560px]">
          <thead className="bg-emerald-50/50 text-emerald-900 font-bold text-sm">
            <tr>
              <th className="px-6 py-4">Farmer</th>
              <th className="px-6 py-4">Phone</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-emerald-800/40 italic">
                  No blocked farmers.
                </td>
              </tr>
            ) : (
              rows.map(({ farmerId, farmer }) => (
                <tr key={farmerId}>
                  <td className="px-6 py-4 font-medium text-emerald-900">
                    {farmer?.name ?? 'Unknown farmer'}
                  </td>
                  <td className="px-6 py-4 text-sm text-emerald-800/70">{farmer?.phone ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-emerald-800/60">{farmer?.location ?? '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onUnblock(farmerId)}
                      className="text-sm font-bold text-emerald-600 hover:text-emerald-800"
                    >
                      Reactivate farmer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Admin Views ---

const OVERDUE_MS = 14 * 24 * 60 * 60 * 1000;

const isLoanOverdue = (loan: Loan) =>
  loan.status === 'Delivered' &&
  Date.now() - new Date(loan.createdAt).getTime() > OVERDUE_MS;

const farmerRepaymentPerformance = (farmerId: string, loans: Loan[]) => {
  const mine = loans.filter((l) => l.farmerId === farmerId);
  const repaid = mine.filter((l) => l.status === 'Repaid').length;
  const activePipeline = mine.filter(
    (l) => l.status !== 'Pending' && l.status !== 'Rejected'
  ).length;
  const rate =
    activePipeline > 0 ? Math.round((repaid / activePipeline) * 100) : 100;
  return { repaid, totalNonPending: activePipeline, rate };
};

const vendorSalesTotal = (vendorId: string, loans: Loan[]) =>
  loans
    .filter(
      (l) =>
        l.vendorId === vendorId &&
        l.status !== 'Pending' &&
        l.status !== 'Rejected'
    )
    .reduce((acc, l) => acc + l.amount, 0);

const systemRepaymentRate = (loans: Loan[]) => {
  const closed = loans.filter(
    (l) => l.status === 'Repaid' || l.status === 'Rejected'
  );
  const repaid = loans.filter((l) => l.status === 'Repaid').length;
  if (!closed.length) return 100;
  return Math.round((repaid / closed.length) * 100);
};

const loanStatusCounts = (loans: Loan[]) => {
  const keys: Loan['status'][] = [
    'Pending',
    'Approved',
    'Paid to Vendor',
    'Delivered',
    'Repaid',
    'Rejected',
  ];
  return keys.map((k) => ({
    status: k,
    count: loans.filter((l) => l.status === k).length,
  }));
};

const BarRow = ({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs font-medium text-emerald-800/80">
      <span>{label}</span>
      <span>{value}</span>
    </div>
    <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${max ? (value / max) * 100 : 0}%` }}
      />
    </div>
  </div>
);

const AdminDashboard = ({
  farmers,
  vendors,
  loans,
  products,
  groups,
  onRefresh,
}: {
  farmers: Farmer[];
  vendors: Vendor[];
  loans: Loan[];
  products: Product[];
  groups: Group[];
  onRefresh: () => void;
}) => {
  const activeVendors = vendors.filter((v) => v.status === 'active').length;
  const activeLoans = loans.filter(
    (l) => l.status !== 'Repaid' && l.status !== 'Rejected'
  ).length;
  const overdueCount = loans.filter(isLoanOverdue).length;
  const repRate = systemRepaymentRate(loans);
  const defaultedApprox = loans.filter(
    (l) => l.status === 'Rejected' || isLoanOverdue(l)
  ).length;
  const defaultRate =
    loans.length > 0
      ? Math.round((defaultedApprox / loans.length) * 100)
      : 0;

  const statusCounts = loanStatusCounts(loans);
  const maxStatus = Math.max(...statusCounts.map((s) => s.count), 1);

  const vendorSales = vendors
    .filter((v) => v.status === 'active')
    .map((v) => ({
      id: v.id,
      name: v.businessName,
      sales: vendorSalesTotal(v.id, loans),
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 6);
  const maxSale = Math.max(...vendorSales.map((v) => v.sales), 1);

  const pendingLoans = loans.filter((l) => l.status === 'Pending');
  const pendingVendors = vendors.filter((v) => v.status === 'pending');

  const stats = [
    {
      label: 'Total Farmers',
      value: farmers.length,
      icon: <Users />,
      color: 'bg-blue-500',
    },
    {
      label: 'Active Vendors',
      value: activeVendors,
      icon: <Store />,
      color: 'bg-teal-500',
    },
    {
      label: 'Active Loans',
      value: activeLoans,
      icon: <CreditCard />,
      color: 'bg-emerald-500',
    },
    {
      label: 'System repayment rate',
      value: `${repRate}%`,
      icon: <TrendingUp />,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100"
          >
            <div
              className={`w-12 h-12 ${stat.color} text-white rounded-2xl flex items-center justify-center mb-4`}
            >
              {stat.icon}
            </div>
            <div className="text-sm text-emerald-800/60 font-medium">
              {stat.label}
            </div>
            <div className="text-2xl font-bold text-emerald-900">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-emerald-100 p-6">
          <h3 className="font-bold text-emerald-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            Loan statistics
          </h3>
          <div className="space-y-3">
            {statusCounts.map(({ status, count }) => (
              <div key={status}>
                <BarRow
                  label={String(status)}
                  value={count}
                  max={maxStatus}
                  color="bg-emerald-500"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 p-6 space-y-4">
          <h3 className="font-bold text-emerald-900 flex items-center gap-2">
            <Percent className="w-5 h-5 text-amber-600" />
            Risk snapshot
          </h3>
          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
            <div className="text-xs font-bold text-amber-800 uppercase tracking-wide">
              Default / stress (est.)
            </div>
            <div className="text-3xl font-bold text-amber-900 mt-1">{defaultRate}%</div>
            <p className="text-xs text-amber-800/70 mt-2">
              Rejected + overdue (delivered &gt; 14d) vs all loans
            </p>
          </div>
          <div className="rounded-2xl bg-red-50 border border-red-100 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-red-900">Overdue loans</div>
              <div className="text-2xl font-bold text-red-800">{overdueCount}</div>
              <p className="text-xs text-red-800/70">Delivered, awaiting repayment</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 p-6">
        <h3 className="font-bold text-emerald-900 mb-4 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-emerald-600" />
          Vendor sales (active vendors)
        </h3>
        {vendorSales.length === 0 ? (
          <p className="text-sm text-emerald-800/50 italic">No vendor sales yet</p>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {vendorSales.map((v) => (
              <div key={v.id}>
                <BarRow
                  label={v.name}
                  value={v.sales}
                  max={maxSale}
                  color="bg-indigo-500"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-emerald-50 font-bold text-emerald-900">
            Recent loan requests
          </div>
          <div className="divide-y divide-emerald-50">
            {pendingLoans.length > 0 ? (
              pendingLoans.map((loan: Loan) => (
                <div
                  key={loan.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-sm">{loan.productName}</div>
                    <div className="text-xs text-emerald-800/60">
                      ₦{loan.amount.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => approveLoan(loan.id).then(onRefresh)}
                      className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectLoan(loan.id).then(onRefresh)}
                      className="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-emerald-800/40 italic text-sm">
                No pending requests
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-emerald-50 font-bold text-emerald-900">
            Vendor approvals
          </div>
          <div className="divide-y divide-emerald-50">
            {pendingVendors.length > 0 ? (
              pendingVendors.map((vendor: Vendor) => (
                <div
                  key={vendor.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-sm">{vendor.businessName}</div>
                    <div className="text-xs text-emerald-800/60">
                      {vendor.location}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveVendor(vendor.id).then(onRefresh)}
                      className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectVendor(vendor.id).then(onRefresh)}
                      className="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-xs font-bold"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-emerald-800/40 italic text-sm">
                No pending vendors
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-emerald-800/70">
        <div className="bg-white rounded-2xl border border-emerald-100 px-4 py-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-600" />
          <span>
            Products listed: <strong className="text-emerald-900">{products.length}</strong>
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-100 px-4 py-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-600" />
          <span>
            Trust groups: <strong className="text-emerald-900">{groups.length}</strong>
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-100 px-4 py-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-600" />
          <span>
            Pending vendor signups:{' '}
            <strong className="text-emerald-900">{pendingVendors.length}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

const AdminFarmersView = ({
  farmers,
  loans,
  onStatus,
}: {
  farmers: Farmer[];
  loans: Loan[];
  onStatus: (id: string, s: 'active' | 'suspended' | 'blocked') => void;
}) => {
  return (
    <div className="space-y-4">
      <p className="text-sm text-emerald-800/60">
        View all farmers, manage account status, and review repayment performance from loan history.
      </p>
      <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-emerald-50/50 text-emerald-900 font-bold text-sm">
            <tr>
              <th className="px-6 py-4">Farmer</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Score</th>
              <th className="px-6 py-4">Repayment perf.</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {farmers.map((farmer: Farmer) => {
              const perf = farmerRepaymentPerformance(farmer.id, loans);
              return (
                <tr key={farmer.id}>
                  <td className="px-6 py-4 font-medium">{farmer.name}</td>
                  <td className="px-6 py-4 text-sm text-emerald-800/60">
                    {farmer.location}
                  </td>
                  <td className="px-6 py-4 font-bold">{farmer.creditScore}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-emerald-900">{perf.rate}%</div>
                    <div className="text-xs text-emerald-800/50">
                      {perf.repaid} repaid / {perf.totalNonPending} non-pending
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                        farmer.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : farmer.status === 'suspended'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {farmer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {farmer.status === 'pending' && (
                        <button
                          onClick={() => onStatus(farmer.id, 'active')}
                          className="text-emerald-600 hover:text-emerald-800 font-bold text-xs"
                        >
                          Approve
                        </button>
                      )}
                      {farmer.status !== 'suspended' && farmer.status !== 'blocked' && (
                        <button
                          onClick={() => onStatus(farmer.id, 'suspended')}
                          className="text-amber-700 font-bold text-xs"
                        >
                          Suspend
                        </button>
                      )}
                      {farmer.status !== 'blocked' && (
                        <button
                          onClick={() => onStatus(farmer.id, 'blocked')}
                          className="text-red-600 font-bold text-xs flex items-center gap-1"
                        >
                          <Ban className="w-3 h-3" /> Block
                        </button>
                      )}
                      {farmer.status !== 'active' && (
                        <button
                          onClick={() => onStatus(farmer.id, 'active')}
                          className="text-emerald-600 font-bold text-xs"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AdminVendorsView = ({
  vendors,
  loans,
  products,
  onApprove,
  onReject,
  onBlock,
  onRemove,
}: {
  vendors: Vendor[];
  loans: Loan[];
  products: Product[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onBlock: (id: string) => void;
  onRemove: (id: string) => void;
}) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-emerald-800/60">
        Approve or reject registrations, block vendors, remove vendors, and inspect each vendor&apos;s product catalog.
      </p>
      <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-emerald-50/50 text-emerald-900 font-bold text-sm">
            <tr>
              <th className="px-6 py-4">Business</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Sales (₦)</th>
              <th className="px-6 py-4">Products</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {vendors.map((vendor: Vendor) => {
              const catalog = products.filter((p) => p.vendorId === vendor.id);
              const sales = vendorSalesTotal(vendor.id, loans);
              return (
                <React.Fragment key={vendor.id}>
                  <tr>
                    <td className="px-6 py-4 font-medium">{vendor.businessName}</td>
                    <td className="px-6 py-4 text-sm text-emerald-800/60">
                      {vendor.location}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono">
                      ₦{sales.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(expanded === vendor.id ? null : vendor.id)
                        }
                        className="text-emerald-600 font-bold text-sm hover:underline"
                      >
                        {catalog.length} items
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                          vendor.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : vendor.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {vendor.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {vendor.status === 'pending' && (
                          <>
                            <button
                              onClick={() => onApprove(vendor.id)}
                              className="text-emerald-600 font-bold text-xs"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => onReject(vendor.id)}
                              className="text-red-600 font-bold text-xs"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {vendor.status === 'active' && (
                          <button
                            onClick={() => onBlock(vendor.id)}
                            className="text-red-600 font-bold text-xs"
                          >
                            Block
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                'Remove this vendor and their product catalog from the system?'
                              )
                            )
                              onRemove(vendor.id);
                          }}
                          className="text-emerald-800/60 font-bold text-xs hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded === vendor.id && (
                    <tr className="bg-emerald-50/30">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="text-xs font-bold text-emerald-900 mb-2">
                          Product catalog — {vendor.businessName}
                        </div>
                        {catalog.length === 0 ? (
                          <p className="text-sm text-emerald-800/50 italic">No products</p>
                        ) : (
                          <ul className="grid sm:grid-cols-2 gap-2 text-sm">
                            {catalog.map((p) => (
                              <li
                                key={p.id}
                                className="flex justify-between bg-white rounded-xl px-3 py-2 border border-emerald-100"
                              >
                                <span>{p.name}</span>
                                <span className="font-mono text-emerald-800">
                                  ₦{p.price.toLocaleString()} · {p.stock} in stock
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AdminLoansView = ({
  farmers,
  vendors,
  loans,
  groups,
  onApprove,
  onDisburse,
  onReject,
}: {
  farmers: Farmer[];
  vendors: Vendor[];
  loans: Loan[];
  groups: Group[];
  onApprove: (id: string) => void;
  onDisburse: (id: string) => void;
  onReject: (id: string) => void;
}) => {
  const [filter, setFilter] = useState<string>('all');

  const groupForFarmer = (farmerId: string) =>
    groups.find((g) => g.memberIds.includes(farmerId));

  const filtered =
    filter === 'overdue'
      ? loans.filter(isLoanOverdue)
      : filter === 'pending'
        ? loans.filter((l) => l.status === 'Pending')
        : loans;

  const groupPerfRows = groups.map((g) => {
    const memberLoans = loans.filter((l) => {
      const f = farmers.find((x) => x.id === l.farmerId);
      return f && g.memberIds.includes(f.id);
    });
    const repaid = memberLoans.filter((l) => l.status === 'Repaid').length;
    const denom = memberLoans.filter(
      (l) => l.status !== 'Pending' && l.status !== 'Rejected'
    ).length;
    const rate = denom ? Math.round((repaid / denom) * 100) : g.repaymentRate;
    return { group: g, rate, members: g.memberIds.length };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-bold text-emerald-900 mr-2">Filter:</span>
        {(['all', 'pending', 'overdue'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize ${
              filter === f
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-emerald-100 text-emerald-800'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filter === 'overdue' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-900 flex gap-2 items-start">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>
            Overdue = delivered to farmer, no repayment for more than 14 days (demo rule).
          </span>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-x-auto">
        <table className="w-full text-left min-w-[960px]">
          <thead className="bg-emerald-50/50 text-emerald-900 font-bold text-sm">
            <tr>
              <th className="px-6 py-4">Loan</th>
              <th className="px-6 py-4">Farmer</th>
              <th className="px-6 py-4">Vendor</th>
              <th className="px-6 py-4">Group perf.</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {filtered.map((loan: Loan) => {
              const farmer = farmers.find((x) => x.id === loan.farmerId);
              const vendor = vendors.find((x) => x.id === loan.vendorId);
              const g = farmer ? groupForFarmer(farmer.id) : undefined;
              const overdue = isLoanOverdue(loan);
              return (
                <tr key={loan.id}>
                  <td className="px-6 py-4 font-mono text-xs">{loan.id}</td>
                  <td className="px-6 py-4 font-medium">
                    {farmer?.name ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {vendor?.businessName ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {g ? (
                      <>
                        <span className="font-bold text-emerald-900">{g.repaymentRate}%</span>
                        <span className="text-emerald-800/60"> · {g.name}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4">₦{loan.amount.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase w-fit ${
                          loan.status === 'Repaid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : loan.status === 'Rejected'
                              ? 'bg-red-100 text-red-700'
                              : overdue
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {overdue ? 'Overdue' : loan.status}
                      </span>
                      {overdue && (
                        <span className="text-[10px] text-amber-700 font-medium">
                          Needs follow-up
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {loan.status === 'Pending' ? (
                      <div className="flex justify-end gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onApprove(loan.id)}
                          className="text-emerald-600 font-bold text-sm hover:underline cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => onReject(loan.id)}
                          className="text-red-600 font-bold text-sm hover:underline cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    ) : loan.status === 'Approved' ? (
                      <div className="flex justify-end gap-2 flex-wrap items-center">
                        <button
                          type="button"
                          onClick={() => onDisburse(loan.id)}
                          className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                        >
                          Disburse
                        </button>
                        <button
                          type="button"
                          onClick={() => onReject(loan.id)}
                          className="text-red-600 font-bold text-xs hover:underline cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    ) : loan.status !== 'Repaid' && loan.status !== 'Rejected' ? (
                      <button
                        type="button"
                        onClick={() => onReject(loan.id)}
                        className="text-red-600 font-bold text-xs hover:underline cursor-pointer"
                      >
                        Reject (override)
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-800/40">Closed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-emerald-800/40 italic">No loans</div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-bold text-emerald-900 mb-3 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Group repayment performance
        </h3>
        <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-emerald-50/50 text-emerald-900 font-bold text-sm">
              <tr>
                <th className="px-6 py-4">Group</th>
                <th className="px-6 py-4">Members</th>
                <th className="px-6 py-4">Recorded rate</th>
                <th className="px-6 py-4">Loan-based rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-50">
              {groupPerfRows.map(({ group, rate, members }) => (
                <tr key={group.id}>
                  <td className="px-6 py-4 font-medium">{group.name}</td>
                  <td className="px-6 py-4">{members}</td>
                  <td className="px-6 py-4">{group.repaymentRate}%</td>
                  <td className="px-6 py-4 font-bold text-emerald-800">{rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AdminGroupsView = ({
  groups,
  farmers,
  loans,
}: {
  groups: Group[];
  farmers: Farmer[];
  loans: Loan[];
}) => {
  return (
    <div className="space-y-4">
      <p className="text-sm text-emerald-800/60">
        View trust groups, members, and repayment signals.
      </p>
      <div className="space-y-6">
        {groups.map((g) => {
          const members = farmers.filter((f) => g.memberIds.includes(f.id));
          const memberLoans = loans.filter((l) =>
            members.some((m) => m.id === l.farmerId)
          );
          const repaid = memberLoans.filter((l) => l.status === 'Repaid').length;
          const denom = memberLoans.filter(
            (l) => l.status !== 'Pending' && l.status !== 'Rejected'
          ).length;
          const loanRate = denom ? Math.round((repaid / denom) * 100) : 100;

          return (
            <div
              key={g.id}
              className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-emerald-50 flex flex-wrap justify-between gap-4 items-center">
                <div>
                  <h3 className="font-bold text-emerald-900 text-lg">{g.name}</h3>
                  <p className="text-sm text-emerald-800/60">
                    Recorded group rate: <strong>{g.repaymentRate}%</strong> · Loan-calculated:{' '}
                    <strong>{loanRate}%</strong>
                  </p>
                </div>
              </div>
              <div className="divide-y divide-emerald-50">
                {members.length === 0 ? (
                  <div className="p-6 text-sm text-emerald-800/50 italic">No members</div>
                ) : (
                  members.map((m) => {
                    const perf = farmerRepaymentPerformance(m.id, loans);
                    return (
                      <div
                        key={m.id}
                        className="px-6 py-4 flex flex-wrap justify-between gap-4 items-center"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 font-bold">
                            {m.name[0]}
                          </div>
                          <div>
                            <div className="font-bold text-emerald-900">{m.name}</div>
                            <div className="text-xs text-emerald-800/60">{m.location}</div>
                          </div>
                        </div>
                        <div className="text-sm text-right">
                          <span className="font-bold text-emerald-900">{perf.rate}%</span>{' '}
                          <span className="text-emerald-800/50">repayment perf.</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
      {groups.length === 0 && (
        <p className="text-center text-emerald-800/40 italic py-12">No groups yet</p>
      )}
    </div>
  );
};

const downloadCsv = (filename: string, rows: (string | number)[][]) => {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const AdminReportsView = ({
  farmers,
  vendors,
  loans,
  products,
}: {
  farmers: Farmer[];
  vendors: Vendor[];
  loans: Loan[];
  products: Product[];
}) => {
  const repaidVol = loans
    .filter((l) => l.status === 'Repaid')
    .reduce((a, l) => a + l.amount, 0);
  const outstanding = loans
    .filter((l) => l.status !== 'Repaid' && l.status !== 'Rejected')
    .reduce((a, l) => a + l.amount, 0);
  const overdue = loans.filter(isLoanOverdue).length;

  const healthScore = Math.max(
    0,
    Math.min(
      100,
      100 -
        Math.round(loans.length ? (overdue / loans.length) * 40 : 0) -
        Math.round(vendors.filter((v) => v.status === 'pending').length * 3)
    )
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-800/60 text-sm font-medium mb-2">
            <Activity className="w-4 h-4" /> System health (demo index)
          </div>
          <div className="text-4xl font-bold text-emerald-900">{healthScore}</div>
          <p className="text-xs text-emerald-800/50 mt-2">
            Weighted by overdue load and pending vendor queue
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm">
          <div className="text-sm text-emerald-800/60 font-medium mb-2">Repaid volume</div>
          <div className="text-2xl font-bold text-emerald-900">
            ₦{repaidVol.toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm">
          <div className="text-sm text-emerald-800/60 font-medium mb-2">Outstanding exposure</div>
          <div className="text-2xl font-bold text-amber-900">
            ₦{outstanding.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm p-6">
        <h3 className="font-bold text-emerald-900 mb-4 flex items-center gap-2">
          <FileDown className="w-5 h-5 text-emerald-600" />
          Generate reports (CSV)
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              downloadCsv('agricredit-loans.csv', [
                ['id', 'farmerId', 'vendorId', 'product', 'amount', 'status', 'createdAt'],
                ...loans.map((l) => [
                  l.id,
                  l.farmerId,
                  l.vendorId,
                  l.productName,
                  l.amount,
                  l.status,
                  l.createdAt,
                ]),
              ])
            }
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700"
          >
            <FileDown className="w-4 h-4" /> Loans
          </button>
          <button
            type="button"
            onClick={() => {
              const perf = farmers.map((f) => {
                const p = farmerRepaymentPerformance(f.id, loans);
                return [f.id, f.name, p.rate, p.repaid, p.totalNonPending];
              });
              downloadCsv('agricredit-repayments-by-farmer.csv', [
                ['farmerId', 'name', 'repaymentRatePct', 'repaidCount', 'nonPendingCount'],
                ...perf,
              ]);
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border-2 border-emerald-200 text-emerald-900 font-bold text-sm hover:bg-emerald-50"
          >
            Repayments by farmer
          </button>
          <button
            type="button"
            onClick={() =>
              downloadCsv('agricredit-vendor-sales.csv', [
                ['vendorId', 'businessName', 'salesTotal'],
                ...vendors.map((v) => [
                  v.id,
                  v.businessName,
                  vendorSalesTotal(v.id, loans),
                ]),
              ])
            }
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border-2 border-emerald-200 text-emerald-900 font-bold text-sm hover:bg-emerald-50"
          >
            Vendor sales
          </button>
          <button
            type="button"
            onClick={() =>
              downloadCsv('agricredit-products.csv', [
                ['id', 'vendorId', 'name', 'category', 'price', 'stock'],
                ...products.map((p) => [
                  p.id,
                  p.vendorId,
                  p.name,
                  p.category,
                  p.price,
                  p.stock,
                ]),
              ])
            }
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border-2 border-emerald-200 text-emerald-900 font-bold text-sm hover:bg-emerald-50"
          >
            Product catalog
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Modals ---

const LoanRequestModal = ({
  isOpen,
  onClose,
  vendors,
  products,
  onSubmit,
  error,
  inputProductsOnly,
}: any) => {
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [amount, setAmount] = useState(0);

  if (!isOpen) return null;

  const vendorProducts = products.filter((p: Product) => {
    if (p.vendorId !== selectedVendor) return false;
    if (inputProductsOnly) {
      return ['Seeds', 'Fertilizers', 'Pesticides'].includes(p.category);
    }
    return true;
  });

  return (
    <div className="fixed inset-0 bg-emerald-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          <h2 className="text-2xl font-bold text-emerald-900 mb-2">Request agricultural credit</h2>
          {inputProductsOnly && (
            <p className="text-sm text-emerald-800/60 mb-4">
              Select seeds, fertilizers, or pesticides from an approved vendor. Admin approval is required before payment.
            </p>
          )}
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 text-sm p-3 rounded-xl border border-red-100">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-emerald-900 mb-2">Select Vendor</label>
              <select 
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">Choose a vendor...</option>
                {vendors.map((v: Vendor) => (
                  <option key={v.id} value={v.id}>{v.businessName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-emerald-900 mb-2">Select Product</label>
              <select 
                value={selectedProduct}
                onChange={(e) => {
                  setSelectedProduct(e.target.value);
                  const p = products.find((prod: Product) => prod.id === e.target.value);
                  if (p) setAmount(p.price);
                }}
                className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                disabled={!selectedVendor}
              >
                <option value="">Choose a product...</option>
                {vendorProducts.map((p: Product) => (
                  <option key={p.id} value={p.id}>{p.name} (₦{p.price.toLocaleString()})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-emerald-900 mb-2">Loan Amount (₦)</label>
              <input 
                type="number"
                value={amount}
                readOnly
                className="w-full bg-emerald-100 border border-emerald-100 rounded-2xl px-4 py-3 text-emerald-900 font-bold outline-none"
              />
            </div>
          </div>
          <div className="mt-8 flex gap-4">
            <button 
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-2xl font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => onSubmit(selectedVendor, selectedProduct, amount)}
              disabled={!selectedProduct}
              className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-200 disabled:opacity-50"
            >
              Submit Request
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const ProductModal = ({ isOpen, onClose, onSubmit, initialData }: any) => {
  const [formData, setFormData] = useState(initialData || { name: '', category: 'Seeds', price: 0, stock: 0 });

  if (!isOpen) return null;

  const baseCategories: Product['category'][] = ['Seeds', 'Fertilizers', 'Pesticides'];
  const categoryOptions: Product['category'][] =
    initialData?.category === 'Tools' ? [...baseCategories, 'Tools'] : baseCategories;

  return (
    <div className="fixed inset-0 bg-emerald-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          <h2 className="text-2xl font-bold text-emerald-900 mb-6">{initialData ? 'Edit Product' : 'Add New Product'}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-emerald-900 mb-2">Product Name</label>
              <input 
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. NPK Fertilizer"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-emerald-900 mb-2">Category</label>
              <select 
                value={formData.category}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category: e.target.value as Product['category'],
                  })
                }
                className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-emerald-900 mb-2">Price (₦)</label>
                <input 
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                  className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-emerald-900 mb-2">Stock Level</label>
                <input 
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})}
                  className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>
          <div className="mt-8 flex gap-4">
            <button 
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-2xl font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => onSubmit(formData)}
              className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-200"
            >
              {initialData ? 'Update Product' : 'Save Product'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main Dashboard Component ---

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState<any>({
    farmers: [], vendors: [], loans: [], products: [], groups: [], notifications: [],
    blockedFarmerIds: [] as string[],
    blockedVendorIds: [] as string[],
  });
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanRequestError, setLoanRequestError] = useState<string | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [repayModalLoan, setRepayModalLoan] = useState<Loan | null>(null);
  const navigate = useNavigate();

  const vendorScopeId = (u: typeof user) =>
    u?.role === 'vendor' ? (u.vendorProfileId ?? u.id) : u?.id;

  const refreshData = async () => {
    if (!user) return;
    if (user.role === 'farmer') {
      await syncFarmerRepaymentDueReminders(user.id);
    }
    const farmers = await getFarmers();
    const vendors = await getVendors();
    const loans = await getLoans();
    const products = await getProducts();
    const groups = await getGroups();
    const notifications = await getNotifications(user.id);
    const blockedFarmerIds =
      user.role === 'vendor'
        ? await getBlockedFarmerIdsForVendor(vendorScopeId(user) as string)
        : [];
    const blockedVendorIds =
      user.role === 'farmer' ? await getBlockedVendorIdsForFarmer() : [];
    setData({
      farmers,
      vendors,
      loans,
      products,
      groups,
      notifications,
      blockedFarmerIds,
      blockedVendorIds,
    });
    if (user.role === 'farmer') {
      const f = farmers.find((x: Farmer) => x.id === user.id);
      if (f) {
        const { password: _pw, ...safe } = f as Farmer & { password?: string };
        setUser(safe);
      }
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('agri_user');
    if (!storedUser) {
      navigate('/login');
    } else {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      // Set initial tab based on role
      if (parsed.role === 'vendor') setActiveTab('overview');
      if (parsed.role === 'admin') setActiveTab('dashboard');
    }
  }, [navigate]);

  useEffect(() => {
    if (user) void refreshData();
  }, [user?.id]);

  const handleLogout = () => {
    localStorage.removeItem('agri_user');
    localStorage.removeItem('agri_token');
    navigate('/');
  };

  if (!user) return null;

  const farmerLoans =
    user.role === 'farmer'
      ? data.loans.filter((l: Loan) => loanBelongsToFarmer(l, user.id))
      : [];

  return (
    <div className="min-h-screen bg-emerald-50/30 flex">
      <Sidebar 
        role={user.role} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
      />
      
      <div className="flex-1 ml-64 p-8 relative z-10 min-w-0">
        {submissionNotice && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            <span className="whitespace-pre-line">{submissionNotice}</span>
            <button
              type="button"
              className="shrink-0 font-bold text-emerald-700 hover:text-emerald-950"
              onClick={() => setSubmissionNotice(null)}
            >
              ×
            </button>
          </div>
        )}
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-bold text-emerald-950">
              {user.role === 'farmer' ? `Welcome, ${user.name}` : 
               user.role === 'vendor' ? (user.businessName || user.name) : 'Admin Panel'}
            </h1>
            <p className="text-emerald-800/60">
              {user.role === 'farmer' ? 'Empowering your farm with smart credit.' : 
               user.role === 'vendor' ? 'Managing your agricultural supply chain.' : 'System-wide overview and management.'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {user.role === 'vendor' || user.role === 'farmer' ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((o) => !o)}
                  className="relative p-3 bg-white rounded-2xl border border-emerald-100 text-emerald-600 shadow-sm hover:bg-emerald-50"
                >
                  <Bell />
                  {data.notifications.some((n: Notification) => !n.read) && (
                    <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 border-2 border-white rounded-full" />
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-emerald-100 bg-white shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-emerald-50 flex justify-between items-center bg-emerald-50/50">
                      <span className="font-bold text-emerald-900 text-sm">Notifications</span>
                      <button
                        type="button"
                        onClick={() =>
                          markAllNotificationsRead(user.id).then(() => {
                            void refreshData();
                          })
                        }
                        className="text-xs font-bold text-emerald-600 hover:underline"
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {data.notifications.length === 0 ? (
                        <p className="p-6 text-sm text-emerald-800/50 text-center">No notifications yet</p>
                      ) : (
                        data.notifications.map((n: Notification) => (
                          <div
                            key={n.id}
                            className={`px-4 py-3 border-b border-emerald-50/80 text-sm ${
                              n.read ? 'opacity-60' : 'bg-emerald-50/30'
                            }`}
                          >
                            <div className="font-bold text-emerald-900">{n.title}</div>
                            <div className="text-emerald-800/80 mt-0.5">{n.message}</div>
                            <div className="text-[10px] text-emerald-800/40 mt-1">
                              {new Date(n.createdAt).toLocaleString()}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="relative p-3 bg-white rounded-2xl border border-emerald-100 text-emerald-600 shadow-sm"
              >
                <Bell />
                {data.notifications.some((n: Notification) => !n.read) && (
                  <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 border-2 border-white rounded-full" />
                )}
              </button>
            )}
            <div className="flex items-center gap-3 bg-white p-2 pr-4 rounded-2xl border border-emerald-100 shadow-sm">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold">
                {user.name[0]}
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-bold text-emerald-900 leading-none">{user.name}</div>
                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">{user.role}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content based on Role and Tab */}
        {user.role === 'farmer' && (
          <>
            {activeTab === 'overview' && (
              <FarmerOverview
                farmer={user}
                loans={farmerLoans}
                group={data.groups.find((g: Group) => g.id === user.groupId)}
                onRepayClick={(loan) => setRepayModalLoan(loan)}
              />
            )}
            {activeTab === 'loans' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-emerald-900">Loan History</h2>
                  <button 
                    onClick={() => {
                      setLoanRequestError(null);
                      setIsLoanModalOpen(true);
                    }}
                    className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-200 flex items-center gap-2"
                  >
                    <Plus /> New Loan Request
                  </button>
                </div>
                <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-emerald-50/50 text-emerald-900 font-bold text-sm">
                      <tr>
                        <th className="px-6 py-4">Product</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4 text-right">Repayment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50">
                      {farmerLoans.length > 0 ? farmerLoans.map((loan: Loan) => (
                        <tr key={loan.id}>
                          <td className="px-6 py-4 font-medium">{loan.productName}</td>
                          <td className="px-6 py-4">₦{loan.amount.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${farmerLoanStatusStyle(loan.status)}`}>{loan.status}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-emerald-800/60">{new Date(loan.createdAt).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-right">
                            {canFarmerRepayLoan(loan) && (
                              <button
                                type="button"
                                onClick={() => setRepayModalLoan(loan)}
                                className="text-sm font-bold text-emerald-600 hover:underline cursor-pointer"
                              >
                                Repay
                              </button>
                            )}
                            {loan.status === 'Repaid' && loan.repaymentMethod && (
                              <span className="text-xs text-emerald-800/60">{loan.repaymentMethod}</span>
                            )}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-emerald-800/40 italic">No loan history</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === 'group' && (
              <FarmerGroupView
                group={data.groups.find((g: Group) => g.id === user.groupId)}
                farmers={data.farmers}
                loans={data.loans}
              />
            )}
            {activeTab === 'profile' && (
              <FarmerProfileView farmer={user} />
            )}
          </>
        )}

        {user.role === 'vendor' && (
          <>
            {activeTab === 'overview' && (
              <VendorOverview
                vendorId={vendorScopeId(user) as string}
                loans={data.loans}
                farmers={data.farmers}
                products={data.products}
                onViewOrders={() => setActiveTab('orders')}
              />
            )}
            {activeTab === 'orders' && (
              <VendorOrders
                vendorId={vendorScopeId(user) as string}
                loans={data.loans}
                farmers={data.farmers}
                onUpdateStatus={(id: string, s) => updateOrderStatus(id, s).then(() => void refreshData())}
              />
            )}
            {activeTab === 'products' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-emerald-900">My inventory</h2>
                    <p className="text-sm text-emerald-800/60 mt-1 max-w-xl">
                      Add, edit, or remove products (seeds, fertilizers, pesticides). Keep price and stock up to date for farmers.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingProduct(null);
                      setIsProductModalOpen(true);
                    }}
                    className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-200 flex items-center gap-2 shrink-0"
                  >
                    <Plus /> Add product
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {data.products.filter((p: Product) => p.vendorId === vendorScopeId(user)).map((product: Product) => (
                    <div key={product.id} className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100 relative group">
                      <div className="bg-emerald-50 w-12 h-12 rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
                        <Package />
                      </div>
                      <h3 className="font-bold text-emerald-900">{product.name}</h3>
                      <div className="text-sm text-emerald-800/60 mb-4">{product.category}</div>
                      <div className="flex justify-between items-end">
                        <div className="text-xl font-bold text-emerald-600">₦{product.price.toLocaleString()}</div>
                        <div className="text-xs font-bold text-emerald-800/40">Stock: {product.stock}</div>
                      </div>
                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingProduct(product);
                            setIsProductModalOpen(true);
                          }}
                          className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteProduct(product.id).then(() => void refreshData())}
                          className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'stats' && (
              <VendorStatsView vendorId={vendorScopeId(user) as string} loans={data.loans} />
            )}
            {activeTab === 'farmers-active' && (
              <VendorFarmersActiveView
                vendorId={vendorScopeId(user) as string}
                loans={data.loans}
                farmers={data.farmers}
                blockedFarmerIds={data.blockedFarmerIds}
                onBlock={(farmerId) =>
                  vendorBlockFarmer(vendorScopeId(user) as string, farmerId).then(() => void refreshData())
                }
              />
            )}
            {activeTab === 'farmers-blocked' && (
              <VendorFarmersBlockedView
                farmers={data.farmers}
                blockedFarmerIds={data.blockedFarmerIds}
                onUnblock={(farmerId) =>
                  vendorUnblockFarmer(vendorScopeId(user) as string, farmerId).then(() => void refreshData())
                }
              />
            )}
          </>
        )}

        {user.role === 'admin' && (
          <>
            {activeTab === 'dashboard' && (
              <AdminDashboard
                farmers={data.farmers}
                vendors={data.vendors}
                loans={data.loans}
                products={data.products}
                groups={data.groups}
                onRefresh={refreshData}
              />
            )}
            {activeTab === 'farmers' && (
              <AdminFarmersView
                farmers={data.farmers}
                loans={data.loans}
                onStatus={(id, s) => updateFarmerStatus(id, s).then(() => void refreshData())}
              />
            )}
            {activeTab === 'vendors' && (
              <AdminVendorsView
                vendors={data.vendors}
                loans={data.loans}
                products={data.products}
                onApprove={(id) => approveVendor(id).then(() => void refreshData())}
                onReject={(id) => rejectVendor(id).then(() => void refreshData())}
                onBlock={(id) => rejectVendor(id).then(() => void refreshData())}
                onRemove={(id) => deleteVendor(id).then(() => void refreshData())}
              />
            )}
            {activeTab === 'loans' && (
              <AdminLoansView
                farmers={data.farmers}
                vendors={data.vendors}
                loans={data.loans}
                groups={data.groups}
                onApprove={(id) => approveLoan(id).then(() => void refreshData())}
                onDisburse={(id) =>
                  disburseLoan(id)
                    .then(() => void refreshData())
                    .catch((e) =>
                      alert(e instanceof Error ? e.message : 'Disburse failed — check M-Pesa B2C .env'),
                    )
                }
                onReject={(id) => rejectLoan(id).then(() => void refreshData())}
              />
            )}
            {activeTab === 'groups' && (
              <AdminGroupsView
                groups={data.groups}
                farmers={data.farmers}
                loans={data.loans}
              />
            )}
            {activeTab === 'reports' && (
              <AdminReportsView
                farmers={data.farmers}
                vendors={data.vendors}
                loans={data.loans}
                products={data.products}
              />
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <LoanRequestModal 
        isOpen={isLoanModalOpen} 
        onClose={() => {
          setIsLoanModalOpen(false);
          setLoanRequestError(null);
        }}
        error={loanRequestError}
        inputProductsOnly={user.role === 'farmer'}
        vendors={data.vendors
          .filter((v: Vendor) => v.status === 'active')
          .filter((v: Vendor) => !data.blockedVendorIds.includes(v.id))}
        products={data.products}
        onSubmit={async (vId: string, pId: string, amt: number) => {
          const res = await requestLoan(user.id, vId, pId, amt);
          if (res.success) {
            setLoanRequestError(null);
            setSubmissionNotice(res.message ?? 'Loan request submitted.');
            setIsLoanModalOpen(false);
            void refreshData();
          } else {
            setLoanRequestError(res.message ?? 'Could not submit request.');
          }
        }}
      />

      <FarmerRepaymentModal
        loan={repayModalLoan}
        isOpen={!!repayModalLoan}
        onClose={() => setRepayModalLoan(null)}
        onPaid={async (channel, amount) => {
          if (!repayModalLoan) return;
          const r = await repayLoan(repayModalLoan.id, channel, amount);
          if (r.success) {
            const m = r.mpesa;
            const lines = [
              r.message ?? 'Paid.',
              m?.stkInitiated && m?.checkoutRequestId
                ? `STK accepted — CheckoutRequestID: ${m.checkoutRequestId}`
                : null,
              m?.customerMessage ? `Safaricom: ${m.customerMessage}` : null,
              m?.displayHint ?? null,
              `Ref: ${m?.reference ?? '—'}${m?.simulated ? ' (demo STK fallback)' : ''}`,
            ].filter(Boolean) as string[];
            setSubmissionNotice(lines.join('\n'));
            setRepayModalLoan(null);
            void refreshData();
          } else {
            alert(r.message ?? 'Repayment failed');
          }
        }}
      />

      <ProductModal 
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        initialData={editingProduct}
        onSubmit={(formData: any) => {
          if (editingProduct) {
            updateProduct(editingProduct.id, formData).then(() => {
              setIsProductModalOpen(false);
              void refreshData();
            });
          } else {
            addProduct({ ...formData, vendorId: vendorScopeId(user) as string }).then(() => {
              setIsProductModalOpen(false);
              void refreshData();
            });
          }
        }}
      />
    </div>
  );
}
