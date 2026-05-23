from flask import Flask, render_template
from flask_socketio import SocketIO
import serial
import json
import csv
from datetime import datetime
import threading
 
app = Flask(__name__)
socketio = SocketIO(app)
 
# ── SERIAL CONFIG ──
SERIAL_PORT = 'COM17'
BAUD_RATE   = 115200
 
# ── SERIAL CONNECTION ──
ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
 
# ── CSV FILE ──
csv_file   = open('data.csv', 'a', newline='')
csv_writer = csv.writer(csv_file)
 
# ── CSV HEADER (all fields the dashboard uses) ──
csv_writer.writerow([
    'timestamp',
    'pitch',
    'posture',
    'severity',
    'score',
    'sitting',
    'slouch_count',
    'slouch_detected',
    'slouch_confirmed',
    'worsening_count',
    'pomodoro_running',
    'on_break',
    'paused_by_slouch',
    'remaining_seconds',
    'timer',
    'pomodoro_message',
    'session_changed',
    'vibration_active',
    'buzzer_active',
    'uptime_ms'
])
 
# ── SESSION SUMMARY STATE ──
# Tracks when remaining_seconds crosses zero so we can log it once
_prev_remaining = None
_prev_on_break  = None
 
@app.route('/')
def index():
    return render_template('index.html')
 
def read_serial():
    global _prev_remaining, _prev_on_break
 
    while True:
        try:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
 
            if not line:
                continue
 
            print("RAW:", line)
 
            if line.startswith('{') and line.endswith('}'):
                data = json.loads(line)
                print("JSON:", data)
 
                now = datetime.now()
 
                # ── SAVE TO CSV ──
                csv_writer.writerow([
                    now,
                    data.get('pitch',            0),
                    data.get('posture',          ''),
                    data.get('severity',         ''),
                    data.get('score',            0),
                    data.get('sitting',          0),
                    data.get('slouch_count',     0),
                    data.get('slouch_detected',  0),
                    data.get('slouch_confirmed', 0),
                    data.get('worsening_count',  0),
                    data.get('pomodoro_running', 0),
                    data.get('on_break',         0),
                    data.get('paused_by_slouch', 0),
                    data.get('remaining_seconds',0),
                    data.get('timer',            ''),
                    data.get('pomodoro_message', ''),
                    data.get('session_changed',  0),
                    data.get('vibration_active', 0),
                    data.get('buzzer_active',    0),
                    data.get('uptime_ms',        0),
                ])
                csv_file.flush()
 
                # ── DETECT POMODORO FINISH → log to console ──
                curr_remaining = int(data.get('remaining_seconds', -1))
                curr_on_break  = bool(data.get('on_break', 0))
 
                if _prev_remaining is not None and _prev_remaining > 0 and curr_remaining == 0:
                    session_type = 'Break' if curr_on_break else 'Focus'
                    print(f"[SUMMARY] {session_type} session finished at {now.strftime('%H:%M:%S')} "
                          f"| Slouches: {data.get('slouch_count', 0)} "
                          f"| SSI: {data.get('score', 0)}/10 "
                          f"| Posture: {data.get('posture', '?')}")
 
                if _prev_on_break is not None and _prev_on_break != curr_on_break:
                    new_type = 'Break' if curr_on_break else 'Focus'
                    print(f"[POMO] Session changed → {new_type} started at {now.strftime('%H:%M:%S')}")
 
                _prev_remaining = curr_remaining
                _prev_on_break  = curr_on_break
 
                # ── SEND ALL DATA TO DASHBOARD ──
                socketio.emit('sensor_data', data)
 
        except json.JSONDecodeError as e:
            print("JSON ERROR:", e)
        except Exception as e:
            print("ERROR:", e)
 
if __name__ == '__main__':
    print(f"Serial connected on {SERIAL_PORT} at {BAUD_RATE} baud")
    thread = threading.Thread(target=read_serial)
    thread.daemon = True
    thread.start()
    socketio.run(app, debug=True, use_reloader=False)