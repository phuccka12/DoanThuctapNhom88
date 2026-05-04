import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaArrowRight, FaGoogle, FaExclamationCircle } from 'react-icons/fa';
import LoadingCat from '../components/shared/LoadingCat';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'account_not_found') {
      setError('Tài khoản chưa được đăng ký. Vui lòng đăng ký trước khi đăng nhập bằng Google.');
    } else if (errorParam === 'server_error') {
      setError('Đã có lỗi xảy ra. Vui lòng thử lại.');
    }
  }, [searchParams]);

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:3001/api/auth/google/login';
  };

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
      const response = await login(email, password);
      const userRole = response?.user?.role;
      if (userRole === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1117] relative flex items-center justify-center p-4 overflow-hidden font-sans">
      {/* Subtle Background Blobs - Not too "AI" */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] animate-float" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[35%] h-[35%] bg-purple-600/10 rounded-full blur-[100px] animate-float" style={{ animationDelay: '-5s' }} />
      <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-sky-500/5 rounded-full blur-[80px] animate-float" style={{ animationDelay: '-10s' }} />

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
              className="w-16 h-16 bg-linear-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20 rotate-3 group-hover:rotate-0 transition-transform duration-500"
            >
              <FaLock className="text-white text-2xl" />
            </motion.div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">Đăng nhập</h2>
            <p className="text-slate-400 text-sm font-medium">Chào mừng trở lại! Hãy tiếp tục hành trình của bạn.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs font-bold flex items-center gap-3"
                >
                  <FaExclamationCircle className="flex-shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email của bạn</label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-500 transition-colors">
                  <FaEnvelope />
                </div>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:bg-white/[0.08] transition-all font-medium text-sm"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mật khẩu</label>
                <Link to="/forgot-password" className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors">QUÊN MẬT KHẨU?</Link>
              </div>
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

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full bg-linear-to-r from-indigo-600 to-purple-600 text-white font-black text-xs py-3 rounded-2xl shadow-xl shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4 uppercase tracking-widest"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                   <LoadingCat size={40} text={null} />
                   <span>ĐANG ĐĂNG NHẬP...</span>
                </div>
              ) : (
                <>
                  Đăng nhập <FaArrowRight className="text-[10px]" />
                </>
              )}
            </motion.button>

            {/* Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
                <span className="px-4 bg-[#0F1117] text-slate-500 rounded-full">Hoặc</span>
              </div>
            </div>

            {/* Social Login */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-xs font-bold hover:bg-white/10 transition-all shadow-sm"
            >
              <FaGoogle className="text-red-400" />
              Tiếp tục với Google
            </motion.button>

            {/* Register Link */}
            <div className="pt-6 text-center text-sm font-medium">
              <span className="text-slate-500">Chưa có tài khoản?</span>{' '}
              <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-bold ml-1 transition-colors underline-offset-4 hover:underline">
                Đăng ký ngay
              </Link>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
