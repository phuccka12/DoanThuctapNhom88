require('dotenv').config(); // Để đọc file .env
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const helmet = require('helmet');
const session = require('express-session');
const passport = require('./src/config/passport');
const connectDB = require('./src/config/db');

// Import routes
const aiRoutes = require('./src/routes/aiRoutes');
const authRoutes = require('./src/routes/authRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const onboardingRoutes = require('./src/routes/onboardingRoutes');
const placementRoutes = require('./src/routes/placementRoutes');
const userRoutes = require('./src/routes/userRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

// Import CMS public routes
const topicRoutes = require('./src/routes/Public/PublicTopics');
const writingPromptRoutes = require('./src/routes/Public/PublicWritingPrompts');
const speakingQuestionRoutes = require('./src/routes/Public/PublicSpeakingQuestions');
const listeningRoutes = require('./src/routes/Public/PublicListening');

// Import CMS admin routes
const adminTopicRoutes = require('./src/routes/Admin/AdminTopics');
const adminWritingPromptRoutes = require('./src/routes/Admin/AdminWritingPrompts');
const adminSpeakingQuestionRoutes = require('./src/routes/Admin/AdminSpeakingQuestions');
const adminStatsRoutes = require('./src/routes/Admin/AdminStats');
const adminUsersRoutes = require('./src/routes/Admin/AdminUsers');
const adminLessonsRoutes = require('./src/routes/Admin/AdminLessons');
const adminVocabularyRoutes = require('./src/routes/Admin/AdminVocabulary');
const adminReadingPassageRoutes = require('./src/routes/readingPassage');
const adminBillingRoutes = require('./src/routes/Admin/AdminBilling');
const adminSystemConfigRoutes = require('./src/routes/Admin/AdminSystemConfig');
const adminListeningRoutes = require('./src/routes/Admin/AdminListening');
const adminGrammarRoutes = require('./src/routes/Admin/AdminGrammar');
const adminPetsRoutes = require('./src/routes/Admin/AdminPets');
// ── NEW: Shop, Economy, Pokedex, Anti-Cheat ──────────────────────────────────
const adminShopRoutes = require('./src/routes/Admin/AdminShop');
const adminEconomyRoutes = require('./src/routes/Admin/AdminEconomy');
const adminPokedexRoutes = require('./src/routes/Admin/AdminPokedex');
const adminAntiCheatRoutes = require('./src/routes/Admin/AdminAntiCheat');
const adminNotificationsRoutes = require('./src/routes/Admin/AdminNotifications');
// ─────────────────────────────────────────────────────────────────────────────
const adminWritingScenarioRoutes = require('./src/routes/Admin/AdminWritingScenarios');
const billingRoutes = require('./src/routes/billingRoutes');
const writingScenarioRoutes = require('./src/routes/writingScenario');
const petRoutes = require('./src/routes/petRoutes');
const uploadRoutes = require('./src/routes/upload');
// ── NEW: Shop (user-side) ────────────────────────────────────────────────────
const shopRoutes = require('./src/routes/shopRoutes');
// ── Learning / Practice module ───────────────────────────────────────────────
const learnRoutes = require('./src/routes/learnRoutes');
// ── RPG Story module ─────────────────────────────────────────────────────────
const storyRoutes = require('./src/routes/storyRoutes');
const adminStoryRoutes = require('./src/routes/Admin/AdminStories');
// ── Vocabulary Learning module ────────────────────────────────────────────────
const vocabLearnRoutes = require('./src/routes/vocabLearnRoutes');
// ─────────────────────────────────────────────────────────────────────────────
const { startPetDecayJob } = require('./src/jobs/petDecay');
const { startCancelStalePendingJob } = require('./src/jobs/cancelStalePending');
const { maintenanceModeMiddleware } = require('./src/middlewares/maintenanceMode');

// Khởi tạo app
const app = express();

// Kết nối DB
connectDB();

// Trust proxy
app.set("trust proxy", 1);

// Middlewares
app.use(helmet());
app.use(cookieParser());
app.use(express.json());

// Session middleware for passport
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

app.use(
  cors({
    origin: true,          // hoặc set domain frontend cụ thể
    credentials: true,     // QUAN TRỌNG để gửi/nhận cookie
  })
);

// ─── Maintenance Mode ─── đặt TRƯỚC tất cả routes để chặn sớm ──────────────
app.use(maintenanceModeMiddleware);

// Endpoint kiểm tra trạng thái bảo trì (dùng bởi MaintenancePage)
// Nếu reach được đây → maintenance OFF (hoặc admin) → trả 200
// Nếu maintenance ON + user thường → middleware trả 503 trước, không reach đây
app.get('/api/maintenance/status', (req, res) => res.json({ maintenance: false }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/topics', adminTopicRoutes);
app.use('/api/admin/writing-prompts', adminWritingPromptRoutes);
app.use('/api/admin/speaking-questions', adminSpeakingQuestionRoutes);
app.use('/api/admin/stats', adminStatsRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin', adminLessonsRoutes);
app.use('/api/admin/vocab', adminVocabularyRoutes);
app.use('/api/admin/reading-passages', adminReadingPassageRoutes);
app.use('/api/admin/billing', adminBillingRoutes);
app.use('/api/admin/system-config', adminSystemConfigRoutes);
app.use('/api/admin/listening', adminListeningRoutes);
app.use('/api/admin/grammar', adminGrammarRoutes);
app.use('/api/admin/pets', adminPetsRoutes);
// ── NEW admin routes ─────────────────────────────────────────────────────────
app.use('/api/admin/shop', adminShopRoutes);
app.use('/api/admin/economy', adminEconomyRoutes);
app.use('/api/admin/pokedex', adminPokedexRoutes);
app.use('/api/admin/anti-cheat', adminAntiCheatRoutes);
app.use('/api/admin/notifications', adminNotificationsRoutes);
app.use('/api/admin/stories', adminStoryRoutes);
app.use('/api/admin/writing-scenarios', adminWritingScenarioRoutes);
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api', dashboardRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/placement', placementRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/writing-prompts', writingPromptRoutes);
app.use('/api/speaking-questions', speakingQuestionRoutes);
app.use('/api/listening', listeningRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/writing-scenarios', writingScenarioRoutes);
app.use('/api/pet', petRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ai', aiRoutes);
// ── NEW user-side shop + ranking ─────────────────────────────────────────────
app.use('/api/shop', shopRoutes);
// ── Learning / Practice module ───────────────────────────────────────────────
app.use('/api/learn', learnRoutes);
// ── RPG Story module ─────────────────────────────────────────────────────────
app.use('/api/stories', storyRoutes);
// ── Vocabulary Learning module ────────────────────────────────────────────────
app.use('/api/vocabulary', vocabLearnRoutes);
// ── Reading Practice module (user-facing, no admin required) ─────────────────
const readingPracticeRoutes = require('./src/routes/readingPracticeRoutes');
app.use('/api/reading-passages', readingPracticeRoutes);
// ── Speaking Practice module (user-facing) ────────────────────────────────────
const speakingPracticeRoutes = require('./src/routes/Public/SpeakingPracticeRoutes');
app.use('/api/speaking-practice', speakingPracticeRoutes);
// ── Grammar Practice module (user-facing) ─────────────────────────────────────
const grammarRoutes = require('./src/routes/Public/GrammarRoutes');
app.use('/api/grammar', grammarRoutes);
// ─────────────────────────────────────────────────────────────────────────────

// start background jobs
startPetDecayJob();
startCancelStalePendingJob();



app.get('/', (req, res) => {
  res.send('Server is running');
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});   