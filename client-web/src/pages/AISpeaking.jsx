import React, { useState, useMemo, useRef } from 'react';
import { useReactMediaRecorder } from "react-media-recorder";
import axiosInstance from '../utils/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '../utils/cn';
import ReactMarkdown from 'react-markdown';
import {
  FaMicrophone, FaStop, FaPaperPlane, FaFire, FaTrophy, FaStar,
  FaChartLine, FaComments, FaVolumeUp,
  FaExclamationTriangle, FaLightbulb, FaMedal,
  FaCoins, FaChevronLeft, FaSpinner, FaRandom, FaRedo, FaCheck
} from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi';
import LoadingCat from '../components/shared/LoadingCat';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

/* ── Waveform Bars (animated when recording) ─────────────────────────── */
const WaveBars = ({ active }) => (
  <div className="flex items-center gap-[3px] h-8">
    {[0.6, 1, 0.75, 1.2, 0.5, 0.9, 1.1, 0.65, 0.8, 1].map((h, i) => (
      <motion.div
        key={i}
        className={cn('w-1 rounded-full', active ? 'bg-white' : 'bg-purple-400/30')}
        animate={active ? { scaleY: [0.4, h, 0.4] } : { scaleY: 0.3 }}
        transition={active ? { duration: 0.8 + i * 0.07, repeat: Infinity, ease: 'easeInOut' } : {}}
        style={{ height: 32 }}
      />
    ))}
  </div>
);

const AISpeaking = () => {
  const { id: promptId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const speakingStartRef = useRef(null);
  const stats = user?.gamification_data || { streak: 0, level: 1, coins: 0 };

  const { status, startRecording, stopRecording, mediaBlobUrl } = useReactMediaRecorder({
    audio: true,
    blobPropertyBag: { type: 'audio/wav' },
    onStop: (_, blob) => setAudioFile(new File([blob], 'recording.wav', { type: 'audio/wav' })),
  });

  const [activeQuestion, setActiveQuestion] = useState(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState('overview');

  // Fallback questions khi DB chưa có dữ liệu
  const FALLBACK_QUESTIONS = [
    "What are the advantages and disadvantages of living in a big city?",
    "Describe a memorable journey or trip you have taken.",
    "Do you think technology has made people's lives better or worse?",
    "What skills do you think will be most important in the future workplace?",
    "How important is it to learn a foreign language in today's world?",
    "Describe a person who has had a great influence on your life.",
    "What changes would you like to see in your hometown?",
    "Is it better to work for yourself or for an employer? Why?",
    "How has social media changed the way people communicate?",
    "What role does education play in a person's success?"
  ];

  const handleRandomQuestion = async () => {
    setQuestionLoading(true);
    try {
      const excludeId = activeQuestion?._id || '';
      const res = await axiosInstance.get(
        `/speaking-questions/random${excludeId ? `?exclude_id=${excludeId}` : ''}`
      );
      const data = res.data?.data;
      if (data) {
        setActiveQuestion(data);
      } else {
        // DB trống, dùng fallback
        useFallback();
      }
    } catch (err) {
      console.warn('API không có câu hỏi, dùng câu hỏi dự phòng:', err.message);
      useFallback();
    } finally {
      setQuestionLoading(false);
    }
    setResult(null);
  };

  const useFallback = () => {
    const exclude = activeQuestion?.question || '';
    const pool = FALLBACK_QUESTIONS.filter(q => q !== exclude);
    const q = pool[Math.floor(Math.random() * pool.length)];
    setActiveQuestion({ question: q, topic_id: null, difficulty: 'medium', _id: null });
  };

  const handleCheck = async () => {
    if (!audioFile && !mediaBlobUrl) { alert('Chưa có ghi âm! Hãy nói trước.'); return; }
    setLoading(true); setResult(null); setActiveResultTab('overview');



    try {
      let fileToSend = audioFile;
      if (!fileToSend && mediaBlobUrl) {
        const blob = await (await fetch(mediaBlobUrl)).blob();
        fileToSend = new File([blob], 'recording.wav', { type: 'audio/wav' });
      }
      const formData = new FormData();
      formData.append('audio', fileToSend);
      if (activeQuestion) {
        formData.append('question', activeQuestion.question || '');
        if (activeQuestion._id) formData.append('speakingId', activeQuestion._id);
      }
      if (promptId) { formData.append('speakingId', promptId); formData.append('question_id', promptId); }
      const elapsed = speakingStartRef.current ? Math.max(0, Math.round((Date.now() - speakingStartRef.current) / 1000)) : 0;
      formData.append('timeSpentSec', elapsed);
      
      const response = await fetch(`${axiosInstance.defaults.baseURL}/ai/speaking`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errText = await response.text();
        try {
          const errObj = JSON.parse(errText);
          throw new Error(errObj.error || errObj.message || 'Lỗi xử lý âm thanh');
        } catch {
          throw new Error('Lỗi máy chủ kết nối AI');
        }
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; 

        for (const line of lines) {
            if (line.trim() === '') continue;
            
            const parts = line.split('\n');
            let eventName = 'message';
            let dataStr = '';
            
            for (const p of parts) {
                if (p.startsWith('event: ')) eventName = p.substring(7).trim();
                else if (p.startsWith('event:')) eventName = p.substring(6).trim();
                else if (p.startsWith('data: ')) dataStr = p.substring(6).trim();
                else if (p.startsWith('data:')) dataStr = p.substring(5).trim();
            }

            if (dataStr) {
                try {
                    const parsed = JSON.parse(dataStr);
                    if (eventName === 'quick_score') {
                        setResult(parsed);
                    } else if (eventName === 'deep_analysis') {
                        setResult(prev => ({ ...prev, ...parsed }));
                    } else if (eventName === 'database_done') {
                        setResult(prev => ({ ...prev, coinResult: parsed.coinResult, petState: parsed.petState, quotaRemaining: parsed.quotaRemaining }));
                    } else if (eventName === 'error') {
                        alert("Lỗi AI: " + (parsed.error || 'Unknown error'));
                    }
                } catch(e) {}
            }
        }
      }

    } catch (e) {
      console.error(e);
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(e.message || "Lỗi xử lý");
      }
    } finally {
      setLoading(false);
    }
  };

  const radarData = useMemo(() => {
    if (!result?.radar_chart) return null;
    
    // Helper để tìm điểm trong object radar_chart bất kể viết hoa/thường/suffix
    const getScore = (keyParts) => {
      const keys = Object.keys(result.radar_chart);
      for (const part of keyParts) {
        const foundKey = keys.find(k => k.toLowerCase().includes(part.toLowerCase()));
        if (foundKey) return result.radar_chart[foundKey];
      }
      return 0;
    };

    return {
      labels: ['Fluency', 'Lexical', 'Grammar', 'Pronunciation'],
      datasets: [{
        label: 'Score',
        data: [
          getScore(['fluency', 'coherence']),
          getScore(['lexical', 'vocabulary']),
          getScore(['grammar', 'accuracy']),
          getScore(['pronunciation', 'accent'])
        ],
        backgroundColor: 'rgba(168,85,247,0.15)',
        borderColor: 'rgba(168,85,247,1)',
        borderWidth: 2,
        pointBackgroundColor: '#a855f7',
        pointBorderColor: '#fff'
      }]
    };
  }, [result]);

  const isRecording = status === 'recording';
  const hasStopped = status === 'stopped' || mediaBlobUrl;
  const resultTabs = [
    { key: 'overview', label: 'Tổng quan', icon: FaChartLine },
    { key: 'heatmap', label: 'Heatmap từ vựng', icon: FaComments },
    { key: 'pitch', label: 'Pitch & nhịp điệu', icon: FaVolumeUp },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0c14] transition-colors duration-300 font-sans overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[60vw] h-[60vh] rounded-full bg-purple-700/8 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[50vw] h-[50vh] rounded-full bg-rose-700/6 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30vw] h-[30vh] rounded-full bg-indigo-600/5 blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* ── HEADER ───────────────────────────────────────────────── */}
        <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')}
              className="w-9 h-9 rounded-xl bg-slate-200/50 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 border border-slate-200 dark:border-white/8 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all">
              <FaChevronLeft size={12} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <FaMicrophone className="text-white text-sm" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-800 dark:text-white leading-tight">Coach Phát âm AI</h1>
                <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-widest">Hybrid XGBoost + Gemini</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[{ icon: <FaFire className="text-orange-500" />, val: `${stats.streak}d` },
              { icon: <FaTrophy className="text-yellow-600 dark:text-yellow-400" />, val: `Lv${stats.level}` },
              { icon: <FaCoins className="text-amber-500 dark:text-amber-400" />, val: `${stats.gold ?? stats.coins ?? 0}` }
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-slate-200/50 dark:bg-white/5 border border-slate-200 dark:border-white/8 px-3 py-1.5 rounded-xl shadow-sm dark:shadow-none">
                {s.icon}<span className="text-slate-700 dark:text-white font-black text-xs">{s.val}</span>
              </div>
            ))}
          </div>
        </motion.header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">

            {/* ── QUESTION CARD ─────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <AnimatePresence mode="wait">
                {activeQuestion ? (
                  <motion.div key={activeQuestion._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-linear-to-br from-purple-100/50 via-white to-slate-50 dark:from-purple-900/30 dark:via-indigo-900/20 dark:to-[#0a0c14] p-6 shadow-xl dark:shadow-none">
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-500 via-fuchsia-400 to-pink-500" />
                    <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-purple-500/5 blur-2xl pointer-events-none" />
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/20 dark:border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
                        <HiSparkles className="text-purple-600 dark:text-purple-400" size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Câu hỏi luyện tập</span>
                          {activeQuestion.topic_id?.name && (
                            <span className="text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/20 px-2.5 py-0.5 rounded-full font-bold">
                              {activeQuestion.topic_id.name}
                            </span>
                          )}
                          {activeQuestion.difficulty && (
                            <span className={cn("text-[10px] px-2.5 py-0.5 rounded-full font-bold border",
                              activeQuestion.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                activeQuestion.difficulty === 'hard' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                  'bg-amber-500/10 text-amber-400 border-amber-500/20')}>
                              {activeQuestion.difficulty}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-800 dark:text-white font-semibold text-base leading-relaxed">{activeQuestion.question}</p>
                        {activeQuestion.sample_answer?.text && (
                          <details className="mt-3">
                            <summary className="text-[11px] text-slate-500 cursor-pointer hover:text-slate-400 select-none">💡 Xem gợi ý trả lời</summary>
                            <p className="mt-2 text-slate-400 text-xs leading-relaxed italic pl-3 border-l border-slate-700">{activeQuestion.sample_answer.text}</p>
                          </details>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="rounded-3xl border border-dashed border-slate-300 dark:border-white/10 p-8 text-center bg-white/50 dark:bg-transparent">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-3">
                      <HiSparkles className="text-purple-600 dark:text-purple-400" size={22} />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Nhấn <span className="text-purple-600 dark:text-purple-400 font-bold">"Câu hỏi mới"</span> để AI gợi ý chủ đề luyện tập</p>
                    <p className="text-slate-500 dark:text-slate-600 text-xs mt-1">Câu hỏi được lấy ngẫu nhiên từ ngân hàng IELTS Speaking</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* ── MAIN RECORDING CARD ───────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
              className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-white/8 bg-linear-to-b from-white to-slate-50 dark:from-white/4 dark:to-transparent p-8 flex flex-col items-center gap-6 shadow-xl dark:shadow-none">

              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/3 via-transparent to-rose-500/3 pointer-events-none" />

              {/* Mic Orb */}
              <div className="relative flex flex-col items-center gap-4">
                <motion.div
                  animate={isRecording ? { scale: [1, 1.05, 1], boxShadow: ['0 0 0 0 rgba(239,68,68,0)', '0 0 0 24px rgba(239,68,68,0.12)', '0 0 0 0 rgba(239,68,68,0)'] } : {}}
                  transition={isRecording ? { duration: 1.5, repeat: Infinity } : {}}
                  className={cn('w-36 h-36 rounded-full flex items-center justify-center relative shadow-2xl transition-all duration-500',
                    isRecording ? 'bg-linear-to-br from-rose-500 to-pink-600 shadow-rose-500/30' : 'bg-linear-to-br from-purple-500/10 to-indigo-500/10 dark:from-purple-600/20 dark:to-indigo-600/20 border border-slate-200 dark:border-white/10 shadow-purple-500/5 dark:shadow-purple-500/10'
                  )}>
                  {isRecording && <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />}
                  <FaMicrophone className={cn('text-5xl transition-all duration-300', isRecording ? 'text-white scale-110' : 'text-purple-500 dark:text-purple-400')} />
                </motion.div>

                {/* Waveform */}
                <div className="h-8 flex items-center">
                  <WaveBars active={isRecording} />
                </div>

                <div className="text-center">
                  <p className={cn('text-sm font-bold transition-colors', isRecording ? 'text-rose-400' : 'text-slate-400')}>
                    {isRecording ? '🔴 Đang thu âm...' : hasStopped ? '✅ Ghi âm hoàn tất' : 'Sẵn sàng ghi âm'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
                {/* Random Q button */}
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={handleRandomQuestion} disabled={questionLoading || isRecording}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white dark:bg-white/5 border border-purple-200 dark:border-purple-500/25 text-purple-600 dark:text-purple-300 text-xs font-black uppercase tracking-wider hover:bg-purple-50 dark:hover:bg-purple-500/10 hover:border-purple-400 dark:hover:border-purple-500/40 transition-all disabled:opacity-40 whitespace-nowrap shadow-sm dark:shadow-none">
                  {questionLoading ? <FaSpinner className="animate-spin" size={11} /> : <FaRandom size={11} />}
                  {questionLoading ? 'Đang tải...' : activeQuestion ? 'Câu hỏi khác' : 'Câu hỏi mới'}
                </motion.button>

                {/* Record / Stop */}
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => { if (isRecording) { stopRecording(); } else { speakingStartRef.current = Date.now(); startRecording(); setResult(null); } }}
                  className={cn('flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm text-white transition-all shadow-lg',
                    isRecording
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 shadow-rose-500/30 animate-pulse'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-purple-500/30 hover:shadow-purple-500/50')}>
                  {isRecording ? <><FaStop size={12} /> Dừng ghi âm</> : <><FaMicrophone size={12} /> {hasStopped ? 'Ghi âm lại' : 'Bắt đầu ghi âm'}</>}
                </motion.button>
              </div>

              {/* Audio player + Analyze CTA */}
              <AnimatePresence>
                {hasStopped && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="w-full max-w-sm space-y-3 overflow-hidden">
                    <audio src={mediaBlobUrl} controls className="w-full h-9 rounded-xl opacity-60 brightness-90 contrast-125 invert" />
                    {loading ? (
                      <div className="py-4 flex justify-center">
                        <LoadingCat size={120} text="Đang phân tích giọng nói..." />
                      </div>
                    ) : (
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={handleCheck}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 hover:shadow-emerald-500/40 transition-all">
                        <FaPaperPlane size={12} /> Phân tích ngay với AI
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

          </div>

          <div className="xl:sticky xl:top-6">
            <div className="rounded-3xl border border-slate-200 dark:border-white/8 bg-white dark:bg-linear-to-b dark:from-white/[0.03] dark:to-transparent p-4 sm:p-5 shadow-xl dark:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">Kết quả phân tích</h2>
                <span className="text-[10px] px-2.5 py-1 rounded-full border border-purple-500/25 text-purple-300 bg-purple-500/10 font-bold uppercase tracking-wider">AI Coach</span>
              </div>

              {/* ── RESULTS AREA ──────────────────────────────────────────── */}
              <AnimatePresence mode="wait">
                {result ? (
                  <motion.div key="result" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="space-y-5 pb-4">
                    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-1.5">
                      {resultTabs.map((tab) => {
                        const Icon = tab.icon;
                        const active = activeResultTab === tab.key;
                        return (
                          <button
                            key={tab.key}
                            onClick={() => setActiveResultTab(tab.key)}
                            className={cn(
                              'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[10px] font-black uppercase tracking-wide transition-all',
                              active
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                            )}
                          >
                            <Icon size={10} />
                            <span className="hidden sm:inline">{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {activeResultTab === 'overview' && (
                      <div className="space-y-5">
                        {/* Score + Radar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          {/* Band Score */}
                          <div className="relative overflow-hidden rounded-3xl border border-amber-200 dark:border-white/8 bg-linear-to-br from-amber-50 to-white dark:from-yellow-500/10 dark:via-amber-500/5 dark:to-transparent p-8 text-center shadow-lg dark:shadow-none">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-yellow-400 to-amber-500" />
                            <FaTrophy className="text-yellow-400 text-4xl mx-auto mb-3" />
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Overall Band Score</p>
                            <p className="text-7xl font-black text-slate-800 dark:text-white tracking-tighter">
                              {typeof result.overall_score === 'object' && result.overall_score !== null
                                ? (result.overall_score.overall ?? result.overall_score.overall_score ?? '–')
                                : (result.overall_score ?? '–')}
                            </p>
                            <div className="mt-3 flex justify-center gap-1.5">
                              {[1, 2, 3].map(s => {
                                const score = typeof result.overall_score === 'object' ? (result.overall_score?.overall || 0) : (result.overall_score || 0);
                                return <FaStar key={s} className={cn('text-sm', (score >= 7.5 || (score >= 5.5 && s <= 2) || s === 1) && score >= 5.5 - s ? 'text-amber-400' : 'text-white/10')} />
                              })}
                            </div>
                          </div>

                          {/* Radar */}
                          <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/2 p-6 flex flex-col items-center shadow-lg dark:shadow-none">
                            <div className="flex items-center gap-2 mb-4">
                              <FaChartLine className="text-purple-600 dark:text-purple-400 text-sm" />
                              <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Biểu đồ kỹ năng</span>
                            </div>
                            <div className="w-full max-w-[220px]">
                              {radarData && <Radar data={radarData} options={{
                                scales: { r: { min: 0, max: 9, ticks: { display: false }, grid: { color: 'rgba(148, 163, 184, 0.15)' }, angleLines: { color: 'rgba(148, 163, 184, 0.15)' }, pointLabels: { color: '#64748b', font: { size: 10, weight: 'bold' } } } },
                                plugins: { legend: { display: false } }
                              }} />}
                            </div>
                          </div>
                        </div>

                        {/* 🌟 AI COACH DETAILED FEEDBACK */}
                        {result.detailed_feedback && (
                          <div className="space-y-4">
                            {typeof result.detailed_feedback === 'string' ? (
                              <div className="rounded-3xl border border-purple-500/15 bg-purple-500/5 p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                  <HiSparkles className="text-purple-600 dark:text-purple-400" size={18} />
                                  <h3 className="text-xs font-black text-purple-800 dark:text-white uppercase tracking-widest">Nhận xét chi tiết</h3>
                                </div>
                                <div className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                                  <ReactMarkdown>{result.detailed_feedback}</ReactMarkdown>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-4">
                                {Object.entries(result.detailed_feedback).map(([key, value], idx) => {
                                  const label = key.replace(/_/g, ' ').toUpperCase();
                                  let colorClass = "border-sky-500/15 bg-sky-500/5 text-sky-800 dark:text-sky-300";
                                  let icon = <HiSparkles size={16} />;
                                  
                                  if (key.includes('strength') || key.includes('good') || key.includes('plus')) {
                                    colorClass = "border-emerald-500/20 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300";
                                    icon = <FaCheck className="text-emerald-500" size={14} />;
                                  } else if (key.includes('improve') || key.includes('weak') || key.includes('error') || key.includes('issue')) {
                                    colorClass = "border-rose-500/20 bg-rose-500/5 text-rose-800 dark:text-rose-300";
                                    icon = <FaExclamationTriangle className="text-rose-500" size={14} />;
                                  } else if (key.includes('tip') || key.includes('advice') || key.includes('coach')) {
                                    colorClass = "border-amber-500/20 bg-amber-500/5 text-amber-800 dark:text-amber-300";
                                    icon = <FaLightbulb className="text-amber-500" size={14} />;
                                  }

                                  return (
                                    <motion.div 
                                      key={key}
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: 0.1 + idx * 0.05 }}
                                      className={cn("rounded-2xl border p-5 shadow-sm", colorClass)}
                                    >
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                                          {icon}
                                        </div>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest">{label}</h4>
                                      </div>
                                      <div className="text-sm leading-relaxed opacity-90">
                                        {typeof value === 'string' ? (
                                          <ReactMarkdown>{value}</ReactMarkdown>
                                        ) : typeof value === 'object' && value !== null ? (
                                          <div className="space-y-1">
                                            {value.score && <p className="font-bold text-xs">Score: {value.score}</p>}
                                            {value.feedback && <ReactMarkdown>{value.feedback}</ReactMarkdown>}
                                            {!value.score && !value.feedback && <pre className="text-[10px] opacity-50 whitespace-pre-wrap">{JSON.stringify(value)}</pre>}
                                          </div>
                                        ) : (
                                          String(value)
                                        )}
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Transcript */}
                        {(result.transcript || result.transcript_display) && (
                          <div className="rounded-3xl border border-indigo-500/15 bg-indigo-500/5 p-6">
                            <div className="flex items-center gap-2 mb-4">
                              <FaComments className="text-indigo-600 dark:text-indigo-400 text-sm" />
                              <h3 className="text-xs font-black text-indigo-800 dark:text-white uppercase tracking-wider">Bản ghi lời nói</h3>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 italic leading-relaxed text-sm">"{result.transcript_display || result.transcript}"</p>
                          </div>
                        )}

                        {/* Mistakes */}
                        {result.mistakes_timeline?.length > 0 && (
                          <div className="rounded-3xl border border-rose-500/15 bg-rose-500/5 p-6 space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                              <FaExclamationTriangle className="text-rose-600 dark:text-rose-400 text-sm" />
                              <h3 className="text-xs font-black text-rose-800 dark:text-white uppercase tracking-wider">Điểm cần cải thiện</h3>
                            </div>
                            {result.mistakes_timeline.map((item, idx) => (
                              <div key={idx} className="bg-white/3 border border-white/6 rounded-2xl p-4 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-rose-400 font-black">{item.word}</span>
                                  <span className="text-[9px] bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded-full uppercase font-bold">Lỗi</span>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{item.error}</p>
                                <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3 flex gap-2">
                                  <FaLightbulb className="text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" size={11} />
                                  <p className="text-emerald-700 dark:text-emerald-400 text-xs font-semibold">{item.fix}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Better Version */}
                        {result.better_version && (
                          <div className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 via-orange-500/4 to-transparent p-6">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                                <FaMedal className="text-white text-xs" />
                              </div>
                              <div>
                                <h3 className="text-xs font-black text-amber-800 dark:text-white uppercase tracking-wider">Phiên bản Band 9.0</h3>
                                <p className="text-[10px] text-amber-600 dark:text-amber-500">Học cách diễn đạt chuẩn native</p>
                              </div>
                            </div>
                            <p className="text-slate-700 dark:text-slate-200 italic leading-relaxed text-sm bg-white/50 dark:bg-white/4 border border-slate-200 dark:border-white/6 rounded-2xl p-5 shadow-inner">
                              {typeof result.better_version === 'object' && result.better_version !== null ? JSON.stringify(result.better_version) : result.better_version}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeResultTab === 'heatmap' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {result.word_heatmap?.length > 0 ? (
                          result.word_heatmap.map((item, idx) => {
                            const token = item.word || item.token || item.text || `#${idx + 1}`;
                            const rawWeight = Number(item.weight ?? item.score ?? item.value ?? 0);
                            const weight = Number.isFinite(rawWeight) ? Math.max(0, Math.min(1, rawWeight)) : 0;
                            const percent = Math.round(weight * 100);
                            return (
                              <div key={`${token}-${idx}`} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-3 shadow-sm transition-all hover:border-purple-500/30">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="text-slate-800 dark:text-white font-bold text-xs truncate max-w-[100px]">{token}</span>
                                  <span className="text-[8px] px-1.5 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300 font-bold uppercase tracking-tight">
                                    {item.type || item.category || 'token'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/8 overflow-hidden">
                                    <div
                                      className={cn(
                                        'h-full rounded-full transition-all',
                                        percent >= 75 ? 'bg-emerald-500' : percent >= 45 ? 'bg-amber-500' : 'bg-rose-500'
                                      )}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-slate-700 dark:text-slate-200 font-black tabular-nums">{percent}%</span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 dark:border-white/15 p-6 text-center text-sm text-slate-400">
                            Chưa có dữ liệu heatmap cho câu trả lời này.
                          </div>
                        )}
                      </div>
                    )}

                    {activeResultTab === 'pitch' && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider mb-2">Tổng quan pitch alignment</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {result.pitch_overlay?.summary || result.pitch_overlay?.message || 'Chưa có tóm tắt pitch từ backend.'}
                          </p>
                          {(result.pitch_overlay?.dtw_distance ?? result.pitch_overlay?.distance ?? null) !== null && (
                            <p className="mt-2 text-xs text-slate-400">
                              DTW distance:{' '}
                              <span className="text-slate-700 dark:text-slate-200 font-semibold">
                                {Number(result.pitch_overlay?.dtw_distance ?? result.pitch_overlay?.distance).toFixed(3)}
                              </span>
                            </p>
                          )}
                        </div>

                        {(result.pitch_overlay?.user_curve?.length > 0 || result.pitch_overlay?.reference_curve?.length > 0) && (
                          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                            <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Mẫu đường cong pitch</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
                                <p className="text-[10px] text-indigo-500 dark:text-indigo-300 font-bold uppercase tracking-wide mb-2">User curve</p>
                                <p className="text-xs text-slate-600 dark:text-slate-300 break-all">{(result.pitch_overlay?.user_curve || []).slice(0, 18).join(', ') || '—'}</p>
                              </div>
                              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-300 font-bold uppercase tracking-wide mb-2">Reference curve</p>
                                <p className="text-xs text-slate-600 dark:text-slate-300 break-all">{(result.pitch_overlay?.reference_curve || []).slice(0, 18).join(', ') || '—'}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                          <p className="text-xs text-cyan-700 dark:text-cyan-300 font-bold uppercase tracking-wide mb-1">Mẹo cải thiện</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300">TẬP ĐỌC CÙNG NHỊP VỚI MẪU THAM CHIẾU, GIỮ CAO ĐỘ ỔN ĐỊNH Ở TỪ KHÓA CHÍNH VÀ GIẢM DAO ĐỘNG MẠNH Ở CUỐI CÂU.</p>
                        </div>
                      </div>
                    )}

                    {/* Try Again */}
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => { setResult(null); setActiveResultTab('overview'); handleRandomQuestion(); }}
                      className="w-full py-4 rounded-2xl bg-slate-200/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center gap-2 hover:bg-slate-300 dark:hover:bg-white/8 transition-all">
                      <FaRedo size={12} /> Thử câu hỏi khác
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty-result"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
                      <FaChartLine className="text-purple-400" size={20} />
                    </div>
                    <p className="text-slate-800 dark:text-slate-300 font-semibold text-sm">Chưa có kết quả phân tích</p>
                    <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                      Hãy chọn câu hỏi, ghi âm và bấm <span className="text-emerald-600 dark:text-emerald-400 font-bold">“Phân tích ngay với AI”</span>.
                    </p>
                    <div className="mt-4 text-[11px] text-slate-500">
                      Hệ thống sẽ chấm theo nhiều yếu tố: Pronunciation, Fluency, Lexical, Grammar, Semantic.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AISpeaking;