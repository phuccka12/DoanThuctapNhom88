import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaArrowRight, FaGoogle, FaExclamationCircle } from 'react-icons/fa';
import LoadingCat from '../components/shared/LoadingCat';

export default function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'account_exists') {
      setError('Email này đã được đăng ký. Vui lòng đăng nhập.');
    } else if (errorParam === 'server_error') {
      setError('Đã có lỗi xảy ra. Vui lòng thử lại.');
    }
  }, [searchParams]);

  const handleGoogleRegister = () => {
    window.location.href = 'http://localhost:3001/api/auth/google/register';
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.firstName.trim().length < 2) {
      return setError('Vui lòng nhập họ tên thật của bạn (tối thiểu 2 ký tự)');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return setError('Định dạng email không hợp lệ (ví dụ: name@example.com)');
    }

    if (formData.password !== formData.confirmPassword) {
      return setError('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
    }
    if (formData.password.length < 6) {
      return setError('Mật khẩu phải có ít nhất 6 ký tự để bảo vệ tài khoản của bạn');
    }

    setLoading(true);
    try {
      const fullName = `${formData.firstName} ${formData.lastName}`.trim() || formData.firstName;
      await register(fullName, formData.email, formData.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1117] relative flex items-center justify-center p-4 overflow-hidden font-sans">
      {/* Subtle Background Blobs - Not too "AI" */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] animate-float" />
      <div className="absolute bottom-[-5%] left-[-5%] w-[35%] h-[35%] bg-indigo-600/10 rounded-full blur-[100px] animate-float" style={{ animationDelay: '-5s' }} />
      <div className="absolute top-[20%] left-[10%] w-[20%] h-[20%] bg-sky-500/5 rounded-full blur-[80px] animate-float" style={{ animationDelay: '-10s' }} />

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[520px] z-10"
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
              className="w-16 h-16 bg-linear-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/20 -rotate-3 group-hover:rotate-0 transition-transform duration-500"
            >
              <FaUser className="text-white text-2xl" />
            </motion.div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">Đăng ký</h2>
            <p className="text-slate-400 text-sm font-medium">Bắt đầu hành trình chinh phục IELTS ngay hôm nay!</p>
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

            {/* Name Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tên</label>
                <div className="relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-purple-500 transition-colors">
                    <FaUser />
                  </div>
                  <input
                    type="text"
                    name="firstName"
                    placeholder="Tên"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-600 outline-none focus:border-purple-500 focus:bg-white/[0.08] transition-all font-medium text-sm"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Họ</label>
                <div className="relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-purple-500 transition-colors">
                    <FaUser />
                  </div>
                  <input
                    type="text"
                    name="lastName"
                    placeholder="Họ (tùy chọn)"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-600 outline-none focus:border-purple-500 focus:bg-white/[0.08] transition-all font-medium text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-purple-500 transition-colors">
                  <FaEnvelope />
                </div>
                <input
                  type="email"
                  name="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-600 outline-none focus:border-purple-500 focus:bg-white/[0.08] transition-all font-medium text-sm"
                  required
                />
              </div>
            </div>

            {/* Password Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mật khẩu</label>
                <div className="relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-purple-500 transition-colors">
                    <FaLock />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full pl-12 pr-10 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-600 outline-none focus:border-purple-500 focus:bg-white/[0.08] transition-all font-medium text-sm"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Xác nhận</label>
                <div className="relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-purple-500 transition-colors">
                    <FaLock />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full pl-12 pr-10 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-600 outline-none focus:border-purple-500 focus:bg-white/[0.08] transition-all font-medium text-sm"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full bg-linear-to-r from-purple-600 to-indigo-600 text-white font-black text-xs py-4 rounded-2xl shadow-xl shadow-purple-600/10 hover:shadow-purple-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4 uppercase tracking-widest"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                   <LoadingCat size={40} text={null} />
                   <span>ĐANG ĐĂNG KÝ...</span>
                </div>
              ) : (
                <>
                  Tạo tài khoản <FaArrowRight className="text-[10px]" />
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

            {/* Social Google */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleGoogleRegister}
              className="w-full flex items-center justify-center gap-3 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-xs font-bold hover:bg-white/10 transition-all shadow-sm"
            >
              <FaGoogle className="text-red-400" />
              Đăng ký với Google
            </motion.button>

            {/* Login Link */}
            <div className="pt-6 text-center text-sm font-medium">
              <span className="text-slate-500">Đã có tài khoản?</span>{' '}
              <Link to="/login" className="text-purple-400 hover:text-purple-300 font-bold ml-1 transition-colors underline-offset-4 hover:underline">
                Đăng nhập
              </Link>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
