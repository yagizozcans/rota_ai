-- RotaAI schema (docs/04-gis-data.md §4). Runs once on first DB init.
-- Source of truth for tables; app/models.py mirrors it. All geometry is
-- geometry(Point, 4326) — raw WGS84; transforms happen at export (docs/04 §3).
--
-- Multi-tenant isolation (docs/00-overview §4.5, docs/04 §4, docs/06 §3): every
-- tenant-bound table carries org_id (FK → organizations) and is guarded by
-- Row-Level Security. The app sets the tenant per transaction via
--   SELECT set_config('app.current_org', '<org uuid>', true)
-- (see app/rls.py); policies below filter every row by it, so one org's query
-- can never return another org's data. Context unset ⇒ current_setting returns
-- NULL ⇒ predicate is false ⇒ zero rows (fail-closed).

CREATE EXTENSION IF NOT EXISTS postgis;

-- kiracılar (kurum/şirket) — kiracı anahtarının kök tablosu (docs/04 §4)
CREATE TABLE IF NOT EXISTS organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('kgm', 'belediye', 'ozel')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pilot tenants. The first id matches the pilot JWT's org_id (mobile config +
-- review console); the FK on every tenant row requires the org to exist. The
-- second is a distinct tenant used to verify isolation (docs/04 §9).
INSERT INTO organizations (id, name, type) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Pilot Kurumu (KGM)', 'kgm'),
    ('22222222-2222-2222-2222-222222222222', 'Test Belediyesi',    'belediye')
ON CONFLICT (id) DO NOTHING;

-- sürüş oturumları
CREATE TABLE IF NOT EXISTS sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id),  -- kiracı (00-overview §4.5); from the auth token
    device_id   TEXT,
    user_id     UUID,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at    TIMESTAMPTZ,
    status      TEXT NOT NULL DEFAULT 'active'   -- active | completed
);
CREATE INDEX IF NOT EXISTS idx_sessions_org ON sessions (org_id);

-- çekilen kareler
CREATE TABLE IF NOT EXISTS frames (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            UUID NOT NULL REFERENCES organizations(id),  -- kiracı (00-overview §4.5)
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
CREATE INDEX IF NOT EXISTS idx_frames_org ON frames (org_id);

-- AI tespitleri
CREATE TABLE IF NOT EXISTS detections (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organizations(id),  -- kiracı (00-overview §4.5)
    frame_id      UUID NOT NULL REFERENCES frames(id) ON DELETE CASCADE,
    type          TEXT NOT NULL DEFAULT 'asset',   -- asset | damage
    class         TEXT NOT NULL,
    bbox          JSONB NOT NULL,                  -- [x, y, w, h] pixels
    confidence    DOUBLE PRECISION NOT NULL,
    model_version TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_detections_frame ON detections (frame_id);
CREATE INDEX IF NOT EXISTS idx_detections_org ON detections (org_id);

-- koordinatlandırılmış envanter (00-overview §4.3)
CREATE TABLE IF NOT EXISTS inventory_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organizations(id),  -- kiracı (00-overview §4.5)
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
CREATE INDEX IF NOT EXISTS idx_inventory_org ON inventory_items (org_id);

-- reddedilen/düzeltilen örnekler → 02 active learning (docs/04 §7)
CREATE TABLE IF NOT EXISTS training_feedback (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            UUID NOT NULL REFERENCES organizations(id),  -- kiracı (00-overview §4.5)
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    detection_id      UUID,
    original_class    TEXT,
    corrected_class   TEXT,
    decision          TEXT NOT NULL,               -- rejected | corrected
    image_ref         TEXT,
    bbox              JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_training_feedback_org ON training_feedback (org_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security (docs/04 §4, docs/06 §3) — tenant isolation by org_id.
--
-- Enforcement depends on WHO connects. A superuser (the bootstrap role, here
-- `rotaai` from POSTGRES_USER) bypasses RLS unconditionally — FORCE cannot stop
-- it. So the API and worker connect as `rotaai_app` below: a plain LOGIN role,
-- not a superuser and not the table owner, to which policies fully apply. FORCE
-- is set anyway so that even a maintenance connection as the owner obeys the
-- policy. Referential-integrity checks (the org FKs above) bypass RLS by design,
-- so they resolve regardless of the current tenant context.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['sessions', 'frames', 'detections', 'inventory_items', 'training_feedback']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
        -- NULLIF(..., '') so a context-less connection is fail-closed *gracefully*:
        -- an unset GUC reads as NULL, but once set_config has touched it on a
        -- pooled connection it reverts to '' after the (is_local) transaction, and
        -- ''::uuid would raise. NULLIF maps both to NULL ⇒ predicate false ⇒ 0 rows.
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I '
            'USING (org_id = NULLIF(current_setting(''app.current_org'', true), '''')::uuid) '
            'WITH CHECK (org_id = NULLIF(current_setting(''app.current_org'', true), '''')::uuid)', t);
    END LOOP;
END $$;

-- Non-superuser application role the API + worker connect as, so RLS actually
-- applies to them (see the note above). DML on the app tables; SELECT on the
-- rest of public (covers PostGIS spatial_ref_sys, which ST_Transform reads at
-- export). All ids are UUIDs (no sequences), so no sequence grants are needed.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rotaai_app') THEN
        CREATE ROLE rotaai_app LOGIN PASSWORD 'rotaai_app';
    END IF;
END $$;
GRANT USAGE ON SCHEMA public TO rotaai_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rotaai_app;
GRANT INSERT, UPDATE, DELETE ON sessions, frames, detections, inventory_items, training_feedback TO rotaai_app;
