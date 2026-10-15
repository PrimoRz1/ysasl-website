-- YSASL: agregar la posición de cada fotografía sin borrar registros existentes.
-- Los registros anteriores se conservan como campeones.
-- No modifica partidos, resultados, jornadas ni las temporadas oficiales.

ALTER TABLE public.campeones
  ADD COLUMN IF NOT EXISTS posicion text NOT NULL DEFAULT 'campeon';

-- Valores válidos para las nuevas fotografías.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campeones_posicion_valida'
      AND conrelid = 'public.campeones'::regclass
  ) THEN
    ALTER TABLE public.campeones
      ADD CONSTRAINT campeones_posicion_valida
      CHECK (posicion IN ('campeon', 'subcampeon', 'tercero'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS campeones_fotos_recientes_idx
  ON public.campeones (temporada, division, posicion, created_at DESC);
