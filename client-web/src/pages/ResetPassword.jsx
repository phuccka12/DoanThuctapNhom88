import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { FaLock, FaEye, FaEyeSlash, FaCheckCircle, FaExclamationCircle, FaArrowRight, FaShieldAlt } from 'react-icons/fa';
import LoadingCat from '../components/shared/LoadingCat';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Token không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại link đặt lại mật khẩu.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
       return setError('Mật khẩu xác nhận không khớp. Vui lòng nhập lại chính xác.');
    }

    if (password.length < 6) {
      return setError('Vì lý do bảo mật, mật khẩu mới phải có ít nhất 6 ký tự.');
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:3001/api/auth/reset-password', {
        token,
        new_password: password,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3500);
    } catch (err) {
      setError(err.response?.data?.message || 'Link đặt lại mật khẩu có vẻ đã hết hạn. Vui lòng yêu cầu link mới.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1117] relative flex items-center justify-center p-4 overflow-hidden font-sans">
      {/* Subtle Background Blobs – Unique for Reset Password */}
      <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] animate-float" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[45%] h-[45%] bg-purple-600/10 rounded-full blur-[100px] animate-float" style={{ animationDelay: '-8s' }} />

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
              className="w-16 h-16 bg-linear-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20 -rotate-3 group-hover:rotate-0 transition-transform duration-500"
            >
              <FaShieldAlt className="text-white text-2xl" />
            </motion.div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">Đặt lại mật khẩu</h2>
            <p className="text-slate-400 text-sm font-medium">Tạo một mật khẩu mới mạnh mẽ để bảo vệ tài khoản của bạn.</p>
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
                <h3 className="text-xl font-black text-white mb-2">Thành công!</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8 px-4">
                  Mật khẩu của bạn đã được thay đổi thành công. Hệ thống sẽ tự động chuyển về trang đăng nhập trong giây lát. 🚀
                </p>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3.5 }}
                    className="h-full bg-emerald-500"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.form 
                key="form"
                onSubmit={handleSubmit} 
                className="space-y-6"
              >
                {!token && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs font-bold flex items-center gap-3 mb-4">
                    <FaExclamationCircle className="flex-shrink-0" />
                    {error}
                  </div>
                )}
                
                {error && token && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs font-bold flex items-center gap-3"
                  >
                    <FaExclamationCircle className="flex-shrink-0" />
                    {error}
                  </motion.div>
                )}

                {/* Password Input */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mật khẩu mới</label>
                  <div className="relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-500 transition-colors">
                      <FaLock />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:bg-white/[0.08] transition-all font-medium text-sm"
                      required
                      disabled={!token}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Input */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Xác nhận mật khẩu</label>
                  <div className="relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-500 transition-colors">
                      <FaLock />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:bg-white/[0.08] transition-all font-medium text-sm"
                      required
                      disabled={!token}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading || !token}
                  className="w-full bg-linear-to-r from-indigo-600 to-purple-600 text-white font-black text-xs py-3 rounded-2xl shadow-xl shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4 uppercase tracking-widest"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                       <LoadingCat size={40} text={null} />
                       <span>ĐANG CẬP NHẬT...</span>
                    </div>
                  ) : (
                    <>
                      Đặt lại mật khẩu <FaArrowRight className="text-[10px]" />
                    </>
                  )}
                </motion.button>

                <div className="pt-6 text-center">
                  <Link to="/login" className="text-slate-500 hover:text-white text-xs font-bold transition-colors underline-offset-4 hover:underline">
                    Hủy và quay lại Đăng nhập
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
