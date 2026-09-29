-- Local-only fixtures for `npm run verify:release` (authenticated walk +
-- draft-recovery gate). Applied with `wrangler d1 execute --local` against the
-- dev persistence in .wrangler/state — NEVER against production D1, and never
-- committed as live data. Idempotent: every statement is an upsert keyed to the
-- fixed fixture ids, so repeated gate runs converge to the same state.
-- Placeholders __USER_ID__ / __JOURNEY_ID__ / __THREAD_ID__ are replaced by
-- scripts/verify-release.mjs with deterministic uuids.
INSERT INTO users (id, email, password_hash, password_salt, subscription_tier, email_verified, token_version, memory_mode)
VALUES ('__USER_ID__', 'verify-release@local.test', 'seed-no-login', 'seed-no-login', 'free', 1, 1, 'server')
ON CONFLICT(id) DO UPDATE SET
  email = excluded.email,
  subscription_tier = 'free',
  email_verified = 1,
  token_version = 1,
  memory_mode = 'server';

-- Non-empty baseline so /chat does not redirect to /baseline during the walk.
INSERT INTO baselines (user_id, nasa_jpl_json_data)
VALUES ('__USER_ID__', '{}')
ON CONFLICT(user_id) DO UPDATE SET nasa_jpl_json_data = '{}';

-- An active journey with real progress, so the JourneyBar reveal is exercised
-- on mount of the live /chat page (null → loaded → animated 0fr→1fr row).
INSERT INTO journeys (id, user_id, goal, current_step, steps_json, milestones_json, visual_progress, status)
VALUES (
  '__JOURNEY_ID__',
  '__USER_ID__',
  'Work through the tension with my partner',
  'widen-the-frame',
  '[{"id":"surface-signal","label":"Say what''s landing","status":"done"},{"id":"name-what-landed","label":"Name what crossed the line","status":"done"},{"id":"separate-the-parts","label":"Separate what''s yours from what''s theirs","status":"done"},{"id":"widen-the-frame","label":"See the fuller picture","status":"current"},{"id":"grounded-next-step","label":"Choose one grounded next step","status":"locked"}]',
  '["signal-surfaced","meaning-clarified","parts-separated"]',
  0.55,
  'active'
)
ON CONFLICT(id) DO UPDATE SET
  goal = excluded.goal,
  current_step = excluded.current_step,
  steps_json = excluded.steps_json,
  milestones_json = excluded.milestones_json,
  visual_progress = 0.55,
  status = 'active';

-- One seeded thread so the transcript (not the empty state) renders, and so
-- the draft-recovery retry can assert "exactly one copy of my words".
INSERT INTO threads (id, user_id, message_history, journey_id)
VALUES (
  '__THREAD_ID__',
  '__USER_ID__',
  '[{"role":"user","content":"Help me see the pattern I keep bringing into this conversation."},{"role":"assistant","content":"You keep naming the same tension twice in one breath. That repetition is the pattern worth looking at."}]',
  '__JOURNEY_ID__'
)
ON CONFLICT(id) DO UPDATE SET
  message_history = excluded.message_history,
  journey_id = excluded.journey_id;

-- A second, paused journey and a second thread that links it. Together they
-- make thread switching falsifiable: opening thread two must show THIS goal in
-- the compact band (not the active journey's), and starting a new chat must
-- fall back to the active one. Thread two carries an old updated_at on purpose
-- — the fixture thread above must stay the one /chat opens first, because
-- several gates assert against its transcript.
INSERT INTO journeys (id, user_id, goal, current_step, steps_json, milestones_json, visual_progress, status)
VALUES (
  '__JOURNEY2_ID__',
  '__USER_ID__',
  'Stop replaying the argument at three in the morning',
  'surface-signal',
  '[{"id":"surface-signal","label":"Say what''s landing","status":"current"},{"id":"name-what-landed","label":"Name what crossed the line","status":"locked"},{"id":"separate-the-parts","label":"Separate what''s yours from what''s theirs","status":"locked"},{"id":"widen-the-frame","label":"See the fuller picture","status":"locked"},{"id":"grounded-next-step","label":"Choose one grounded next step","status":"locked"}]',
  '[]',
  0,
  'paused'
)
ON CONFLICT(id) DO UPDATE SET
  goal = excluded.goal,
  current_step = excluded.current_step,
  steps_json = excluded.steps_json,
  milestones_json = '[]',
  visual_progress = 0,
  status = 'paused';

INSERT INTO threads (id, user_id, message_history, journey_id, created_at, updated_at)
VALUES (
  '__THREAD2_ID__',
  '__USER_ID__',
  '[{"role":"user","content":"Second thread: why do I defend people who never accused me?"},{"role":"assistant","content":"That question arrived already answered — notice how fast the defence went up."}]',
  '__JOURNEY2_ID__',
  '2026-01-01 00:00:00',
  '2026-01-01 00:00:00'
)
ON CONFLICT(id) DO UPDATE SET
  message_history = excluded.message_history,
  journey_id = excluded.journey_id,
  updated_at = '2026-01-01 00:00:00';
