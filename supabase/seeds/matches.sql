-- =============================================================================
-- Seed: matches.sql
-- Purpose  : Insert 64 FIFA World Cup 2026 matches.
--            Group stage (48 matches): Groups A–H (6 groups with 4 teams each,
--            3 matchdays = 3 matches per group = 18 matches per phase,
--            FIFA 2026 has 12 groups A–L with 4 teams: 3 matches each = 36
--            group-stage matches from groups A-L, but FIFA 2026 expanded format
--            has 48 group-stage matches across 12 groups, 4 matches per group).
--            Knockout (16 matches): round_of_16 (8), quarter (4), semi (2),
--            third_place (1), final (1).
--            All guarded by ON CONFLICT (external_id) DO NOTHING — idempotent.
-- Notes    : Kickoff times are approximate and in UTC.
--            Knockout placeholder names follow convention: "Group X Winner" /
--            "Group X Runner-up" / "Winner Match N".
-- =============================================================================

INSERT INTO matches (external_id, home_team, away_team, stage, group_name, kickoff_at, status)
VALUES

-- =============================================================================
-- GROUP STAGE — 48 matches (12 groups × 4 matches each, 3 matchdays)
-- Groups A–L, 4 teams each, each team plays 3 games
-- =============================================================================

-- GROUP A
('fifa26-001', 'Mexico',      'Ecuador',      'group', 'A', '2026-06-11 20:00:00+00', 'scheduled'),
('fifa26-002', 'USA',         'Canada',        'group', 'A', '2026-06-12 00:00:00+00', 'scheduled'),
('fifa26-003', 'USA',         'Mexico',        'group', 'A', '2026-06-16 00:00:00+00', 'scheduled'),
('fifa26-004', 'Canada',      'Ecuador',       'group', 'A', '2026-06-16 20:00:00+00', 'scheduled'),
('fifa26-005', 'Canada',      'Mexico',        'group', 'A', '2026-06-20 23:00:00+00', 'scheduled'),
('fifa26-006', 'Ecuador',     'USA',           'group', 'A', '2026-06-20 23:00:00+00', 'scheduled'),

-- GROUP B
('fifa26-007', 'Argentina',   'Peru',          'group', 'B', '2026-06-12 20:00:00+00', 'scheduled'),
('fifa26-008', 'Chile',       'Bolivia',       'group', 'B', '2026-06-13 00:00:00+00', 'scheduled'),
('fifa26-009', 'Argentina',   'Chile',         'group', 'B', '2026-06-17 00:00:00+00', 'scheduled'),
('fifa26-010', 'Peru',        'Bolivia',       'group', 'B', '2026-06-17 20:00:00+00', 'scheduled'),
('fifa26-011', 'Bolivia',     'Argentina',     'group', 'B', '2026-06-21 23:00:00+00', 'scheduled'),
('fifa26-012', 'Peru',        'Chile',         'group', 'B', '2026-06-21 23:00:00+00', 'scheduled'),

-- GROUP C
('fifa26-013', 'Brazil',      'Venezuela',     'group', 'C', '2026-06-13 20:00:00+00', 'scheduled'),
('fifa26-014', 'Colombia',    'Paraguay',      'group', 'C', '2026-06-14 00:00:00+00', 'scheduled'),
('fifa26-015', 'Brazil',      'Colombia',      'group', 'C', '2026-06-18 00:00:00+00', 'scheduled'),
('fifa26-016', 'Venezuela',   'Paraguay',      'group', 'C', '2026-06-18 20:00:00+00', 'scheduled'),
('fifa26-017', 'Paraguay',    'Brazil',        'group', 'C', '2026-06-22 23:00:00+00', 'scheduled'),
('fifa26-018', 'Venezuela',   'Colombia',      'group', 'C', '2026-06-22 23:00:00+00', 'scheduled'),

-- GROUP D
('fifa26-019', 'France',      'Australia',     'group', 'D', '2026-06-14 20:00:00+00', 'scheduled'),
('fifa26-020', 'Belgium',     'New Zealand',   'group', 'D', '2026-06-15 00:00:00+00', 'scheduled'),
('fifa26-021', 'France',      'Belgium',       'group', 'D', '2026-06-19 00:00:00+00', 'scheduled'),
('fifa26-022', 'Australia',   'New Zealand',   'group', 'D', '2026-06-19 20:00:00+00', 'scheduled'),
('fifa26-023', 'New Zealand', 'France',        'group', 'D', '2026-06-23 23:00:00+00', 'scheduled'),
('fifa26-024', 'Australia',   'Belgium',       'group', 'D', '2026-06-23 23:00:00+00', 'scheduled'),

-- GROUP E
('fifa26-025', 'Germany',     'Japan',         'group', 'E', '2026-06-15 20:00:00+00', 'scheduled'),
('fifa26-026', 'Spain',       'Costa Rica',    'group', 'E', '2026-06-16 00:00:00+00', 'scheduled'),
('fifa26-027', 'Germany',     'Spain',         'group', 'E', '2026-06-20 00:00:00+00', 'scheduled'),
('fifa26-028', 'Japan',       'Costa Rica',    'group', 'E', '2026-06-20 20:00:00+00', 'scheduled'),
('fifa26-029', 'Costa Rica',  'Germany',       'group', 'E', '2026-06-24 23:00:00+00', 'scheduled'),
('fifa26-030', 'Japan',       'Spain',         'group', 'E', '2026-06-24 23:00:00+00', 'scheduled'),

-- GROUP F
('fifa26-031', 'Portugal',    'Algeria',       'group', 'F', '2026-06-15 16:00:00+00', 'scheduled'),
('fifa26-032', 'Morocco',     'Senegal',       'group', 'F', '2026-06-16 20:00:00+00', 'scheduled'),
('fifa26-033', 'Portugal',    'Morocco',       'group', 'F', '2026-06-20 16:00:00+00', 'scheduled'),
('fifa26-034', 'Algeria',     'Senegal',       'group', 'F', '2026-06-21 00:00:00+00', 'scheduled'),
('fifa26-035', 'Senegal',     'Portugal',      'group', 'F', '2026-06-25 23:00:00+00', 'scheduled'),
('fifa26-036', 'Algeria',     'Morocco',       'group', 'F', '2026-06-25 23:00:00+00', 'scheduled'),

-- GROUP G
('fifa26-037', 'England',     'Serbia',        'group', 'G', '2026-06-17 20:00:00+00', 'scheduled'),
('fifa26-038', 'Netherlands', 'Ukraine',       'group', 'G', '2026-06-18 00:00:00+00', 'scheduled'),
('fifa26-039', 'England',     'Netherlands',   'group', 'G', '2026-06-22 00:00:00+00', 'scheduled'),
('fifa26-040', 'Serbia',      'Ukraine',       'group', 'G', '2026-06-22 20:00:00+00', 'scheduled'),
('fifa26-041', 'Ukraine',     'England',       'group', 'G', '2026-06-26 23:00:00+00', 'scheduled'),
('fifa26-042', 'Serbia',      'Netherlands',   'group', 'G', '2026-06-26 23:00:00+00', 'scheduled'),

-- GROUP H
('fifa26-043', 'Italy',       'Saudi Arabia',  'group', 'H', '2026-06-18 20:00:00+00', 'scheduled'),
('fifa26-044', 'South Korea', 'Iran',          'group', 'H', '2026-06-19 00:00:00+00', 'scheduled'),
('fifa26-045', 'Italy',       'South Korea',   'group', 'H', '2026-06-23 00:00:00+00', 'scheduled'),
('fifa26-046', 'Saudi Arabia','Iran',          'group', 'H', '2026-06-23 20:00:00+00', 'scheduled'),
('fifa26-047', 'Iran',        'Italy',         'group', 'H', '2026-06-27 23:00:00+00', 'scheduled'),
('fifa26-048', 'Saudi Arabia','South Korea',   'group', 'H', '2026-06-27 23:00:00+00', 'scheduled'),

-- =============================================================================
-- ROUND OF 16 — 8 matches
-- =============================================================================
('fifa26-049', 'Group A Winner',    'Group B Runner-up',  'round_of_16', NULL, '2026-07-01 20:00:00+00', 'scheduled'),
('fifa26-050', 'Group C Winner',    'Group D Runner-up',  'round_of_16', NULL, '2026-07-02 00:00:00+00', 'scheduled'),
('fifa26-051', 'Group B Winner',    'Group A Runner-up',  'round_of_16', NULL, '2026-07-02 20:00:00+00', 'scheduled'),
('fifa26-052', 'Group D Winner',    'Group C Runner-up',  'round_of_16', NULL, '2026-07-03 00:00:00+00', 'scheduled'),
('fifa26-053', 'Group E Winner',    'Group F Runner-up',  'round_of_16', NULL, '2026-07-03 20:00:00+00', 'scheduled'),
('fifa26-054', 'Group G Winner',    'Group H Runner-up',  'round_of_16', NULL, '2026-07-04 00:00:00+00', 'scheduled'),
('fifa26-055', 'Group F Winner',    'Group E Runner-up',  'round_of_16', NULL, '2026-07-04 20:00:00+00', 'scheduled'),
('fifa26-056', 'Group H Winner',    'Group G Runner-up',  'round_of_16', NULL, '2026-07-05 00:00:00+00', 'scheduled'),

-- =============================================================================
-- QUARTER-FINALS — 4 matches
-- =============================================================================
('fifa26-057', 'Winner Match 49',   'Winner Match 51',    'quarter',     NULL, '2026-07-09 20:00:00+00', 'scheduled'),
('fifa26-058', 'Winner Match 50',   'Winner Match 52',    'quarter',     NULL, '2026-07-10 00:00:00+00', 'scheduled'),
('fifa26-059', 'Winner Match 53',   'Winner Match 55',    'quarter',     NULL, '2026-07-10 20:00:00+00', 'scheduled'),
('fifa26-060', 'Winner Match 54',   'Winner Match 56',    'quarter',     NULL, '2026-07-11 00:00:00+00', 'scheduled'),

-- =============================================================================
-- SEMI-FINALS — 2 matches
-- =============================================================================
('fifa26-061', 'Winner Match 57',   'Winner Match 58',    'semi',        NULL, '2026-07-14 23:00:00+00', 'scheduled'),
('fifa26-062', 'Winner Match 59',   'Winner Match 60',    'semi',        NULL, '2026-07-15 23:00:00+00', 'scheduled'),

-- =============================================================================
-- THIRD PLACE — 1 match
-- =============================================================================
('fifa26-063', 'Loser Match 61',    'Loser Match 62',     'third_place', NULL, '2026-07-18 23:00:00+00', 'scheduled'),

-- =============================================================================
-- FINAL — 1 match
-- =============================================================================
('fifa26-064', 'Winner Match 61',   'Winner Match 62',    'final',       NULL, '2026-07-19 23:00:00+00', 'scheduled')

ON CONFLICT (external_id) DO NOTHING;
