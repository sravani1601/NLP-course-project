#!/usr/bin/env python3
"""
Python service for plan generation using Hugging Face model
Called from Node.js via child_process
"""

import os
import sys
import json
import re
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta, time, date, timezone

try:
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM, GenerationConfig
except Exception:
    AutoTokenizer = None
    AutoModelForCausalLM = None
    GenerationConfig = None

TIME_WINDOWS = {
    "early morning": (5, 7),
    "morning": (7, 9),
    "late morning": (9, 11),
    "midday": (11, 13),
    "afternoon": (13, 17),
    "evening": (18, 21),
    "night": (21, 23),
}

WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

def interpret_vague_time(token: str) -> Tuple[int, int]:
    token = token.lower().strip()
    if token in TIME_WINDOWS:
        return TIME_WINDOWS[token]
    if "weekend" in token:
        return TIME_WINDOWS["morning"]
    if "after work" in token or "post-work" in token:
        return (17, 19)
    for key, window in TIME_WINDOWS.items():
        if key in token:
            return window
    return TIME_WINDOWS["morning"]

def choose_hour_from_window(window: Tuple[int, int], chronotype: str) -> int:
    start, end = window
    mid = (start + end) // 2
    if chronotype == "morning":
        return start
    if chronotype == "evening":
        return mid
    return mid

def hhmm(hour: int, minute: int = 0) -> str:
    return f"{hour:02d}:{minute:02d}"

def extract_largest_json(text: str) -> Optional[str]:
    if not text:
        return None
    s = text.strip()
    s = re.sub(r"```json", "", s, flags=re.IGNORECASE)
    s = re.sub(r"```", "", s)
    s = re.sub(r"<\?xml.*?\?>", "", s, flags=re.DOTALL)
    start_indices = [m.start() for m in re.finditer(r"\{", s)]
    if not start_indices:
        return None
    best = None
    max_len = 0
    for idx in start_indices:
        count = 0
        for j in range(idx, len(s)):
            if s[j] == "{":
                count += 1
            elif s[j] == "}":
                count -= 1
                if count == 0:
                    cand = s[idx:j+1]
                    clen = len(cand)
                    if clen > max_len:
                        max_len = clen
                        best = cand
                    break
    return best

def repair_text_to_json(s: str) -> Optional[dict]:
    if not s:
        return None
    s0 = s.strip()
    try:
        return json.loads(s0)
    except Exception:
        pass
    s1 = re.sub(r"(\w)\'s\b", r"\1's", s0)
    s1 = s1.replace(""", '"').replace(""", '"').replace("'", "'").replace("'", "'")
    s1 = re.sub(r"([\{\}\[\]:,])\s*'", r'\1"', s1)
    s1 = re.sub(r"'\s*([\{\}\[\]:,])", r'"\1', s1)
    s1 = re.sub(r',\s*(\}|\])', r'\1', s1)
    try:
        return json.loads(s1)
    except Exception:
        pass
    return None

PROMPT_SYSTEM = (
    "You are an AI planner. Return ONLY a single valid JSON object that matches the schema below. "
    "No explanations, no commentary, no markdown fences, no surrounding text. Use 24-hour HH:MM times."
)

PROMPT_SCHEMA = json.dumps({
    "weekly_plan": [
        {"task_name": "string", "day": "Mon|Tue|...", "start_time": "HH:MM", "duration_minutes": 0, "recurrence": "daily|weekly|none", "location": "optional string"}
    ],
    "milestones": [{"date": "YYYY-MM-DD (optional)", "goal": "string"}]
}, indent=2)

PROMPT_TIME_RULES = "\n".join([f"- \"{k}\" -> {v[0]:02d}:00-{v[1]:02d}:00" for k, v in TIME_WINDOWS.items()])

def build_prompt_minimal(profile: Dict, busy_iso: List[str], goal: str) -> str:
    profile_block = json.dumps(profile, indent=2)
    busy_block = "\n".join(busy_iso) if busy_iso else "none"
    parts = [
        PROMPT_SYSTEM,
        "SCHEMA:",
        PROMPT_SCHEMA,
        "TIME_RULES:",
        PROMPT_TIME_RULES,
        "USER_PROFILE:",
        profile_block,
        "BUSY_INTERVALS:",
        busy_block,
        "GOAL:",
        goal,
        "OUTPUT: Return a single raw JSON object exactly matching the schema above."
    ]
    return "\n\n".join(parts)

class HFWrapper:
    def __init__(self, model_name: str, device: Optional[str] = None, max_new_tokens: int = 400):
        if AutoTokenizer is None or AutoModelForCausalLM is None:
            raise RuntimeError("Transformers not available")
        self.device = device if device else ("cuda" if torch.cuda.is_available() else "cpu")
        self.model_name = model_name
        self.tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(model_name, trust_remote_code=True)
        self.model.to(self.device)
        self.max_new_tokens = max_new_tokens
        self.use_chat_template = hasattr(self.tokenizer, "apply_chat_template")

    def generate(self, prompt: str, temperature: float = 0.2, top_p: float = 0.9) -> str:
        chat_prompt = prompt
        if self.use_chat_template:
            try:
                enc = [{"role": "user", "content": prompt}]
                chat_prompt = self.tokenizer.apply_chat_template(enc, tokenize=False)
            except Exception:
                chat_prompt = prompt
        inputs = self.tokenizer(chat_prompt, return_tensors="pt").to(self.device)
        gen_conf = GenerationConfig(
            max_new_tokens=self.max_new_tokens,
            do_sample=True,
            temperature=float(temperature),
            top_p=float(top_p),
            eos_token_id=getattr(self.tokenizer, "eos_token_id", None)
        ) if GenerationConfig is not None else None
        if gen_conf is not None:
            outputs = self.model.generate(**inputs, generation_config=gen_conf)
        else:
            outputs = self.model.generate(**inputs, do_sample=True, max_new_tokens=self.max_new_tokens, temperature=float(temperature), top_p=float(top_p))
        raw = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        if chat_prompt.strip() and raw.startswith(chat_prompt.strip()):
            raw = raw[len(chat_prompt.strip()):].strip()
        return raw

def repair_and_validate_json(raw_text: str) -> Optional[dict]:
    jtext = extract_largest_json(raw_text)
    if not jtext:
        jtext = raw_text
    parsed = repair_text_to_json(jtext)
    return parsed

def normalize_plan(plan_items: List[dict], chronotype: str = "neutral") -> List[dict]:
    normalized = []
    for item in plan_items:
        if item.get("duration_minutes") is None:
            item["duration_minutes"] = 60
        
        d = item.get("day", "").strip()
        day_conv = {
            **{d0.lower(): d0 for d0 in WEEK_DAYS},
            "monday": "Mon", "tuesday": "Tue", "wednesday": "Wed", "thursday": "Thu",
            "friday": "Fri", "saturday": "Sat", "sunday": "Sun"
        }
        if d.lower() in day_conv:
            item["day"] = day_conv[d.lower()]
        
        if re.search(r"[a-zA-Z]", item.get("start_time", "")):
            w = interpret_vague_time(item["start_time"])
            hour = choose_hour_from_window(w, chronotype)
            item["start_time"] = hhmm(hour)
        
        # Preserve all fields: task_name, day, start_time, duration_minutes, recurrence, location, notes
        normalized.append(item)
    return normalized

def plan_conflicts(plan_items: List[dict], busy_intervals: List[str], ref_week_start: date) -> List[Tuple[dict, Dict]]:
    """Check for conflicts between plan items and busy intervals"""
    conflicts = []
    day_to_date = {wd: ref_week_start + timedelta(days=i) for i, wd in enumerate(WEEK_DAYS)}
    
    for p in plan_items:
        if p.get("day") not in day_to_date:
            continue
        try:
            t = datetime.strptime(p.get("start_time", "09:00"), "%H:%M").time()
        except Exception:
            continue
        
        plan_dt = datetime.combine(day_to_date[p["day"]], t)
        dur_minutes = p.get("duration_minutes", 60)
        plan_end = plan_dt + timedelta(minutes=dur_minutes)
        
        for busy_str in busy_intervals:
            if "/" in busy_str:
                start_str, end_str = busy_str.split("/", 1)
                try:
                    busy_start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                    busy_end = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
                    # Convert to local timezone for comparison
                    if busy_start.tzinfo:
                        busy_start = busy_start.replace(tzinfo=None)
                    if busy_end.tzinfo:
                        busy_end = busy_end.replace(tzinfo=None)
                    
                    if not (plan_end <= busy_start or plan_dt >= busy_end):
                        conflicts.append((p, {"start": busy_start, "end": busy_end}))
                except Exception:
                    continue
    
    return conflicts

def resolve_conflict_by_shifting(item: dict, busy_intervals: List[str], ref_date: date, chronotype: str = "neutral") -> bool:
    """Try to resolve conflict by shifting the time"""
    dur_minutes = item.get("duration_minutes", 60)
    try:
        current_hour = int(item.get("start_time", "08:00").split(":")[0])
    except Exception:
        current_hour = 8
    
    deltas = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]
    if chronotype == "morning":
        deltas = [-1, -2, -3, 1, 2, 3, 4, -4, 5, -5]
    elif chronotype == "evening":
        deltas = [1, 2, 3, -1, -2, -3, 4, -4, 5, -5]
    
    for delta in deltas:
        candidate_hour = current_hour + delta
        if 6 <= candidate_hour <= 22:
            candidate_start = datetime.combine(ref_date, time(candidate_hour, 0))
            candidate_end = candidate_start + timedelta(minutes=dur_minutes)
            
            conflict = False
            for busy_str in busy_intervals:
                if "/" in busy_str:
                    start_str, end_str = busy_str.split("/", 1)
                    try:
                        busy_start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                        busy_end = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
                        if busy_start.tzinfo:
                            busy_start = busy_start.replace(tzinfo=None)
                        if busy_end.tzinfo:
                            busy_end = busy_end.replace(tzinfo=None)
                        
                        if not (candidate_end <= busy_start or candidate_start >= busy_end):
                            conflict = True
                            break
                    except Exception:
                        continue
            
            if not conflict:
                item["start_time"] = hhmm(candidate_hour)
                return True
    
    return False

def generate_plan(goal: str, profile: Optional[Dict] = None, busy_intervals: Optional[List[str]] = None, model_name: Optional[str] = None, ref_week_start: Optional[date] = None):
    """Main function called from Node.js - matches original plan_pipeline format"""
    try:
        # Default profile if not provided
        if profile is None:
            profile = {
                "user_id": None,
                "chronotype": "neutral",
                "timezone": "UTC",
                "preferences": {}
            }
        
        if busy_intervals is None:
            busy_intervals = []
        
        if model_name is None:
            model_name = os.getenv("HF_MODEL", "google/gemma-2-2b-it")
        
        if ref_week_start is None:
            today = date.today()
            ref_week_start = today + timedelta(days=(7 - today.weekday()))
        
        # Build prompt
        prompt = build_prompt_minimal(profile, busy_intervals, goal)
        
        # Initialize model
        hf_model = HFWrapper(model_name)
        
        # Generate
        raw_out = hf_model.generate(prompt)
        
        # Parse and validate
        planner_out = repair_and_validate_json(raw_out)
        
        if planner_out is None:
            return {
                "success": False,
                "error": "Failed to parse JSON from model output",
                "raw_output": raw_out,
                "metadata": {
                    "model_used": "huggingface",
                    "raw_text": raw_out,
                    "status": "invalid_json"
                }
            }
        
        # Normalize plan
        if "weekly_plan" in planner_out:
            planner_out["weekly_plan"] = normalize_plan(
                planner_out["weekly_plan"],
                chronotype=profile.get("chronotype", "neutral")
            )
        
        # Check conflicts before resolution
        conflicts_before = plan_conflicts(planner_out["weekly_plan"], busy_intervals, ref_week_start)
        
        # Resolve conflicts
        for (plan_item, busy_interval) in conflicts_before:
            try:
                day_idx = WEEK_DAYS.index(plan_item.get("day", "Mon"))
                target_date = ref_week_start + timedelta(days=day_idx)
                resolve_conflict_by_shifting(
                    plan_item, 
                    busy_intervals, 
                    target_date, 
                    chronotype=profile.get("chronotype", "neutral")
                )
            except Exception:
                pass
        
        # Check conflicts after resolution
        conflicts_after = plan_conflicts(planner_out["weekly_plan"], busy_intervals, ref_week_start)
        
        # Build metadata matching original format
        metadata = {
            "model_used": "huggingface",
            "raw_text": raw_out,
            "conflicts_before": len(conflicts_before),
            "conflicts_after": len(conflicts_after),
            "status": "ok"
        }
        
        return {
            "success": True,
            "output": planner_out,
            "metadata": metadata
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "metadata": {
                "model_used": "huggingface",
                "status": "error",
                "error": str(e)
            }
        }

if __name__ == "__main__":
    # Read JSON from stdin
    try:
        input_data = json.loads(sys.stdin.read())
        goal = input_data.get("goal", "")
        profile = input_data.get("profile")
        busy_intervals = input_data.get("busy_intervals")
        model_name = input_data.get("model_name")
        
        result = generate_plan(goal, profile, busy_intervals, model_name)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }))

