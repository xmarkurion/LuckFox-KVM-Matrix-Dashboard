FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AGENT_HOST=0.0.0.0 \
    AGENT_PORT=8799 \
    SCRIPT_PATH=/scripts/host_action.py \
    SCRIPT_TIMEOUT_SECONDS=60

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts-default
RUN mkdir -p /scripts && \
    if [ ! -f /scripts/host_action.py ]; then cp /app/scripts-default/host_action.py /scripts/host_action.py; fi

EXPOSE 8799

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8799/health', timeout=3).read()" || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host ${AGENT_HOST} --port ${AGENT_PORT}"]
