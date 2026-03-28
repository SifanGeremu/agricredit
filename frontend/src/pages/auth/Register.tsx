/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Leaf, Phone, Lock, User, Loader2, ArrowLeft, MapPin, Ruler, Sprout, CreditCard, Truck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { registerFarmer, registerVendor } from '../../services/mockApi';
import { UserRole } from '../../types';

export default function Register() {
  const [role, setRole] = useState<UserRole>('farmer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Role, 2: Details, 3: OTP
  const navigate = useNavigate();

  // Form States
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    nationalId: '',
    farmSize: '',
    cropType: '',
    location: '',
    businessName: '',
    ownerName: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let response;
      if (role === 'farmer') {
        response = await registerFarmer(formData);
      } else {
        response = await registerVendor(formData);
      }

      if (response.success) {
        setStep(3); // Go to OTP simulation
      } else {
        setError(response.message || 'Registration failed.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/login');
    }, 1000);
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
          {step === 3 ? 'Verify Identity' : 'Join AgriCredit'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white py-8 px-4 shadow-xl shadow-emerald-900/5 sm:rounded-3xl sm:px-10 border border-emerald-100"
        >
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-emerald-900 text-center">Choose your role</h3>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => { setRole('farmer'); setStep(2); }}
                  className="p-6 border-2 border-emerald-100 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center group"
                >
                  <Sprout className="w-10 h-10 mx-auto mb-3 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <div className="font-bold text-emerald-900">Farmer</div>
                  <div className="text-xs text-emerald-800/60 mt-1">Access loans & inputs</div>
                </button>
                <button 
                  onClick={() => { setRole('vendor'); setStep(2); }}
                  className="p-6 border-2 border-emerald-100 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center group"
                >
                  <Truck className="w-10 h-10 mx-auto mb-3 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <div className="font-bold text-emerald-900">AgroVendor</div>
                  <div className="text-xs text-emerald-800/60 mt-1">Sell seeds & tools</div>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form className="space-y-4" onSubmit={handleRegister}>
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
              {role === 'vendor' && (
                <div className="bg-amber-50 border border-amber-100 text-amber-900 text-sm p-3 rounded-xl">
                  AgroVendor registration requires admin approval before you can log in.
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-full">
                  <label className="block text-sm font-semibold text-emerald-900">
                    {role === 'farmer' ? 'Full Name' : 'Business Name'}
                  </label>
                  <input
                    name={role === 'farmer' ? 'name' : 'businessName'}
                    type="text" required onChange={handleChange}
                    className="mt-1 block w-full px-4 py-3 border border-emerald-100 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-emerald-900">Phone Number</label>
                  <input
                    name="phone" type="tel" required onChange={handleChange}
                    className="mt-1 block w-full px-4 py-3 border border-emerald-100 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-emerald-900">Password</label>
                  <input
                    name="password" type="password" required onChange={handleChange}
                    className="mt-1 block w-full px-4 py-3 border border-emerald-100 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {role === 'farmer' ? (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-emerald-900">National ID</label>
                      <input
                        name="nationalId"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{12}"
                        minLength={12}
                        maxLength={12}
                        title="12 digits (backend requirement)"
                        required
                        onChange={handleChange}
                        className="mt-1 block w-full px-4 py-3 border border-emerald-100 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-emerald-900">Farm Size (Hectares)</label>
                      <input
                        name="farmSize" type="number" required onChange={handleChange}
                        className="mt-1 block w-full px-4 py-3 border border-emerald-100 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-emerald-900">Crop Type</label>
                      <select 
                        name="cropType" required onChange={handleChange}
                        className="mt-1 block w-full px-4 py-3 border border-emerald-100 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="">Select Crop</option>
                        <option value="Maize">Maize</option>
                        <option value="Wheat">Wheat</option>
                        <option value="Coffee">Coffee</option>
                        <option value="Rice">Rice</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-emerald-900">Owner Name</label>
                    <input
                      name="ownerName" type="text" required onChange={handleChange}
                      className="mt-1 block w-full px-4 py-3 border border-emerald-100 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-emerald-900">Location</label>
                  <input
                    name="location" type="text" required onChange={handleChange}
                    className="mt-1 block w-full px-4 py-3 border border-emerald-100 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all flex justify-center items-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Register'}
              </button>
              <button type="button" onClick={() => setStep(1)} className="w-full text-emerald-600 text-sm font-medium">Change Role</button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center space-y-6">
              <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                <p className="text-emerald-900 font-medium mb-4">
                  {role === 'farmer'
                    ? 'Demo: OTP verification is simulated. Enter any digits — your name, ID, farm details, and password are saved for farmer login.'
                    : 'A simulation OTP has been sent to your phone.'}
                </p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4].map(i => (
                    <input key={i} type="text" maxLength={1} className="w-12 h-12 text-center text-xl font-bold border-2 border-emerald-200 rounded-xl focus:border-emerald-500 outline-none" defaultValue={i} />
                  ))}
                </div>
              </div>
              <button
                onClick={verifyOTP} disabled={loading}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg flex justify-center items-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Verify & Complete'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
