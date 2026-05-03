import axiosInstance from '../utils/axiosConfig';

const BASE = '/notifications';

const notificationService = {
  getNotifications: async (limit = 20) => {
    const res = await axiosInstance.get(`${BASE}`, { params: { limit } });
    return res.data?.data || { items: [], unread: 0 };
  },

  getUnreadCount: async () => {
    const res = await axiosInstance.get(`${BASE}/unread-count`);
    return Number(res.data?.data?.unread || 0);
  },

  markAsRead: async (id) => {
    const res = await axiosInstance.patch(`${BASE}/${id}/read`);
    return res.data?.data || null;
  },

  markAllAsRead: async () => {
    const res = await axiosInstance.post(`${BASE}/mark-all-read`);
    return res.data?.data || { unread: 0 };
  },

  createSelfTestNotification: async (payload = {}) => {
    const res = await axiosInstance.post(`${BASE}/self-test`, payload);
    return res.data?.data || null;
  },
};

export default notificationService;
