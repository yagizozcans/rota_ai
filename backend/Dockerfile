# Shared image for BOTH the API and the Celery worker (docs/06-infra-devops.md §2).
# The command differs per service in docker-compose.yml.
FROM python:3.11-slim

# psycopg2 + geo libs need these at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
# Install runtime deps (no ML — stub mode). To run the real model, extend this
# image with:  pip install -e '.[ml]'  and mount/install the ai-pipeline package,
# then set WEIGHTS_PATH. The API layer is untouched either way.
RUN pip install --no-cache-dir \
        "fastapi>=0.115" "uvicorn[standard]>=0.30" "python-multipart>=0.0.9" \
        "celery>=5.4" "redis>=5.0" "sqlalchemy>=2.0" "geoalchemy2>=0.15" \
        "psycopg2-binary>=2.9" "pydantic>=2.7" "pydantic-settings>=2.3"

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
