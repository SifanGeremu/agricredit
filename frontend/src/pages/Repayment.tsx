/**
 * Farmer-only: M-Pesa STK repayment form (triggers POST /mpesa/repay).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Leaf, Loader2, Smartphone, CreditCard } from 'lucide-react';
import { getLoans, repayLoan } from '../services/mockApi';
import type { Loan } from '../types';

export default function Repayment() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loanId, setLoanId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getLoans();
      setAllLoans(list);
      const repayable = list.filter((l) => {
        const st = String(l.status).toLowerCase();
        if (st !== 'delivered') return false;
        const bal = Number(l.remainingBalance ?? l.amount);
        return Number.isFinite(bal) && bal >= 1;
      });
      setLoans(repayable);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const raw = localStorage.getItem('agri_user');
    if (!raw) {
      navigate('/login');
      return;
    }
    const u = JSON.parse(raw);
    if (u.role !== 'farmer') {
      navigate('/dashboard');
      return;
    }
    setUser(u);
    void load();
  }, [navigate]);

  const selected = useMemo(
    () => loans.find((l) => l.id === loanId),
    [loans, loanId]
  );
  const maxOwed = selected
    ? (() => {
        const n = Number(selected.remainingBalance ?? selected.amount);
        return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
      })()
    : 0;

  useEffect(() => {
    if (!selected) return;
    const n = Number(selected.remainingBalance ?? selected.amount);
    const bal = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    setAmount(bal > 0 ? bal : 0);
  }, [selected?.id, selected?.remainingBalance, selected?.amount]);

  useEffect(() => {
    if (loans.length && !loanId) {
      setLoanId(loans[0].id);
    }
  }, [loans, loanId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanId || amount <= 0) return;
    setSubmitting(true);
    setResult(null);
    const r = await repayLoan(loanId, 'M-Pesa', amount);
    setSubmitting(false);
    if (r.success) {
      const m = r.mpesa;
      const ref = m?.reference ?? '—';
      const sim =
        m?.simulated === true
          ? ' (demo fallback — STK not confirmed by Safaricom)'
          : '';
      const lines = [
        r.message ?? 'M-Pesa request sent.',
        m?.stkInitiated && m?.checkoutRequestId
          ? `STK accepted — CheckoutRequestID: ${m.checkoutRequestId}`
          : null,
        m?.customerMessage ? `Safaricom: ${m.customerMessage}` : null,
        m?.displayHint ?? null,
        `Reference: ${ref}${sim}`,
      ].filter(Boolean) as string[];
      setResult({
        ok: true,
        text: lines.join('\n'),
      });
      await load();
    } else {
      setResult({ ok: false, text: r.message ?? 'Payment failed' });
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-emerald-50/30">
      <header className="border-b border-emerald-100 bg-white/80 backdrop-blur">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-emerald-700 font-bold hover:text-emerald-900"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
            <Leaf className="w-5 h-5 text-emerald-600" /> Repay
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-black text-emerald-950 mb-1">M-Pesa STK repayment</h1>
        <p className="text-emerald-800/70 text-sm mb-6">
          Submit to trigger <strong>STK Push</strong> (Safaricom). Amount is sent to your backend; configure{' '}
          <code className="text-xs bg-emerald-100 px-1 rounded">MPESA_*</code> in <code className="text-xs bg-emerald-100 px-1 rounded">backend/.env</code>.
        </p>

        {result && (
          <div
            className={`mb-6 p-4 rounded-2xl text-sm font-medium whitespace-pre-line ${
              result.ok
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-100'
            }`}
          >
            {result.text}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
          </div>
        ) : loans.length === 0 ? (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-emerald-100 p-8 text-left text-emerald-800/80 text-sm">
              <CreditCard className="w-10 h-10 mb-3 text-emerald-400" />
              <p className="font-bold text-emerald-950 mb-2">Repayment unlocks after delivery</p>
              <p className="mb-4">
                M-Pesa repay only shows for loans in <strong>Delivered</strong> status with a balance. Flow:{' '}
                <strong>Admin approve</strong> → <strong>Disburse</strong> (Loans table) → vendor{' '}
                <strong>Confirm delivery</strong> → then return here.
              </p>
              {allLoans.length > 0 ? (
                <ul className="space-y-2 border-t border-emerald-100 pt-4">
                  {allLoans.map((l) => (
                    <li
                      key={l.id}
                      className="flex justify-between gap-2 text-emerald-900 font-medium"
                    >
                      <span>{l.productName}</span>
                      <span className="text-xs uppercase tracking-wide text-emerald-600">{l.status}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-emerald-700/70 italic">No loans on this account.</p>
              )}
            </div>
          </div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={onSubmit}
            className="bg-white rounded-3xl border border-emerald-100 p-6 shadow-sm space-y-5"
          >
            <div>
              <label className="block text-sm font-bold text-emerald-900 mb-2">Loan</label>
              <select
                value={loanId}
                onChange={(e) => setLoanId(e.target.value)}
                className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 font-medium text-emerald-950"
              >
                {loans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.productName} — balance ₦{(l.remainingBalance ?? l.amount).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-emerald-900 mb-2">Amount (₦)</label>
              <input
                type="number"
                min={1}
                max={maxOwed}
                step={1}
                required
                value={Number.isFinite(amount) ? amount : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') {
                    setAmount(0);
                    return;
                  }
                  const n = Number(v);
                  if (Number.isFinite(n)) setAmount(Math.floor(n));
                }}
                className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 font-bold text-emerald-950"
              />
              <p className="text-xs text-emerald-800/50 mt-1">
                Max: ₦{maxOwed.toLocaleString()} (remaining balance)
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50/80 border border-emerald-100 px-4 py-3 text-sm text-emerald-900">
              <span className="font-bold">Account phone:</span> {user.phone}
              <br />
              <span className="text-emerald-800/70">
                STK uses <code className="text-xs">MPESA_STK_MSISDN</code> when set.
              </span>
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                maxOwed < 1 ||
                !Number.isFinite(amount) ||
                amount < 1 ||
                amount > maxOwed
              }
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-200"
            >
              {submitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Smartphone className="w-6 h-6" />
              )}
              {submitting ? 'Contacting M-Pesa…' : 'Pay with M-Pesa (STK)'}
            </button>
          </motion.form>
        )}
      </main>
    </div>
  );
}
