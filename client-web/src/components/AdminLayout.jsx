import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiMenu, FiX, FiLogOut, FiHome, FiBook, FiHeadphones, FiEdit3, FiUsers, FiBookOpen, FiFileText, FiDollarSign, FiSettings, FiVolume2, FiHeart, FiShoppingBag, FiSliders, FiShield, FiBell } from 'react-icons/fi';
import { GiDragonSpiral } from 'react-icons/gi';
import { FaBookOpen } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

// 1️⃣ DI CHUYỂN MENU RA NGOÀI COMPONENT ĐỂ TRÁNH RENDER LẠI VÀ LỖI CACHE
const menuItems = [
  { icon: FiHome,       label: 'Panel',              path: '/admin' },
  { icon: FiUsers,      label: 'User',               path: '/admin/users' },
  { divider: true, label: 'NỘI DUNG' },
  { icon: FiBook,       label: 'Topic',              path: '/admin/topics' },
  { icon: FiBookOpen,   label: 'Vocabulary',         path: '/admin/vocabulary' },
  { icon: FiFileText,   label: 'Reading Passages',   path: '/admin/reading-passages' },
  { icon: FiEdit3,      label: 'Writing Scenarios',  path: '/admin/writing-scenarios' },
  { icon: FiHeadphones, label: 'Speaking Questions', path: '/admin/speaking-questions' },
  { icon: FiVolume2,    label: 'Listening',          path: '/admin/listening' },
  { icon: FiFileText,   label: 'Ngữ pháp',           path: '/admin/grammar' },
  { divider: true, label: 'MINI-GAME' },
  { icon: FaBookOpen,   label: 'Câu chuyện RPG',     path: '/admin/stories' },
  { divider: true, label: 'GAMIFICATION' },
  { icon: FiHeart,        label: 'Gamification',       path: '/admin/gamification' },
  { icon: FiShoppingBag,  label: 'Cửa hàng Vật phẩm', path: '/admin/shop' },
  { icon: FiSliders,      label: 'Cân bằng Game',      path: '/admin/economy' },
  { icon: GiDragonSpiral, label: 'Pet Pokédex',        path: '/admin/pokedex' },
  { icon: FiShield,       label: 'Anti-Cheat',         path: '/admin/anti-cheat' },
  { divider: true, label: 'HỆ THỐNG' },
  { icon: FiDollarSign, label: 'Gói cước',  path: '/admin/billing' },
  { icon: FiBell,       label: 'Thông báo', path: '/admin/notifications' },
  { icon: FiSettings,   label: 'Cài đặt',   path: '/admin/system-config' },
];

function AdminLayout({ children }) {
  const [sidebarOpen, setShowSidebar] = useState(true);
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-900 border-r border-purple-500/20 transition-all duration-300 flex flex-col shadow-2xl overflow-hidden`}>

        {/* Logo - Sửa bg-linear thành bg-gradient */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-purple-500/20 bg-gradient-to-r from-purple-600/10 to-blue-600/10 shrink-0">
          {sidebarOpen && (
            <span className="font-bold text-xl bg-gradient-to-r from-purple-400 via-pink-400 to-blue-500 bg-clip-text text-transparent">
              HIDAY ENGLISH
            </span>
          )}
          <button
            onClick={() => setShowSidebar(!sidebarOpen)}
            className="p-2 rounded-xl hover:bg-purple-500/20 transition-all text-purple-400 hover:text-purple-300"
          >
            {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        </div>

        {/* Nav Menu */}
        <nav className="flex-1 min-h-0 px-2 py-3 space-y-0.5 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.4) transparent' }}>
          {menuItems.map((item, idx) => {
            if (item.divider) {
              return sidebarOpen ? (
                <div key={`div-${idx}`} className="pt-3 pb-1 px-3">
                  <p className="text-[10px] font-bold tracking-widest text-gray-600 uppercase">{item.label}</p>
                </div>
              ) : (
                <div key={`div-${idx}`} className="my-2 mx-2 border-t border-gray-800" />
              );
            }
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={!sidebarOpen ? item.label : ''}
                className={`w-full group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={18} className={`shrink-0 ${active ? 'text-white' : 'text-purple-400 group-hover:text-purple-300'}`} />
                {sidebarOpen && (
                  <span className={`text-sm font-semibold truncate ${active ? 'text-white' : ''}`}>
                    {item.label}
                  </span>
                )}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-purple-400 to-blue-500 rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-3 border-t border-purple-500/20 shrink-0">
          {sidebarOpen ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-purple-600/10 border border-purple-500/20">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-white text-sm shrink-0">
                  {user?.user_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user?.user_name || 'Admin'}</p>
                  <p className="text-xs text-purple-300 truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all border border-red-500/20"
              >
                <FiLogOut size={16} />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex justify-center p-2 text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all"
              title="Đăng xuất"
            >
              <FiLogOut size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-gray-900/80 backdrop-blur-xl border-b border-purple-500/20 flex items-center justify-between px-8 shadow-lg shrink-0">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {menuItems.find(item => !item.divider && item.path === location.pathname)?.label || 'Quản trị viên'}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Chào mừng trở lại, {user?.user_name || 'Admin'}
            </p>
          </div>
          <div className="px-4 py-2 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-xl border border-purple-500/30">
            <p className="text-xs text-purple-300 font-medium">Vai trò</p>
            <p className="text-sm font-bold text-white">{user?.role?.toUpperCase() || 'ADMIN'}</p>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-gray-950 p-8">
          <div className="max-w-screen-2xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;