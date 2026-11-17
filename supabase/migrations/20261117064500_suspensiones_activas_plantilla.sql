CREATE OR REPLACE FUNCTION public.listar_suspensiones_activas_plantilla(p_jugador_ids bigint[])
RETURNS TABLE (jugador_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT DISTINCT s.jugador_id::text
  FROM public.suspensiones AS s
  JOIN public.jugadores AS j ON j.id = s.jugador_id
  WHERE auth.uid() IS NOT NULL
    AND s.activa IS TRUE
    AND j.id = ANY (p_jugador_ids)
    AND (
      public.es_admin()
      OR EXISTS (
        SELECT 1
        FROM public.delegados_equipo AS d
        WHERE d.usuario_id = auth.uid()
          AND d.equipo_id = j.equipo_id
          AND d.activo IS TRUE
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.listar_suspensiones_activas_plantilla(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_suspensiones_activas_plantilla(bigint[]) TO authenticated;
