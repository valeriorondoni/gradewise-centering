# Container for hosting the test site. Built for Hugging Face Spaces (Docker
# SDK); also works on Render, Railway, Fly.io...
#
# Set on the host (on Spaces: Settings -> Variables and secrets):
#   GRADEWISE_PASSWORD  secret: team password (8+ plain characters)
#   HF_TOKEN            secret: Hugging Face token with write access to the dataset
#   HF_DATASET          variable: dataset that keeps the test history,
#                       e.g. your-name/gradewise-tests (created private if missing)
# Instead of HF_DATASET, a host with a persistent disk can set DATA_DIR to it.
FROM python:3.12-slim

# Spaces run the container as user 1000: give it a home it can write to
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR $HOME/app

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

COPY --chown=user *.py ./

EXPOSE 8000
CMD ["python", "webapp.py", "--deploy"]
