import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import axiosInstance from './utils/axiosConfig';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import GoogleCallback from './pages/GoogleCallback';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import AIWriting from './pages/AiWriting';
import AISpeaking from './pages/AISpeaking';
import AIConversation from './pages/AIConversation';
import Onboarding from './pages/Onboarding';
import PlacementTest   from './pages/PlacementTest';
import PlacementResult from './pages/PlacementResult';
import NotFound from './pages/NotFound';
import Landingpage from './pages/Landingpage';
import Pricing from './pages/Pricing';
import MySubscription from './pages/MySubscription';
import PaymentResult from './pages/PaymentResult';
import MaintenancePage from './pages/MaintenancePage';
// Learning module
import Learn        from './pages/Learn';
import TopicDetail  from './pages/TopicDetail';
import LessonPlayer from './pages/LessonPlayer';
// RPG Story module
import StoryLobby  from './pages/StoryLobby';
import StoryDetail from './pages/StoryDetail';
import StoryReader from './pages/StoryReader';
// Vocabulary Learning module
import VocabularyHome   from './pages/VocabularyHome';
import VocabularyDetail from './pages/VocabularyDetail';
import VocabularyLearn  from './pages/VocabularyLearn';
// Reading Practice module
import ReadingPractice from './pages/ReadingPractice';
// Speaking Practice module
import SpeakingPractice from './pages/SpeakingPractice';
// Writing Scenario module
import WritingScenarioLobby from './pages/WritingScenarioLobby';
import WritingScenarioPractice from './pages/WritingScenarioPractice';
import LoadingCat from './components/shared/LoadingCat';

// Admin Pages
import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminUsers from './pages/Admin/AdminUsers';
import AdminTopics from './pages/Admin/AdminTopics';
import CourseBuilder from './pages/Admin/CourseBuilder';
import AdminLessons from './pages/Admin/AdminLessons';
import AdminSpeakingQuestions from './pages/Admin/AdminSpeakingQuestions';
import AdminWritingPrompts from './pages/Admin/AdminWritingPrompts';
import AdminVocabulary from './pages/Admin/AdminVocabulary';
import AdminReadingPassages from './pages/Admin/AdminReadingPassages';
import AdminWritingScenarios from './pages/Admin/AdminWritingScenarios';
import AdminBilling from './pages/Admin/AdminBilling';
import AdminSystemConfig from './pages/Admin/AdminSystemConfig';
import AdminListening from './pages/Admin/AdminListening';
import AdminGamification from './pages/Admin/AdminGamification';
import AdminShop from './pages/Admin/AdminShop';
import AdminEconomy from './pages/Admin/AdminEconomy';
import AdminPokedex from './pages/Admin/AdminPokedex';
import AdminAntiCheat from './pages/Admin/AdminAntiCheat';
import AdminStories from './pages/Admin/AdminStories';
import AdminGrammar from './pages/Admin/AdminGrammar';
import AdminNotifications from './pages/Admin/AdminNotifications';
import GrammarLobby from './pages/GrammarLobby';
import GrammarLesson from './pages/GrammarLesson';
import AIListening from './pages/AIListening';

// Protected Route Component with Onboarding check
function ProtectedRoute({ children, allowWithoutOnboarding = false }) {
  const { isAuthenticated, needsOnboarding, loading, user } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1117]">
        <LoadingCat size={250} text="Đang chuẩn bị dữ liệu..." />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // If user needs onboarding and this route doesn't allow bypass, redirect to onboarding
  // UNLESS user is admin (bypass for testing)
  const isAdmin = user?.role === 'admin';
  if (needsOnboarding && !allowWithoutOnboarding && !isAdmin) {
    return <Navigate to="/onboarding" replace />;
  }
  
  return children;
}

// MaintenanceGuard — checks maintenance status BEFORE rendering any protected route
function MaintenanceGuard({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'maintenance'

  // Paths that should never be blocked (public / admin / maintenance page itself)
  const SKIP_PATHS = [
    '/maintenance',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/pricing',
    '/payment/result',
    '/auth/google/callback',
  ];

  const shouldSkip =
    SKIP_PATHS.some(p => location.pathname.startsWith(p)) ||
    location.pathname.startsWith('/admin');

  useEffect(() => {
    // Reset về checking mỗi khi path thay đổi (trừ skip paths)
    if (shouldSkip) {
      setStatus('ok');
      return;
    }

    setStatus('checking');
    let cancelled = false;
    // Dùng /auth/ping — route này công khai, tránh lỗi 401 khi chưa login
    axiosInstance.get('/auth/ping')
      .then(() => { if (!cancelled) setStatus('ok'); })
      .catch(err => {
        if (cancelled) return;
        if (err.response?.status === 503 && err.response?.data?.maintenance) {
          setStatus('maintenance');
        } else {
          // 401, network error, etc — don't block the user
          setStatus('ok');
        }
      });

    return () => { cancelled = true; };
  }, [location.pathname]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1117]">
        <LoadingCat size={250} text="Đang kiểm tra trạng thái máy chủ..." />
      </div>
    );
  }

  if (status === 'maintenance') {
    return <Navigate to="/maintenance" replace />;
  }

  return children;
}

// ─── Heartbeat Manager (Real-time study time tracking) ──────────────────────────
function HeartbeatManager() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    // Send heartbeat every 60 seconds
    const sendHeartbeat = () => {
      axiosInstance.post('/heartbeat').catch(() => { /* ignore */ });
    };

    const interval = setInterval(sendHeartbeat, 60000);
    
    // Initial heartbeat on login/mount
    sendHeartbeat();

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HeartbeatManager />
        <MaintenanceGuard>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landingpage />} />
          <Route path="/landingpage" element={<Landingpage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/google/callback" element={<GoogleCallback />} />
          
          {/* Onboarding Route - Protected but allows access without completed onboarding */}
          <Route path="/onboarding" element={
            <ProtectedRoute allowWithoutOnboarding={true}>
              <Onboarding />
            </ProtectedRoute>
          } />
          
          {/* Public pricing page */}
          <Route path="/pricing" element={<Pricing />} />
          {/* VNPay return page (public — VNPay redirects here) */}
          <Route path="/payment/result" element={<PaymentResult />} />

          {/* Placement Test — protected, accessible even if onboarding just finished */}
          <Route path="/placement-test" element={
            <ProtectedRoute allowWithoutOnboarding={true}>
              <PlacementTest />
            </ProtectedRoute>
          } />
          <Route path="/placement-result" element={
            <ProtectedRoute allowWithoutOnboarding={true}>
              <PlacementResult />
            </ProtectedRoute>
          } />

          {/* Protected Routes - Require onboarding completion */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Profile defaultTab="settings" />
            </ProtectedRoute>
          } />
          <Route path="/ai-writing/:id?" element={
            <ProtectedRoute>
              <AIWriting />
            </ProtectedRoute>
          } />
          <Route path="/ai-speaking/:id?" element={
            <ProtectedRoute>
              <AISpeaking />
            </ProtectedRoute>
          } />
          <Route path="/ai-conversation" element={
            <ProtectedRoute>
              <AIConversation />
            </ProtectedRoute>
          } />
          <Route path="/ai-listening/:id?" element={
            <ProtectedRoute>
              <AIListening />
            </ProtectedRoute>
          } />
          {/* Grammar Journey module */}
          <Route path="/grammar" element={
            <ProtectedRoute>
              <GrammarLobby />
            </ProtectedRoute>
          } />
          <Route path="/grammar/:id" element={
            <ProtectedRoute>
              <GrammarLesson />
            </ProtectedRoute>
          } />
          <Route path="/my-subscription" element={
            <ProtectedRoute>
              <MySubscription />
            </ProtectedRoute>
          } />

          {/* Learning / Practice module */}
          <Route path="/learn" element={
            <ProtectedRoute>
              <Learn />
            </ProtectedRoute>
          } />
          <Route path="/learn/topics/:topicId" element={
            <ProtectedRoute>
              <TopicDetail />
            </ProtectedRoute>
          } />
          <Route path="/learn/lessons/:lessonId" element={
            <ProtectedRoute>
              <LessonPlayer />
            </ProtectedRoute>
          } />

          {/* RPG Story module */}
          <Route path="/stories" element={
            <ProtectedRoute>
              <StoryLobby />
            </ProtectedRoute>
          } />
          <Route path="/stories/:storyId" element={
            <ProtectedRoute>
              <StoryDetail />
            </ProtectedRoute>
          } />
          <Route path="/stories/:storyId/parts/:partNum" element={
            <ProtectedRoute>
              <StoryReader />
            </ProtectedRoute>
          } />

          {/* Vocabulary Learning module */}
          <Route path="/vocabulary" element={
            <ProtectedRoute>
              <VocabularyHome />
            </ProtectedRoute>
          } />
          <Route path="/vocabulary/:topicId" element={
            <ProtectedRoute>
              <VocabularyDetail />
            </ProtectedRoute>
          } />
          <Route path="/vocabulary/:topicId/learn" element={
            <ProtectedRoute>
              <VocabularyLearn />
            </ProtectedRoute>
          } />

          {/* Reading Practice module */}
          <Route path="/reading/:id?" element={
            <ProtectedRoute>
              <ReadingPractice />
            </ProtectedRoute>
          } />

          {/* Speaking Practice module */}
          <Route path="/speaking-practice/:id?" element={
            <ProtectedRoute>
              <SpeakingPractice />
            </ProtectedRoute>
          } />

          {/* Writing Scenario module */}
          <Route path="/writing-scenarios" element={
            <ProtectedRoute>
              <WritingScenarioLobby />
            </ProtectedRoute>
          } />
          <Route path="/writing-scenario/:id?" element={
            <ProtectedRoute>
              <WritingScenarioPractice />
            </ProtectedRoute>
          } />
          
          {/* Admin Routes */}
          <Route path="/admin" element={
            <AdminRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/users" element={
            <AdminRoute>
              <AdminLayout>
                <AdminUsers />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/topics" element={
            <AdminRoute>
              <AdminLayout>
                <AdminTopics />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/topics/:topicId/lessons/:lessonId/builder" element={
            <AdminRoute>
              <CourseBuilder />
            </AdminRoute>
          } />
          <Route path="/admin/topics/:topicId/lessons" element={
            <AdminRoute>
              <AdminLayout>
                <AdminLessons />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/vocabulary" element={
            <AdminRoute>
              <AdminLayout>
                <AdminVocabulary />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/reading-passages" element={
            <AdminRoute>
              <AdminLayout>
                <AdminReadingPassages />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/writing-scenarios" element={
            <AdminRoute>
              <AdminLayout>
                <AdminWritingScenarios />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/speaking-questions" element={
            <AdminRoute>
              <AdminLayout>
                <AdminSpeakingQuestions />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/writing-prompts" element={
            <AdminRoute>
              <AdminLayout>
                <AdminWritingPrompts />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/listening" element={
            <AdminRoute>
              <AdminLayout>
                <AdminListening />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/grammar" element={
            <AdminRoute>
              <AdminLayout>
                <AdminGrammar />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/billing" element={
            <AdminRoute>
              <AdminLayout>
                <AdminBilling />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/gamification" element={
            <AdminRoute>
              <AdminLayout>
                <AdminGamification />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/shop" element={
            <AdminRoute>
              <AdminLayout>
                <AdminShop />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/economy" element={
            <AdminRoute>
              <AdminLayout>
                <AdminEconomy />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/pokedex" element={
            <AdminRoute>
              <AdminLayout>
                <AdminPokedex />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/anti-cheat" element={
            <AdminRoute>
              <AdminLayout>
                <AdminAntiCheat />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/stories" element={
            <AdminRoute>
              <AdminLayout>
                <AdminStories />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/system-config" element={
            <AdminRoute>
              <AdminLayout>
                <AdminSystemConfig />
              </AdminLayout>
            </AdminRoute>
          } />
          <Route path="/admin/notifications" element={
            <AdminRoute>
              <AdminLayout>
                <AdminNotifications />
              </AdminLayout>
            </AdminRoute>
          } />
          
          {/* 404 - Catch all undefined routes */}
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </MaintenanceGuard>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
