import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { FaEnvelope, FaKey, FaArrowLeft, FaExclamationCircle, FaCheckCircle, FaPaperPlane, FaArrowRight } from 'react-icons/fa';
import LoadingCat from '../components/shared/LoadingCat';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Định dạng email không hợp lệ (ví dụ: name@example.com)');
      setLoading(false);
      return;
    }

    try {
      await axios.post('http://localhost:3001/api/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi yêu cầu. Vui lòng kiểm tra kết nối mạng!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1117] relative flex items-center justify-center p-4 overflow-hidden font-sans">
      {/* Subtle Background Blobs – Unique for Forgot Password */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-sky-600/10 rounded-full blur-[120px] animate-float" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[100px] animate-float" style={{ animationDelay: '-7s' }} />
      
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[440px] z-10"
      >
        {/* Glass Card */}
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-[2.5rem] shadow-2xl p-8 md:p-10 relative overflow-hidden group">
          {/* Subtle top light effect */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-linear-to-r from-transparent via-white/20 to-transparent" />
          
          <div className="text-center mb-10">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 bg-linear-to-br from-sky-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-sky-500/20 rotate-6 group-hover:rotate-0 transition-transform duration-500"
            >
              <FaKey className="text-white text-2xl" />
            </motion.div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">Quên mật khẩu</h2>
            <p className="text-slate-400 text-sm font-medium">Đừng lo lắng, chúng tôi sẽ giúp bạn khôi phục quyền truy cập.</p>
          </div>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6"
              >
                <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FaCheckCircle className="text-emerald-500 text-4xl" />
                </div>
                <h3 className="text-xl font-black text-white mb-2">Đã gửi email thành công!</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8 px-4">
                  Một đường dẫn đặt lại mật khẩu đã được gửi đến <span className="text-white font-bold">{email}</span>. Vui lòng kiểm tra hộp thư đến (vào cả mục spam nếu cần).
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-black text-xs uppercase tracking-widest transition-all hover:gap-3"
                >
                  <FaArrowLeft className="text-[10px]" /> Quay lại đăng nhập
                </Link>
              </motion.div>
            ) : (
              <motion.form 
                key="form"
                onSubmit={handleSubmit} 
                className="space-y-6"
              >
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs font-bold flex items-center gap-3"
                  >
                    <FaExclamationCircle className="flex-shrink-0" />
                    {error}
                  </motion.div>
                )}

                {/* Email Input */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Địa chỉ Email</label>
                  <div className="relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-sky-500 transition-colors">
                      <FaEnvelope />
                    </div>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-600 outline-none focus:border-sky-500 focus:bg-white/[0.08] transition-all font-medium text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full bg-linear-to-r from-sky-600 to-indigo-600 text-white font-black text-xs py-3 rounded-2xl shadow-xl shadow-sky-600/10 hover:shadow-sky-600/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-widest"
                >
                  {loading ? (
                     <div className="flex items-center gap-2">
                        <LoadingCat size={40} text={null} />
                        <span>ĐANG GỬI...</span>
                     </div>
                  ) : (
                    <>
                      Gửi link khôi phục <FaPaperPlane className="text-[10px]" />
                    </>
                  )}
                </motion.button>

                {/* Back Link */}
                <div className="pt-6 text-center">
                  <Link to="/login" className="text-slate-500 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 group/back">
                    <FaArrowLeft className="text-[10px] group-hover/back:-translate-x-1 transition-transform" /> 
                    Quay lại đăng nhập
                  </Link>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
