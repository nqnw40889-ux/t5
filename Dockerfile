FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt fastapi uvicorn python-multipart

COPY *.py ./
COPY web_app/run.py ./web_app/run.py
COPY web_app/backend/ ./web_app/backend/
COPY data/ ./data/
COPY ket_qua/ ./ket_qua/

USER 10001:10001
CMD ["python", "web_app/run.py"]
