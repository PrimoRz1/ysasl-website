begin;

create table public.solicitudes_vinculacion (
  id bigint generated always as identity primary key,
  jugador_id bigint not null references public.jugadores(id),
  equipo_id bigint not null references public.equipos(id),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  created_at timestamptz not null default now()
);
create unique index solicitudes_vinculacion_pendiente
  on public.solicitudes_vinculacion (jugador_id, usuario_id) where estado = 'pendiente';
alter table public.solicitudes_vinculacion enable row level security;
revoke all on public.solicitudes_vinculacion from anon, authenticated;
grant select on public.solicitudes_vinculacion to authenticated;
create policy consultar_vinculaciones on public.solicitudes_vinculacion for select to authenticated
using (usuario_id = (select auth.uid()) or exists (
  select 1 from public.delegados_equipo d where d.usuario_id = (select auth.uid())
  and d.equipo_id = solicitudes_vinculacion.equipo_id and d.activo
));

create function public.fichas_sin_cuenta(p_equipo_id bigint)
returns table (jugador_id bigint) language sql stable security definer set search_path = ''
as $$
  select j.id::bigint from public.jugadores j
  where j.equipo_id = p_equipo_id and j.activo and not exists (
    select 1 from public.solicitudes_jugadores s
    where s.jugador_id = j.id and s.estado = 'aprobada'
  );
$$;

create function public.solicitar_vinculacion(p_jugador_id bigint)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_ficha public.jugadores%rowtype;
  v_nombre text;
begin
  select nullif(left(trim(raw_user_meta_data->>'nombre'), 120), '') into v_nombre
  from auth.users where id = v_usuario and email_confirmed_at is not null;
  if not found then raise exception 'Confirma tu correo antes de solicitar la vinculación.'; end if;
  select * into v_ficha from public.jugadores where id = p_jugador_id and activo for update;
  if not found then raise exception 'La ficha ya no está disponible.'; end if;
  if not exists (select 1 from public.fichas_sin_cuenta(v_ficha.equipo_id) f where f.jugador_id = p_jugador_id)
  then raise exception 'Esta ficha ya tiene una cuenta vinculada.'; end if;
  if exists (select 1 from public.solicitudes_jugadores s
    join public.jugadores j on j.id = s.jugador_id and j.activo
    where s.usuario_id = v_usuario and s.estado = 'aprobada')
  then raise exception 'Tu cuenta ya tiene una ficha activa vinculada.'; end if;
  insert into public.solicitudes_vinculacion (jugador_id, equipo_id, usuario_id, nombre)
  values (v_ficha.id, v_ficha.equipo_id, v_usuario, coalesce(v_nombre, 'Jugador sin nombre en su cuenta'))
  on conflict (jugador_id, usuario_id) where estado = 'pendiente' do nothing;
end;
$$;

create function public.resolver_vinculacion(p_solicitud_id bigint, p_aprobar boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_peticion public.solicitudes_vinculacion%rowtype;
  v_ficha public.jugadores%rowtype;
begin
  select * into v_peticion from public.solicitudes_vinculacion where id = p_solicitud_id;
  if not found or not exists (
    select 1 from public.delegados_equipo d where d.usuario_id = auth.uid()
    and d.equipo_id = v_peticion.equipo_id and d.activo
  ) then raise exception 'No tienes permiso para resolver esta solicitud.'; end if;
  select * into v_ficha from public.jugadores where id = v_peticion.jugador_id for update;
  select * into v_peticion from public.solicitudes_vinculacion where id = p_solicitud_id for update;
  if not found or v_peticion.estado <> 'pendiente' then raise exception 'La solicitud ya fue resuelta.'; end if;
  if not coalesce(p_aprobar, false) then
    update public.solicitudes_vinculacion set estado = 'rechazada' where id = p_solicitud_id;
    return;
  end if;
  perform 1 from auth.users where id = v_peticion.usuario_id and email_confirmed_at is not null for update;
  if not found then raise exception 'La cuenta ya no está disponible o falta confirmar su correo.'; end if;
  if not coalesce(v_ficha.activo, false) or v_ficha.equipo_id <> v_peticion.equipo_id
    or exists (select 1 from public.solicitudes_jugadores s where s.jugador_id = v_ficha.id and s.estado = 'aprobada')
  then raise exception 'La ficha ya no está disponible para vincular.'; end if;
  if exists (select 1 from public.solicitudes_jugadores s
    join public.jugadores j on j.id = s.jugador_id and j.activo
    where s.usuario_id = v_peticion.usuario_id and s.estado = 'aprobada')
  then raise exception 'Esta cuenta ya tiene una ficha activa vinculada.'; end if;

  update public.solicitudes_jugadores
  set estado = 'aprobada', jugador_id = v_ficha.id
  where id = (
    select s.id from public.solicitudes_jugadores s
    where s.usuario_id = v_peticion.usuario_id and s.equipo_id = v_ficha.equipo_id
    and s.estado <> 'aprobada' order by (s.estado = 'pendiente') desc, s.created_at desc limit 1
  );
  if not found then
    insert into public.solicitudes_jugadores (usuario_id, equipo_id, jugador_id, nombre, numero, estado)
    values (v_peticion.usuario_id, v_ficha.equipo_id, v_ficha.id, v_ficha.nombre, v_ficha.numero, 'aprobada');
  end if;
  update public.solicitudes_vinculacion
  set estado = case when id = p_solicitud_id then 'aprobada' else 'rechazada' end
  where estado = 'pendiente' and jugador_id = v_ficha.id;
end;
$$;

create function public.agregar_jugador_delegado_con_foto(
  p_equipo_id integer, p_nombre text, p_numero integer, p_ruta text
) returns bigint language plpgsql security definer set search_path = ''
as $$
declare v_id bigint;
begin
  if not exists (select 1 from public.delegados_equipo d where d.usuario_id = auth.uid()
    and d.equipo_id = p_equipo_id and d.activo)
  then raise exception 'No tienes permiso para agregar jugadores a este equipo.'; end if;
  if public.ysasl_altas_delegado_bloqueadas(p_equipo_id) is distinct from false
  then raise exception 'El periodo de altas está cerrado.'; end if;
  if p_ruta is not null and (
    p_ruta !~ ('^' || auth.uid()::text || '/[a-f0-9-]{36}-original\.(jpg|png|webp)$')
    or not exists (select 1 from storage.objects o where o.bucket_id = 'fotos-jugadores' and o.name = p_ruta)
  ) then raise exception 'No se encontró la fotografía subida.'; end if;
  select public.agregar_jugador_delegado(p_equipo_id, p_nombre, p_numero) into v_id;
  if p_ruta is not null then
    update public.jugadores set foto_url = 'https://djtwrknixwhinatcoswf.supabase.co/storage/v1/object/public/fotos-jugadores/' || p_ruta
    where id = v_id and equipo_id = p_equipo_id;
    if not found then raise exception 'No se pudo guardar la fotografía.'; end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.fichas_sin_cuenta(bigint), public.solicitar_vinculacion(bigint),
  public.resolver_vinculacion(bigint, boolean),
  public.agregar_jugador_delegado_con_foto(integer, text, integer, text) from public, anon, authenticated;
grant execute on function public.fichas_sin_cuenta(bigint) to anon, authenticated;
grant execute on function public.solicitar_vinculacion(bigint), public.resolver_vinculacion(bigint, boolean),
  public.agregar_jugador_delegado_con_foto(integer, text, integer, text) to authenticated;

commit;
