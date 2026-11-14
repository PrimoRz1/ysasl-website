-- YSASL: permitir que un Administrador de Equipo (principal o auxiliar)
-- suba y cambie SOLO el escudo de los equipos que tiene asignados.
-- Ejecutar UNA VEZ en el SQL Editor del proyecto Supabase de YSASL.
-- No cambia escudos existentes, jugadores, partidos ni resultados.

-- Política de almacenamiento: el archivo debe estar dentro de la carpeta
-- del equipo asignado, por ejemplo: escudos-equipos/19/archivo.png.
DROP POLICY IF EXISTS "ysasl_delegados_suben_escudo_propio" ON storage.objects;

CREATE POLICY "ysasl_delegados_suben_escudo_propio"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'escudos-equipos'
  AND (storage.foldername(name))[1] ~ '^[0-9]+$'
  AND EXISTS (
    SELECT 1
    FROM public.delegados_equipo AS permiso
    WHERE permiso.usuario_id = (SELECT auth.uid())
      AND permiso.activo = true
      AND permiso.equipo_id::text = (storage.foldername(name))[1]
  )
);

-- La función limita la actualización a la columna escudo_url
-- y comprueba el permiso en la base de datos, no en el navegador.
CREATE OR REPLACE FUNCTION public.establecer_escudo_equipo_delegado(
  p_equipo_id bigint,
  p_ruta text,
  p_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.delegados_equipo AS permiso
    WHERE permiso.usuario_id = (SELECT auth.uid())
      AND permiso.equipo_id = p_equipo_id
      AND permiso.activo = true
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar el escudo de este equipo.';
  END IF;

  IF p_ruta IS NULL OR
     p_ruta !~ ('^' || p_equipo_id::text || '/[0-9]+-[a-z0-9]{4,12}\.(png|jpg|webp)$') THEN
    RAISE EXCEPTION 'La ruta del escudo no corresponde al equipo.';
  END IF;

  IF p_url IS DISTINCT FROM
    ('https://djtwrknixwhinatcoswf.supabase.co/storage/v1/object/public/escudos-equipos/' || p_ruta) THEN
    RAISE EXCEPTION 'La dirección del escudo no es válida.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects
    WHERE bucket_id = 'escudos-equipos'
      AND name = p_ruta
  ) THEN
    RAISE EXCEPTION 'El archivo del escudo no se encuentra en el almacenamiento.';
  END IF;

  UPDATE public.equipos
  SET escudo_url = p_url
  WHERE id = p_equipo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el equipo.';
  END IF;
END;
$func$;

REVOKE ALL ON FUNCTION public.establecer_escudo_equipo_delegado(bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.establecer_escudo_equipo_delegado(bigint, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.establecer_escudo_equipo_delegado(bigint, text, text) TO authenticated;
