FROM python:3.11-slim

WORKDIR /app

# System deps needed to build psycopg2-binary's dependencies on slim images
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render/Railway set $PORT for you; default to 8000 for local `docker run`
ENV PORT=8000
EXPOSE 8000

# Run migrations, then start the server. If migrations fail, the
# container fails to start instead of serving against a stale schema.
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
