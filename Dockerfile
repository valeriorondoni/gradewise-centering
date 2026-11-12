# Container for hosting the test site (Render, Railway, Fly.io, Hugging Face Spaces...)
#
# The host must set:
#   GRADEWISE_PASSWORD  team password (8+ plain characters)
#   DATA_DIR            folder on a persistent disk, e.g. /data (otherwise the
#                       test history is lost on every restart)
# PORT is set by the host; 8000 is used when it isn't.
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py ./

EXPOSE 8000
CMD ["python", "webapp.py", "--deploy"]
