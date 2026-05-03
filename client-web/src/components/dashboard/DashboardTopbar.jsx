import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaBell } from "react-icons/fa";
import { HiOutlineSearch } from "react-icons/hi";
import axiosInstance from "../../utils/axiosConfig";
import { useNavigate } from 'react-router-dom';
import ThemeToggle from "../ThemeToggle";
import { cn } from "../../utils/dashboardTheme";
import notificationService from "../../services/notificationService";

export default function DashboardTopbar({ user, theme: t }) {
  const navigate = useNavigate();
  const bellRef = useRef(null);
  const [openNotif, setOpenNotif] = useState(false);
  const [loadingNotif, setLoadingNotif] = useState(false);
  const [notifItems, setNotifItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  const handleRetakeWithBonus = async () => {
    try {
      await axiosInstance.post('/placement/start-bonus');
    } catch (_) {}
    navigate('/placement-test');
  };

  const notifLabel = useMemo(() => {
    if (unread <= 0) return null;
    return unread > 99 ? '99+' : String(unread);
  }, [unread]);

  const loadNotifications = async () => {
    try {
      setLoadingNotif(true);
      const data = await notificationService.getNotifications(12);
      setNotifItems(Array.isArray(data.items) ? data.items : []);
      setUnread(Number(data.unread || 0));
    } catch (err) {
      console.error('Load notifications failed:', err);
    } finally {
      setLoadingNotif(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const count = await notificationService.getUnreadCount();
        if (mounted) setUnread(count);
      } catch (_) {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!bellRef.current) return;
      if (!bellRef.current.contains(event.target)) {
        setOpenNotif(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenNotifications = async () => {
    const next = !openNotif;
    setOpenNotif(next);
    if (next) {
      await loadNotifications();
    }
  };

  const handleMarkOneRead = async (item) => {
    if (!item || !item._id) return;
    try {
      const data = await notificationService.markAsRead(item._id);
      setUnread(Number(data?.unread ?? unread));
      setNotifItems((prev) => prev.map((n) =>
        n._id === item._id ? { ...n, isRead: true, readAt: n.readAt || new Date().toISOString() } : n
      ));
      if (item.link) navigate(item.link);
    } catch (err) {
      console.error('Mark notification read failed:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setUnread(0);
      setNotifItems((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt || new Date().toISOString() })));
    } catch (err) {
      console.error('Mark all notifications read failed:', err);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  };

  const getSenderMeta = (item) => {
    const role = String(item?.senderRole || item?.meta?.senderRole || 'system').toLowerCase();
    const name = item?.senderName || item?.meta?.senderName || (role === 'admin' ? 'Admin' : 'Hệ thống');

    if (role === 'admin') {
      return {
        name,
        roleLabel: 'Quản trị viên',
        roleClass: 'bg-violet-100 text-violet-700 border-violet-200',
      };
    }

    return {
      name,
      roleLabel: 'Hệ thống',
      roleClass: 'bg-slate-100 text-slate-600 border-slate-200',
    };
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        {/* Greeting */}
        <div>
          <p className={cn("text-xs font-medium", t.sub)}>{greeting} 👋</p>
          <h1 className={cn("text-xl font-bold mt-0.5", t.text)}>{user.name}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="hidden md:flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 text-slate-400 text-sm w-52 cursor-pointer hover:bg-slate-200 transition-colors">
            <HiOutlineSearch className="text-base shrink-0" />
            <span className="text-slate-400 text-sm">Tìm kiếm...</span>
          </div>

          {/* Upgrade Premium Button */}
          <button
            onClick={() => navigate("/pricing")}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-[#6C5CE7] to-[#a78bfa] text-white text-[11px] font-black uppercase tracking-widest shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5 active:scale-95 transition-all"
          >
            Nâng cấp <span className="text-sm">✨</span>
          </button>
          <button
            onClick={() => navigate("/pricing")}
            className="flex sm:hidden w-9 h-9 items-center justify-center rounded-xl bg-linear-to-r from-[#6C5CE7] to-[#a78bfa] text-white shadow-lg active:scale-95 transition-all"
          >
            ✨
          </button>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Bell */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={handleOpenNotifications}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors relative",
              )}
              aria-label="Mở thông báo"
            >
              <FaBell className="text-base" />
              {notifLabel ? (
                <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-[#6C5CE7] text-white text-[10px] leading-4.5 text-center font-bold">
                  {notifLabel}
                </span>
              ) : null}
            </button>

            {openNotif && (
              <div className="absolute right-0 mt-2 w-[320px] max-w-[90vw] rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-800">Thông báo</p>
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                    disabled={!notifItems.length || unread <= 0}
                  >
                    Đọc tất cả
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {loadingNotif ? (
                    <p className="px-4 py-6 text-sm text-slate-500">Đang tải thông báo...</p>
                  ) : notifItems.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-500">Bạn chưa có thông báo nào.</p>
                  ) : (
                    notifItems.map((item) => {
                      const sender = getSenderMeta(item);
                      return (
                        <button
                          key={item._id}
                          onClick={() => handleMarkOneRead(item)}
                          className={cn(
                            "w-full text-left px-4 py-3 border-b last:border-b-0 border-slate-100 hover:bg-slate-50 transition-colors",
                            !item.isRead ? "bg-indigo-50/50" : "bg-white"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {!item.isRead ? <span className="mt-1.5 w-2 h-2 rounded-full bg-indigo-500 shrink-0" /> : <span className="mt-1.5 w-2 h-2" />}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{item.title || 'Thông báo'}</p>
                              {item.message ? <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{item.message}</p> : null}

                              <div className="mt-1.5 flex items-center gap-2 min-w-0">
                                <p className="text-[11px] text-indigo-700 font-semibold truncate">Người gửi: {sender.name}</p>
                                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md border font-semibold shrink-0', sender.roleClass)}>
                                  {sender.roleLabel}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-400 mt-1">{formatTime(item.created_at || item.createdAt)}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Avatar */}
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 rounded-full bg-linear-to-br from-[#6C5CE7] to-[#a78bfa] text-white flex items-center justify-center font-bold text-sm shadow-sm">
              {user.initials}
            </div>
            <span className={cn("hidden sm:block text-sm font-semibold", t.text)}>{user.name}</span>
          </button>
        </div>
      </div>

      {/* Subtle coin retake nudge */}
      <button
        onClick={handleRetakeWithBonus}
        title="Làm bài kiểm tra trình độ để nhận 200 Coins"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border border-yellow-200 bg-[#FFFBEB] text-yellow-700 text-xs font-semibold hover:bg-yellow-100 hover:shadow-xl transition-all duration-200 group"
      >
        <span className="text-base animate-bounce group-hover:animate-none">🪙</span>
        Kiểm tra lại trình độ
        <span className="bg-yellow-400 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">+200</span>
      </button>
    </>
  );
}
