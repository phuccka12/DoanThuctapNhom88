import React, { useEffect, useMemo, useState } from 'react';
import { FiBell, FiSend, FiUsers, FiUser, FiRefreshCw, FiClock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import adminService from '../../services/adminService';

const TYPE_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'reward', label: 'Reward' },
  { value: 'plan', label: 'Plan' },
  { value: 'reminder', label: 'Reminder' },
];

const TARGET_OPTIONS = [
  { value: 'single', label: '1 người dùng' },
  { value: 'role', label: 'Theo role' },
  { value: 'all', label: 'Toàn bộ user active' },
];

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  const isSuccess = type === 'success';
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border text-sm font-semibold shadow-xl flex items-center gap-2 ${
      isSuccess ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-300' : 'bg-red-950/95 border-red-500/40 text-red-300'
    }`}>
      {isSuccess ? <FiCheckCircle size={16} /> : <FiAlertCircle size={16} />}
      <span>{message}</span>
    </div>
  );
}

export default function AdminNotifications() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [stats, setStats] = useState({ all: 0, byRole: { standard: 0, vip: 0, admin: 0 } });
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState({ message: '', type: 'success' });

  const [form, setForm] = useState({
    targetType: 'single',
    userId: '',
    role: 'standard',
    type: 'system',
    title: '',
    message: '',
    link: '/dashboard',
  });

  const estimatedRecipients = useMemo(() => {
    if (form.targetType === 'single') return form.userId?.trim() ? 1 : 0;
    if (form.targetType === 'role') return Number(stats?.byRole?.[form.role] || 0);
    return Number(stats?.all || 0);
  }, [form.targetType, form.userId, form.role, stats]);

  const loadInitial = async () => {
    try {
      setLoading(true);
      const [statsRes, historyRes] = await Promise.all([
        adminService.getNotificationRecipientStats(),
        adminService.getNotificationHistory(20),
      ]);
      setStats(statsRes?.data?.data || { all: 0, byRole: { standard: 0, vip: 0, admin: 0 } });
      setHistory(historyRes?.data?.data?.items || []);
    } catch (err) {
      console.error('Load admin notifications data failed:', err);
      setToast({ message: err?.response?.data?.message || 'Không tải được dữ liệu thông báo', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  const refreshHistory = async () => {
    try {
      setRefreshingHistory(true);
      const historyRes = await adminService.getNotificationHistory(20);
      setHistory(historyRes?.data?.data?.items || []);
    } catch (err) {
      console.error('Refresh history failed:', err);
    } finally {
      setRefreshingHistory(false);
    }
  };

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSend = async () => {
    if (!form.title.trim()) {
      setToast({ message: 'Vui lòng nhập tiêu đề thông báo', type: 'error' });
      return;
    }
    if (form.targetType === 'single' && !form.userId.trim()) {
      setToast({ message: 'Vui lòng nhập userId khi gửi cho 1 người dùng', type: 'error' });
      return;
    }

    try {
      setSending(true);
      const payload = {
        targetType: form.targetType,
        userId: form.targetType === 'single' ? form.userId.trim() : undefined,
        role: form.targetType === 'role' ? form.role : undefined,
        type: form.type,
        title: form.title.trim(),
        message: form.message.trim(),
        link: form.link.trim(),
      };

      const res = await adminService.sendAdminNotification(payload);
      const insertedCount = res?.data?.data?.insertedCount || 0;
      setToast({ message: `Đã gửi ${insertedCount} thông báo thành công`, type: 'success' });

      setForm((prev) => ({ ...prev, title: '', message: '' }));
      await Promise.all([loadInitial(), refreshHistory()]);
    } catch (err) {
      console.error('Send notification failed:', err);
      setToast({ message: err?.response?.data?.message || 'Gửi thông báo thất bại', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '-';
    return dt.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-purple-500/25 bg-purple-500/10 p-4">
          <p className="text-xs text-purple-300 font-bold uppercase tracking-wider">Active Users</p>
          <p className="text-2xl font-black text-white mt-1">{stats.all || 0}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
          <p className="text-xs text-emerald-300 font-bold uppercase tracking-wider">Standard</p>
          <p className="text-2xl font-black text-white mt-1">{stats.byRole?.standard || 0}</p>
        </div>
        <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/10 p-4">
          <p className="text-xs text-yellow-300 font-bold uppercase tracking-wider">VIP</p>
          <p className="text-2xl font-black text-white mt-1">{stats.byRole?.vip || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl border border-gray-700/60 bg-gray-900/60 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FiBell className="text-purple-400" />
            <h2 className="text-lg font-bold text-white">Gửi thông báo mới</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 font-semibold">Đối tượng gửi</label>
              <select
                className="w-full mt-1 px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white"
                value={form.targetType}
                onChange={(e) => updateForm('targetType', e.target.value)}
              >
                {TARGET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 font-semibold">Loại thông báo</label>
              <select
                className="w-full mt-1 px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white"
                value={form.type}
                onChange={(e) => updateForm('type', e.target.value)}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {form.targetType === 'single' && (
            <div>
              <label className="text-xs text-gray-400 font-semibold">User ID người nhận</label>
              <input
                className="w-full mt-1 px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white"
                placeholder="Ví dụ: 67ab..."
                value={form.userId}
                onChange={(e) => updateForm('userId', e.target.value)}
              />
            </div>
          )}

          {form.targetType === 'role' && (
            <div>
              <label className="text-xs text-gray-400 font-semibold">Role nhận thông báo</label>
              <select
                className="w-full mt-1 px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white"
                value={form.role}
                onChange={(e) => updateForm('role', e.target.value)}
              >
                <option value="standard">standard</option>
                <option value="vip">vip</option>
                <option value="admin">admin</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-400 font-semibold">Tiêu đề</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white"
              maxLength={120}
              placeholder="Ví dụ: Hệ thống cập nhật mới"
              value={form.title}
              onChange={(e) => updateForm('title', e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 font-semibold">Nội dung</label>
            <textarea
              className="w-full mt-1 px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white resize-y"
              rows={4}
              maxLength={500}
              placeholder="Nhập nội dung thông báo..."
              value={form.message}
              onChange={(e) => updateForm('message', e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 font-semibold">Link chuyển hướng (optional)</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white"
              maxLength={200}
              placeholder="/dashboard"
              value={form.link}
              onChange={(e) => updateForm('link', e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
            <div className="text-sm text-indigo-200 flex items-center gap-2">
              <FiUsers />
              Ước tính người nhận: <span className="font-black text-white">{estimatedRecipients}</span>
            </div>
            <button
              onClick={handleSend}
              disabled={sending || loading || estimatedRecipients <= 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? <FiRefreshCw className="animate-spin" /> : <FiSend />}
              Gửi thông báo
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-700/60 bg-gray-900/60 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><FiClock /> Lịch sử gửi gần đây</h3>
            <button
              onClick={refreshHistory}
              className="text-xs text-purple-300 hover:text-purple-200 inline-flex items-center gap-1"
            >
              <FiRefreshCw className={refreshingHistory ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>

          <div className="space-y-2 max-h-140 overflow-y-auto pr-1">
            {loading ? (
              <p className="text-sm text-gray-400">Đang tải dữ liệu...</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-400">Chưa có lịch sử gửi thông báo.</p>
            ) : (
              history.map((item) => {
                const receiver = item.userId;
                return (
                  <div key={item._id} className="rounded-xl border border-gray-700/60 bg-gray-950/60 p-3">
                    <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{item.message || '(không có nội dung)'}</p>
                    <div className="mt-2 text-[11px] text-gray-500 space-y-1">
                      <p className="flex items-center gap-1"><FiUser size={11} /> {receiver?.user_name || receiver?.email || 'Unknown user'} ({receiver?.role || '-'})</p>
                      <p>{formatDateTime(item.created_at || item.createdAt)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
