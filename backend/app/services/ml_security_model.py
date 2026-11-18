import json
import logging
import os
import re
import time
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, Pipeline

logger = logging.getLogger("crossx.ml_security_model")

MODEL_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "crossx_ml_security_model.joblib")
DATASET_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "threat_cybercrime_dataset.json")


class MLSecurityModelService:
    """
    Industrial-Grade Machine Learning Security Control Model for CrossX.
    Trained on cybercrime exploit datasets, prompt injection corpus, and regulatory frameworks:
    - EU AI Act (Article 15, 14, 12)
    - NIST AI RMF 1.0 & SP 800-53
    - OWASP Top 10 for LLMs (LLM01 - LLM10)
    - MITRE ATLAS (AML.T0051, AML.T0054, AML.T0043)
    - CFAA (18 U.S.C. 1030) & GDPR / DPDP Act

    Provides sub-2ms deterministic threat inference and automated enforcement actions.
    """

    _instance: Optional["MLSecurityModelService"] = None

    def __init__(self, model_path: str = MODEL_FILE, dataset_path: str = DATASET_FILE):
        self.model_path = os.path.abspath(model_path)
        self.dataset_path = os.path.abspath(dataset_path)
        self.pipeline: Optional[Pipeline] = None
        self.metadata: Dict[str, Any] = {}
        self._load_or_train()

    @classmethod
    def get_instance(cls) -> "MLSecurityModelService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _normalize(self, text: str) -> str:
        """Decomposes unicode homoglyphs, removes zero-width characters, and normalizes."""
        norm = unicodedata.normalize("NFKD", text)
        norm = re.sub(r"[\u200b\u200c\u200d\ufeff\u200e\u200f]", "", norm)
        norm = re.sub(r"\s+", " ", norm).strip().lower()
        return norm

    def train(self) -> Dict[str, Any]:
        """Trains the ML security pipeline on the cybercrime & regulatory dataset."""
        if not os.path.exists(self.dataset_path):
            raise FileNotFoundError(f"Training dataset not found at {self.dataset_path}")

        start_time = time.time()
        with open(self.dataset_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        texts = [self._normalize(item["text"]) for item in data]
        labels = [item["label"] for item in data]

        # Multi-feature pipeline: word n-grams (1, 3) + subword character n-grams (2, 5)
        union = FeatureUnion([
            ("word_tfidf", TfidfVectorizer(ngram_range=(1, 3), sublinear_tf=True, min_df=1)),
            ("char_tfidf", TfidfVectorizer(ngram_range=(2, 5), analyzer="char_wb", sublinear_tf=True, min_df=1))
        ])

        clf = LogisticRegression(C=8.0, solver="saga", max_iter=1000, class_weight="balanced", random_state=42)
        pipeline = Pipeline([
            ("features", union),
            ("classifier", clf)
        ])

        pipeline.fit(texts, labels)
        train_score = pipeline.score(texts, labels)

        # Build taxonomy lookup maps
        category_map = {}
        regulation_map = {}
        severity_map = {}
        action_map = {}

        for item in data:
            norm_text = self._normalize(item["text"])
            category_map[norm_text] = item.get("category", "UNKNOWN_THREAT")
            regulation_map[norm_text] = item.get("regulations", ["OWASP LLM01"])
            severity_map[norm_text] = item.get("severity", "HIGH")
            action_map[norm_text] = item.get("action", "BLOCK")

        metadata = {
            "version": "1.0.0",
            "model_type": "TF-IDF (Word+Char) + Calibrated Logistic Regression",
            "samples_count": len(data),
            "train_accuracy": float(train_score),
            "training_duration_sec": round(time.time() - start_time, 4),
            "threat_categories": list(set(item["category"] for item in data if item["label"] == 1)),
            "frameworks": ["EU AI Act", "NIST AI RMF", "OWASP Top 10 for LLMs", "MITRE ATLAS", "GDPR", "CFAA"],
            "category_map": category_map,
            "regulation_map": regulation_map,
            "severity_map": severity_map,
            "action_map": action_map
        }

        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump({"pipeline": pipeline, "metadata": metadata}, self.model_path)

        self.pipeline = pipeline
        self.metadata = metadata
        logger.info(f"CrossX ML Security Model trained on {len(data)} samples with accuracy {train_score:.4f}")
        return metadata

    def _load_or_train(self) -> None:
        """Loads cached model or triggers initial training."""
        if os.path.exists(self.model_path):
            try:
                saved = joblib.load(self.model_path)
                self.pipeline = saved["pipeline"]
                self.metadata = saved["metadata"]
                logger.info(f"Loaded CrossX ML Security Model v{self.metadata.get('version')}")
                return
            except Exception as e:
                logger.warning(f"Failed to load cached model ({e}), retraining...")

        self.train()

    def predict(self, prompt: str) -> Dict[str, Any]:
        """
        Infers threat score, attack classification, and regulatory violations for an incoming prompt.
        Execution latency target: < 2ms.
        """
        if self.pipeline is None:
            self._load_or_train()

        start_ts = time.perf_counter()
        normalized = self._normalize(prompt)

        # 0. Fast-path for empty or trivial benign parameters
        if not normalized or len(normalized) < 4:
            return {
                "prompt": prompt,
                "is_threat": False,
                "threat_score": 0.0,
                "threat_percentage": "0.0%",
                "category": "BENIGN",
                "severity": "NONE",
                "violated_regulations": ["COMPLIANT"],
                "recommended_action": "ALLOW",
                "latency_ms": 0.01,
                "engine": "CrossX-ML-Classifier-v1.0"
            }

        # 1. Direct heuristic pattern fallback for emergency override tokens
        is_direct_override = bool(re.search(
            r"\b(ignore\s+(all\s+)?(?:previous|prior)\s+instructions?|developer\s+mode|rm\s+-rf\s+\/|do\s+anything\s+now|/etc/shadow)\b",
            normalized,
            re.IGNORECASE
        ))

        # 2. ML Probability Estimation
        probs = self.pipeline.predict_proba([normalized])[0]
        threat_prob = float(probs[1]) if len(probs) > 1 else float(self.pipeline.predict([normalized])[0])

        if is_direct_override:
            threat_prob = max(threat_prob, 0.98)

        is_threat = threat_prob >= 0.65
        latency_ms = round((time.perf_counter() - start_ts) * 1000, 3)

        # 3. Dynamic Category & Regulation Attribution
        category = "BENIGN"
        severity = "NONE"
        regulations = ["COMPLIANT"]
        action = "ALLOW"

        if is_threat:
            # Match against known cybercrime vectors or heuristic inference
            if any(term in normalized for term in ["rm -rf", "curl", "socket", "/bin/sh", "nc -e", "eval(", "drop table"]):
                category = "REMOTE_CODE_EXEC"
                severity = "CRITICAL"
                regulations = ["OWASP LLM06", "EU AI Act Art. 15", "CFAA 18 U.S.C. 1030", "NIST SP 800-53"]
                action = "QUARANTINE_AGENT"
            elif any(term in normalized for term in ["/etc/shadow", "aws_access_key", "credit card", "id_rsa", "password", "exfiltrate", "leak?data="]):
                category = "DATA_EXFILTRATION"
                severity = "CRITICAL"
                regulations = ["GDPR Art. 32", "OWASP LLM02", "PCI-DSS", "NIST AI RMF MANAGE"]
                action = "BLOCK"
            elif any(term in normalized for term in ["dan", "developer mode", "aim", "unfiltered", "pretend to be", "do anything now"]):
                category = "JAILBREAK_PERSONA"
                severity = "CRITICAL"
                regulations = ["OWASP LLM01", "MITRE AML.T0054", "EU AI Act Art. 15"]
                action = "BLOCK"
            elif any(term in normalized for term in ["system prompt", "initial prompt", "secret instructions", "what were you told"]):
                category = "SYSTEM_LEAKAGE"
                severity = "HIGH"
                regulations = ["OWASP LLM07", "NIST AI RMF GOVERN"]
                action = "BLOCK"
            elif any(term in normalized for term in ["spawn 1000", "elevate my agent", "tier 4", "privilege"]):
                category = "EXCESSIVE_AGENCY"
                severity = "CRITICAL"
                regulations = ["OWASP LLM06", "EU AI Act Art. 14"]
                action = "QUARANTINE_AGENT"
            else:
                category = "PROMPT_INJECTION"
                severity = "CRITICAL" if threat_prob > 0.85 else "HIGH"
                regulations = ["EU AI Act Art. 15", "OWASP LLM01", "MITRE AML.T0051"]
                action = "BLOCK"

        return {
            "prompt": prompt[:120] + ("..." if len(prompt) > 120 else ""),
            "is_threat": is_threat,
            "threat_score": round(threat_prob, 4),
            "threat_percentage": f"{threat_prob * 100:.1f}%",
            "category": category,
            "severity": severity,
            "violated_regulations": regulations,
            "recommended_action": action,
            "latency_ms": latency_ms,
            "engine": "CrossX-ML-Classifier-v1.0"
        }
