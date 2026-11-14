-- YSASL | Invierno 2026 (temporada_id = 10)
-- Cerrar altas de Administradores de Equipo cuando TODOS los partidos
-- oficiales de Jornada 3 de las divisiones participantes hayan terminado.
-- El cierre queda guardado y no se revierte si después se corrige un resultado.
-- No modifica jugadores, partidos, resultados ni la temporada oficial id 1.
-- Ejecutar en Supabase SQL Editor ANTES de publicar la interfaz nueva.

BEGIN;

-- Verificar el torneo antes de instalar reglas en la base de datos real.
DO $verificar_torneo$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.temporadas
    WHERE id = 10 AND nombre ILIKE '%Invierno%2026%'
  ) THEN
    RAISE EXCEPTION 'No se encontró Invierno 2026 con ID 10. No se aplicó ningún cambio.';
  END IF;
END;
$verificar_torneo$;

CREATE TABLE IF NOT EXISTS public.cierre_altas_jugadores_temporada (
  temporada_id bigint PRIMARY KEY CHECK (temporada_id = 10),
  cerrado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cierre_altas_jugadores_temporada ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cierre_altas_jugadores_temporada FROM PUBLIC, anon, authenticated;

-- Revisión serializada para evitar carreras cuando se finalizan dos partidos a la vez.
CREATE OR REPLACE FUNCTION public.ysasl_verificar_cierre_altas_jornada3()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(22026, 30010);

  IF EXISTS (
    SELECT 1 FROM public.cierre_altas_jugadores_temporada
    WHERE temporada_id = 10
  ) THEN
    RETURN;
  END IF;

  -- No cerrar sin divisiones con al menos dos equipos activos.
  IF NOT EXISTS (
    SELECT 1 FROM public.divisiones d
    WHERE d.temporada_id = 10
      AND (
        SELECT count(*) FROM public.inscripciones_equipo i
        WHERE i.division_id = d.id AND i.activo = true
      ) >= 2
  ) THEN
    RETURN;
  END IF;

  -- Para CADA división con partidos por disputar debe existir Jornada 3
  -- con al menos un partido regular, y TODOS sus partidos deben tener
  -- estado finalizado y marcador oficial.
  IF EXISTS (
    SELECT 1
    FROM public.divisiones d
    WHERE d.temporada_id = 10
      AND (
        SELECT count(*) FROM public.inscripciones_equipo i
        WHERE i.division_id = d.id AND i.activo = true
      ) >= 2
      AND (
        NOT EXISTS (
          SELECT 1
          FROM public.jornadas j
          JOIN public.partidos p ON p.jornada_id = j.id
          WHERE j.division_id = d.id AND j.numero = 3
            AND COALESCE(p.fase, 'regular') = 'regular'
        )
        OR EXISTS (
          SELECT 1
          FROM public.jornadas j
          JOIN public.partidos p ON p.jornada_id = j.id
          WHERE j.division_id = d.id AND j.numero = 3
            AND COALESCE(p.fase, 'regular') = 'regular'
            AND (
              p.estado IS DISTINCT FROM 'finalizado'
              OR p.goles_local IS NULL
              OR p.goles_visitante IS NULL
            )
        )
      )
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.cierre_altas_jugadores_temporada (temporada_id)
  VALUES (10)
  ON CONFLICT (temporada_id) DO NOTHING;
END;
$func$;

REVOKE ALL ON FUNCTION public.ysasl_verificar_cierre_altas_jornada3() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ysasl_revisar_partido_para_cierre_altas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
  IF NEW.estado = 'finalizado'
     AND NEW.goles_local IS NOT NULL
     AND NEW.goles_visitante IS NOT NULL
     AND COALESCE(NEW.fase, 'regular') = 'regular'
     AND EXISTS (
       SELECT 1 FROM public.jornadas j
       JOIN public.divisiones d ON d.id = j.division_id
       WHERE j.id = NEW.jornada_id AND j.numero = 3 AND d.temporada_id = 10
     ) THEN
    PERFORM public.ysasl_verificar_cierre_altas_jornada3();
  END IF;
  RETURN NEW;
END;
$func$;

REVOKE ALL ON FUNCTION public.ysasl_revisar_partido_para_cierre_altas() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ysasl_cerrar_altas_tras_jornada3 ON public.partidos;
CREATE TRIGGER ysasl_cerrar_altas_tras_jornada3
AFTER INSERT OR UPDATE ON public.partidos
FOR EACH ROW
EXECUTE FUNCTION public.ysasl_revisar_partido_para_cierre_altas();

-- La regla se aplica a cualquier alta o incorporación a la plantilla,
-- aunque se haga mediante RPC, aprobación de solicitud o reactivación.
-- Los Administradores Generales y el servicio interno quedan autorizados.
CREATE OR REPLACE FUNCTION public.ysasl_bloquear_altas_delegado_tras_jornada3()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_uid uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.equipo_id IS NOT DISTINCT FROM OLD.equipo_id
       AND NOT (OLD.activo IS DISTINCT FROM true AND NEW.activo IS TRUE) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.activo IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  -- Si el equipo no participa en Invierno 2026, no aplicar el bloqueo.
  IF NOT EXISTS (
    SELECT 1
    FROM public.divisiones d
    JOIN public.inscripciones_equipo i ON i.division_id = d.id
    WHERE d.temporada_id = 10
      AND i.activo = true
      AND i.equipo_id = NEW.equipo_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Esperar a que termine cualquier cierre simultáneo al último resultado.
  PERFORM pg_catalog.pg_advisory_xact_lock(22026, 30010);

  IF NOT EXISTS (
    SELECT 1 FROM public.cierre_altas_jugadores_temporada
    WHERE temporada_id = 10
  ) THEN
    RETURN NEW;
  END IF;

  IF pg_catalog.current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_uid := (SELECT auth.uid());
  IF v_uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = v_uid AND rol = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Inscripciones cerradas: la Jornada 3 de Invierno 2026 ya finalizó. Solo un Administrador General puede incorporar jugadores.';
END;
$func$;

REVOKE ALL ON FUNCTION public.ysasl_bloquear_altas_delegado_tras_jornada3() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ysasl_impedir_altas_delegados_jornada3 ON public.jugadores;
CREATE TRIGGER ysasl_impedir_altas_delegados_jornada3
BEFORE INSERT OR UPDATE ON public.jugadores
FOR EACH ROW
EXECUTE FUNCTION public.ysasl_bloquear_altas_delegado_tras_jornada3();

-- La interfaz consulta si el equipo seleccionado ya está cerrado.
CREATE OR REPLACE FUNCTION public.ysasl_altas_delegado_bloqueadas(p_equipo_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $func$
  SELECT EXISTS (
    SELECT 1
    FROM public.cierre_altas_jugadores_temporada c
    JOIN public.divisiones d ON d.temporada_id = c.temporada_id
    JOIN public.inscripciones_equipo i ON i.division_id = d.id
    WHERE c.temporada_id = 10
      AND i.activo = true
      AND i.equipo_id = p_equipo_id
  );
$func$;

REVOKE ALL ON FUNCTION public.ysasl_altas_delegado_bloqueadas(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ysasl_altas_delegado_bloqueadas(bigint) TO authenticated;

-- Si la Jornada 3 ya estaba finalizada antes de aplicar la regla,
-- registrar el cierre ahora; de lo contrario seguirá abierta.
SELECT public.ysasl_verificar_cierre_altas_jornada3();

COMMIT;
