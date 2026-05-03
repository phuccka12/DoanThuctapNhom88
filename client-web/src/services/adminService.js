import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

/**
 * Admin Service - Handle all admin API calls
 * All methods use Bearer token (auto-handled by axiosInstance)
 */

// Create dedicated axios instance for admin (inherits token from storage)
const adminAxios = axios.create({ baseURL: API_BASE });

adminAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============ TOPICS ============
export const getTopics = (params) => adminAxios.get('/admin/topics', { params });
export const getAllTopicsForDropdown = () => adminAxios.get('/admin/topics', { params: { limit: 1000, is_active: true } });
export const getTopicById = (id) => adminAxios.get(`/admin/topics/${id}`);
export const createTopic = (data) => adminAxios.post('/admin/topics', data);
export const updateTopic = (id, data) => adminAxios.put(`/admin/topics/${id}`, data);
export const deleteTopic = (id) => adminAxios.delete(`/admin/topics/${id}`);

// ============ SPEAKING QUESTIONS ============
export const getSpeakingQuestions = () => adminAxios.get('/admin/speaking-questions');
export const getSpeakingQuestionById = (id) => adminAxios.get(`/admin/speaking-questions/${id}`);
export const createSpeakingQuestion = (data) => adminAxios.post('/admin/speaking-questions', data);
export const updateSpeakingQuestion = (id, data) => adminAxios.put(`/admin/speaking-questions/${id}`, data);
export const deleteSpeakingQuestion = (id) => adminAxios.delete(`/admin/speaking-questions/${id}`);

// ============ WRITING PROMPTS ============
export const getWritingPrompts = () => adminAxios.get('/admin/writing-prompts');
export const getWritingPromptById = (id) => adminAxios.get(`/admin/writing-prompts/${id}`);
export const createWritingPrompt = (data) => adminAxios.post('/admin/writing-prompts', data);
export const updateWritingPrompt = (id, data) => adminAxios.put(`/admin/writing-prompts/${id}`, data);
export const deleteWritingPrompt = (id) => adminAxios.delete(`/admin/writing-prompts/${id}`);

// Admin analytics/stats
export const getAdminStats = (year) => adminAxios.get('/admin/stats', { params: { year } });

// ============ USERS MANAGEMENT ============
export const createUser = (data) => adminAxios.post('/admin/users', data);
export const getUsers = (params) => adminAxios.get('/admin/users', { params });
export const getUserById = (id) => adminAxios.get(`/admin/users/${id}`);
export const updateUser = (id, data) => adminAxios.put(`/admin/users/${id}`, data);
export const resetPassword = (id, password) => adminAxios.patch(`/admin/users/${id}/password`, { password });
export const updateUserStatus = (id, status) => adminAxios.patch(`/admin/users/${id}/status`, { status });
export const deleteUser = (id) => adminAxios.delete(`/admin/users/${id}`);
export const getUserStats = () => adminAxios.get('/admin/users/stats');

// ============ ADMIN NOTIFICATIONS ============
export const getNotificationRecipientStats = () => adminAxios.get('/admin/notifications/recipients/stats');
export const getNotificationHistory = (limit = 20) => adminAxios.get('/admin/notifications/history', { params: { limit } });
export const sendAdminNotification = (payload) => adminAxios.post('/admin/notifications/send', payload);

// ============ LESSONS ============
export const getLessonsByTopic = (topicId) => adminAxios.get(`/admin/topics/${topicId}/lessons`);
export const createLesson = (topicId, data) => adminAxios.post(`/admin/topics/${topicId}/lessons`, data);
export const getLessonById = (id) => adminAxios.get(`/admin/lessons/${id}`);
export const updateLesson = (id, data) => adminAxios.put(`/admin/lessons/${id}`, data);
export const deleteLesson = (id) => adminAxios.delete(`/admin/lessons/${id}`);
export const reorderLessons = (topicId, lessonIds) => adminAxios.put(`/admin/topics/${topicId}/lessons/reorder`, { lessonIds });

// ============ VOCABULARY BANK ============
export const getVocabularies = (params) => adminAxios.get('/admin/vocab', { params });
export const getVocabularyById = (id) => adminAxios.get(`/admin/vocab/${id}`);
export const createVocabulary = (data) => adminAxios.post('/admin/vocab', data);
export const updateVocabulary = (id, data) => adminAxios.put(`/admin/vocab/${id}`, data);
export const deleteVocabulary = (id) => adminAxios.delete(`/admin/vocab/${id}`);
export const bulkDeleteVocabulary = (ids) => adminAxios.delete('/admin/vocab/bulk', { data: { ids } });
export const importVocabularyCSV = (csvData) => adminAxios.post('/admin/vocab/import', { csvData });
export const exportVocabularyCSV = () => adminAxios.get('/admin/vocab/export');
export const getVocabularyStats = () => adminAxios.get('/admin/vocab/stats');

// ============ READING PASSAGES BANK ============
export const getReadingPassages = (params) => adminAxios.get('/admin/reading-passages', { params });
export const getReadingPassageById = (id) => adminAxios.get(`/admin/reading-passages/${id}`);
export const createReadingPassage = (data) => adminAxios.post('/admin/reading-passages', data);
export const updateReadingPassage = (id, data) => adminAxios.put(`/admin/reading-passages/${id}`, data);
export const deleteReadingPassage = (id) => adminAxios.delete(`/admin/reading-passages/${id}`);
export const bulkDeleteReadingPassages = (ids) => adminAxios.post('/admin/reading-passages/bulk-delete', { ids });
export const importReadingPassagesCSV = (formData) => adminAxios.post('/admin/reading-passages/import', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const exportReadingPassagesCSV = () => adminAxios.get('/admin/reading-passages/export');
export const getReadingPassageStats = () => adminAxios.get('/admin/reading-passages/stats');
// AI Features
export const generatePassageWithAI = (data) => adminAxios.post('/admin/reading-passages/generate-ai', data);
export const agenticGeneratePassage = (data) => adminAxios.post('/admin/reading-passages/agentic-generate', data);
export const scanAndLinkVocabulary = (id) => adminAxios.post(`/admin/reading-passages/${id}/scan-vocabulary`);
export const trackPassageUsage = (id) => adminAxios.post(`/admin/reading-passages/${id}/track-usage`);
export const getPassagesForLessonBuilder = (params) => adminAxios.get('/admin/reading-passages/for-lesson-builder', { params });

// ============ LISTENING PASSAGES ============
export const getListeningPassages     = (params) => adminAxios.get('/admin/listening',                  { params });
export const getListeningById         = (id)      => adminAxios.get(`/admin/listening/${id}`);
export const getListeningStats        = ()        => adminAxios.get('/admin/listening/stats');
export const createListeningPassage   = (data)    => adminAxios.post('/admin/listening',                data);
export const updateListeningPassage   = (id, data) => adminAxios.put(`/admin/listening/${id}`,          data);
export const toggleListeningActive    = (id)      => adminAxios.patch(`/admin/listening/${id}/toggle`);
export const deleteListeningPassage   = (id)      => adminAxios.delete(`/admin/listening/${id}`);
export const duplicateListeningPassage = (id)     => adminAxios.post(`/admin/listening/${id}/duplicate`);
export const bulkDeleteListening      = (ids)     => adminAxios.post('/admin/listening/bulk-delete',    { ids });
export const bulkToggleListening      = (ids, is_active) => adminAxios.post('/admin/listening/bulk-toggle', { ids, is_active });

// ============ BILLING / REVENUE ============
export const getTransactionStats   = ()               => adminAxios.get('/admin/billing/transactions/stats');
export const getRevenueByMonth     = (months = 12)    => adminAxios.get('/admin/billing/transactions/revenue', { params: { months } });

// ============ SPEAKING STATS ============
export const getSpeakingStats      = ()               => adminAxios.get('/admin/speaking-questions/stats');

// ============ GAMIFICATION / PETS ============
export const getPetStats     = ()              => adminAxios.get('/admin/pets/stats');
export const getAllPets       = (params)        => adminAxios.get('/admin/pets', { params });
export const getPetById      = (id)            => adminAxios.get(`/admin/pets/${id}`);
export const updatePet       = (id, data)      => adminAxios.patch(`/admin/pets/${id}`, data);
export const grantPetCoins   = (id, amount)    => adminAxios.post(`/admin/pets/${id}/grant-coins`, { amount });
export const deletePet       = (id)            => adminAxios.delete(`/admin/pets/${id}`);

// ============ SHOP ITEMS ============
export const getShopItems    = (params)        => adminAxios.get('/admin/shop', { params });
export const getShopItem     = (id)            => adminAxios.get(`/admin/shop/${id}`);
export const createShopItem  = (formData)      => adminAxios.post('/admin/shop', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateShopItem  = (id, formData)  => adminAxios.patch(`/admin/shop/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteShopItem  = (id)            => adminAxios.delete(`/admin/shop/${id}`);
export const hardDeleteShopItem = (id)         => adminAxios.delete(`/admin/shop/${id}/hard`);

// ============ ECONOMY SETTINGS ============
export const getEconomySettings    = ()        => adminAxios.get('/admin/economy');
export const updateEconomySettings = (configs) => adminAxios.post('/admin/economy', { configs });

// ============ PET POKEDEX ============
export const getPokedex      = (params)        => adminAxios.get('/admin/pokedex', { params });
export const getSpecies      = (id)            => adminAxios.get(`/admin/pokedex/${id}`);
export const createSpecies   = (formData)      => adminAxios.post('/admin/pokedex', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateSpecies   = (id, formData)  => adminAxios.patch(`/admin/pokedex/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const addEvolution    = (id, formData)  => adminAxios.post(`/admin/pokedex/${id}/evolution`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteSpecies   = (id)            => adminAxios.delete(`/admin/pokedex/${id}`);

// ============ ANTI-CHEAT / COIN LOGS ============
export const getCoinLogs          = (params)   => adminAxios.get('/admin/anti-cheat/logs', { params });
export const getSuspiciousUsers   = ()         => adminAxios.get('/admin/anti-cheat/suspicious');
export const getAntiCheatUserDetail = (userId) => adminAxios.get(`/admin/anti-cheat/user/${userId}`);
export const adjustCoins          = (userId, amount, reason) => adminAxios.post(`/admin/anti-cheat/user/${userId}/coins`, { amount, reason });
export const resetPetAdmin        = (petId)    => adminAxios.post(`/admin/anti-cheat/pet/${petId}/reset`);

// ============ RPG STORIES ============
export const getStoriesAdmin  = (params)     => adminAxios.get('/admin/stories', { params });
export const getStoryAdmin    = (id)         => adminAxios.get(`/admin/stories/${id}`);
export const createStoryAdmin = (data)       => adminAxios.post('/admin/stories', data);
export const updateStoryAdmin = (id, data)   => adminAxios.put(`/admin/stories/${id}`, data);
export const deleteStoryAdmin = (id)         => adminAxios.delete(`/admin/stories/${id}`);

// ============ GRAMMAR LESSONS ============
export const getGrammarList     = (params)       => adminAxios.get('/admin/grammar', { params });
export const getGrammarById     = (id)           => adminAxios.get(`/admin/grammar/${id}`);
export const createGrammar      = (data)         => adminAxios.post('/admin/grammar', data);
export const updateGrammar      = (id, data)     => adminAxios.put(`/admin/grammar/${id}`, data);
export const deleteGrammar      = (id)           => adminAxios.delete(`/admin/grammar/${id}`);
export const aiGenerateGrammar  = (topic)        => adminAxios.post('/admin/grammar/ai-generate', { topic });

export default {
  // Topics
  getTopics,
  getAllTopicsForDropdown,
  getTopicById,
  createTopic,
  updateTopic,
  deleteTopic,
  // Speaking Questions
  getSpeakingQuestions,
  getSpeakingQuestionById,
  createSpeakingQuestion,
  updateSpeakingQuestion,
  deleteSpeakingQuestion,
  // Writing Prompts
  getWritingPrompts,
  getWritingPromptById,
  createWritingPrompt,
  updateWritingPrompt,
  deleteWritingPrompt,
  getAdminStats,
  // Users
  createUser,
  getUsers,
  getUserById,
  updateUser,
  resetPassword,
  updateUserStatus,
  deleteUser,
  getUserStats,
  // Admin Notifications
  getNotificationRecipientStats,
  getNotificationHistory,
  sendAdminNotification,
  // Lessons
  getLessonsByTopic,
  createLesson,
  getLessonById,
  updateLesson,
  deleteLesson,
  reorderLessons,
  // Vocabulary Bank
  getVocabularies,
  getVocabularyById,
  createVocabulary,
  updateVocabulary,
  deleteVocabulary,
  bulkDeleteVocabulary,
  importVocabularyCSV,
  exportVocabularyCSV,
  getVocabularyStats,
  // Reading Passages Bank
  getReadingPassages,
  getReadingPassageById,
  createReadingPassage,
  updateReadingPassage,
  deleteReadingPassage,
  bulkDeleteReadingPassages,
  importReadingPassagesCSV,
  exportReadingPassagesCSV,
  getReadingPassageStats,
  generatePassageWithAI,
  agenticGeneratePassage,
  scanAndLinkVocabulary,
  trackPassageUsage,
  getPassagesForLessonBuilder,
  // Listening Passages
  getListeningPassages,
  getListeningById,
  getListeningStats,
  createListeningPassage,
  updateListeningPassage,
  toggleListeningActive,
  deleteListeningPassage,
  // Billing / Revenue
  getTransactionStats,
  getRevenueByMonth,
  // Speaking Stats
  getSpeakingStats,
  // Gamification / Pets
  getPetStats,
  getAllPets,
  getPetById,
  updatePet,
  grantPetCoins,
  deletePet,
  // Shop Items
  getShopItems,
  getShopItem,
  createShopItem,
  updateShopItem,
  deleteShopItem,
  hardDeleteShopItem,
  // Economy Settings
  getEconomySettings,
  updateEconomySettings,
  // Pet Pokedex
  getPokedex,
  getSpecies,
  createSpecies,
  updateSpecies,
  addEvolution,
  deleteSpecies,
  // Anti-Cheat
  getCoinLogs,
  getSuspiciousUsers,
  getAntiCheatUserDetail,
  adjustCoins,
  resetPetAdmin,
  // Stories (RPG module)
  getStoriesAdmin,
  getStoryAdmin,
  createStoryAdmin,
  updateStoryAdmin,
  deleteStoryAdmin,
  // Grammar Lessons
  getGrammarList,
  getGrammarById,
  createGrammar,
  updateGrammar,
  deleteGrammar,
  aiGenerateGrammar,
  // Raw axios instance (for custom calls)
  adminAxios,
};
