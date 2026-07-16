-- RotaAI schema (docs/04-gis-data.md §4). Runs once on first DB init.
-- Source of truth for tables; app/models.py mirrors it. All geometry is
-- geometry(Point, 4326) — raw WGS84; transforms happen at export (docs/04 §3).

CREATE EXTENSION IF NOT EXISTS postgis;

-- sürüş oturumları
CREATE TABLE IF NOT EXISTS sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id   TEXT,
    user_id     UUID,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at    TIMESTAMPTZ,
    status      TEXT NOT NULL DEFAULT 'active'   -- active | completed
);

-- çekilen kareler
CREATE TABLE IF NOT EXISTS frames (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    device_id         TEXT,
    captured_at       TIMESTAMPTZ,
    geom              geometry(Point, 4326),
    gps_lat           DOUBLE PRECISION,
    gps_lon           DOUBLE PRECISION,
    heading_deg       DOUBLE PRECISION,
    gps_accuracy_m    DOUBLE PRECISION,
    speed_kmh         DOUBLE PRECISION,
    image_ref         TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'pending',  -- pending|processing|done|error
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_frames_geom ON frames USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_frames_session ON frames (session_id);

-- AI tespitleri
CREATE TABLE IF NOT EXISTS detections (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    frame_id      UUID NOT NULL REFERENCES frames(id) ON DELETE CASCADE,
    type          TEXT NOT NULL DEFAULT 'asset',   -- asset | damage
    class         TEXT NOT NULL,
    bbox          JSONB NOT NULL,                  -- [x, y, w, h] pixels
    confidence    DOUBLE PRECISION NOT NULL,
    model_version TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_detections_frame ON detections (frame_id);

-- koordinatlandırılmış envanter (00-overview §4.3)
CREATE TABLE IF NOT EXISTS inventory_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detection_id  UUID NOT NULL REFERENCES detections(id) ON DELETE CASCADE,
    geom          geometry(Point, 4326) NOT NULL,
    srid_source   INTEGER NOT NULL DEFAULT 4326,
    type          TEXT NOT NULL DEFAULT 'asset',
    class         TEXT NOT NULL,
    severity      TEXT,                            -- low | medium | high | null
    review_status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected|corrected
    reviewer_id   UUID,
    reviewed_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_geom ON inventory_items USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items (review_status);

-- reddedilen/düzeltilen örnekler → 02 active learning (docs/04 §7)
CREATE TABLE IF NOT EXISTS training_feedback (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    detection_id      UUID,
    original_class    TEXT,
    corrected_class   TEXT,
    decision          TEXT NOT NULL,               -- rejected | corrected
    image_ref         TEXT,
    bbox              JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
