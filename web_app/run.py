"""Launcher for AI4I Predictive Maintenance Web Application.
Usage:
    python web_app/run.py
"""
import sys
import os
import webbrowser
from pathlib import Path
import uvicorn

# Ensure root and backend are in sys.path
CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent
BACKEND_DIR = CURRENT_DIR / "backend"

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

def main():
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    url = f"http://{host}:{port}"
    
    print("=" * 70)
    print("  HỆ THỐNG DỰ ĐOÁN HỎNG HÓC MÁY PHỤC VỤ BẢO TRÌ DỰ ĐOÁN (AI4I 2020)")
    print("  Nhóm 16 - Mô hình LightGBM (Winner Profile 3) | Ngưỡng 31.54%")
    print("=" * 70)
    print(f"[*] Website đang chạy tại: {url}")
    print("[*] Đang phục vụ API tại:  {url}/api/health")
    print("[*] Nhấn Ctrl+C để dừng server.")
    print("=" * 70)

    uvicorn.run("main:app", host=host, port=port, app_dir=str(BACKEND_DIR), log_level="info")

if __name__ == "__main__":
    main()
