import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import dashboardService from "../services/dashboardService";
import PetWidget from "../components/PetWidget";
import { dashboardRefreshEmitter } from "../utils/dashboardRefresh";

import { cn, theme, darkTheme } from "../utils/dashboardTheme";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import DashboardTopbar from "../components/dashboard/DashboardTopbar";
import DashboardWelcome from "../components/dashboard/DashboardWelcome";
import {
  Card,
  CardHeader,
  SmallLink,
  Pill,
  ScoreRow,
  ReminderRow,
  StatCard,
  SkillDonut,
  UpNextCard,
  ActivityHeatmap,
  CoinBadge,
  StreakFlame,
  MilestoneProgress,
  QuickActionCard,
} from "../components/dashboard/DashboardCards";
import LoadingCat from "../components/shared/LoadingCat";
import StreakCelebrationModal from "../components/dashboard/StreakCelebrationModal";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark } = useTheme();

  const [active, setActive] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [streakToCelebrate, setStreakToCelebrate] = useState(0);
  const [showSkillUpdatePulse, setShowSkillUpdatePulse] = useState(false);

  const t = isDark ? darkTheme : theme;

  const mapTodayTasks = (tasks = []) => {
    const mapped = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      subtitle: task.subtitle || task.description,
      percent: task.progress || 0,
      completed: Boolean(task.completed) || (task.progress || 0) >= 100,
      type: task.type,
      actionUrl: task.actionUrl,
      actionText: task.actionText,
      reward: task.reward,
      lessonId: task.lessonId,
      lessonType: task.lessonType,
    }));

    // Unfinished tasks first (stable order inside each group)
    return mapped.sort((a, b) => {
      const aDone = a.completed || a.percent >= 100;
      const bDone = b.completed || b.percent >= 100;
      if (aDone === bDone) return 0;
      return aDone ? 1 : -1;
    });
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) { setLoading(false); return; }
      try {
        setLoading(true);
        setError(null);
        const [userProfile, todayTasks, timeSpent, latestScores, reminders, userGoals] =
          await Promise.all([
            dashboardService.getUserProfile(),
            dashboardService.getTodayTasks(),
            dashboardService.getTimeSpent("week"),
            dashboardService.getLatestScores(3),
            dashboardService.getReminders(),
            dashboardService.getUserGoals(),
          ]);
        const userInfo = userProfile.user || userProfile;
        const learningPrefs = userInfo.learning_preferences || {};

        // Milestone detection
        const currentStreak = userInfo.gamification_data?.streak || 0;
        const milestones = [3, 7, 14, 30, 60, 100, 365];
        const lastCelebrated = parseInt(localStorage.getItem('last_celebrated_streak') || '0');
        if (milestones.includes(currentStreak) && currentStreak > lastCelebrated) {
          setStreakToCelebrate(currentStreak);
          setShowStreakModal(true);
          localStorage.setItem('last_celebrated_streak', currentStreak.toString());
        }

        setDashboardData({
          user: {
            name: userInfo.user_name || "Student",
            email: userInfo.email || "",
            avatar: userInfo.avatar || null,
            initials: userInfo.user_name ? userInfo.user_name.substring(0, 2).toUpperCase() : "ST",
            currentBand: userInfo.current_band || null,
            targetBand: userInfo.target_band || null,
            hasCompletedPlacementTest: userInfo.placement_test_completed || false,
            selfAssessedLevel: learningPrefs.current_level || null,
            wantsPlacementCheck: learningPrefs.wants_placement_check || false,
          },
          stats: {
            streak: userInfo.gamification_data?.streak || 0,
            totalXP: userInfo.gamification_data?.exp || 0,
            level: userInfo.gamification_data?.level || 1,
            coins: userInfo.gamification_data?.coins ?? userInfo.gamification_data?.gold ?? 0,
            milestoneProgress: (() => {
              const streak = userInfo.gamification_data?.streak || 0;
              const milestones = [3, 7, 14, 30, 60, 100, 365];
              const next = milestones.find(m => m > streak) || (streak + 1);
              const prev = [...milestones].reverse().find(m => m <= streak) || 0;
              const percent = Math.min(100, Math.max(0, ((streak - prev) / (next - prev)) * 100));
              return { streak, prev, next, percent };
            })(),
            activityWeek: (() => {
              const streak = userInfo.gamification_data?.streak || 0;
              const arr = Array(7).fill(false);
              if (streak > 0) {
                const now = new Date();
                const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
                arr[todayIdx] = true;
                // Optionally fill previous days if streak > 1, 
                // but just today is enough for a reliable fallback.
              }
              return arr;
            })(),
          },
          todayTasks: mapTodayTasks(todayTasks),
          weeklyTimeSpent: {
            total: timeSpent.total || 0,
            breakdown: timeSpent.breakdown || [],
          },
          activityHeatmap: timeSpent.activityHeatmap || [],
          latestScores: latestScores.map((s) => {
            const value = s.score ?? s.value ?? s.band ?? 0;
            const date = s.date || s.test_date || s.createdAt || s.timestamp;
            const prettyDate = date ? ` - ${new Date(date).toLocaleDateString()}` : "";
            const name = s.label || s.test_name || s.name || s.title || s.topic || s.type || s.skill;
            return { score: value, label: name ? `${name}${prettyDate}` : `Test${prettyDate}` };
          }),
          reminders: reminders.map((r) => ({ id: r.id, label: r.message || r.title })),
          progressGoal: userGoals || { current: 0, target: 100, label: "This month" },
        });
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [user]);

  const handleLogout = async () => {
    try { await logout(); navigate("/login"); }
    catch (err) { console.error("Logout error:", err); }
  };

  const handleStartPlacementTest = () => {
    navigate('/placement-test');
  };

  const refreshDashboard = async () => {
    if (isRefreshing || !user) return;
    try {
      setIsRefreshing(true);
      const [userProfile, todayTasks, timeSpent, latestScores] = await Promise.all([
        dashboardService.getUserProfile(),
        dashboardService.getTodayTasks(),
        dashboardService.getTimeSpent("week"),
        dashboardService.getLatestScores(3),
      ]);

      const userInfo = userProfile.user || userProfile;

      // Milestone detection on refresh
      const currentStreak = userInfo.gamification_data?.streak || 0;
      const milestones = [3, 7, 14, 30, 60, 100, 365];
      const lastCelebrated = parseInt(localStorage.getItem('last_celebrated_streak') || '0');
      if (milestones.includes(currentStreak) && currentStreak > lastCelebrated) {
        setStreakToCelebrate(currentStreak);
        setShowStreakModal(true);
        localStorage.setItem('last_celebrated_streak', currentStreak.toString());
      }

      setDashboardData(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          streak: userInfo.gamification_data?.streak || 0,
          totalXP: userInfo.gamification_data?.exp || 0,
          level: userInfo.gamification_data?.level || 1,
          coins: userInfo.gamification_data?.coins ?? userInfo.gamification_data?.gold ?? 0,
        },
        todayTasks: mapTodayTasks(todayTasks),
        weeklyTimeSpent: {
          total: timeSpent.total || 0,
          breakdown: timeSpent.breakdown || [],
        },
        activityHeatmap: timeSpent.activityHeatmap || [],
        latestScores: latestScores.map((s) => {
          const value = s.score ?? s.value ?? s.band ?? 0;
          const date = s.date || s.test_date || s.createdAt || s.timestamp;
          const prettyDate = date ? ` - ${new Date(date).toLocaleDateString()}` : "";
          const name = s.label || s.test_name || s.name || s.title || s.topic || s.type || s.skill;
          return { score: value, label: name ? `${name}${prettyDate}` : `Test${prettyDate}` };
        }),
      }));
    } catch (err) {
      console.error("Error refreshing dashboard:", err);
    } finally {
      setIsRefreshing(false);
      // Show skill update pulse
      setShowSkillUpdatePulse(true);
      setTimeout(() => setShowSkillUpdatePulse(false), 2000);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => { if (dashboardData) refreshDashboard(); }, 30000);
    return () => clearInterval(interval);
  }, [dashboardData, user, isRefreshing]);

  useEffect(() => {
    const unsubscribe = dashboardRefreshEmitter.on(() => {
      if (!isRefreshing) refreshDashboard();
    });
    return unsubscribe;
  }, [isRefreshing]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center">
        <LoadingCat size={300} text="Đang tải dữ liệu học tập..." />
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="min-h-screen bg-linear-to-br from-purple-50 via-white to-violet-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700">{error || "Unable to load dashboard data"}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const upNextTask = dashboardData.todayTasks.find(task => (task.percent || 0) < 100) || dashboardData.todayTasks[0] || null;

  return (
    <div className={cn("min-h-screen", t.page)}>
      <div className="max-w-[1500px] mx-auto p-4 md:p-6 lg:flex lg:gap-6">

        {/* ── 1. SIDEBAR (Left) ─────────────────────────────────── */}
        <DashboardSidebar active={active} setActive={setActive} onLogout={handleLogout} theme={t} />

        {/* ── 2. MAIN CONTENT (Center) ──────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-6 mt-6 lg:mt-0">

          {/* Topbar + Mobile stats */}
          <DashboardTopbar user={dashboardData.user} theme={t} />
          <div className="flex xl:hidden items-center gap-2 shrink-0 -mt-2">
            <StreakFlame days={dashboardData.stats.streak} />
            <CoinBadge amount={dashboardData.stats.coins} />
          </div>

          {/* Placement Nudge */}
          {!dashboardData.user.hasCompletedPlacementTest && (
            <DashboardWelcome
              name={dashboardData.user.name}
              hasDonePlacementTest={dashboardData.user.hasCompletedPlacementTest}
              ctaVariant={dashboardData.user.wantsPlacementCheck ? 'placement' : (dashboardData.user.selfAssessedLevel ? 'path' : 'placement')}
              ctaLabel={(() => {
                const map = { stranger: 'Mới bắt đầu', old_friend: 'Cơ bản', learning: 'Trung bình', close_friend: 'Khá tốt' };
                const lvl = dashboardData.user.selfAssessedLevel;
                return lvl ? `Bắt đầu lộ trình ${map[lvl] || lvl}` : 'Làm bài kiểm tra trình độ';
              })()}
              onStartTest={handleStartPlacementTest}
              onStartPath={() => navigate('/practice')}
              theme={t}
            />
          )}

          {/* Hero Stats (4 Columns) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Streak"
              value={`${dashboardData.stats.streak} ngày`}
              sub={dashboardData.stats.streak >= 3 ? "🔥 Đang cháy!" : "Bắt đầu nhé!"}
              accent="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-100"
            />
            <StatCard
              label="Tổng XP"
              value={dashboardData.stats.totalXP.toLocaleString()}
              sub={`Cấp ${dashboardData.stats.level}`}
              accent="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100"
            />
            <StatCard
              label="Thời gian tuần"
              value={dashboardData.weeklyTimeSpent.total > 0
                ? `${Math.floor(dashboardData.weeklyTimeSpent.total / 60)}h ${dashboardData.weeklyTimeSpent.total % 60}m`
                : "0m"}
              sub="Tổng học tập"
            />
            <StatCard
              label="Band hiện tại"
              value={dashboardData.user.currentBand ?? "—"}
              sub={dashboardData.user.targetBand ? `🎯 Mục tiêu: ${dashboardData.user.targetBand}` : "Chưa thi"}
              accent="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100"
            />
          </div>

          {/* Split Content: 2/3 Main Tasks, 1/3 Skills Tracking */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Left Side (Quests & Up Next) */}
            <div className="xl:col-span-2 flex flex-col gap-6">

              {/* Highlight AI Suggestion */}
              {upNextTask ? (
                <UpNextCard
                  title={upNextTask.title}
                  skill={upNextTask.subtitle || "IELTS"}
                  duration={(upNextTask.percent || 0) >= 100
                    ? "Đã hoàn thành"
                    : upNextTask.lessonType === 'continue' ? "Tiếp tục" : "Bắt đầu"}
                  onClick={() => navigate(upNextTask.actionUrl || "/learn")}
                />
              ) : (
                <div className="h-[120px] rounded-3xl bg-slate-900 flex items-center justify-center border-4 border-white shadow-lg">
                  <p className="text-indigo-300 font-bold uppercase tracking-widest text-xs">Hoàn thành nhiệm vụ để nhận gợi ý ✨</p>
                </div>
              )}

              {/* Nhiệm vụ hôm nay */}
              <div className="flex flex-col gap-3">
                {/* Section Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className={cn("text-base font-black tracking-tight", t.text)}>
                      Nhiệm vụ hôm nay
                    </h3>
                    <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {dashboardData.todayTasks.filter(tk => tk.percent >= 100).length}/{dashboardData.todayTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={refreshDashboard}
                    disabled={isRefreshing}
                    className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-500 hover:border-indigo-200 hover:shadow-sm transition-all flex items-center justify-center active:scale-90"
                  >
                    <span className={cn("text-sm", isRefreshing ? "animate-spin" : "")}>🔄</span>
                  </button>
                </div>

                {/* Task Rows inside single bordered card */}
                <div className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                  {dashboardData.todayTasks.length === 0 ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2">
                      <span className="text-3xl">🎉</span>
                      <p className="text-sm font-semibold text-slate-400">Không có nhiệm vụ nào hôm nay!</p>
                    </div>
                  ) : (
                    dashboardData.todayTasks.map((task) => {
                      const isDone = task.percent >= 100;
                      const pct = Math.max(4, Math.min(task.percent, 100));
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 transition-colors",
                            isDone ? "bg-emerald-50/40" : "hover:bg-slate-50/60"
                          )}
                        >
                          {/* Checkbox */}
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                            isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white"
                          )}>
                            {isDone && <span className="text-[9px] font-black leading-none">✓</span>}
                          </div>

                          {/* Title + subtitle */}
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-[13px] font-bold leading-tight truncate",
                              isDone ? "text-slate-400 line-through" : "text-slate-800"
                            )}>{task.title}</p>
                            {task.subtitle && (
                              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5 truncate">{task.subtitle}</p>
                            )}
                          </div>

                          {/* Mini progress */}
                          <div className="hidden sm:flex items-center gap-1.5 w-20 shrink-0">
                            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all duration-700", isDone ? "bg-emerald-400" : "bg-indigo-500")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={cn("text-[9px] font-black w-5 text-right shrink-0", isDone ? "text-emerald-500" : "text-slate-400")}>
                              {Math.round(pct)}%
                            </span>
                          </div>

                          {/* Reward */}
                          {task.reward && (
                            <span className="hidden sm:inline-flex text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md shrink-0">
                              +{task.reward}🪙
                            </span>
                          )}

                          {/* Action */}
                          {task.actionUrl && (
                            <button
                              disabled={isDone}
                              onClick={() => navigate(task.actionUrl)}
                              className={cn(
                                "shrink-0 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                isDone
                                  ? "text-emerald-600 bg-emerald-50 cursor-not-allowed"
                                  : "text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white"
                              )}
                            >
                              {isDone ? "✓ Xong" : (task.actionText || "Làm")}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <Card theme={t}>
                <CardHeader title="Luyện tập nhanh" theme={t} />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <QuickActionCard emoji="✍️" label="Writing" color="indigo" onClick={() => navigate("/ai-writing")} />
                  <QuickActionCard emoji="🎧" label="Listening" color="purple" onClick={() => navigate("/ai-listening")} />
                  <QuickActionCard emoji="🎙️" label="Speaking" color="emerald" onClick={() => navigate("/ai-speaking")} />
                  <QuickActionCard emoji="💬" label="AI Chat" color="cyan" onClick={() => navigate("/ai-conversation")} />
                </div>
              </Card>

            </div>

            {/* Right Side (Milestones & Skills) */}
            <div className="flex flex-col gap-6">
              <MilestoneProgress progress={dashboardData.stats.milestoneProgress} theme={t} />

              <Card theme={t} className="flex-1">
                <CardHeader
                  title="Tiến độ kỹ năng"
                  right={<span className={cn(
                    "text-[10px] font-bold px-2 py-1 rounded-md transition-all duration-500",
                    showSkillUpdatePulse ? t.success + " scale-110" : t.accentSoft + " " + t.accent
                  )}>
                    {showSkillUpdatePulse ? "Vừa cập nhật ✨" : "Tuần này"}
                  </span>}
                  theme={t}
                />
                <motion.div
                  animate={showSkillUpdatePulse ? { scale: [1, 1.02, 1], filter: ["brightness(1)", "brightness(1.1)", "brightness(1)"] } : {}}
                  className="py-2"
                >
                  <SkillDonut
                    skills={dashboardData.weeklyTimeSpent.breakdown?.length > 0
                      ? dashboardData.weeklyTimeSpent.breakdown
                      : [
                        { label: "Lessons", value: 0, color: "#6366F1" },
                        { label: "Writing", value: 0, color: "#8B5CF6" },
                        { label: "Speaking", value: 0, color: "#10B981" },
                        { label: "Reading", value: 0, color: "#06B6D4" },
                        { label: "Listening", value: 0, color: "#3B82F6" },
                        { label: "Vocabulary", value: 0, color: "#F59E0B", isCount: true },
                      ]
                    }
                    totalTimeStr={dashboardData.weeklyTimeSpent.total > 0
                      ? `${Math.floor(dashboardData.weeklyTimeSpent.total / 60) > 0 ? Math.floor(dashboardData.weeklyTimeSpent.total / 60) + 'h ' : ''}${dashboardData.weeklyTimeSpent.total % 60}m`
                      : "0m"}
                  />
                </motion.div>
                <ActivityHeatmap activeDays={
                  dashboardData.activityHeatmap.length > 0
                    ? dashboardData.activityHeatmap.map(d => d.minutes > 0)
                    : dashboardData.stats.activityWeek || Array(7).fill(false)
                } />
              </Card>
            </div>
          </div>
        </div>

        {/* ── 3. RIGHT PANEL (Gamification & Reminders) ─────────── */}
        <div className="hidden xl:flex flex-col gap-6 w-[300px] shrink-0 mt-6 lg:mt-0">

          <div className="flex items-center gap-2 px-2">
            <StreakFlame days={dashboardData.stats.streak} />
            <CoinBadge amount={dashboardData.stats.coins} />
          </div>

          <PetWidget theme={t} />

          <Card>
            <CardHeader
              title="Điểm gần nhất"
              right={<SmallLink onClick={() => navigate("/progress")}>Tất cả</SmallLink>}
            />
            {dashboardData.latestScores.length > 0 ? (
              dashboardData.latestScores.map((s, i) => (
                <ScoreRow key={i} score={s.score} label={s.label} onClick={() => navigate("/profile?tab=progress")} />
              ))
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">Chưa có điểm nào</p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Nhắc nhở"
              right={<SmallLink onClick={() => navigate("/reminders")}>Tất cả</SmallLink>}
            />
            {dashboardData.reminders.length > 0 ? (
              dashboardData.reminders.map((r, i) => (
                <ReminderRow key={i} label={r.label} />
              ))
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">Không có nhắc nhở</p>
            )}
          </Card>
        </div>

      </div>

      {/* Streak Celebration Modal */}
      <StreakCelebrationModal
        isOpen={showStreakModal}
        onClose={() => setShowStreakModal(false)}
        streak={streakToCelebrate}
        theme={t}
      />
    </div>
  );
}