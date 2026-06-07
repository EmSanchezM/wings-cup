-- =============================================================================
-- Seed: matches.sql
-- Purpose  : Insert the 104 official FIFA World Cup 2026 matches.
--            48 teams / 12 groups (A–L) = 72 group-stage matches, then
--            round_of_32 (16), round_of_16 (8), quarter (4), semi (2),
--            third_place (1), final (1).
-- Source   : Official FIFA schedule; kickoff times stored in UTC.
-- Notes    : Team names are in Spanish and MUST match shared/constants/team-flags.ts.
--            Knockout matchups are placeholders ("2do A", "1ro E vs Mejor 3ro …",
--            "Ganador P73", "Perdedor P101") — no flag, UI falls back to initials.
--            round_of_32 requires migration 00017. Idempotent via ON CONFLICT.
-- =============================================================================

INSERT INTO matches (external_id, home_team, away_team, stage, group_name, kickoff_at, status)
VALUES

-- GROUP STAGE — 72 matches (12 groups A–L, 4 teams each)
('fifa26-001', 'Mexico', 'Sudafrica', 'group', 'A', '2026-06-11 19:00:00+00', 'scheduled'),
('fifa26-002', 'Corea del Sur', 'Chequia', 'group', 'A', '2026-06-12 02:00:00+00', 'scheduled'),
('fifa26-003', 'Canada', 'Bosnia y Herzegovina', 'group', 'B', '2026-06-12 19:00:00+00', 'scheduled'),
('fifa26-004', 'Estados Unidos', 'Paraguay', 'group', 'D', '2026-06-13 01:00:00+00', 'scheduled'),
('fifa26-005', 'Qatar', 'Suiza', 'group', 'B', '2026-06-13 19:00:00+00', 'scheduled'),
('fifa26-006', 'Brasil', 'Marruecos', 'group', 'C', '2026-06-13 22:00:00+00', 'scheduled'),
('fifa26-007', 'Haiti', 'Escocia', 'group', 'C', '2026-06-14 01:00:00+00', 'scheduled'),
('fifa26-008', 'Australia', 'Turquia', 'group', 'D', '2026-06-14 04:00:00+00', 'scheduled'),
('fifa26-009', 'Alemania', 'Curazao', 'group', 'E', '2026-06-14 17:00:00+00', 'scheduled'),
('fifa26-010', 'Paises Bajos', 'Japon', 'group', 'F', '2026-06-14 20:00:00+00', 'scheduled'),
('fifa26-011', 'Costa de Marfil', 'Ecuador', 'group', 'E', '2026-06-14 23:00:00+00', 'scheduled'),
('fifa26-012', 'Suecia', 'Tunez', 'group', 'F', '2026-06-15 02:00:00+00', 'scheduled'),
('fifa26-013', 'Espana', 'Cabo Verde', 'group', 'H', '2026-06-15 16:00:00+00', 'scheduled'),
('fifa26-014', 'Belgica', 'Egipto', 'group', 'G', '2026-06-15 19:00:00+00', 'scheduled'),
('fifa26-015', 'Arabia Saudita', 'Uruguay', 'group', 'H', '2026-06-15 22:00:00+00', 'scheduled'),
('fifa26-016', 'Iran', 'Nueva Zelanda', 'group', 'G', '2026-06-16 01:00:00+00', 'scheduled'),
('fifa26-017', 'Francia', 'Senegal', 'group', 'I', '2026-06-16 19:00:00+00', 'scheduled'),
('fifa26-018', 'Irak', 'Noruega', 'group', 'I', '2026-06-16 22:00:00+00', 'scheduled'),
('fifa26-019', 'Argentina', 'Argelia', 'group', 'J', '2026-06-17 01:00:00+00', 'scheduled'),
('fifa26-020', 'Austria', 'Jordania', 'group', 'J', '2026-06-17 04:00:00+00', 'scheduled'),
('fifa26-021', 'Portugal', 'RD Congo', 'group', 'K', '2026-06-17 17:00:00+00', 'scheduled'),
('fifa26-022', 'Inglaterra', 'Croacia', 'group', 'L', '2026-06-17 20:00:00+00', 'scheduled'),
('fifa26-023', 'Ghana', 'Panama', 'group', 'L', '2026-06-17 23:00:00+00', 'scheduled'),
('fifa26-024', 'Uzbekistan', 'Colombia', 'group', 'K', '2026-06-18 02:00:00+00', 'scheduled'),
('fifa26-025', 'Chequia', 'Sudafrica', 'group', 'A', '2026-06-18 16:00:00+00', 'scheduled'),
('fifa26-026', 'Suiza', 'Bosnia y Herzegovina', 'group', 'B', '2026-06-18 19:00:00+00', 'scheduled'),
('fifa26-027', 'Canada', 'Qatar', 'group', 'B', '2026-06-18 22:00:00+00', 'scheduled'),
('fifa26-028', 'Mexico', 'Corea del Sur', 'group', 'A', '2026-06-19 01:00:00+00', 'scheduled'),
('fifa26-029', 'Estados Unidos', 'Australia', 'group', 'D', '2026-06-19 19:00:00+00', 'scheduled'),
('fifa26-030', 'Escocia', 'Marruecos', 'group', 'C', '2026-06-19 22:00:00+00', 'scheduled'),
('fifa26-031', 'Brasil', 'Haiti', 'group', 'C', '2026-06-20 00:30:00+00', 'scheduled'),
('fifa26-032', 'Turquia', 'Paraguay', 'group', 'D', '2026-06-20 03:00:00+00', 'scheduled'),
('fifa26-033', 'Paises Bajos', 'Suecia', 'group', 'F', '2026-06-20 17:00:00+00', 'scheduled'),
('fifa26-034', 'Alemania', 'Costa de Marfil', 'group', 'E', '2026-06-20 20:00:00+00', 'scheduled'),
('fifa26-035', 'Ecuador', 'Curazao', 'group', 'E', '2026-06-21 00:00:00+00', 'scheduled'),
('fifa26-036', 'Tunez', 'Japon', 'group', 'F', '2026-06-21 04:00:00+00', 'scheduled'),
('fifa26-037', 'Espana', 'Arabia Saudita', 'group', 'H', '2026-06-21 16:00:00+00', 'scheduled'),
('fifa26-038', 'Belgica', 'Iran', 'group', 'G', '2026-06-21 19:00:00+00', 'scheduled'),
('fifa26-039', 'Uruguay', 'Cabo Verde', 'group', 'H', '2026-06-21 22:00:00+00', 'scheduled'),
('fifa26-040', 'Nueva Zelanda', 'Egipto', 'group', 'G', '2026-06-22 01:00:00+00', 'scheduled'),
('fifa26-041', 'Argentina', 'Austria', 'group', 'J', '2026-06-22 17:00:00+00', 'scheduled'),
('fifa26-042', 'Francia', 'Irak', 'group', 'I', '2026-06-22 21:00:00+00', 'scheduled'),
('fifa26-043', 'Noruega', 'Senegal', 'group', 'I', '2026-06-23 00:00:00+00', 'scheduled'),
('fifa26-044', 'Jordania', 'Argelia', 'group', 'J', '2026-06-23 03:00:00+00', 'scheduled'),
('fifa26-045', 'Portugal', 'Uzbekistan', 'group', 'K', '2026-06-23 17:00:00+00', 'scheduled'),
('fifa26-046', 'Inglaterra', 'Ghana', 'group', 'L', '2026-06-23 20:00:00+00', 'scheduled'),
('fifa26-047', 'Panama', 'Croacia', 'group', 'L', '2026-06-23 23:00:00+00', 'scheduled'),
('fifa26-048', 'Colombia', 'RD Congo', 'group', 'K', '2026-06-24 02:00:00+00', 'scheduled'),
('fifa26-049', 'Suiza', 'Canada', 'group', 'B', '2026-06-24 19:00:00+00', 'scheduled'),
('fifa26-050', 'Bosnia y Herzegovina', 'Qatar', 'group', 'B', '2026-06-24 19:00:00+00', 'scheduled'),
('fifa26-051', 'Escocia', 'Brasil', 'group', 'C', '2026-06-24 22:00:00+00', 'scheduled'),
('fifa26-052', 'Marruecos', 'Haiti', 'group', 'C', '2026-06-24 22:00:00+00', 'scheduled'),
('fifa26-053', 'Chequia', 'Mexico', 'group', 'A', '2026-06-25 01:00:00+00', 'scheduled'),
('fifa26-054', 'Sudafrica', 'Corea del Sur', 'group', 'A', '2026-06-25 01:00:00+00', 'scheduled'),
('fifa26-055', 'Curazao', 'Costa de Marfil', 'group', 'E', '2026-06-25 20:00:00+00', 'scheduled'),
('fifa26-056', 'Ecuador', 'Alemania', 'group', 'E', '2026-06-25 20:00:00+00', 'scheduled'),
('fifa26-057', 'Japon', 'Suecia', 'group', 'F', '2026-06-25 23:00:00+00', 'scheduled'),
('fifa26-058', 'Tunez', 'Paises Bajos', 'group', 'F', '2026-06-25 23:00:00+00', 'scheduled'),
('fifa26-059', 'Turquia', 'Estados Unidos', 'group', 'D', '2026-06-26 02:00:00+00', 'scheduled'),
('fifa26-060', 'Paraguay', 'Australia', 'group', 'D', '2026-06-26 02:00:00+00', 'scheduled'),
('fifa26-061', 'Noruega', 'Francia', 'group', 'I', '2026-06-26 19:00:00+00', 'scheduled'),
('fifa26-062', 'Senegal', 'Irak', 'group', 'I', '2026-06-26 19:00:00+00', 'scheduled'),
('fifa26-063', 'Cabo Verde', 'Arabia Saudita', 'group', 'H', '2026-06-27 00:00:00+00', 'scheduled'),
('fifa26-064', 'Uruguay', 'Espana', 'group', 'H', '2026-06-27 00:00:00+00', 'scheduled'),
('fifa26-065', 'Egipto', 'Iran', 'group', 'G', '2026-06-27 03:00:00+00', 'scheduled'),
('fifa26-066', 'Nueva Zelanda', 'Belgica', 'group', 'G', '2026-06-27 03:00:00+00', 'scheduled'),
('fifa26-067', 'Panama', 'Inglaterra', 'group', 'L', '2026-06-27 21:00:00+00', 'scheduled'),
('fifa26-068', 'Croacia', 'Ghana', 'group', 'L', '2026-06-27 21:00:00+00', 'scheduled'),
('fifa26-069', 'Colombia', 'Portugal', 'group', 'K', '2026-06-27 23:30:00+00', 'scheduled'),
('fifa26-070', 'RD Congo', 'Uzbekistan', 'group', 'K', '2026-06-27 23:30:00+00', 'scheduled'),
('fifa26-071', 'Argelia', 'Austria', 'group', 'J', '2026-06-28 02:00:00+00', 'scheduled'),
('fifa26-072', 'Jordania', 'Argentina', 'group', 'J', '2026-06-28 02:00:00+00', 'scheduled'),

-- ROUND OF 32 — 16 matches
('fifa26-073', '2do A', '2do B', 'round_of_32', NULL, '2026-06-28 19:00:00+00', 'scheduled'),
('fifa26-074', '1ro E', 'Mejor 3ro (A/B/C/D/F)', 'round_of_32', NULL, '2026-06-29 20:30:00+00', 'scheduled'),
('fifa26-075', '1ro F', '2do C', 'round_of_32', NULL, '2026-06-30 01:00:00+00', 'scheduled'),
('fifa26-076', '1ro C', '2do F', 'round_of_32', NULL, '2026-06-29 17:00:00+00', 'scheduled'),
('fifa26-077', '1ro I', 'Mejor 3ro (C/D/F/G/H)', 'round_of_32', NULL, '2026-06-30 21:00:00+00', 'scheduled'),
('fifa26-078', '2do E', '2do I', 'round_of_32', NULL, '2026-06-30 17:00:00+00', 'scheduled'),
('fifa26-079', '1ro A', 'Mejor 3ro (C/E/F/H/I)', 'round_of_32', NULL, '2026-07-01 01:00:00+00', 'scheduled'),
('fifa26-080', '1ro L', 'Mejor 3ro (E/H/I/J/K)', 'round_of_32', NULL, '2026-07-01 16:00:00+00', 'scheduled'),
('fifa26-081', '1ro D', 'Mejor 3ro (B/E/F/I/J)', 'round_of_32', NULL, '2026-07-02 00:00:00+00', 'scheduled'),
('fifa26-082', '1ro G', 'Mejor 3ro (A/E/H/I/J)', 'round_of_32', NULL, '2026-07-01 20:00:00+00', 'scheduled'),
('fifa26-083', '2do K', '2do L', 'round_of_32', NULL, '2026-07-02 23:00:00+00', 'scheduled'),
('fifa26-084', '1ro H', '2do J', 'round_of_32', NULL, '2026-07-02 19:00:00+00', 'scheduled'),
('fifa26-085', '1ro B', 'Mejor 3ro (E/F/G/I/J)', 'round_of_32', NULL, '2026-07-03 03:00:00+00', 'scheduled'),
('fifa26-086', '1ro J', '2do H', 'round_of_32', NULL, '2026-07-03 22:00:00+00', 'scheduled'),
('fifa26-087', '1ro K', 'Mejor 3ro (D/E/I/J/L)', 'round_of_32', NULL, '2026-07-04 01:30:00+00', 'scheduled'),
('fifa26-088', '2do D', '2do G', 'round_of_32', NULL, '2026-07-03 18:00:00+00', 'scheduled'),

-- ROUND OF 16 — 8 matches
('fifa26-089', 'Ganador P74', 'Ganador P77', 'round_of_16', NULL, '2026-07-04 21:00:00+00', 'scheduled'),
('fifa26-090', 'Ganador P73', 'Ganador P75', 'round_of_16', NULL, '2026-07-04 17:00:00+00', 'scheduled'),
('fifa26-091', 'Ganador P76', 'Ganador P78', 'round_of_16', NULL, '2026-07-05 20:00:00+00', 'scheduled'),
('fifa26-092', 'Ganador P79', 'Ganador P80', 'round_of_16', NULL, '2026-07-06 00:00:00+00', 'scheduled'),
('fifa26-093', 'Ganador P83', 'Ganador P84', 'round_of_16', NULL, '2026-07-06 19:00:00+00', 'scheduled'),
('fifa26-094', 'Ganador P81', 'Ganador P82', 'round_of_16', NULL, '2026-07-07 00:00:00+00', 'scheduled'),
('fifa26-095', 'Ganador P86', 'Ganador P88', 'round_of_16', NULL, '2026-07-07 16:00:00+00', 'scheduled'),
('fifa26-096', 'Ganador P85', 'Ganador P87', 'round_of_16', NULL, '2026-07-07 20:00:00+00', 'scheduled'),

-- QUARTER-FINALS — 4 matches
('fifa26-097', 'Ganador P89', 'Ganador P90', 'quarter', NULL, '2026-07-09 20:00:00+00', 'scheduled'),
('fifa26-098', 'Ganador P93', 'Ganador P94', 'quarter', NULL, '2026-07-10 19:00:00+00', 'scheduled'),
('fifa26-099', 'Ganador P91', 'Ganador P92', 'quarter', NULL, '2026-07-11 21:00:00+00', 'scheduled'),
('fifa26-100', 'Ganador P95', 'Ganador P96', 'quarter', NULL, '2026-07-12 01:00:00+00', 'scheduled'),

-- SEMI-FINALS — 2 matches
('fifa26-101', 'Ganador P97', 'Ganador P98', 'semi', NULL, '2026-07-14 19:00:00+00', 'scheduled'),
('fifa26-102', 'Ganador P99', 'Ganador P100', 'semi', NULL, '2026-07-15 19:00:00+00', 'scheduled'),

-- THIRD PLACE — 1 match
('fifa26-103', 'Perdedor P101', 'Perdedor P102', 'third_place', NULL, '2026-07-18 21:00:00+00', 'scheduled'),

-- FINAL — 1 match
('fifa26-104', 'Ganador P101', 'Ganador P102', 'final', NULL, '2026-07-19 19:00:00+00', 'scheduled')

ON CONFLICT (external_id) DO NOTHING;
