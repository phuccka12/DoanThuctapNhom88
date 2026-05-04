import os
import tempfile
import random
import time
import json
import uuid
import html
import asyncio
import math
import re as _re
from pydub import AudioSegment
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor
import joblib
import pandas as pd

# --- IMPORT MODULAR SERVICES ---
import services.gemini_service as gemini_service
from services.audio_service import (
    whisper_model, transcribe_audio, extract_pitch, 
    get_audio_duration, extract_audio_features_pro, transcribe_audio_detailed
)
from services.tts_service import run_tts_sync, generate_audio_edge
from services.nlp_service import (
    analyze_deep_tech, check_grammar, _offline_writing_score, 
    _offline_fluency_score, CEFR_FLESCH_MAP
)
from services.ollama_service import call_ollama, check_ollama_status, call_ollama_stream
from services.vector_service import vector_service
from services.analytic_service import analytic_service
from services.writing_service import writing_service
from services.roadmap_service import RoadmapService
from services.lesson_vector_service import lesson_vector_service
from services.speaking_hybrid_service import (
    evaluate_speaking_hybrid, format_speaking_response
)

from utils.helpers import clean_temp_file, parse_json_safely
load_dotenv()
app = Flask(__name__)
CORS(app)
@app.route('/api/ai/roadmap/generate', methods=['POST'])
def generate_roadmap_strategy():
    """
    Tầng 1 & 2: Xác định Persona và Tối ưu hóa trình tự học.
    """
    try:
        data = request.json
        user_profile = data.get('profile', {})
        days = data.get('days', 7)
        
        # 1. Clustering (Persona)
        persona_info = RoadmapService.get_user_persona(user_profile)
        persona_info['focus_skills'] = user_profile.get('focus_skills', [])
        persona_info['interests'] = user_profile.get('interests', [])
        
        # 2. Path Optimization (Genetic)
        sequence = RoadmapService.optimize_sequence(persona_info, days=days)
        
        return jsonify({
            "success": True,
            "persona": persona_info,
            "sequence": sequence
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/ai/roadmap/update-knowledge', methods=['POST'])
def update_knowledge_state():
    """
    Tầng 5: Cập nhật xác suất làm chủ kiến thức (BKT).
    """
    try:
        data = request.json
        p_prior = data.get('p_prior', 0.5)
        p_transit = data.get('p_transit', 0.1)
        p_guess = data.get('p_guess', 0.2)
        p_slip = data.get('p_slip', 0.1)
        is_correct = data.get('is_correct', True)
        
        p_new = RoadmapService.calculate_bkt(p_prior, p_transit, p_guess, p_slip, is_correct)
        
        return jsonify({
            "success": True,
            "p_new": p_new
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/ai/roadmap/semantic-match', methods=['POST'])
def semantic_match_lessons():
    """
    V4.5: Tìm kiếm bài học bằng Embedding + Hybrid Scoring.
    """
    try:
        data = request.json
        interests = data.get('interests', [])
        major = data.get('major', '')
        level = data.get('level', 'A2')
        mastery = data.get('mastery', {})
        n_results = data.get('n_results', 5)

        # 1. Hydrate/Translate Interests (Nếu là tiếng Việt)
        query_text = f"{major} {' '.join(interests)}".strip()
        
        # Nếu có tiếng Việt (Unicode > 127), nhờ Gemini dịch & mở rộng
        if any(ord(c) > 127 for c in query_text):
            prompt = f"Translate and expand these English learning interests into professional English keywords: {query_text}. Output ONLY context-rich keywords."
            expanded_query = gemini_service.call_gemini_text(prompt)
            if expanded_query:
                query_text = expanded_query

        # 2. Hybrid Matching
        matches = lesson_vector_service.hybrid_match(
            query_text=query_text,
            user_level=level,
            mastery_stats=mastery,
            n_results=n_results
        )

        return jsonify({
            "success": True,
            "query": query_text,
            "matches": matches
        })
    except Exception as e:
        print(f"❌ Semantic Match API Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# --- THREAD POOL FOR PARALLEL TASKS ---
executor = ThreadPoolExecutor(max_workers=8)  # Tăng lên 8 workers để xử lý song song tốt hơn

# --- GLOBAL CACHE FOR QUOTA SAVING ---
GREETING_CACHE = {} 
CACHE_DURATION = 600

# --- WRITING TASK STORE ---
WRITING_TASKS = {}

# --- SMART OFFLINE FALLBACK ---
LAST_QUOTA_ERROR_TIME = 0
OFFLINE_COOLDOWN = 60 # 1 phút nghỉ nếu bị 429
FALLBACK_QUESTIONS = [
    "That's a very interesting point. Can you tell me more about your personal experience with that?",
    "I see. And how does that compare to what people usually do in your country?",
    "That's quite a detailed answer. Why do you think that's the case nowadays?",
    "Interesting. If you had the chance, would you change anything about that situation?",
    "I understand. Moving on, could you tell me a bit more about how this affects your daily life?",
    "That's a common perspective. Do you think this will change in the future?",
    "Actually, that leads me to another question: How do you feel about this topic in general?"
]
import random

# --- LOAD HYBRID BRAIN (XGBOOST) ---
SPEAKING_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'Random_forest', 'alex_speaking_brain_pro.joblib')
try:
    speaking_model = joblib.load(SPEAKING_MODEL_PATH)
    print("🎤 [SUCCESS] Hybrid Speaking Brain (XGBoost) loaded!")
except Exception as e:
    print(f"⚠️ [WARNING] Failed to load Speaking Brain: {e}")
    speaking_model = None

print("🚀 HỆ THỐNG AI ĐÃ ĐƯỢC MODULAR HÓA & TỐI ƯU TỐC ĐỘ!")

SPEAKING_SCORING_PRESETS = {
    "balanced": {
        "pron_weight": 0.40,
        "content_weight": 0.60,
        "content_mix": {"semantic": 0.40, "lexical": 0.35, "usage": 0.25},
        "short_answer_penalties": {2: 2.5, 6: 1.6, 10: 0.8},
        "fluency_penalty_threshold": 4.5,
        "fluency_penalty_value": 0.4,
        "gemini_assist_weight": 0.35,
        "feedback_rules": [
            {"min_overall": 7.5, "message": "Rất tốt! Cả phát âm và nội dung đều cân bằng."},
            {"min_overall": 6.0, "message": "Khá tốt. Cần cải thiện thêm chiều sâu ý nghĩa và cách dùng từ."},
            {"min_overall": 5.0, "message": "Giọng ổn nhưng nội dung còn mỏng. Hãy mở rộng ý và dùng từ nối tốt hơn."},
            {"min_overall": 0.0, "message": "Cần cố gắng thêm về phát âm và độ rõ ý trong câu trả lời."}
        ]
    },
    "strict": {
        "pron_weight": 0.35,
        "content_weight": 0.65,
        "content_mix": {"semantic": 0.45, "lexical": 0.30, "usage": 0.25},
        "short_answer_penalties": {2: 3.0, 6: 2.0, 10: 1.2},
        "fluency_penalty_threshold": 5.0,
        "fluency_penalty_value": 0.6,
        "gemini_assist_weight": 0.45,
        "feedback_rules": [
            {"min_overall": 7.5, "message": "Tốt, nhưng vẫn cần duy trì chiều sâu lập luận ở mọi câu trả lời."},
            {"min_overall": 6.0, "message": "Phát âm ổn, cần nâng đáng kể vốn từ và độ liên quan nội dung."},
            {"min_overall": 5.0, "message": "Nội dung chưa đủ sâu. Tránh trả lời ngắn và thêm từ nối học thuật."},
            {"min_overall": 0.0, "message": "Điểm còn thấp. Hãy cải thiện cả pronunciation lẫn semantic relevance."}
        ]
    },
    "pronunciation_focus": {
        "pron_weight": 0.60,
        "content_weight": 0.40,
        "content_mix": {"semantic": 0.35, "lexical": 0.35, "usage": 0.30},
        "short_answer_penalties": {2: 2.0, 6: 1.2, 10: 0.6},
        "fluency_penalty_threshold": 4.0,
        "fluency_penalty_value": 0.3,
        "gemini_assist_weight": 0.25,
        "feedback_rules": [
            {"min_overall": 7.5, "message": "Phát âm rất tốt, tiếp tục mở rộng vốn từ để đạt band cao hơn."},
            {"min_overall": 6.0, "message": "Pronunciation ổn, cần thêm độ tự nhiên và mạch ý."},
            {"min_overall": 0.0, "message": "Cần luyện phát âm trọng âm, âm cuối và kiểm soát ngắt nghỉ."}
        ]
    }
}


def _resolve_speaking_policy(form):
    preset_name = (form.get("scoring_profile", "balanced") or "balanced").strip().lower()
    # deep-copy tránh mutate preset gốc
    base = json.loads(json.dumps(SPEAKING_SCORING_PRESETS.get(preset_name, SPEAKING_SCORING_PRESETS["balanced"])))

    # Cho phép override policy động từ frontend/admin (JSON string)
    custom_policy_raw = form.get("scoring_policy_json", "")
    if custom_policy_raw:
        try:
            custom_policy = json.loads(custom_policy_raw)
            if isinstance(custom_policy, dict):
                # Override các key được phép
                for k in [
                    "pron_weight", "content_weight", "content_mix",
                    "short_answer_penalties", "fluency_penalty_threshold",
                    "fluency_penalty_value", "gemini_assist_weight", "feedback_rules"
                ]:
                    if k in custom_policy:
                        base[k] = custom_policy[k]
        except Exception as e:
            print(f"⚠️ Invalid scoring_policy_json, fallback preset '{preset_name}': {e}")

    if "pron_weight" in form:
        base["pron_weight"] = _safe_float(form.get("pron_weight"), _safe_float(base.get("pron_weight", 0.4), 0.4))
    if "content_weight" in form:
        base["content_weight"] = _safe_float(form.get("content_weight"), _safe_float(base.get("content_weight", 0.6), 0.6))
    if "gemini_assist_weight" in form:
        base["gemini_assist_weight"] = _safe_float(form.get("gemini_assist_weight"), _safe_float(base.get("gemini_assist_weight", 0.35), 0.35))

    # sanitize nested configs
    mix = base.get("content_mix", {}) or {}
    semantic_w = _safe_float(mix.get("semantic", 0.40), 0.40)
    lexical_w = _safe_float(mix.get("lexical", 0.35), 0.35)
    usage_w = _safe_float(mix.get("usage", 0.25), 0.25)
    mix_total = max(semantic_w + lexical_w + usage_w, 1e-6)
    base["content_mix"] = {
        "semantic": semantic_w / mix_total,
        "lexical": lexical_w / mix_total,
        "usage": usage_w / mix_total
    }

    penalty_map = base.get("short_answer_penalties", {}) or {}
    cleaned_penalties = {}
    for k, v in penalty_map.items():
        try:
            wk = int(k)
            cleaned_penalties[wk] = max(0.0, _safe_float(v, 0.0))
        except Exception:
            continue
    if not cleaned_penalties:
        cleaned_penalties = {2: 2.5, 6: 1.6, 10: 0.8}
    base["short_answer_penalties"] = cleaned_penalties

    rules = base.get("feedback_rules", [])
    if not isinstance(rules, list) or not rules:
        rules = SPEAKING_SCORING_PRESETS["balanced"]["feedback_rules"]
    clean_rules = []
    for r in rules:
        if not isinstance(r, dict):
            continue
        clean_rules.append({
            "min_overall": _safe_float(r.get("min_overall", 0.0), 0.0),
            "message": str(r.get("message", "Tiếp tục luyện tập.")).strip() or "Tiếp tục luyện tập."
        })
    clean_rules.sort(key=lambda x: x["min_overall"], reverse=True)
    base["feedback_rules"] = clean_rules

    base["fluency_penalty_threshold"] = _safe_float(base.get("fluency_penalty_threshold", 4.5), 4.5)
    base["fluency_penalty_value"] = max(0.0, _safe_float(base.get("fluency_penalty_value", 0.4), 0.4))

    total = max(_safe_float(base.get("pron_weight", 0.4), 0.4) + _safe_float(base.get("content_weight", 0.6), 0.6), 1e-6)
    base["pron_weight"] = base["pron_weight"] / total
    base["content_weight"] = base["content_weight"] / total
    base["gemini_assist_weight"] = max(0.0, min(1.0, _safe_float(base.get("gemini_assist_weight", 0.35), 0.35)))
    return base


def _feedback_from_policy(local_hybrid, policy):
    rules = policy.get("feedback_rules", [])
    score = _safe_float(local_hybrid.get("overall_score", 5.0), 5.0)
    for r in rules:
        if score >= _safe_float(r.get("min_overall", 0.0), 0.0):
            return r.get("message", "Tiếp tục luyện tập để cải thiện đều các tiêu chí speaking.")
    return "Tiếp tục luyện tập để cải thiện đều các tiêu chí speaking."


def _gemini_assist_language_quality(transcript, question, local_hybrid, lang_quality, policy):
    if not transcript or len(_extract_words(transcript)) < 4:
        return local_hybrid, None

    prompt = f"""
    Role: Senior IELTS Speaking Examiner (Professional, Strict, and Unbiased).
    Context: A candidate is practicing for the IELTS Speaking test. You must calibrate their performance based on official IELTS marking criteria.

    [INPUT DATA]
    - Transcript: "{transcript}"
    - Question: "{question}"
    - System Baseline (0-9): Lexical={local_hybrid.get('lexical', 5.0)}, Semantic={local_hybrid.get('semantic', 5.0)}, WordUsage={local_hybrid.get('word_usage', 5.0)}, Grammar={local_hybrid.get('grammar', 5.0)}

    [SCORING RULES - STRICT ENFORCEMENT]
    1. RESPONSE LENGTH PENALTY (CRITICAL):
       - If word count < 6: MAX overall score for all categories is 3.5 (Inadequate).
       - If word count 6-15: MAX overall score is 5.5 (Limited development).
       - To reach Band 7.0+, the candidate MUST speak at least 30 meaningful words.

    2. RELEVANCE & COHERENCE:
       - If the answer is "Off-topic" or doesn't address the prompt: Set semantic_score to 3.0 immediately.
       - Penalize heavily for excessive repetition of simple words (e.g., "like", "and", "good").

    3. LEXICAL RESOURCE & GRAMMAR:
       - Band 7.0+: Must use idiomatic expressions or academic words.
       - No complex sentences (relative clauses, etc.)? -> Max Grammar score is 5.5.

    [OUTPUT FORMAT - JSON ONLY]
    {{
        "lexical_score": float,
        "semantic_score": float,
        "usage_score": float,
        "grammar_score": float,
        "confidence": float,
        "note": "Phản hồi sư phạm thẳng thắn bằng tiếng Việt (Ví dụ: 'Câu trả lời quá ngắn', 'Thiếu chiều sâu', 'Lặp từ nhiều'...)"
    }}
    """

    ai = gemini_service.call_gemini_json(prompt)
    if not ai:
        return local_hybrid, None

    w = policy.get("gemini_assist_weight", 0.35)
    ai_lex = _clamp_score(ai.get("lexical_score", local_hybrid.get("lexical", 5.0)))
    ai_sem = _clamp_score(ai.get("semantic_score", local_hybrid.get("semantic", 5.0)))
    ai_use = _clamp_score(ai.get("usage_score", local_hybrid.get("word_usage", 5.0)))
    ai_gra = _clamp_score(ai.get("grammar_score", local_hybrid.get("grammar", 5.0)))

    blended = dict(local_hybrid)
    blended["lexical"] = _round_half((1 - w) * local_hybrid.get("lexical", 5.0) + w * ai_lex)
    blended["semantic"] = _round_half((1 - w) * local_hybrid.get("semantic", 5.0) + w * ai_sem)
    blended["word_usage"] = _round_half((1 - w) * local_hybrid.get("word_usage", 5.0) + w * ai_use)
    blended["grammar"] = _round_half((1 - w) * local_hybrid.get("grammar", 5.0) + w * ai_gra)

    mix = policy.get("content_mix", {"semantic": 0.40, "lexical": 0.35, "usage": 0.25})
    content = (
        blended["semantic"] * _safe_float(mix.get("semantic", 0.40), 0.40)
        + blended["lexical"] * _safe_float(mix.get("lexical", 0.35), 0.35)
        + blended["word_usage"] * _safe_float(mix.get("usage", 0.25), 0.25)
    )
    content -= _safe_float(lang_quality.get("short_answer_penalty", 0.0), 0.0)
    blended["content_score"] = _round_half(_clamp_score(content))
    blended["overall_score"] = _round_half(_clamp_score(
        blended.get("pronunciation", 5.0) * policy.get("pron_weight", 0.40)
        + blended["content_score"] * policy.get("content_weight", 0.60)
    ))

    return blended, {
        "raw": ai,
        "assist_weight": w
    }


def _clamp_score(value, low=0.0, high=9.0):
    try:
        return max(low, min(high, float(value)))
    except Exception:
        return low


def _round_half(value):
    return round(_clamp_score(value) * 2) / 2


def _extract_words(text):
    return _re.findall(r"[A-Za-z']+", (text or "").lower())


def _analyze_speaking_language_quality(transcript, question="", policy=None):
    policy = policy or SPEAKING_SCORING_PRESETS["balanced"]
    words = _extract_words(transcript)
    q_words = set(_extract_words(question))

    stop_words = {
        "the", "a", "an", "is", "are", "was", "were", "to", "of", "and", "in", "on",
        "for", "with", "it", "this", "that", "i", "you", "we", "they", "he", "she",
        "my", "your", "our", "their", "be", "do", "does", "did", "have", "has", "had"
    }
    content_q_words = {w for w in q_words if w not in stop_words and len(w) > 2}

    connectors = {
        "because", "however", "therefore", "although", "moreover", "furthermore",
        "besides", "meanwhile", "instead", "actually", "personally", "generally",
        "for", "example", "in", "addition"
    }
    fillers = {"um", "uh", "erm", "ah", "like"}

    word_count = len(words)
    unique_ratio = (len(set(words)) / word_count) if word_count else 0.0
    avg_word_len = (sum(len(w) for w in words) / word_count) if word_count else 0.0
    connector_hits = sum(1 for w in words if w in connectors)
    filler_hits = sum(1 for w in words if w in fillers)
    filler_ratio = filler_hits / max(word_count, 1)

    transcript_set = set(words)
    overlap = len(content_q_words & transcript_set)
    relevance_ratio = overlap / max(len(content_q_words), 1) if content_q_words else 0.5

    grammar_errors_count = 0
    if transcript and word_count >= 4:
        try:
            grammar_errors_count = len(check_grammar(transcript) or [])
        except Exception:
            grammar_errors_count = 0

    lexical_score = 4.5 + (unique_ratio * 2.6) + (min(connector_hits, 5) * 0.35) + min(max(avg_word_len - 3.5, 0), 2.0) * 0.5
    semantic_score = 4.0 + min(word_count / 25, 1.5) * 2.0 + relevance_ratio * 2.2
    usage_score = 5.0 + min(connector_hits, 5) * 0.4 - (filler_ratio * 6.0) - min(grammar_errors_count * 0.12, 2.5)
    grammar_score = 6.8 - min(grammar_errors_count * 0.25, 3.8)

    short_answer_penalty = 0.0
    penalty_map = policy.get("short_answer_penalties", {2: 2.5, 6: 1.6, 10: 0.8})
    for max_words in sorted(penalty_map.keys(), key=lambda x: int(x)):
        if word_count <= int(max_words):
            short_answer_penalty = _safe_float(penalty_map[max_words], 0.0)
            break

    return {
        "word_count": word_count,
        "unique_ratio": round(unique_ratio, 3),
        "connector_hits": connector_hits,
        "filler_ratio": round(filler_ratio, 3),
        "relevance_ratio": round(relevance_ratio, 3),
        "grammar_errors": grammar_errors_count,
        "short_answer_penalty": short_answer_penalty,
        "lexical_score": _clamp_score(lexical_score),
        "semantic_score": _clamp_score(semantic_score),
        "usage_score": _clamp_score(usage_score),
        "grammar_score": _clamp_score(grammar_score)
    }


def _score_acoustic_fluency(acoustic_feats):
    if not acoustic_feats:
        return 5.0

    silence_ratio = float(acoustic_feats.get("silence_ratio", 0.25))
    jitter = float(acoustic_feats.get("jitter", 0.03))
    shimmer = float(acoustic_feats.get("shimmer", 0.12))

    fluency = 7.4
    fluency -= max(0.0, silence_ratio - 0.18) * 10.0
    fluency -= max(0.0, jitter - 0.035) * 18.0
    fluency -= max(0.0, shimmer - 0.13) * 8.0
    return _clamp_score(fluency)


def _build_hybrid_speaking_scores(pronunciation_score, lang_quality, acoustic_fluency, pron_weight=0.40, content_weight=0.60, policy=None):
    policy = policy or SPEAKING_SCORING_PRESETS["balanced"]
    pronunciation_score = _clamp_score(pronunciation_score if pronunciation_score > 0 else 5.0)

    lexical = lang_quality.get("lexical_score", 5.0)
    semantic = lang_quality.get("semantic_score", 5.0)
    usage = lang_quality.get("usage_score", 5.0)
    grammar = lang_quality.get("grammar_score", 5.0)
    short_answer_penalty = lang_quality.get("short_answer_penalty", 0.0)

    content_mix = policy.get("content_mix", {"semantic": 0.40, "lexical": 0.35, "usage": 0.25})
    content_score = (
        semantic * _safe_float(content_mix.get("semantic", 0.40), 0.40)
        + lexical * _safe_float(content_mix.get("lexical", 0.35), 0.35)
        + usage * _safe_float(content_mix.get("usage", 0.25), 0.25)
    )
    content_score = _clamp_score(content_score - short_answer_penalty)

    overall = (pronunciation_score * pron_weight) + (content_score * content_weight)
    fluency_threshold = _safe_float(policy.get("fluency_penalty_threshold", 4.5), 4.5)
    fluency_penalty_value = _safe_float(policy.get("fluency_penalty_value", 0.4), 0.4)
    if acoustic_fluency < fluency_threshold:
        overall -= fluency_penalty_value
    overall = _clamp_score(overall)

    return {
        "overall_score": _round_half(overall),
        "pronunciation": _round_half(pronunciation_score),
        "fluency": _round_half(acoustic_fluency),
        "lexical": _round_half(lexical),
        "grammar": _round_half(grammar),
        "semantic": _round_half(semantic),
        "word_usage": _round_half(usage),
        "content_score": _round_half(content_score)
    }


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return default


def _infer_phoneme_hints(word):
    w = (word or "").lower()
    hints = []
    if "th" in w:
        hints.append("/θ/ hoặc /ð/")
    if "r" in w:
        hints.append("/r/")
    if "l" in w:
        hints.append("/l/")
    if any(ch in w for ch in ["s", "sh", "ch"]):
        hints.append("/s/ /ʃ/ /tʃ/")
    if w.endswith("ed"):
        hints.append("đuôi -ed")
    if w.endswith("s"):
        hints.append("đuôi /s/ /z/")
    return hints[:2]


def _build_word_heatmap(transcript, audio_duration, local_hybrid, lang_quality, asr_words=None):
    if asr_words:
        base_score = _safe_float(local_hybrid.get("pronunciation", 5.0), 5.0)
        semantic_boost = (_safe_float(local_hybrid.get("semantic", 5.0), 5.0) - 5.0) * 0.2
        out = []
        for w in asr_words:
            word_text = (w.get("word", "") or "").strip()
            if not word_text:
                continue
            conf = _safe_float(w.get("confidence", 0.0), 0.0)
            conf_bonus = (conf - 0.6) * 2.2
            word_penalty = 0.0
            if len(word_text) <= 2:
                word_penalty += 0.4
            if word_text.lower() in {"um", "uh", "erm", "ah", "like"}:
                word_penalty += 1.2

            w_score = _clamp_score(base_score + semantic_boost + conf_bonus - word_penalty)
            level = "good" if w_score >= 7.0 else ("ok" if w_score >= 5.5 else "weak")
            out.append({
                "word": word_text,
                "start": round(_safe_float(w.get("start", 0.0), 0.0), 2),
                "end": round(_safe_float(w.get("end", 0.0), 0.0), 2),
                "score": round(w_score, 2),
                "level": level,
                "confidence": round(conf, 3),
                "phoneme_hints": _infer_phoneme_hints(word_text)
            })
        if out:
            return out

    words = _extract_words(transcript)
    if not words:
        return []

    duration = max(_safe_float(audio_duration, 0.0), 0.1)
    step = duration / max(len(words), 1)
    base_score = _safe_float(local_hybrid.get("pronunciation", 5.0), 5.0)
    semantic_boost = (_safe_float(local_hybrid.get("semantic", 5.0), 5.0) - 5.0) * 0.2

    heatmap = []
    for idx, w in enumerate(words):
        start = round(idx * step, 2)
        end = round((idx + 1) * step, 2)

        # Heuristic chấm từng từ để mô phỏng heatmap theo thời gian
        word_penalty = 0.0
        if len(w) <= 2:
            word_penalty += 0.5
        if w in {"um", "uh", "erm", "ah", "like"}:
            word_penalty += 1.2
        if len(w) >= 8:
            word_penalty -= 0.2

        w_score = _clamp_score(base_score + semantic_boost - word_penalty)
        if w_score >= 7.0:
            level = "good"
        elif w_score >= 5.5:
            level = "ok"
        else:
            level = "weak"

        heatmap.append({
            "word": w,
            "start": start,
            "end": end,
            "score": round(w_score, 2),
            "level": level
        })

    return heatmap


def _resample_curve(values, target_len=40):
    vals = [float(v) for v in (values or []) if v is not None]
    if not vals:
        return []
    if len(vals) == 1:
        return [vals[0]] * target_len

    out = []
    for i in range(target_len):
        pos = i * (len(vals) - 1) / max(target_len - 1, 1)
        left = int(math.floor(pos))
        right = min(left + 1, len(vals) - 1)
        alpha = pos - left
        out.append(vals[left] * (1 - alpha) + vals[right] * alpha)
    return out


def _dtw_distance(series_a, series_b):
    if not series_a or not series_b:
        return 0.0

    n, m = len(series_a), len(series_b)
    inf = float("inf")
    dp = [[inf] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0.0

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = abs(series_a[i - 1] - series_b[j - 1])
            dp[i][j] = cost + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])

    return dp[n][m] / max(n + m, 1)


def _build_pitch_overlay(user_pitch, question="", voice="en-GB-SoniaNeural", use_tts_reference=True):
    user_curve = _resample_curve(user_pitch, target_len=40)
    if not user_curve:
        return {
            "user_curve": [],
            "reference_curve": [],
            "dtw_distance": 0.0,
            "pitch_match_score": 0.0,
            "reference_source": "none"
        }

    reference_source = "synthetic"
    ref_curve = []

    if use_tts_reference and question and question.strip():
        tts_temp = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp_tts:
                tts_temp = tmp_tts.name
            run_tts_sync(question, tts_temp, voice=voice)
            tts_pitch = extract_pitch(tts_temp)
            if tts_pitch:
                ref_curve = _resample_curve(tts_pitch, target_len=len(user_curve))
                reference_source = "tts"
        except Exception as e:
            print(f"⚠️ [PITCH_OVERLAY] TTS reference failed: {e}")
        finally:
            if tts_temp and os.path.exists(tts_temp):
                try:
                    os.remove(tts_temp)
                except Exception:
                    pass

    if not ref_curve:
        avg = sum(user_curve) / len(user_curve)
        q_factor = min(len(_extract_words(question or "")) / 15.0, 1.0)
        amp = 8.0 + (q_factor * 5.0)
        for i in range(len(user_curve)):
            t = i / max(len(user_curve) - 1, 1)
            ref_curve.append(avg + amp * math.sin(2 * math.pi * t) + (amp * 0.4) * math.cos(4 * math.pi * t))

    dist = _dtw_distance(user_curve, ref_curve)
    # Dist nhỏ thì điểm match cao
    match = max(0.0, 100.0 - (dist * 3.5))

    return {
        "user_curve": [round(x, 2) for x in user_curve],
        "reference_curve": [round(x, 2) for x in ref_curve],
        "dtw_distance": round(dist, 3),
        "pitch_match_score": round(match, 2),
        "reference_source": reference_source
    }


def _build_bkt_update(overall_score, skill="speaking_overall", p_prior=0.5, p_transit=0.12, p_guess=0.2, p_slip=0.1):
    is_correct = _safe_float(overall_score, 0) >= 6.5
    p_new = RoadmapService.calculate_bkt(
        _safe_float(p_prior, 0.5),
        _safe_float(p_transit, 0.12),
        _safe_float(p_guess, 0.2),
        _safe_float(p_slip, 0.1),
        is_correct
    )
    return {
        "skill": skill,
        "is_correct": is_correct,
        "p_prior": round(_safe_float(p_prior, 0.5), 4),
        "p_new": round(_safe_float(p_new, 0.5), 4)
    }


def _sse(event_name, data):
    return f"event: {event_name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# ==========================================
# 🎛️ API: SPEAKING SCORING POLICY (ADMIN/FE)
# ==========================================
@app.route('/api/speaking/scoring-presets', methods=['GET'])
def get_speaking_scoring_presets():
    """Trả về danh sách preset + policy mặc định đã normalize."""
    try:
        profile = request.args.get('profile', 'balanced')
        resolved = _resolve_speaking_policy({"scoring_profile": profile})
        return jsonify({
            "success": True,
            "default_profile": profile,
            "available_profiles": list(SPEAKING_SCORING_PRESETS.keys()),
            "resolved_policy": resolved,
            "presets": SPEAKING_SCORING_PRESETS
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/speaking/scoring-policy/resolve', methods=['POST'])
def resolve_speaking_scoring_policy():
    """Validate + normalize policy từ JSON payload để FE preview trước khi chấm."""
    try:
        data = request.json or {}
        profile = data.get('scoring_profile', 'balanced')

        resolver_input = {
            "scoring_profile": profile,
            "pron_weight": data.get('pron_weight'),
            "content_weight": data.get('content_weight'),
            "gemini_assist_weight": data.get('gemini_assist_weight')
        }

        custom_policy = data.get('scoring_policy')
        if isinstance(custom_policy, dict):
            resolver_input["scoring_policy_json"] = json.dumps(custom_policy, ensure_ascii=False)

        resolver_input = {k: v for k, v in resolver_input.items() if v is not None}
        resolved = _resolve_speaking_policy(resolver_input)

        return jsonify({
            "success": True,
            "resolved_policy": resolved
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500




# ==========================================
# ✍️ API 1: WRITING (HYBRID ENGINE)
# ==========================================
@app.route('/api/writing/check', methods=['POST'])
def check_writing():
    try:
        data = request.json
        text = data.get('text', '')
        topic = data.get('topic', 'General Writing')
        mode = data.get('mode', 'online')
        
        if not text: return jsonify({"error": "Chưa nhập nội dung!"}), 400

        grammar_errors = check_grammar(text)
        tech_data = analyze_deep_tech(text)

        if mode == 'offline':
            result = _offline_writing_score(text, topic, grammar_errors)
            result["mistakes"] = grammar_errors[:10]
            return jsonify(result)

        # Online Mode (Gemini)
        prompt = f"""
        Role: Senior IELTS Examiner. Topic: {topic}. Text: {text}.
        Evidence: {len(grammar_errors)} errors, Flesch Reading Ease: {tech_data['math']['reading_ease']}, 
        Complex Structures (if/although/which): {tech_data['nlp']['complex_count']}.
        Output JSON in Vietnamese: overall_score, radar_chart, system_feedback, topic_vocab_suggestion, detailed_analysis, better_version.
        """
        result = gemini_service.call_gemini_json(prompt)
        if not result:
            return jsonify(_offline_writing_score(text, topic, grammar_errors))
        
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==========================================
# 🎤 API 2: SPEAKING (WHISPER + GEMINI)
# ==========================================
@app.route('/api/speaking/check', methods=['POST'])
def evaluate_speaking():
    global LAST_QUOTA_ERROR_TIME
    try:
        if 'audio' not in request.files: return jsonify({"error": "No file"}), 400
        audio_file = request.files['audio']
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        # --- SAFELY CONVERT WEBM/OPUS TO 16kHz MONO WAV FOR LIBROSA ---
        wav_path = tmp_path + ".wav"
        try:
            from pydub import AudioSegment
            AudioSegment.from_file(tmp_path).set_frame_rate(16000).set_channels(1).export(wav_path, format="wav")
            process_path = wav_path
        except Exception as e:
            print(f"⚠️ [WARNING] Pydub Conversion failed: {e}")
            process_path = tmp_path

        # 1. Chạy song song STT, Pitch và Đặc trưng âm học sâu (Pro Features)
        future_stt = executor.submit(transcribe_audio_detailed, process_path)
        future_pitch = executor.submit(extract_pitch, process_path)
        future_feats = executor.submit(extract_audio_features_pro, process_path)
        
        # 2. Đợi kết quả (Parallel Execution)
        stt_res = future_stt.result()
        transcript = stt_res.get("text", "")
        asr_words = stt_res.get("words", []) if isinstance(stt_res, dict) else []
        asr_segments = stt_res.get("segments", []) if isinstance(stt_res, dict) else []
        pitch_data = future_pitch.result()
        acoustic_feats = future_feats.result()
        audio_duration = get_audio_duration(process_path)
        
        # 3. XGBoost Physical Scoring
        physical_score = 0
        tech_evidence = "No technical evidence available."
        target_question = request.form.get("question", "") # Lấy câu hỏi mục tiêu nếu có
        policy = _resolve_speaking_policy(request.form)
        
        if speaking_model and acoustic_feats:
            df_feats = pd.DataFrame([acoustic_feats])
            physical_score = float(speaking_model.predict(df_feats)[0])
            # Tạo chuỗi bằng chứng kỹ thuật cực kỳ chi tiết cho Gemini
            tech_evidence = f"""
            - Predicted Accuracy (XGBoost): {physical_score:.2f}/9.0
            - Target Question: "{target_question}"
            - Silence Ratio: {acoustic_feats['silence_ratio']:.2f}
            - Pitch Mean: {acoustic_feats['pitch_mean']:.2f}Hz
            - Jitter (Freq Instability): {acoustic_feats['jitter']:.4f}
            - Shimmer (Amp Instability): {acoustic_feats['shimmer']:.4f}
            - Key Spectral Feature (MFCC_8): {acoustic_feats['mfcc_8']:.2f}
            """

        # 4) Local Hybrid Score (Tai + Não text-level): chống bias chỉ dựa vào lưu loát
        lang_quality = _analyze_speaking_language_quality(transcript, target_question, policy=policy)
        acoustic_fluency = _score_acoustic_fluency(acoustic_feats)
        local_hybrid = _build_hybrid_speaking_scores(
            pronunciation_score=physical_score,
            lang_quality=lang_quality,
            acoustic_fluency=acoustic_fluency,
            pron_weight=policy["pron_weight"],
            content_weight=policy["content_weight"],
            policy=policy
        )

        gemini_assist = str(request.form.get("gemini_assist", "1")).lower() in ("1", "true", "yes", "on")
        gemini_assist_meta = None
        if gemini_assist and time.time() - LAST_QUOTA_ERROR_TIME > OFFLINE_COOLDOWN:
            try:
                local_hybrid, gemini_assist_meta = _gemini_assist_language_quality(
                    transcript,
                    target_question,
                    local_hybrid,
                    lang_quality,
                    policy
                )
            except Exception as e:
                print(f"⚠️ Gemini assist scoring failed: {e}")
        word_heatmap = _build_word_heatmap(transcript, audio_duration, local_hybrid, lang_quality, asr_words=asr_words)
        pitch_overlay = _build_pitch_overlay(
            pitch_data,
            target_question,
            voice=request.form.get("voice", "en-GB-SoniaNeural"),
            use_tts_reference=str(request.form.get("use_tts_reference", "1")).lower() in ("1", "true", "yes", "on")
        )
        bkt_update = _build_bkt_update(
            local_hybrid["overall_score"],
            skill=request.form.get("skill", "speaking_overall"),
            p_prior=request.form.get("p_prior", 0.5)
        )

        # 5) Full Gemini narrative là optional, nhưng Gemini-assist score có thể chạy trước (linh hoạt)
        use_gemini = str(request.form.get("use_gemini", "0")).lower() in ("1", "true", "yes", "on")
        use_gemini_full = use_gemini or str(request.form.get("use_gemini_full", "0")).lower() in ("1", "true", "yes", "on")
        if physical_score > 0 and not use_gemini_full:
            final_score = local_hybrid["overall_score"]
            clean_temp_file(tmp_path, wav_path)
            return jsonify({
                "transcript": transcript,
                "pitch_data": pitch_data,
                "overall_score": final_score,
                "detailed_feedback": _feedback_from_policy(local_hybrid, policy),
                "radar_chart": {
                    "Fluency": local_hybrid["fluency"],
                    "Pronunciation": local_hybrid["pronunciation"],
                    "Lexical": local_hybrid["lexical"],
                    "Grammar": local_hybrid["grammar"]
                },
                "content_diagnostics": {
                    "semantic": local_hybrid["semantic"],
                    "word_usage": local_hybrid["word_usage"],
                    "word_count": lang_quality["word_count"],
                    "relevance_ratio": lang_quality["relevance_ratio"],
                    "short_answer_penalty": lang_quality["short_answer_penalty"]
                },
                "word_heatmap": word_heatmap,
                "asr_words": asr_words,
                "asr_segments": asr_segments,
                "pitch_overlay": pitch_overlay,
                "bkt_update": bkt_update,
                "scoring_policy": {
                    "profile": request.form.get("scoring_profile", "balanced"),
                    "pron_weight": round(policy["pron_weight"], 3),
                    "content_weight": round(policy["content_weight"], 3)
                },
                "gemini_assist": gemini_assist_meta,
                "source": "xgboost-hybrid-local"
            }), 200

        # 6. Gemini/Ollama full narrative (với đầy đủ bằng chứng kỹ thuật)
        prompt = f"""
        Role: Senior IELTS Speaking Examiner (Hybrid AI Tutor).
        Transcript: "{transcript[:2000]}"

        [PHYSICAL EVIDENCE FROM ACOUSTIC ANALYZER]:
        {tech_evidence}

        [LANGUAGE QUALITY EVIDENCE]:
        - Word Count: {lang_quality['word_count']}
        - Relevance Ratio: {lang_quality['relevance_ratio']:.2f}
        - Lexical Score (local): {local_hybrid['lexical']}/9.0
        - Semantic Score (local): {local_hybrid['semantic']}/9.0
        - Word Usage Score (local): {local_hybrid['word_usage']}/9.0
        - Grammar Score (local): {local_hybrid['grammar']}/9.0
        - Short Answer Penalty: {lang_quality['short_answer_penalty']:.1f}

        Instructions:
        1. Use the [PHYSICAL EVIDENCE] to provide evidence-based feedback.
        2. If Jitter/Shimmer is high, mention 'instability' or 'nervousness'.
        3. If Silence Ratio > 0.3, focus on 'Fluency and Coherence'.
        4. The final overall_score should consider the XGBoost prediction but allow for your semantic correction.

        Output JSON only (Vietnamese): 
        overall_score (0.0-9.0), 
        radar_chart (object with keys: Fluency, Pronunciation, Lexical, Grammar - values must be numbers 0-9),
        detailed_feedback (object with keys: overall_assessment, strengths, areas_for_improvement, coach_tips), 
        mistakes_timeline (list), 
        vocab_upgrade (list), 
        better_version (string).
        """

        ai_result = None
        if time.time() - LAST_QUOTA_ERROR_TIME > OFFLINE_COOLDOWN:
            ai_result = gemini_service.call_gemini_json(prompt)
            if not ai_result:
                LAST_QUOTA_ERROR_TIME = time.time()

        if not ai_result and check_ollama_status():
            ai_result = call_ollama(prompt)

        clean_temp_file(tmp_path, wav_path)

        if ai_result:
            ai_score = ai_result.get("overall_score", local_hybrid["overall_score"])
            try:
                ai_score = float(ai_score)
            except Exception:
                ai_score = float(local_hybrid["overall_score"])


            fused_score = _round_half((ai_score * 0.55) + (local_hybrid["overall_score"] * 0.45))
            ai_result["overall_score"] = fused_score
            ai_result["local_hybrid"] = local_hybrid
            ai_result["content_diagnostics"] = {
                "word_count": lang_quality["word_count"],
                "relevance_ratio": lang_quality["relevance_ratio"],
                "short_answer_penalty": lang_quality["short_answer_penalty"]
            }
            ai_result["pitch_data"] = pitch_data
            ai_result["word_heatmap"] = word_heatmap
            ai_result["asr_words"] = asr_words
            ai_result["asr_segments"] = asr_segments
            ai_result["pitch_overlay"] = pitch_overlay
            ai_result["bkt_update"] = bkt_update
            ai_result["gemini_assist"] = gemini_assist_meta
            ai_result["scoring_policy"] = {
                "profile": request.form.get("scoring_profile", "balanced"),
                "pron_weight": round(policy["pron_weight"], 3),
                "content_weight": round(policy["content_weight"], 3)
            }
            ai_result["source"] = "hybrid-fused"
            return jsonify(ai_result), 200
        
        # Fallback cuối cùng nếu cả 2 đều lỗi
        final_score = local_hybrid["overall_score"] if physical_score > 0 else 5.0
        return jsonify({
            "transcript": transcript, 
            "pitch_data": pitch_data,
            "overall_score": final_score,
            "detailed_feedback": (
                f"Gemini đang quá tải. Đã fallback sang hybrid local với điểm {final_score}/9.0 "
                f"(Phát âm {local_hybrid['pronunciation']}, Nội dung {local_hybrid['content_score']})."
            ),
            "radar_chart": {
                "Fluency": local_hybrid["fluency"],
                "Pronunciation": local_hybrid["pronunciation"],
                "Lexical": local_hybrid["lexical"],
                "Grammar": local_hybrid["grammar"]
            },
            "content_diagnostics": {
                "semantic": local_hybrid["semantic"],
                "word_usage": local_hybrid["word_usage"],
                "word_count": lang_quality["word_count"],
                "relevance_ratio": lang_quality["relevance_ratio"],
                "short_answer_penalty": lang_quality["short_answer_penalty"]
            },
            "word_heatmap": word_heatmap,
            "asr_words": asr_words,
            "asr_segments": asr_segments,
            "pitch_overlay": pitch_overlay,
            "bkt_update": bkt_update,
            "gemini_assist": gemini_assist_meta,
            "scoring_policy": {
                "profile": request.form.get("scoring_profile", "balanced"),
                "pron_weight": round(policy["pron_weight"], 3),
                "content_weight": round(policy["content_weight"], 3)
            },
            "source": "xgboost-fallback"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/speaking/check-stream', methods=['POST'])
def evaluate_speaking_stream():
    global LAST_QUOTA_ERROR_TIME
    if 'audio' not in request.files:
        return jsonify({"error": "No file"}), 400

    audio_file = request.files['audio']
    target_question = request.form.get("question", "")
    force_gemini = str(request.form.get("use_gemini", "1")).lower() in ("1", "true", "yes", "on")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    wav_path = tmp_path + ".wav"
    process_path = tmp_path
    try:
        AudioSegment.from_file(tmp_path).set_frame_rate(16000).set_channels(1).export(wav_path, format="wav")
        process_path = wav_path
    except Exception as e:
        print(f"⚠️ [STREAM] Convert failed: {e}")

    def generate_events():
        global LAST_QUOTA_ERROR_TIME
        try:
            # Stage 1: local analysis (nhanh)
            stt_res = transcribe_audio_detailed(process_path)
            transcript = stt_res.get("text", "")
            asr_words = stt_res.get("words", []) if isinstance(stt_res, dict) else []
            asr_segments = stt_res.get("segments", []) if isinstance(stt_res, dict) else []
            pitch_data = extract_pitch(process_path)
            acoustic_feats = extract_audio_features_pro(process_path)
            audio_duration = get_audio_duration(process_path)
            policy = _resolve_speaking_policy(request.form)

            physical_score = 0.0
            if speaking_model and acoustic_feats:
                physical_score = float(speaking_model.predict(pd.DataFrame([acoustic_feats]))[0])

            lang_quality = _analyze_speaking_language_quality(transcript, target_question, policy=policy)
            local_hybrid = _build_hybrid_speaking_scores(
                pronunciation_score=physical_score,
                lang_quality=lang_quality,
                acoustic_fluency=_score_acoustic_fluency(acoustic_feats),
                pron_weight=policy["pron_weight"],
                content_weight=policy["content_weight"],
                policy=policy
            )

            gemini_assist_meta = None
            gemini_assist = str(request.form.get("gemini_assist", "1")).lower() in ("1", "true", "yes", "on")
            if gemini_assist and time.time() - LAST_QUOTA_ERROR_TIME > OFFLINE_COOLDOWN:
                local_hybrid, gemini_assist_meta = _gemini_assist_language_quality(
                    transcript,
                    target_question,
                    local_hybrid,
                    lang_quality,
                    policy
                )

            quick_payload = {
                "stage": "quick",
                "transcript": transcript,
                "overall_score": local_hybrid["overall_score"],
                "scores": local_hybrid,
                "radar_chart": {
                    "Fluency": local_hybrid.get("fluency", 5.0),
                    "Pronunciation": local_hybrid.get("pronunciation", 5.0),
                    "Lexical": local_hybrid.get("lexical", 5.0),
                    "Grammar": local_hybrid.get("grammar", 5.0)
                },
                "scoring_policy": {
                    "profile": request.form.get("scoring_profile", "balanced"),
                    "pron_weight": round(policy["pron_weight"], 3),
                    "content_weight": round(policy["content_weight"], 3)
                },
                "gemini_assist": gemini_assist_meta,
                "content_diagnostics": {
                    "word_count": lang_quality["word_count"],
                    "relevance_ratio": lang_quality["relevance_ratio"],
                    "short_answer_penalty": lang_quality["short_answer_penalty"]
                },
                "word_heatmap": _build_word_heatmap(transcript, audio_duration, local_hybrid, lang_quality, asr_words=asr_words),
                "asr_words": asr_words,
                "asr_segments": asr_segments,
                "pitch_overlay": _build_pitch_overlay(
                    pitch_data,
                    target_question,
                    voice=request.form.get("voice", "en-GB-SoniaNeural"),
                    use_tts_reference=str(request.form.get("use_tts_reference", "1")).lower() in ("1", "true", "yes", "on")
                ),
                "bkt_update": _build_bkt_update(
                    local_hybrid["overall_score"],
                    skill=request.form.get("skill", "speaking_overall"),
                    p_prior=request.form.get("p_prior", 0.5)
                )
            }
            yield _sse("quick_score", quick_payload)

            # Stage 2: deep analysis (Gemini/Ollama)
            if not force_gemini:
                yield _sse("done", {"source": "xgboost-hybrid-local", "overall_score": local_hybrid["overall_score"]})
                return

            prompt = f"""
            Role: Senior IELTS Speaking Examiner (Hybrid AI Tutor).
            Transcript: "{transcript}"
            Target Question: "{target_question}"
            Local Hybrid Score: {local_hybrid['overall_score']}/9
            Give deep feedback in Vietnamese with JSON keys:
            overall_score (0.0-9.0),
            detailed_feedback (object with keys: overall_assessment, strengths, areas_for_improvement, coach_tips),
            radar_chart (object with keys: Fluency, Lexical, Grammar, Pronunciation - values must be numbers 0-9),
            vocab_upgrade (list),
            better_version (string).
            """

            ai_result = None
            if time.time() - LAST_QUOTA_ERROR_TIME > OFFLINE_COOLDOWN:
                ai_result = gemini_service.call_gemini_json(prompt)
                if not ai_result:
                    LAST_QUOTA_ERROR_TIME = time.time()

            if not ai_result and check_ollama_status():
                ai_result = call_ollama(prompt)

            if ai_result:
                try:
                    ai_score = float(ai_result.get("overall_score", local_hybrid["overall_score"]))
                except Exception:
                    ai_score = float(local_hybrid["overall_score"])

                fused_score = _round_half((ai_score * 0.55) + (local_hybrid["overall_score"] * 0.45))
                ai_result["overall_score"] = fused_score
                ai_result["source"] = "hybrid-fused-stream"
                yield _sse("deep_analysis", ai_result)
            else:
                yield _sse("deep_analysis", {
                    "overall_score": local_hybrid["overall_score"],
                    "detailed_feedback": "Không lấy được Gemini/Ollama, giữ kết quả local.",
                    "source": "xgboost-hybrid-local"
                })

            yield _sse("done", {"ok": True})
        except Exception as e:
            yield _sse("error", {"error": str(e)})
        finally:
            clean_temp_file(tmp_path, wav_path)

    return Response(stream_with_context(generate_events()), mimetype='text/event-stream')

# Endpoint mới đồng bộ với Node Controller SpeakingPractice.js (Luyện tập theo Topic - CHỈ DÙNG XGBOOST)
@app.route('/api/speaking-practice/evaluate', methods=['POST'])
def evaluate_speaking_practice():
    try:
        if 'audio' not in request.files: return jsonify({"error": "No audio file provided"}), 400
        audio_file = request.files['audio']
        question = request.form.get('question', 'General Speaking')
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        # --- SAFELY CONVERT WEBM/OPUS TO 16kHz MONO WAV FOR LIBROSA ---
        wav_path = tmp_path + ".wav"
        try:
            from pydub import AudioSegment
            AudioSegment.from_file(tmp_path).set_frame_rate(16000).set_channels(1).export(wav_path, format="wav")
            process_path = wav_path
        except Exception as e:
            print(f"⚠️ [WARNING] Pydub Conversion failed: {e}")
            process_path = tmp_path

        # 1. Chạy song song STT, Pitch và Acoustic Features
        future_stt = executor.submit(transcribe_audio_detailed, process_path)
        future_pitch = executor.submit(extract_pitch, process_path)
        future_feats = executor.submit(extract_audio_features_pro, process_path)
        
        stt_res = future_stt.result()
        transcript = stt_res.get("text", "")
        asr_words = stt_res.get("words", []) if isinstance(stt_res, dict) else []
        asr_segments = stt_res.get("segments", []) if isinstance(stt_res, dict) else []
        pitch_data = future_pitch.result()
        acoustic_feats = future_feats.result()
        audio_duration = get_audio_duration(process_path)
        policy = _resolve_speaking_policy(request.form)
        
        # 2. XGBoost + Language Scoring (Offline Hybrid)
        overall_score = 5.0
        pron_score = 5.0
        feedback_msg = "Không thể chấm điểm vật lý, trả về điểm mặc định."
        gemini_assist_meta = None
        
        if speaking_model and acoustic_feats:
            df_feats = pd.DataFrame([acoustic_feats])
            pron_score = float(speaking_model.predict(df_feats)[0])
            lang_quality = _analyze_speaking_language_quality(transcript, question, policy=policy)
            acoustic_fluency = _score_acoustic_fluency(acoustic_feats)
            local_hybrid = _build_hybrid_speaking_scores(
                pron_score,
                lang_quality,
                acoustic_fluency,
                pron_weight=policy["pron_weight"],
                content_weight=policy["content_weight"],
                policy=policy
            )

            gemini_assist = str(request.form.get("gemini_assist", "1")).lower() in ("1", "true", "yes", "on")
            if gemini_assist and time.time() - LAST_QUOTA_ERROR_TIME > OFFLINE_COOLDOWN:
                try:
                    local_hybrid, gemini_assist_meta = _gemini_assist_language_quality(
                        transcript,
                        question,
                        local_hybrid,
                        lang_quality,
                        policy
                    )
                except Exception as e:
                    print(f"⚠️ SpeakingPractice gemini-assist failed: {e}")

            overall_score = local_hybrid["overall_score"]
            feedback_msg = _feedback_from_policy(local_hybrid, policy)
        else:
            lang_quality = _analyze_speaking_language_quality(transcript, question, policy=policy)
            local_hybrid = _build_hybrid_speaking_scores(
                5.0,
                lang_quality,
                5.0,
                pron_weight=policy["pron_weight"],
                content_weight=policy["content_weight"],
                policy=policy
            )
            feedback_msg = _feedback_from_policy(local_hybrid, policy)

        word_heatmap = _build_word_heatmap(transcript, audio_duration, local_hybrid, lang_quality, asr_words=asr_words)
        pitch_overlay = _build_pitch_overlay(
            pitch_data,
            question,
            voice=request.form.get("voice", "en-GB-SoniaNeural"),
            use_tts_reference=str(request.form.get("use_tts_reference", "1")).lower() in ("1", "true", "yes", "on")
        )
        bkt_update = _build_bkt_update(
            local_hybrid["overall_score"],
            skill=request.form.get("skill", "speaking_overall"),
            p_prior=request.form.get("p_prior", 0.5)
        )

        clean_temp_file(tmp_path, wav_path)

        # Trả về format đồng bộ với Frontend SpeakingPractice.jsx
        return jsonify({
            "scores": {
                "overall": round(overall_score, 1),
                "fluency": round(local_hybrid["fluency"], 1),
                "pronunciation": round(local_hybrid["pronunciation"], 1),
                "lexical": round(local_hybrid["lexical"], 1),
                "grammar": round(local_hybrid["grammar"], 1),
                "semantic": round(local_hybrid["semantic"], 1),
                "word_usage": round(local_hybrid["word_usage"], 1)
            },
            "feedback": {
                "overall": feedback_msg,
                "pronunciation": f"Điểm phát âm dựa trên phân tích âm phổ: {local_hybrid['pronunciation']:.1f}",
                "fluency": f"Độ trôi chảy (từ silence/jitter/shimmer): {local_hybrid['fluency']:.1f}",
                "lexical": f"Vốn từ và độ đa dạng từ: {local_hybrid['lexical']:.1f}",
                "grammar": f"Độ chính xác cấu trúc: {local_hybrid['grammar']:.1f}",
                "semantic": f"Độ liên quan nội dung với câu hỏi: {local_hybrid['semantic']:.1f}",
                "word_usage": f"Cách dùng từ & từ nối: {local_hybrid['word_usage']:.1f}"
            },
            "transcript": transcript,
            "pitch_data": pitch_data,
            "content_diagnostics": {
                "word_count": lang_quality.get("word_count", 0),
                "relevance_ratio": lang_quality.get("relevance_ratio", 0),
                "short_answer_penalty": lang_quality.get("short_answer_penalty", 0)
            },
            "word_heatmap": word_heatmap,
            "asr_words": asr_words,
            "asr_segments": asr_segments,
            "pitch_overlay": pitch_overlay,
            "bkt_update": bkt_update,
            "gemini_assist": gemini_assist_meta,
            "scoring_policy": {
                "profile": request.form.get("scoring_profile", "balanced"),
                "pron_weight": round(policy["pron_weight"], 3),
                "content_weight": round(policy["content_weight"], 3)
            },
            "encouragement": "Tiếp tục luyện tập nhé! Bạn đang tiến bộ mỗi ngày. 🔥",
            "source": "xgboost-hybrid-local"
        }), 200
        
    except Exception as e:
        print(f"❌ Speaking Practice Evaluate Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/speaking/conversation', methods=['POST'])
def conversation():
    try:
        audio_file = request.files['audio']
        history_str = request.form.get('history', '[]') 
        voice_id = request.form.get('voice', 'en-GB-SoniaNeural') # Lấy giọng nói từ FE
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        # 1. Chạy song song STT và Pitch
        future_stt = executor.submit(transcribe_audio, tmp_path)
        future_pitch = executor.submit(extract_pitch, tmp_path)
        
        # 2. Đợi STT xong (Nhanh với Faster-Whisper)
        stt_res = future_stt.result()
        user_text = stt_res.get("text", "")
        
        # 3. CHIẾN THUẬT "STREAMING & PARALLEL TTS": Tối ưu tốc độ phản hồi
        now = time.time()
        ai_response_text = ""
        correction_tip = ""
        global LAST_QUOTA_ERROR_TIME
        
        # 3. QUẢN LÝ NGỮ CẢNH THÔNG MINH (Lấy 5 tin nhắn gần nhất)
        try:
            full_history = json.loads(history_str)
            # Chỉ lấy 5 lượt hội thoại gần nhất để nhất quán nhưng vẫn đủ sâu
            recent_history = full_history[-5:] if len(full_history) > 5 else full_history
            history_window = json.dumps(recent_history, ensure_ascii=False)
        except:
            history_window = history_str[-2000:] # Fallback
        
        async def handle_ai_speaking():
            global LAST_QUOTA_ERROR_TIME
            nonlocal ai_response_text
            full_text = ""
            audio_segments = []
            sentence_buffer = ""
            tts_tasks = []
            
            # --- RAG: Tìm kiếm kiến thức bổ trợ ---
            knowledge_hints = ""
            rag_res = vector_service.query_knowledge(user_text, n_results=2)
            if rag_res and rag_res['documents']:
                knowledge_hints = "\nRelevant IELTS Examples/Vocab:\n" + "\n".join(rag_res['documents'][0])
                # Thêm cả các đáp án mẫu từ metadata nếu có
                for meta in rag_res['metadatas'][0]:
                    if meta.get('answer'):
                        knowledge_hints += f"\nNote: {meta['answer'][:500]}"
            
            # --- PHASE 1: Thử Gemini ---
            use_ollama = True
            if now - LAST_QUOTA_ERROR_TIME > OFFLINE_COOLDOWN:
                try:
                    prompt = f"""
                    Role: Friendly IELTS Speaking Examiner. 
                    History: {history_window}
                    Candidate said: "{user_text}"
                    Instruction: 
                    - If this is the start (Part 1), be very gentle. 
                    - Ask ONLY one simple individual question. 
                    - Do not overwhelm the candidate.
                    - Respond naturally and encouragingly.
                    - Use the provided context/knowledge to suggest advanced vocabulary if applicable.
                    {knowledge_hints}
                    Text only, no JSON.
                    """
                    stream_gen = gemini_service.call_gemini_stream(prompt)
                    
                    gemini_success = False
                    for chunk in stream_gen:
                        if chunk:
                            gemini_success = True
                            full_text += chunk
                            sentence_buffer += chunk
                            
                            if any(p in sentence_buffer for p in ['. ', '? ', '! ', '\n']):
                                parts = _re.split(r'(?<=[.?!])\s+|\n', sentence_buffer)
                                for i in range(len(parts) - 1):
                                    s = parts[i].strip()
                                    if s and len(s) > 2:
                                        chunk_path = os.path.join("static", f"chunk_{uuid.uuid4()}.mp3")
                                        audio_segments.append(chunk_path)
                                        tts_tasks.append(generate_audio_edge(s, chunk_path, voice=voice_id))
                                sentence_buffer = parts[-1]
                    
                    if gemini_success:
                        use_ollama = False
                    else:
                        LAST_QUOTA_ERROR_TIME = time.time()
                except Exception as e:
                    print(f"⚠️ Gemini Catch-all Error: {e}")
                    LAST_QUOTA_ERROR_TIME = time.time()

            # --- PHASE 2: Fallback sang Ollama (nếu Gemini fail hoặc đang cooldown) ---
            if use_ollama:
                if check_ollama_status():
                    print("🛡️ [AUTO FALLBACK] Gemini failed. Switching to Ollama for current request.")
                    # Profile cho AI Local (Cần ngắn gọn, súc tích hơn)
                    ollama_prompt = f"""
                    Role: Friendly and Patient IELTS Examiner. 
                    Context: {history_window[-1000:]}
                    Candidate said: "{user_text}"
                    Instruction: 
                    - Be very gentle and encouraging.
                    - Respond briefly and ask ONLY ONE simple next question.
                    - Focus on Part 1 style (simple personal questions).
                    - Knowledge Hints: {knowledge_hints}
                    """
                    stream_gen = call_ollama_stream(ollama_prompt)
                    for chunk in stream_gen:
                        if chunk:
                            full_text += chunk
                            sentence_buffer += chunk
                            if any(p in sentence_buffer for p in ['. ', '? ', '! ', '\n']):
                                parts = _re.split(r'(?<=[.?!])\s+|\n', sentence_buffer)
                                for i in range(len(parts) - 1):
                                    s = parts[i].strip()
                                    if s and len(s) > 2:
                                        chunk_path = os.path.join("static", f"chunk_{uuid.uuid4()}.mp3")
                                        audio_segments.append(chunk_path)
                                        tts_tasks.append(generate_audio_edge(s, chunk_path, voice=voice_id))
                                sentence_buffer = parts[-1]

            # Xử lý đoạn văn cuối cùng
            if sentence_buffer.strip():
                chunk_path = os.path.join("static", f"chunk_{uuid.uuid4()}.mp3")
                audio_segments.append(chunk_path)
                tts_tasks.append(generate_audio_edge(sentence_buffer.strip(), chunk_path, voice=voice_id))

            if tts_tasks:
                try:
                    await asyncio.gather(*tts_tasks)
                except Exception as e:
                    print(f"⚠️ Async TTS Gather Error: {e}")
            
            ai_response_text = full_text.strip()
            return audio_segments

        # Chạy logic Async an toàn trong Flask / Thread
        try:
            # Sử dụng asyncio.run cho gọn gàng và tự động dọn dẹp loop
            audio_paths = asyncio.run(handle_ai_speaking())
        except Exception as e:
            print(f"❌ AI Speaking Async Critical Error: {e}")
            # Fallback nếu toàn bộ luồng async sập
            ai_response_text = random.choice(FALLBACK_QUESTIONS) if not ai_response_text else ai_response_text
            audio_paths = []

        # 4. GHÉP AUDIO & TRẢ VỀ JSON
        final_filename = f"ai_ask_{uuid.uuid4()}.mp3"
        final_path = os.path.join("static", final_filename)
        os.makedirs("static", exist_ok=True)

        if audio_paths:
            try:
                combined = AudioSegment.empty()
                for p in audio_paths:
                    if os.path.exists(p):
                        combined += AudioSegment.from_file(p)
                        os.remove(p)
                combined.export(final_path, format="mp3")
            except Exception as e:
                print(f"⚠️ Merge Audio Error: {e}")
                run_tts_sync(ai_response_text, final_path, voice=voice_id)
        else:
            run_tts_sync(ai_response_text, final_path, voice=voice_id)

        # 5. Phân tích ngữ pháp (Correction Tip)
        errors = check_grammar(user_text)
        if errors:
            correction_tip = f"Tip: {errors[0]['error']}. Instead of '{errors[0]['word']}', try '{errors[0]['fix']}'."

        # Lấy Pitch data (đã chạy song song từ đầu)
        pitch_data = future_pitch.result()
        
        # --- Feature Extraction (The "Eyes") ---
        fluency_stats = analytic_service.extract_fluency_features(tmp_path)
        lexical_stats = analytic_service.extract_lexical_features(user_text)

        return jsonify({
            "user_transcript": user_text,
            "ai_response_text": ai_response_text,
            "ai_audio_url": f"{request.host_url}static/{final_filename}",
            "correction": correction_tip,
            "pitch_data": pitch_data,
            "analytics": {
                "fluency": fluency_stats,
                "lexical": lexical_stats
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        # Đảm bảo dọn dẹp file tạm dù có lỗi hay không
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            clean_temp_file(tmp_path)

# ==========================================
# 🤖 API 4: AGENTIC CONTENT ENGINE
# ==========================================
@app.route('/api/agentic/generate-reading', methods=['POST'])
def agentic_generate_reading():
    # ... Simplified for brief demo, can keep full logic if needed ...
    data = request.json
    prompt = f"Generate IELTS Reading passage about {data.get('topic')}. CEFR: {data.get('cefr_level')}. Word count: {data.get('wordCount')}. JSON output: title, passage."
    result = gemini_service.call_gemini_json(prompt)
    return jsonify(result), 200

@app.route('/api/speaking/start', methods=['GET', 'POST'])
def start_conversation():
    """AI chủ động chào hỏi theo chuẩn IELTS chuyên nghiệp (Có Cache theo Voice ID)"""
    global GREETING_CACHE
    try:
        # 0. Lấy Voice ID từ request
        voice_id = request.args.get('voice', 'en-GB-SoniaNeural')
        
        # 1. Kiểm tra Cache cho voice này
        now = time.time()
        cache = GREETING_CACHE.get(voice_id)
        if cache and now < cache["expires_at"]:
            print(f"💡 [CACHE HIT] Sử dụng câu chào ({voice_id}) từ bộ nhớ đệm.")
            return jsonify({
                "text": cache["text"],
                "audio_url": cache["audio_url"]
            }), 200

        prompt = """
        Role: Friendly and Encouraging IELTS Speaking Examiner. 
        Action: Start a new Speaking Mock Test with a gentle approach.
        Guidelines:
        1. Greet the candidate very warmly (e.g., 'Hello! It's nice to meet you.').
        2. Briefly introduce yourself (e.g., 'I'm Alex, and I'll be your examiner today.').
        3. Ask ONLY ONE simple question to start (e.g., 'First of all, could you tell me your full name, please?').
        4. Do NOT ask multiple questions at once. Keep it simple and welcoming.
        Respond in JSON: examiner_text.
        Language: English.
        """

        # KIẾN TRÚC FINAL: Task cơ bản (Chào hỏi) -> Ưu tiên Ollama (Local) trước để tiết kiệm Quota
        data = None
        if check_ollama_status():
            print("🏠 [FINAL ARCH] Task cơ bản: Ưu tiên sử dụng Ollama cho lời chào...")
            data = call_ollama(prompt)
        
        if not data:
            print("🌐 [FINAL ARCH] Ollama không sẵn sàng hoặc lỗi, chuyển sang Gemini...")
            data = gemini_service.call_gemini_json(prompt)

        
        if not data: 
            # Tầng cuối cùng: Offline Fallback
            print("🛡️ [FINAL ARCH] Tất cả AI đều bận, sử dụng bộ mẫu chuẩn Offline.")
            text = "Good day! My name is Alex, and I'll be your examiner for this test today. First, could you tell me your full name, please? Also, to start with, I'd like to ask you some questions about your hometown. Where do you come from?"
        else:
            text = data.get("examiner_text", "")



        filename = f"ai_start_{uuid.uuid4()}.mp3"
        filepath = os.path.join("static", filename)
        os.makedirs("static", exist_ok=True)
        
        run_tts_sync(text, filepath, voice=voice_id)
        audio_url = f"{request.host_url}static/{filename}"

        # 2. Cập nhật Cache cho giọng này
        GREETING_CACHE[voice_id] = {
            "text": text,
            "audio_url": audio_url,
            "expires_at": now + 21600 # 6 hours
        }
        
        return jsonify({
            "text": text,
            "audio_url": audio_url
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==========================================
# ✍️ API 5: WRITING PRO (THE 4-STAGE PIPELINE)
# ==========================================
# --- HELPER: Background Processor ---
def background_evaluate_task(task_id, text, task_type, topic):
    try:
        WRITING_TASKS[task_id] = {"status": "processing", "progress": 10}

        # BƯỚC 1: Preprocessing (bắt buộc chạy trước để lấy sentences + stats)
        analysis = writing_service.preprocess(text)
        WRITING_TASKS[task_id]["progress"] = 30

        # BƯỚC 2 & 3: Chạy song song NLI + Gemini
        # - NLI cần `analysis["sentences"]` (đã sẵn sàng)
        # - Gemini cần `analysis["stats"]` và `analysis["sentences"]` (đã sẵn sàng)
        # - NLI và Gemini KHÔNG phụ thuộc vào nhau nên có thể chạy đồng thời
        future_nli = executor.submit(
            writing_service.analyze_cohesion_nli,
            analysis["sentences"]
        )
        future_gemini = executor.submit(
            gemini_service.evaluate_writing_pro,
            text, task_type, topic,
            {"stats": analysis["stats"], "sentences": analysis["sentences"], "cohesion": {}}
        )

        WRITING_TASKS[task_id]["progress"] = 50

        # Đợi cả 2 hoàn thành
        cohesion_analysis = future_nli.result()
        ai_eyes = future_gemini.result()

        WRITING_TASKS[task_id]["progress"] = 80

        if not ai_eyes:
            ai_eyes = {
                "task_response": {"relevance_score": 5.0},
                "highlights": [],
                "detailed_feedback": "AI đang bận, vui lòng thử lại sau."
            }

        # BƯỚC 4: Final Scoring (Weighted Consensus - nhanh, local)
        final_result = writing_service.calculate_final_score(
            {
                "stats": analysis["stats"],
                "cohesion": cohesion_analysis,
                "discourse_markers": analysis["discourse_markers"],
                "collocation_errors": analysis.get("collocation_errors", [])
            },
            ai_eyes
        )

        # Merge Collocation Errors vào Highlights
        if "highlights" not in ai_eyes:
            ai_eyes["highlights"] = []
        for coll_err in analysis.get("collocation_errors", []):
            ai_eyes["highlights"].append({
                "original_text": coll_err["error"],
                "suggestion": coll_err["suggestion"],
                "explanation": f"Lỗi Collocation: '{coll_err['error']}' không tự nhiên.",
                "category": "vocab"
            })

        # BƯỚC 5: Post-processing (tính offset cho highlights)
        refined_highlights = []
        for h in ai_eyes.get("highlights", []):
            orig = h.get("original_text", "")
            if orig and orig in text:
                start = text.find(orig)
                refined_highlights.append({**h, "start": start, "end": start + len(orig)})
            else:
                refined_highlights.append(h)

        # BƯỚC 6: Lưu kết quả
        WRITING_TASKS[task_id].update({
            "status": "completed",
            "progress": 100,
            "result": {
                "sentences": analysis["sentences"],
                "discourse_markers": analysis["discourse_markers"],
                "cohesion": cohesion_analysis,
                "ai_eyes": ai_eyes,
                "highlights": refined_highlights,
                "scoring": final_result
            }
        })
    except Exception as e:
        print(f"❌ Background Task Error: {e}")
        WRITING_TASKS[task_id] = {"status": "failed", "error": str(e)}


# ==========================================
# 🎤 API: HYBRID SPEAKING EVALUATION (NEW)
# ==========================================
# Hybrid = XGBoost Acoustic + Gemini Feedback

@app.route('/api/speaking/evaluate-hybrid', methods=['POST'])
def evaluate_speaking_hybrid_api():
    """
    Enhanced Speaking Evaluation using Hybrid Model
    XGBoost Physical Scoring + Gemini AI Feedback
    """
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400
        
        audio_file = request.files['audio']
        transcript = request.form.get('transcript', '')
        question = request.form.get('question', '')
        
        # Save temp audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name
        
        # Convert to WAV if needed
        try:
            audio = AudioSegment.from_file(tmp_path)
            wav_path = tmp_path.replace(".webm", ".wav")
            audio.export(wav_path, format="wav")
        except:
            wav_path = tmp_path
        
        # 🎼 HYBRID EVALUATION
        hybrid_result = evaluate_speaking_hybrid(
            audio_path=wav_path,
            transcript=transcript,
            target_question=question,
            gemini_service=gemini_service
        )
        
        # Format for frontend
        response = format_speaking_response(hybrid_result)
        
        # Cleanup
        clean_temp_file(tmp_path, wav_path)
        
        return jsonify(response), 200
        
    except Exception as e:
        print(f"❌ Hybrid Speaking Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/api/ai/writing/evaluate', methods=['POST'])
def evaluate_writing_pro():
    data = request.json
    text = data.get('text', '')
    topic = data.get('topic', '')
    
    if not text: return jsonify({"error": "No text"}), 400
    
    task_id = str(uuid.uuid4())
    task_type = data.get('task_type', 'task2') # Mặc định là task2
    WRITING_TASKS[task_id] = {"status": "pending", "progress": 0}
    
    # GỬI KÈM ĐỦ 4 THAM SỐ (Fix Error)
    executor.submit(background_evaluate_task, task_id, text, task_type, topic)
    
    return jsonify({"task_id": task_id, "status": "accepted"}), 202

@app.route('/api/ai/writing/status/<task_id>', methods=['GET'])
def get_writing_status(task_id):
    task = WRITING_TASKS.get(task_id)
    if not task: return jsonify({"error": "Task not found"}), 404
    return jsonify(task)

@app.route('/api/ai/writing/model-essay', methods=['POST'])
def generate_model_essay():
    data = request.json
    topic = data.get('topic', '')
    essay = data.get('essay', '') 
    
    # --- 1. GOLD STANDARDS (BAND 9.0 BENCHMARKS + DYNAMIC BALANCE) ---
    GOLD_STANDARDS = {
        "mlt": 22.0,      # Sentence maturity target
        "mtld": 100.0,    # Lexical diversity target
        "complex_ratio": 0.65, 
        "inversions": 2,  
        "passives": 4,     # Reduced slightly for more active, direct voice
        "natural_flow": "High",
        "tone": "Sophisticated yet Academic",
        "syntactic_variety": "Dynamic Mix of short & long", # New
        "collocation_density": "High (Natural > Obscure)"     # New
    }
    
    # --- 2. GAP ANALYSIS (LOCAL NLP LAYER) ---
    user_stats = {"mlt": 0, "mtld": 0, "complex_ratio": 0, "inversions": 0, "passives": 0}
    
    if essay.strip():
        try:
            analysis = writing_service.preprocess(essay)
            stats = analysis.get('stats', {})
            user_stats = {
                "mlt": stats.get('mlt_index', 0),
                "mtld": stats.get('mtld_diversity', 0),
                "complex_ratio": stats.get('complex_sentence_ratio', 0),
                "inversions": stats.get('structures', {}).get('INVERSION', 0),
                "passives": stats.get('structures', {}).get('PASSIVE_VOICE', 0)
            }
        except Exception as e:
            print(f"⚠️ Gap Analysis failed: {e}. Using baseline.")

    # --- 3. DYNAMIC CONSTRAINT-BASED PROMPT (PARAMETER INJECTION + HUMAN NUANCE) ---
    prompt = f"""
    [OBJECTIVE: HIGH-PRECISION BAND 9.0 ESSAY GENERATION - HUMAN-LIKE UPGRADE]
    You are a Senior Cambridge IELTS Professor. Your task is to generate a Band 9.0 Model Essay that sounds authoritative yet natural. 
    You must bridge the gap between the User's current stats and the technical Gold Standards, while maintaining a 'Dynamic Balance'.

    Topic: "{topic}"
    User's Initial Draft Context (if any): "{essay}"

    [TECHNICAL PARAMETERS & GAP ANALYSIS]:
    1. SENTENCE MATURITY (MLT): 
       - Current: {user_stats['mlt']} -> Target: > {GOLD_STANDARDS['mlt']}
       - REQ: Mix sophisticated multi-clause structures with punchy short sentences for impact and breathing room.

    2. LEXICAL DIVERSITY (MTLD): 
       - Current: {user_stats['mtld']} -> Target: > {GOLD_STANDARDS['mtld']}
       - REQ: Prioritize 'Natural Academic Collocations' (e.g., 'play a pivotal role', 'at the very heart of the matter') over obscure single 'big words'.

    3. GRAMMATICAL SOPHISTICATION:
       - Complex Ratio: {user_stats['complex_ratio']*100}% -> Target: > {GOLD_STANDARDS['complex_ratio']*100}%
       - Inversions: {user_stats['inversions']} -> Target: {GOLD_STANDARDS['inversions']} (e.g., 'Not only...', 'Seldom...').
       - Passive Voice: {user_stats['passives']} -> Use for objective distance, but maintain active voice for clarity.

    [STYLISTIC GUIDELINES - CRITICAL FOR NATURAL FLOW]:
    - AVOID ROBOTIC TONE: Do not just string high-level vocabulary together. Ensure semantic cohesion using reference words (this, these, such developments).
    - RHYTHM: Create a 'flow'. Use varied sentence openings. Avoid starts like 'Moreover,' or 'Furthermore,' at the beginning of every paragraph.
    - HEDGING & NUANCE: Acknowledge complexity. Use professional hedging like 'arguably', 'to some extent', or 'it is perhaps more accurate to suggest...'.
    - TONE: Sophisticated, intellectual, yet readable. Avoid 'machine-sounding' overly-formal phrases.

    [OUTPUT]: Output the essay ONLY. High-quality Band 9.0 that would impress a human examiner.
    """
    
    # Stream the high-precision response
    def generate():
        for chunk in gemini_service.call_gemini_stream(prompt):
            if chunk: yield chunk
            
    return app.response_class(generate(), mimetype='text/plain')


if __name__ == '__main__':
    import atexit

    # Dọn dẹp LanguageTool khi tắt server (tránh WinError 10038 socket leak)
    def _cleanup_languagetool():
        try:
            from services.nlp_service import tool as lt_tool
            if lt_tool and lt_tool is not False:
                lt_tool.close()
                print("✅ LanguageTool đã được đóng sạch.")
        except Exception:
            pass
    atexit.register(_cleanup_languagetool)

    # threaded=True: Mỗi request chạy trên 1 thread riêng → không bị block lẫn nhau
    # use_reloader=False: Tắt Werkzeug auto-reloader trên Windows (gây WinError 10038)
    # debug=False: Tắt debug mode để Flask dùng production threading model
    print("🚀 Flask AI Server đang khởi động (Multi-threaded mode)...")
    app.run(
        port=5000,
        debug=False,
        threaded=True,
        use_reloader=False
    )