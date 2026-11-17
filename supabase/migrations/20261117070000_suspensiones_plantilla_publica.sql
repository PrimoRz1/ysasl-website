CREATE OR REPLACE FUNCTION public.listar_suspendidos_publicos(p_equipo_id bigint)
RETURNS TABLE (jugador_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT j.id::text
  FROM public.jugadores AS j
  WHERE j.equipo_id = p_equipo_id
    AND j.activo IS TRUE
    AND EXISTS (
      SELECT 1
      FROM public.suspensiones AS s
      WHERE s.jugador_id = j.id
        AND s.activa IS TRUE
    );
$function$;

REVOKE ALL ON FUNCTION public.listar_suspendidos_publicos(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_suspendidos_publicos(bigint) TO anon, authenticated;
