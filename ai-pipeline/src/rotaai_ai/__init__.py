"""RotaAI AI pipeline — road-asset detection (Layer 02).

Core value engine of the MVP. See docs/02-ai-pipeline.md.

The public surface is intentionally small so the same inference code powers
both the manual CLI (scripts/predict.py) and the future backend Celery worker
(docs/03-backend-api.md §5):

    from rotaai_ai.detect import load_model, detect_image
    from rotaai_ai.schema import Detection
"""

__version__ = "0.1.0"
