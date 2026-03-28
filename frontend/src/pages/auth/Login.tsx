/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Leaf, Phone, Lock, Loader2, ArrowLeft, ShieldCheck, UserCog } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../../services/mockApi';
import { UserRole } from '../../types';

export default function Login() {
  const [role, setRole] = useState<UserRole>('farmer');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await loginUser(phone, role, password);
      if (response.success && response.user) {
        if (response.token) {
          localStorage.setItem('agri_token', response.token);
        }
        localStorage.setItem('agri_user', JSON.stringify(response.user));
        if (response.user.role === 'farmer') {
          navigate('/repayment');
        } else {
          navigate('/dashboard');
        }
      } else {
        setError(response.message || 'Invalid credentials.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6 text-emerald-600 hover:text-emerald-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <div className="flex justify-center">
          <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-200">
            <Leaf className="text-white w-10 h-10" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-emerald-950">
          Login to AgriCredit
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex bg-white p-1 rounded-2xl mb-6 shadow-sm border border-emerald-100">
          {(['farmer', 'vendor', 'admin'] as UserRole[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all capitalize ${
                role === r ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-800/60 hover:text-emerald-900'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white py-8 px-4 shadow-xl shadow-emerald-900/5 sm:rounded-3xl sm:px-10 border border-emerald-100"
        >
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
            
            <div>
              <label className="block text-sm font-semibold text-emerald-900">Phone Number</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-emerald-400" />
                </div>
                <input
                  type="tel" required value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-emerald-100 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder={role === 'admin' ? '0000' : '08012345678'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-emerald-900">Password</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-emerald-400" />
                </div>
                <input
                  type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-emerald-100 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all flex justify-center items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/register" className="text-sm font-medium text-emerald-600 hover:text-emerald-500">
              Don't have an account? Register
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
