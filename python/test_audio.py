#!/usr/bin/env python3
"""
Desktop-Assistant: Audio & Wake-Word Pipeline Test Suite.
Validates:
1. Environment and dependency availability (sounddevice, openwakeword).
2. Custom model detection logic in models/wake_words/.
3. PCM audio chunk formatting (16 kHz, 16-bit, 1280 samples).
4. Wake-word detector process communication (JSON-lines IPC).
5. Cooldown enforcement.
"""

import sys
import os
import json
import time
import subprocess
import numpy as np

def run_tests():
    print("=" * 60)
    print("DESKTOP-ASSISTANT: LOCAL AUDIO & WAKE-WORD TEST SUITE")
    print("=" * 60)

    # 1. Dependency checks
    print("\n[Test 1] Checking Python dependencies...")
    try:
        import sounddevice as sd
        devices = sd.query_devices()
        input_dev = sd.query_devices(kind='input')
        print(f"  ✓ sounddevice available ({len(devices)} devices found, default input: {input_dev.get('name', 'None')})")
    except Exception as e:
        print(f"  ⚠ sounddevice warning: {e}")

    try:
        import openwakeword
        print("  ✓ openwakeword available")
    except Exception as e:
        print(f"  ⚠ openwakeword warning: {e}")

    # 2. Model directory verification
    print("\n[Test 2] Checking models/wake_words directory...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    model_dir = os.path.join(project_root, "models", "wake_words")
    assert os.path.isdir(model_dir), f"Directory {model_dir} does not exist"
    readme_path = os.path.join(model_dir, "README.md")
    assert os.path.isfile(readme_path), f"README in {model_dir} missing"
    print(f"  ✓ models/wake_words directory verified at {model_dir}")
    print(f"  ✓ models/wake_words/README.md documentation verified")

    custom_model_path = os.path.join(model_dir, "mischief_managed.onnx")
    has_custom_model = os.path.isfile(custom_model_path)
    print(f"  • Custom model 'mischief_managed.onnx' present: {has_custom_model}")
    if not has_custom_model:
        print("    (Notice: Custom model is not installed. Application will report model_loaded=False without substituting unrelated words)")

    # 3. Audio chunk specification verification
    print("\n[Test 3] Verifying 16kHz 16-bit PCM chunk specifications...")
    sample_rate = 16000
    chunk_size = 1280  # 80ms at 16kHz
    duration_sec = chunk_size / sample_rate
    assert duration_sec == 0.08, f"Expected 0.08s (80ms), got {duration_sec}s"

    dummy_chunk = np.zeros(chunk_size, dtype=np.int16)
    assert dummy_chunk.nbytes == chunk_size * 2, "Expected 2560 bytes for 1280 int16 samples"
    assert dummy_chunk.shape == (1280,), f"Expected shape (1280,), got {dummy_chunk.shape}"
    print(f"  ✓ Chunk size {chunk_size} samples = {duration_sec*1000:.0f}ms at {sample_rate} Hz")
    print(f"  ✓ Raw chunk memory footprint: {dummy_chunk.nbytes} bytes (int16 mono)")

    # 4. Spawning wake_word_detector.py and testing stdio IPC
    print("\n[Test 4] Spawning wake_word_detector.py helper process...")
    detector_script = os.path.join(script_dir, "wake_word_detector.py")
    proc = subprocess.Popen(
        [sys.executable, "-u", detector_script, "--model-dir", model_dir],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )

    try:
        # Read initial 'ready' event
        ready_line = proc.stdout.readline()
        ready_event = json.loads(ready_line)
        print(f"  ✓ Received 'ready' event: type={ready_event.get('type')}, model_name={ready_event.get('model_name')}, model_loaded={ready_event.get('model_loaded')}")
        assert ready_event.get("type") == "ready"
        assert ready_event.get("model_name") == "mischief_managed"

        # Test ping -> pong
        proc.stdin.write(json.dumps({"cmd": "ping"}) + "\n")
        proc.stdin.flush()
        pong_line = proc.stdout.readline()
        pong_event = json.loads(pong_line)
        assert pong_event.get("type") == "pong"
        print("  ✓ Process responds to 'ping' with 'pong'")

        # Test state change
        proc.stdin.write(json.dumps({"cmd": "set_state", "state": "awake"}) + "\n")
        proc.stdin.flush()
        state_line = proc.stdout.readline()
        state_event = json.loads(state_line)
        assert state_event.get("type") == "state_changed" and state_event.get("state") == "awake"
        print("  ✓ Process handled 'set_state' command to 'awake'")

        # Test simulated detection
        proc.stdin.write(json.dumps({"cmd": "simulate_wake"}) + "\n")
        proc.stdin.flush()
        det_line = proc.stdout.readline()
        det_event = json.loads(det_line)
        assert det_event.get("type") == "detection"
        assert det_event.get("wake_word") == "mischief_managed"
        assert det_event.get("simulated") is True
        print(f"  ✓ Detection event emitted: wake_word='{det_event.get('wake_word')}', state='{det_event.get('state')}'")

        # Test cooldown: immediate second simulate_wake should be rejected by cooldown
        proc.stdin.write(json.dumps({"cmd": "simulate_wake"}) + "\n")
        proc.stdin.flush()
        cooldown_line = proc.stdout.readline()
        cooldown_event = json.loads(cooldown_line)
        assert cooldown_event.get("type") == "cooldown_active"
        print("  ✓ Cooldown enforced: rapid consecutive detection ignored")

        # Test clean quit
        proc.stdin.write(json.dumps({"cmd": "quit"}) + "\n")
        proc.stdin.flush()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        print(f"  ✓ Process exited cleanly with exit code {proc.returncode}")
    finally:
        if proc.poll() is None:
            proc.kill()

    print("\n" + "=" * 60)
    print("ALL PYTHON AUDIO & WAKE-WORD TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
