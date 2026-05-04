"""
🎤 HYBRID SPEAKING EVALUATION SERVICE
=====================================
Kết hợp XGBoost Model + Gemini AI để chấm phát âm chuyên nghiệp

Features:
- XGBoost acoustic scoring (from your trained model)
- Gemini detailed feedback + pronunciation tips
- Confidence confidence metrics
- Real-time pronunciation error detection
"""

import os
import json
import joblib
import librosa
import numpy as np
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv
import re

load_dotenv()

# ==========================================
# 1. LOAD YOUR TRAINED XGBOOST MODEL
# ==========================================
MODEL_DIR = Path(__file__).parent.parent / "Random_forest"
SPEAKING_MODEL_PATH = MODEL_DIR / "alex_speaking_brain_pro.joblib"

try:
    speaking_model = joblib.load(str(SPEAKING_MODEL_PATH))
    print(f"✅ [HYBRID] XGBoost Speaking Model loaded from: {SPEAKING_MODEL_PATH}")
    HAS_SPEAKING_MODEL = True
except Exception as e:
    print(f"⚠️ [HYBRID] Failed to load XGBoost model: {e}")
    speaking_model = None
    HAS_SPEAKING_MODEL = False


# ==========================================
# 2. ACOUSTIC FEATURES EXTRACTION (44 features)
# ==========================================
def extract_acoustic_features(audio_path):
    """
    Trích xuất 44 đặc trưng âm học cho XGBoost
    
    Features:
    - 13 MFCCs (Mel-Frequency Cepstral Coefficients)
    - 13 Delta MFCCs (biến thiên)
    - 13 Delta-Delta MFCCs (gia tốc biến thiên)
    - Pitch, Jitter, Shimmer, Silence Ratio
    
    Total: 44 features
    """
    try:
        if not os.path.exists(audio_path):
            return None

        # Load audio (16kHz mono)
        y, sr = librosa.load(audio_path, sr=16000)

        # 1. MFCC Analysis (13 chiều)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_delta = librosa.feature.delta(mfccs)
        mfcc_delta2 = librosa.feature.delta(mfccs, order=2)

        # 2. Pitch Analysis (F0 + Jitter)
        f0, voiced_flag, voiced_probs = librosa.pyin(y, fmin=65, fmax=2093, sr=sr)
        f0_clean = f0[~np.isnan(f0)]
        pitch_mean = np.mean(f0_clean) if len(f0_clean) > 0 else 0
        jitter = (np.std(f0_clean) / np.mean(f0_clean)) if len(f0_clean) > 0 and np.mean(f0_clean) > 0 else 0

        # 3. Energy Analysis (RMS + Shimmer)
        rms = librosa.feature.rms(y=y)[0]
        energy_mean = np.mean(rms)
        shimmer = (np.std(rms) / np.mean(rms)) if np.mean(rms) > 0 else 0

        # 4. Fluency Analysis (Silence Ratio)
        non_silent = librosa.effects.split(y, top_db=30)
        total_dur = len(y) / sr
        speech_dur = sum([(e - s) / sr for s, e in non_silent])
        silence_ratio = (total_dur - speech_dur) / total_dur if total_dur > 0 else 0

        # Build feature dictionary
        features = {
            "pitch_mean": pitch_mean,
            "jitter": jitter,
            "energy_mean": energy_mean,
            "shimmer": shimmer,
            "silence_ratio": silence_ratio
        }

        # Add 13 MFCCs + Deltas
        for i in range(13):
            features[f"mfcc_{i}"] = np.mean(mfccs[i])
            features[f"delta_{i}"] = np.mean(mfcc_delta[i])
            features[f"delta2_{i}"] = np.mean(mfcc_delta2[i])

        return features

    except Exception as e:
        print(f"❌ Error extracting features: {e}")
        return None


# ==========================================
# 3. XGBOOST SCORING
# ==========================================
def score_with_xgboost(features_dict):
    """
    Dùng XGBoost model của bạn để dự đoán điểm phát âm
    
    Returns:
    - score (0-10): Pronunciation accuracy score
    - confidence (0-1): Model confidence
    """
    if not HAS_SPEAKING_MODEL or not features_dict:
        return {
            "score": 5.0,
            "confidence": 0.0,
            "error": "Model not available"
        }

    try:
        # Convert to DataFrame
        df = pd.DataFrame([features_dict])

        # Predict
        prediction = speaking_model.predict(df)[0]

        # Normalize to 0-10 scale (nếu model trả về scale khác)
        score = float(np.clip(prediction, 0, 10))

        # Confidence (based on feature variance)
        feature_variance = np.var(list(features_dict.values()))
        confidence = 1.0 / (1.0 + feature_variance)  # Sigmoid-like confidence

        return {
            "score": score,
            "confidence": float(np.clip(confidence, 0, 1)),
            "raw_prediction": float(prediction)
        }

    except Exception as e:
        print(f"❌ XGBoost scoring error: {e}")
        return {
            "score": 5.0,
            "confidence": 0.0,
            "error": str(e)
        }


# ==========================================
# 4. PRONUNCIATION ERROR DETECTION
# ==========================================
def detect_pronunciation_issues(features_dict, score):
    """
    Phân tích các vấn đề phát âm dựa trên acoustic features
    
    Returns:
    - issues: danh sách các vấn đề
    - severity: Cao/Trung bình/Thấp
    """
    issues = []
    severity = "low"

    if not features_dict:
        return {"issues": issues, "severity": severity}

    try:
        # High Silence Ratio = Hesitation / Fluency issues
        if features_dict.get("silence_ratio", 0) > 0.35:
            issues.append("❌ Nhiều khoảng lặng → Thiếu tự tin hoặc suy nghĩ lâu")
            severity = "medium"

        # Low Energy = Muffled / Weak voice
        if features_dict.get("energy_mean", 0) < 0.02:
            issues.append("❌ Giọng quá yếu → Không nghe rõ")
            severity = "high"

        # High Jitter = Voice instability
        if features_dict.get("jitter", 0) > 0.05:
            issues.append("⚠️ Giọng run rẩy → Cần ổn định hơn")
            severity = "medium"

        # High Shimmer = Voice tremor
        if features_dict.get("shimmer", 0) > 0.15:
            issues.append("⚠️ Âm sắc không ổn định → Cần kiểm soát ngữ điệu")
            severity = "medium"

        # Low pitch variation (mfcc_delta)
        delta_avg = np.mean([v for k, v in features_dict.items() if "delta_" in k])
        if abs(delta_avg) < 0.01:
            issues.append("⚠️ Ngữ điệu đơn điệu → Cần biểu cảm hơn")
            severity = "low"

        if not issues:
            issues.append("✅ Không phát hiện vấn đề lớn")
            severity = "low"

    except Exception as e:
        print(f"Error detecting issues: {e}")

    return {
        "issues": issues,
        "severity": severity
    }


# ==========================================
# 5. BUILD GEMINI PROMPT (Enhanced)
# ==========================================
def build_gemini_prompt(transcript, acoustic_score, features_dict, issues_list, target_question=""):
    """
    Tạo prompt chi tiết để Gemini đánh giá phát âm
    Kết hợp XGBoost physical score + acoustic analysis
    """

    # Score interpretation
    if acoustic_score >= 8:
        score_level = "Xuất sắc (Excellent)"
    elif acoustic_score >= 7:
        score_level = "Tốt (Good)"
    elif acoustic_score >= 5:
        score_level = "Bình thường (Fair)"
    else:
        score_level = "Cần cải thiện (Needs improvement)"

    # Feature summary
    feature_summary = f"""
    PHYSICAL ACOUSTIC ANALYSIS:
    - Pitch Stability: {features_dict.get('pitch_mean', 0):.1f} Hz (Normal: 80-250 Hz)
    - Voice Stability (Jitter): {features_dict.get('jitter', 0):.4f} (Normal: <0.02)
    - Vocal Energy: {features_dict.get('energy_mean', 0):.3f} (Too low: <0.02)
    - Pronunciation Fluency: {(1 - features_dict.get('silence_ratio', 0)) * 100:.1f}% (Goal: >70%)
    """

    prompt = f"""
Role: Expert IELTS Speaking Examiner & Pronunciation Coach (Hybrid AI)
Task: Provide detailed pronunciation feedback based on BOTH AI acoustic analysis AND semantic understanding

CANDIDATE'S TRANSCRIPT:
"{transcript}"

TARGET QUESTION:
"{target_question or 'General Speaking'}"

═══════════════════════════════════════════════════════════════
🎼 ACOUSTIC ANALYSIS (From XGBoost AI Model)
═══════════════════════════════════════════════════════════════
Pronunciation Score (0-10): {acoustic_score:.2f}/10
Assessment Level: {score_level}

{feature_summary}

DETECTED ISSUES:
{chr(10).join(f'  • {issue}' for issue in issues_list.get('issues', ['No issues detected']))}

═══════════════════════════════════════════════════════════════
📝 YOUR FEEDBACK (JSON Format)
═══════════════════════════════════════════════════════════════

Please respond STRICTLY in this JSON format (NO markdown, NO extra text):

{{
  "pronunciation_score": <0-10 float>,
  "fluency_score": <0-10 float>,
  "confidence_score": <0-10 float>,
  "overall_band": "<Band 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, or 9.0>",
  "strengths": [
    "<specific pronunciation strength 1>",
    "<specific pronunciation strength 2>"
  ],
  "areas_for_improvement": [
    "<specific error 1 with phonetic detail>",
    "<specific error 2 with phonetic detail>"
  ],
  "detailed_feedback": {
    "overall_assessment": "[1-2 sentence summary of general impression]",
    "strengths": "- **Pronunciation**: [Acoustic highlights]\n- **Intonation**: [Naturalness highlights]",
    "areas_for_improvement": "- **Specific Errors**: [Detailed phonetic errors and fixes]\n- **Fluency**: [Suggestions on speed and pausing]",
    "coach_tips": "[Inspirational advice and concise roadmap]"
  },
  "pronunciation_tips": [
    "<actionable tip 1 with example>",
    "<actionable tip 2 with example>"
  ],
  "native_speaker_reference": "<Show correct pronunciation pattern if needed>"
}}

IMPORTANT:
1. Base score on BOTH acoustic analysis AND content quality
2. Give specific phonetic feedback (e.g., "th" vs "s" confusion)
3. Be encouraging but honest
4. Format must be valid JSON only
"""

    return prompt


# ==========================================
# 6. MAIN HYBRID EVALUATION FUNCTION
# ==========================================
def evaluate_speaking_hybrid(audio_path, transcript, target_question="", gemini_service=None):
    """
    Main function: Evaluate speaking with hybrid XGBoost + Gemini
    
    Args:
        audio_path: Path to audio file
        transcript: Transcribed text
        target_question: The speaking prompt
        gemini_service: Gemini service instance (optional)
    
    Returns:
        {
            "acoustic_score": float,
            "xgboost_confidence": float,
            "pronunciation_issues": list,
            "gemini_feedback": dict (if gemini_service provided),
            "combined_score": float,
            "source": "hybrid"
        }
    """

    result = {
        "source": "hybrid",
        "timestamp": pd.Timestamp.now().isoformat()
    }

    # ===== STEP 1: Extract Features =====
    features = extract_acoustic_features(audio_path)
    if not features:
        return {
            **result,
            "error": "Failed to extract acoustic features",
            "acoustic_score": 5.0,
            "xgboost_confidence": 0.0
        }

    # ===== STEP 2: XGBoost Scoring =====
    xgb_result = score_with_xgboost(features)
    acoustic_score = xgb_result["score"]
    xgb_confidence = xgb_result["confidence"]

    result.update({
        "acoustic_score": acoustic_score,
        "xgboost_confidence": xgb_confidence,
        "xgboost_raw": xgb_result.get("raw_prediction", acoustic_score)
    })

    # ===== STEP 3: Detect Issues =====
    issues = detect_pronunciation_issues(features, acoustic_score)
    result["pronunciation_issues"] = issues

    # ===== STEP 4: Gemini Feedback (Optional) =====
    if gemini_service:
        try:
            prompt = build_gemini_prompt(transcript, acoustic_score, features, issues, target_question)
            gemini_response = gemini_service.call_gemini_json(prompt)

            if gemini_response and not gemini_response.get("error"):
                result["gemini_feedback"] = gemini_response

                # Combine scores (70% Gemini, 30% XGBoost)
                gemini_pron = gemini_response.get("pronunciation_score", acoustic_score)
                combined = (gemini_pron * 0.7) + (acoustic_score * 0.3)
                result["combined_score"] = float(np.clip(combined, 0, 10))
            else:
                result["gemini_error"] = gemini_response.get("error", "Unknown error")
                result["combined_score"] = acoustic_score

        except Exception as e:
            print(f"⚠️ Gemini feedback error: {e}")
            result["gemini_error"] = str(e)
            result["combined_score"] = acoustic_score
    else:
        result["combined_score"] = acoustic_score

    return result


# ==========================================
# 7. FORMAT RESPONSE FOR FRONTEND
# ==========================================
def format_speaking_response(hybrid_result):
    """
    Convert hybrid evaluation result to frontend-friendly format
    """
    try:
        acoustic = hybrid_result.get("acoustic_score", 5.0)
        combined = hybrid_result.get("combined_score", acoustic)
        issues = hybrid_result.get("pronunciation_issues", {}).get("issues", [])
        gemini = hybrid_result.get("gemini_feedback", {})

        # Calculate sub-scores from Gemini or defaults
        pronunciation = gemini.get("pronunciation_score", acoustic)
        fluency = gemini.get("fluency_score", acoustic * 0.95)
        confidence = gemini.get("confidence_score", acoustic * 0.9)

        return {
            "success": True,
            "source": "hybrid-xgboost-gemini",
            "scores": {
                "overall": round(combined, 1),
                "pronunciation": round(pronunciation, 1),
                "fluency": round(fluency, 1),
                "confidence": round(confidence, 1)
            },
            "band": gemini.get("overall_band", f"{round(combined / 2, 1)}-band"),
            "strengths": gemini.get("strengths", ["Phát âm tự nhiên", "Ngữ điệu rõ ràng"]),
            "areas_for_improvement": gemini.get("areas_for_improvement", issues[:3]),
            "feedback": gemini.get("detailed_feedback", "Tiếp tục luyện tập!"),
            "tips": gemini.get("pronunciation_tips", []),
            "xgboost_acoustic": round(acoustic, 2),
            "xgboost_confidence": round(hybrid_result.get("xgboost_confidence", 0), 2),
            "native_reference": gemini.get("native_speaker_reference", "")
        }

    except Exception as e:
        print(f"Error formatting response: {e}")
        return {
            "success": False,
            "error": str(e)
        }
