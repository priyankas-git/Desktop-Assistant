#!/usr/bin/env python3
"""
Desktop-Assistant: Local Voice Activation & Wake-Word Detector Helper Process.
Uses openWakeWord for local on-device wake-word detection for "Mischief managed".

Communication with Electron:
- Inbound: JSON Lines via standard input (sys.stdin)
- Outbound: JSON Lines via standard output (sys.stdout)
- Diagnostics: Standard error (sys.stderr)
"""

import sys
import os
import json
import time
import argparse
import threading
from typing import Optional, Dict, Any

# Ensure stdout uses UTF-8 and auto-flushes
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', line_buffering=True)

# Global State
companion_state = "sleeping"
is_listening = False
audio_stream = None
stream_lock = threading.Lock()
last_detection_time = 0.0
DETECTION_COOLDOWN_SEC = 2.0
SCORE_THRESHOLD = 0.5
TARGET_WAKE_WORD = "mischief_managed"

# Check optional dependencies
HAS_SOUNDDEVICE = False
try:
    import sounddevice as sd
    HAS_SOUNDDEVICE = True
except Exception as e:
    sys.stderr.write(f"[wake_word_detector] sounddevice not available: {e}\n")

HAS_OPENWAKEWORD = False
oww_model = None
model_loaded = False
loaded_model_path: Optional[str] = None
model_load_error: Optional[str] = None

try:
    import openwakeword
    HAS_OPENWAKEWORD = True
except Exception as e:
    sys.stderr.write(f"[wake_word_detector] openwakeword not available: {e}\n")
    model_load_error = f"openwakeword import failed: {e}"


def emit_event(event_type: str, data: Optional[Dict[str, Any]] = None) -> None:
    """Emit a JSON line to sys.stdout."""
    payload = {"type": event_type}
    if data:
        payload.update(data)
    try:
        sys.stdout.write(json.dumps(payload) + "\n")
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"[wake_word_detector] Failed to write event: {e}\n")


def find_model_path(model_dir: str) -> Optional[str]:
    """Look for mischief_managed.onnx or mischief_managed.tflite."""
    candidates = [
        os.path.join(model_dir, "mischief_managed.onnx"),
        os.path.join(model_dir, "mischief_managed.tflite"),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return os.path.abspath(c)
    return None


def init_wake_word_model(model_dir: str) -> None:
    """Initialize openWakeWord with custom model if present."""
    global oww_model, model_loaded, loaded_model_path, model_load_error

    if not HAS_OPENWAKEWORD:
        model_loaded = False
        return

    model_path = find_model_path(model_dir)
    if not model_path:
        model_loaded = False
        loaded_model_path = None
        model_load_error = (
            f"Custom wake-word model '{TARGET_WAKE_WORD}.onnx' not found in '{model_dir}'. "
            "See models/wake_words/README.md for instructions on training and placing the model."
        )
        sys.stderr.write(f"[wake_word_detector] {model_load_error}\n")
        return

    try:
        framework = "tflite" if model_path.endswith(".tflite") else "onnx"
        sys.stderr.write(f"[wake_word_detector] Loading model from {model_path} ({framework})...\n")
        oww_model = openwakeword.Model(
            wakeword_models=[model_path],
            inference_framework=framework,
        )
        model_loaded = True
        loaded_model_path = model_path
        model_load_error = None
        sys.stderr.write(f"[wake_word_detector] Model loaded successfully: {list(oww_model.models.keys())}\n")
    except Exception as e:
        model_loaded = False
        loaded_model_path = None
        model_load_error = f"Failed to instantiate openWakeWord model: {e}"
        sys.stderr.write(f"[wake_word_detector] {model_load_error}\n")


def get_current_status() -> Dict[str, Any]:
    """Return dictionary of current detector status."""
    return {
        "openwakeword_installed": HAS_OPENWAKEWORD,
        "sounddevice_installed": HAS_SOUNDDEVICE,
        "model_loaded": model_loaded,
        "model_name": TARGET_WAKE_WORD,
        "model_path": loaded_model_path,
        "error": model_load_error,
        "is_listening": is_listening,
        "companion_state": companion_state,
        "score_threshold": SCORE_THRESHOLD,
        "cooldown_sec": DETECTION_COOLDOWN_SEC,
    }


def process_audio_chunk(chunk) -> None:
    """Process a single 16kHz, 16-bit PCM 1280-sample audio chunk."""
    global last_detection_time

    if not is_listening or not model_loaded or oww_model is None:
        return

    try:
        predictions = oww_model.predict(chunk)
        # Look for target wake word prediction
        for name, score in predictions.items():
            if TARGET_WAKE_WORD in name.lower() or name.lower() in TARGET_WAKE_WORD:
                if score >= SCORE_THRESHOLD:
                    now = time.time()
                    if now - last_detection_time >= DETECTION_COOLDOWN_SEC:
                        last_detection_time = now
                        emit_event("detection", {
                            "wake_word": TARGET_WAKE_WORD,
                            "score": float(score),
                            "state": companion_state,
                            "simulated": False,
                            "timestamp": int(now * 1000),
                        })
    except Exception as e:
        sys.stderr.write(f"[wake_word_detector] Error during inference: {e}\n")


def audio_callback(indata, frames, time_info, status):
    """Callback from sounddevice InputStream."""
    if status:
        sys.stderr.write(f"[wake_word_detector] Audio callback status: {status}\n")

    if not is_listening:
        return

    # indata is numpy array with shape (1280, 1), int16
    chunk = indata.flatten()
    process_audio_chunk(chunk)


def start_audio_capture() -> bool:
    """Start capturing microphone audio using sounddevice."""
    global audio_stream, is_listening

    with stream_lock:
        if is_listening and audio_stream is not None:
            return True

        if not HAS_SOUNDDEVICE:
            emit_event("error", {
                "code": "DEPENDENCY_MISSING",
                "message": "sounddevice library is not installed."
            })
            return False

        try:
            # 16000 Hz, mono, 16-bit int, 1280 samples (80 ms chunk)
            audio_stream = sd.InputStream(
                samplerate=16000,
                channels=1,
                dtype='int16',
                blocksize=1280,
                callback=audio_callback,
            )
            audio_stream.start()
            is_listening = True
            device_info = sd.query_devices(kind='input')
            emit_event("listening_started", {
                "device": device_info.get("name", "Default Microphone") if device_info else "Default"
            })
            emit_event("status", get_current_status())
            return True
        except Exception as e:
            is_listening = False
            audio_stream = None
            emit_event("error", {
                "code": "MIC_OPEN_FAILED",
                "message": f"Failed to open microphone: {e}"
            })
            emit_event("status", get_current_status())
            return False


def stop_audio_capture() -> None:
    """Stop audio capture and release microphone device."""
    global audio_stream, is_listening

    with stream_lock:
        is_listening = False
        if audio_stream is not None:
            try:
                audio_stream.stop()
                audio_stream.close()
            except Exception as e:
                sys.stderr.write(f"[wake_word_detector] Error closing stream: {e}\n")
            finally:
                audio_stream = None

        emit_event("listening_stopped")
        emit_event("status", get_current_status())


def trigger_simulated_detection(wake_word: str = TARGET_WAKE_WORD) -> None:
    """Simulate wake-word detection for testing."""
    global last_detection_time
    now = time.time()
    if now - last_detection_time >= DETECTION_COOLDOWN_SEC:
        last_detection_time = now
        emit_event("detection", {
            "wake_word": wake_word,
            "score": 0.99,
            "state": companion_state,
            "simulated": True,
            "timestamp": int(now * 1000),
        })
    else:
        emit_event("cooldown_active", {
            "time_remaining_ms": int((DETECTION_COOLDOWN_SEC - (now - last_detection_time)) * 1000)
        })


def handle_command(cmd_obj: Dict[str, Any]) -> bool:
    """Handle a command received via sys.stdin. Return False to terminate."""
    global companion_state

    cmd = cmd_obj.get("cmd")
    if not cmd:
        return True

    if cmd == "start_listening":
        start_audio_capture()
    elif cmd == "stop_listening":
        stop_audio_capture()
    elif cmd == "set_state":
        next_state = cmd_obj.get("state", "sleeping")
        if next_state in ("sleeping", "awake"):
            companion_state = next_state
            emit_event("state_changed", {"state": companion_state})
    elif cmd == "get_status":
        emit_event("status", get_current_status())
    elif cmd == "simulate_wake" or cmd == "simulate_detection":
        ww = cmd_obj.get("wake_word", TARGET_WAKE_WORD)
        trigger_simulated_detection(ww)
    elif cmd == "ping":
        emit_event("pong", {"timestamp": int(time.time() * 1000)})
    elif cmd == "quit":
        stop_audio_capture()
        emit_event("exited")
        sys.stderr.write("[wake_word_detector] Quit command received. Exiting.\n")
        os._exit(0)
    return True


def stdin_reader_loop() -> None:
    """Continuously read commands from sys.stdin line-by-line without read-ahead buffering."""
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            cmd_data = json.loads(line)
            if not handle_command(cmd_data):
                break
        except json.JSONDecodeError as err:
            emit_event("error", {"code": "MALFORMED_JSON", "message": str(err)})
        except Exception as err:
            emit_event("error", {"code": "COMMAND_ERROR", "message": str(err)})

    stop_audio_capture()


def main():
    parser = argparse.ArgumentParser(description="Desktop-Assistant Wake Word Detector")
    parser.add_argument("--model-dir", type=str, default=None, help="Directory containing wake-word models")
    parser.add_argument("--start-listening", action="store_true", help="Start listening immediately on launch")
    parser.add_argument("--test-mode", action="store_true", help="Run self-test and output status")
    args = parser.parse_args()

    # Determine model directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    default_model_dir = os.path.join(project_root, "models", "wake_words")
    model_dir = args.model_dir if args.model_dir else default_model_dir

    init_wake_word_model(model_dir)

    # Initial ready notification
    emit_event("ready", get_current_status())

    if args.test_mode:
        emit_event("status", get_current_status())
        return

    if args.start_listening:
        start_audio_capture()

    try:
        stdin_reader_loop()
    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        stop_audio_capture()
        sys.stderr.write("[wake_word_detector] Exiting cleanly.\n")


if __name__ == "__main__":
    main()
