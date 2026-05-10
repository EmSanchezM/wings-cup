# Sistema de Apuestas Mundialistas entre Amigos

> Especificaciones técnicas y de diseño para el sistema web de pronósticos del Mundial de Fútbol.

## Tabla de contenidos

1. [Resumen del proyecto](#resumen-del-proyecto)
2. [Decisiones de diseño](#decisiones-de-diseño)
3. [Stack tecnológico](#stack-tecnológico)
4. [Arquitectura](#arquitectura)
5. [Esquema de base de datos](#esquema-de-base-de-datos)
6. [Row Level Security (RLS)](#row-level-security-rls)
7. [Triggers y funciones de BD](#triggers-y-funciones-de-bd)
8. [Flujos de usuario](#flujos-de-usuario)
9. [Reglas de negocio críticas](#reglas-de-negocio-críticas)
10. [APIs externas](#apis-externas)
11. [Notas de seguridad](#notas-de-seguridad)
12. [Roadmap futuro](#roadmap-futuro)

---

## Resumen del proyecto

Sistema web para que grupos de amigos hagan competencias de pronósticos durante el Mundial de Fútbol. Cada sala tiene un premio definido (típicamente comida, ej: "12 alitas BBQ"), y los participantes acumulan puntos según la precisión de sus pronósticos.

**Características principales:**

- Registro e inicio de sesión con redes sociales (Google, Facebook)
- Creación de salas privadas con premio personalizado
- Invitaciones por link compartible (WhatsApp, email)
- Sistema híbrido: invitado primero (magic link), registro completo después
- Aislamiento de salas: solo ves las salas en las que participas
- Pronósticos editables hasta el momento del kickoff (bloqueo automático)
- Ranking en vivo con actualización realtime
- Panel de super admin para correcciones manuales y auditoría

---

## Decisiones de diseño

| Decisión | Elección | Motivo |
|----------|----------|--------|
| Framework | **Nuxt 3 (Vue)** | Ecosistema maduro, módulos oficiales, despliegue sencillo |
| Acceso de invitados | **Híbrido (magic link + OAuth opcional)** | Cero fricción al inicio, retención posterior |
| Auth + DB | **Supabase** | OAuth social, magic links, RLS y realtime en una sola plataforma |
| Hosting | **Vercel** (recomendado) | Cron jobs incluidos, integración con Nuxt |
| Costo objetivo | **$0 durante el mundial** | Tier gratis de Supabase + Vercel es suficiente |

---

## Stack tecnológico

### Frontend / Backend

- **Nuxt 3** (SSR + Nitro para server API)
- **Tailwind CSS** + **shadcn-vue** (UI accesible y bonita sin reinventar)
- **Pinia** (`@pinia/nuxt`) para estado del cliente
- **Zod** para validación (mismo schema en cliente y servidor)

### Servicios

- **Supabase** (`@nuxtjs/supabase`)
  - PostgreSQL con Row Level Security
  - Auth (OAuth Google/Facebook + Magic Links)
  - Realtime (para ranking en vivo)
  - Storage (avatares, opcional)
- **API-Football** (resultados oficiales del mundial)
- **Resend** (emails custom de invitación, opcional — Supabase manda los magic links)

### Infraestructura

- **Vercel** (deploy + Cron Jobs) o **Netlify** alternativa
- **Nitro scheduled tasks** como fallback al cron

---

## Arquitectura

```
┌──────────────────────────────────────────────────────┐
│                   CLIENTE (Browser)                  │
│  Nuxt 3 + Pinia + Tailwind + shadcn-vue              │
└──────────────────┬───────────────────────────────────┘
                   │ HTTPS
┌──────────────────▼───────────────────────────────────┐
│              NUXT 3 (SSR + Nitro)                    │
│  ┌────────────────┐  ┌─────────────────────────┐     │
│  │  Pages (SSR)   │  │   Server API (/server)  │     │
│  │  - Landing     │  │   - /api/rooms/*        │     │
│  │  - /rooms/*    │  │   - /api/predictions/*  │     │
│  │  - /admin      │  │   - /api/invitations/*  │     │
│  └────────────────┘  │   - /api/admin/*        │     │
│                      │   - /api/cron/*         │     │
│                      └────────┬────────────────┘     │
└───────────────────────────────┼──────────────────────┘
                                │
        ┌───────────────────────┼─────────────────────┐
        │                       │                     │
┌───────▼────────┐    ┌─────────▼─────────┐  ┌────────▼────────┐
│   SUPABASE     │    │  API-FOOTBALL     │  │  CRON SCHEDULER │
│  - Postgres    │    │  (resultados      │  │  (Nitro tasks   │
│  - Auth (OAuth │    │   mundial)        │  │   o Vercel Cron)│
│    Google/FB)  │    └───────────────────┘  └─────────────────┘
│  - RLS         │
│  - Realtime    │
│  - Storage     │
│  - Magic Links │
└────────────────┘
```

---

## Esquema de base de datos

### Tabla: `profiles`

Extiende `auth.users` de Supabase. Se crea automáticamente con un trigger al registrarse.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_super_admin BOOLEAN DEFAULT FALSE,
  is_guest BOOLEAN DEFAULT TRUE,        -- false cuando vincula OAuth
  auth_provider TEXT,                   -- 'magic_link' | 'google' | 'facebook'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: `rooms`

Las salas de competencia.

```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  prize_description TEXT NOT NULL,      -- "12 alitas BBQ + cervezas"
  invite_code TEXT UNIQUE NOT NULL,     -- código corto: "AB12CD"
  created_by UUID NOT NULL REFERENCES profiles(id),
  scoring_rules JSONB NOT NULL DEFAULT '{
    "exact_score": 5,
    "correct_result": 3,
    "correct_goal_diff": 2,
    "wrong": 0
  }'::jsonb,
  tournament TEXT DEFAULT 'world_cup_2026',
  status TEXT NOT NULL DEFAULT 'active', -- active | finished | archived
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rooms_invite_code ON rooms(invite_code);
CREATE INDEX idx_rooms_created_by ON rooms(created_by);
```

### Tabla: `room_members`

Relación muchos-a-muchos entre usuarios y salas. Incluye `total_points` denormalizado para queries rápidas del ranking.

```sql
CREATE TABLE room_members (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'player',  -- player | owner
  total_points INT DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX idx_room_members_user ON room_members(user_id);
```

### Tabla: `matches`

Partidos del mundial. Sincronizados desde API-Football.

```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,              -- id de API-Football
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_team_code TEXT,                  -- 'ARG', 'FRA' (banderitas)
  away_team_code TEXT,
  kickoff_at TIMESTAMPTZ NOT NULL,
  home_score INT,
  away_score INT,
  stage TEXT NOT NULL,                  -- 'group_a' | 'r16' | 'qf' | 'sf' | 'final'
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | live | finished | cancelled
  updated_from_api_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_kickoff ON matches(kickoff_at);
CREATE INDEX idx_matches_status ON matches(status);
```

### Tabla: `predictions`

Pronósticos de cada usuario por partido y sala (un usuario puede pronosticar el mismo partido en distintas salas).

```sql
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_home INT NOT NULL CHECK (predicted_home >= 0 AND predicted_home <= 20),
  predicted_away INT NOT NULL CHECK (predicted_away >= 0 AND predicted_away <= 20),
  points_earned INT,                    -- NULL = no calculado aún
  locked_at TIMESTAMPTZ,                -- se setea al kickoff
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (room_id, user_id, match_id)
);

CREATE INDEX idx_predictions_match ON predictions(match_id);
CREATE INDEX idx_predictions_room_user ON predictions(room_id, user_id);
```

### Tabla: `invitations`

Tokens de invitación a salas.

```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,           -- random secreto del link
  invited_email TEXT,                   -- opcional
  used_by_user_id UUID REFERENCES profiles(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: `audit_log`

Registro de todas las acciones del super admin.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,                 -- 'edit_prediction' | 'change_match_score'...
  target_type TEXT NOT NULL,            -- 'prediction' | 'match' | 'room'
  target_id UUID NOT NULL,
  before_value JSONB,
  after_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_admin ON audit_log(admin_id, created_at DESC);
```

---

## Row Level Security (RLS)

La pieza clave de seguridad. Aunque alguien hackee el frontend, Postgres mismo le impide modificar datos prohibidos.

```sql
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Solo veo salas donde soy miembro (o si soy super admin)
CREATE POLICY "rooms_select" ON rooms FOR SELECT
USING (
  EXISTS (SELECT 1 FROM room_members 
          WHERE room_id = rooms.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles 
             WHERE id = auth.uid() AND is_super_admin = TRUE)
);

-- Solo veo predicciones de salas donde soy miembro
CREATE POLICY "predictions_select" ON predictions FOR SELECT
USING (
  EXISTS (SELECT 1 FROM room_members 
          WHERE room_id = predictions.room_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles 
             WHERE id = auth.uid() AND is_super_admin = TRUE)
);

-- Solo puedo crear MIS predicciones, y solo si el partido no empezó
CREATE POLICY "predictions_insert" ON predictions FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM matches 
              WHERE id = match_id AND kickoff_at > NOW())
);

-- Solo puedo modificar MIS predicciones si no están bloqueadas
CREATE POLICY "predictions_update" ON predictions FOR UPDATE
USING (
  user_id = auth.uid()
  AND locked_at IS NULL
  AND EXISTS (SELECT 1 FROM matches 
              WHERE id = match_id AND kickoff_at > NOW())
);
```

---

## Triggers y funciones de BD

### Cálculo automático de puntos

Se ejecuta cuando un partido pasa a `finished`. Aplica las reglas de cada sala (que pueden ser distintas) y actualiza el ranking.

```sql
CREATE OR REPLACE FUNCTION calculate_points()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'finished' AND OLD.status != 'finished' THEN
    -- Calcular puntos por predicción según reglas de cada sala
    UPDATE predictions p
    SET points_earned = 
      CASE
        WHEN p.predicted_home = NEW.home_score 
         AND p.predicted_away = NEW.away_score 
        THEN (r.scoring_rules->>'exact_score')::int
        
        WHEN SIGN(p.predicted_home - p.predicted_away) = 
             SIGN(NEW.home_score - NEW.away_score)
         AND (p.predicted_home - p.predicted_away) = 
             (NEW.home_score - NEW.away_score)
        THEN (r.scoring_rules->>'correct_goal_diff')::int
        
        WHEN SIGN(p.predicted_home - p.predicted_away) = 
             SIGN(NEW.home_score - NEW.away_score)
        THEN (r.scoring_rules->>'correct_result')::int
        
        ELSE 0
      END
    FROM rooms r
    WHERE p.match_id = NEW.id AND p.room_id = r.id;
    
    -- Actualizar puntos totales en room_members
    UPDATE room_members rm
    SET total_points = (
      SELECT COALESCE(SUM(points_earned), 0)
      FROM predictions
      WHERE room_id = rm.room_id AND user_id = rm.user_id
    )
    WHERE EXISTS (
      SELECT 1 FROM predictions 
      WHERE room_id = rm.room_id AND user_id = rm.user_id 
        AND match_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_points
AFTER UPDATE ON matches
FOR EACH ROW EXECUTE FUNCTION calculate_points();
```

### Bloqueo automático de pronósticos

Se invoca desde el cron cada minuto.

```sql
CREATE OR REPLACE FUNCTION lock_started_predictions()
RETURNS void AS $$
BEGIN
  UPDATE predictions
  SET locked_at = NOW()
  WHERE locked_at IS NULL
    AND match_id IN (SELECT id FROM matches WHERE kickoff_at <= NOW());
END;
$$ LANGUAGE plpgsql;
```

---

## Flujos de usuario

### Flujo A: Crear sala e invitar amigos

```
[Usuario logueado] 
  → click "Crear sala"
  → form: nombre, premio, reglas de puntuación (con preset default)
  → POST /api/rooms
      ↓
  Server: 
    - genera invite_code random 6 chars (mayús+números)
    - INSERT en rooms
    - INSERT en room_members (role='owner')
    - retorna {room, invite_url: "/join/AB12CD"}
      ↓
  Frontend muestra: 
    - "Sala creada! Comparte este link:"
    - Botones: WhatsApp / Copiar / Email
    - QR code (bonus, útil en persona)
```

### Flujo B: Invitado entra por link (modelo híbrido)

```
[Amigo abre link /join/AB12CD]
  ↓
GET /join/[code]
  → Server valida que existe la sala
  → Renderiza página con info: nombre sala, premio, miembros actuales
  ↓
¿Está logueado?
  ├── SÍ → POST /api/rooms/join → INSERT room_members → redirect a sala
  │
  └── NO → muestra 3 opciones:
            ├── [A] "Entrar con Google" → OAuth → join → sala
            ├── [B] "Entrar con Facebook" → OAuth → join → sala
            └── [C] "Solo quiero jugar rápido" 
                    → form: nombre + email
                    → POST /api/auth/guest-join
                        - Crea user en Supabase con magic_link
                        - is_guest=true en profiles
                        - INSERT room_members
                        - manda magic link al email
                    → "Te enviamos un link a tu correo, ábrelo para entrar"
                    → Click en link → sesión activa → entra a sala
```

**Conversión posterior de invitado a registrado:** dentro de la sala, banner persistente "Vincula tu cuenta con Google para entrar desde otros dispositivos". Click → flujo OAuth → Supabase ejecuta `linkIdentity()` → `is_guest=false`. Mantiene el mismo `user_id`, conservando todos sus puntos.

### Flujo C: Hacer y editar pronóstico

```
[Usuario en /rooms/[id]]
  → ve lista de partidos (próximos 7 días por default, scrolleable)
  → para cada partido próximo: input marcador (2 spinners)
  → onChange: debounce 500ms → POST /api/predictions
      ↓
  Server:
    - valida con Zod
    - verifica miembro de la sala (RLS lo respalda)
    - verifica match.kickoff_at > now()
    - UPSERT en predictions
    - retorna OK
      ↓
  Frontend: 
    - icono ✓ pequeño "Guardado"
    - countdown al kickoff
    
[Cuando kickoff_at llega]
  → cron task corre cada 1 min: lock_started_predictions()
  → UI vía realtime detecta locked_at NOT NULL
  → inputs se deshabilitan, badge "Bloqueado 🔒"
```

### Flujo D: Sincronización de resultados y cálculo de puntos

```
[Cron cada 5 min durante días de partido]
  → GET /api/cron/sync-matches (con secret header)
      ↓
  Server:
    - llama API-Football: partidos de hoy
    - para cada partido, UPDATE matches SET home_score, away_score, status
    - el trigger calculate_points() corre solo
    - también actualiza room_members.total_points
      ↓
  Frontend conectado vía Supabase Realtime
    → ve cambios en matches y room_members
    → ranking se reordena en vivo
    → notificación toast: "¡Sumaste 5 puntos! ARG 2-1 FRA"
```

### Flujo E: Super admin

```
[Usuario con is_super_admin=true entra a /admin]
  → middleware verifica el flag (en server, no solo cliente)
  → tabs:
    1. Salas: listado completo, puede ver miembros, archivar
    2. Partidos: editar manualmente marcadores (por si la API falla)
    3. Pronósticos: buscar por usuario+sala, editar con motivo obligatorio
    4. Audit log: tabla con todas las acciones admin
  
  Cada acción:
    → POST /api/admin/* con motivo
    → Server valida is_super_admin
    → ejecuta cambio
    → INSERT audit_log automático
```

---

## Reglas de negocio críticas

### 1. Bloqueo de pronósticos

No puede depender solo del frontend. **Triple validación:**

- En el endpoint del servidor: comparar `now()` contra `matches.kickoff_at`
- En la RLS policy de Postgres
- Cron que cada minuto setea `locked_at` en predicciones cuando empieza el partido

### 2. Aislamiento de salas

Las RLS policies hacen que un usuario solo pueda leer/escribir en salas donde es miembro. Un fetch directo a `/rooms/123` siendo no-miembro retorna vacío sin necesidad de validación manual.

### 3. Cálculo de puntos por sala

Cada sala puede tener distintas reglas (`scoring_rules` JSONB). El trigger las aplica correctamente. Esto permite tener una sala "casual" (3/2/1) y una "hardcore" (10/5/3) coexistiendo.

### 4. Auditoría de cambios admin

Toda corrección manual debe loggearse en `audit_log` con motivo obligatorio. Trazabilidad para que después nadie diga "¿por qué Juan tiene 3 puntos extra?"

---

## APIs externas

### API-Football (recomendada)

- **URL:** https://www.api-football.com/
- **Tier gratis:** 100 requests/día (suficiente con cron cada 15 min)
- **Cobertura:** Mundial completo

### Alternativas

- **Football-Data.org** — gratis con límites razonables, menos features
- **SportMonks** — más caro pero data más rica

---

## Notas de seguridad

### Endpoints de cron

Todos los `/api/cron/*` deben validar header secret:

```typescript
const authHeader = getHeader(event, 'authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  throw createError({ statusCode: 401 })
}
```

### Variables de entorno

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...    # Solo en server, NUNCA en cliente
API_FOOTBALL_KEY=...
CRON_SECRET=...                  # Random largo
```

### Validación dual

Toda mutación importante (crear pronóstico, unirse a sala, etc.) se valida:

1. **Zod** en el endpoint del servidor (forma del payload)
2. **RLS** en Postgres (permisos)
3. **Constraints** de BD (rangos válidos, unicidad)

---

## Roadmap futuro

Funcionalidades a considerar para versiones posteriores:

- **Pronóstico del campeón al inicio del torneo** — vale muchos puntos al final. Solo requiere tabla extra `tournament_predictions`.
- **Chat por sala** — Supabase realtime ya está, agregar tabla `messages` es trivial.
- **Achievements/insignias** — "Pronóstico perfecto", "Racha de 5", etc. Tabla `user_achievements`.
- **Notificaciones push** — recordatorio antes del kickoff si no has pronosticado.
- **Estadísticas personales** — % de aciertos, mejor partido, peor partido.
- **Salas públicas** — modo torneo abierto para quien quiera unirse.
- **Multi-idioma** — al menos español/inglés.

---

## Estimación de tiempos

| Fase | Tiempo |
|------|--------|
| Setup Nuxt + Supabase + Auth | 1 día |
| Schema BD + RLS + Triggers | 1 día |
| CRUD salas + invitaciones | 2 días |
| Vista de partidos + pronósticos | 2 días |
| Ranking realtime | 1 día |
| Integración API-Football + cron | 1 día |
| Panel super admin + audit log | 1-2 días |
| Pulido UI + responsive | 2 días |
| **Total estimado** | **~11-12 días de trabajo** |

---

*Documento de especificaciones — Sistema de Apuestas Mundialistas entre Amigos*
