-- ============================================================================
-- Nexis OS — 0005 session bundle
--
-- Every page render needs the same four things: the profile, its department,
-- the departments the user manages, and the count of approvals waiting on
-- them. Fetched separately that is four network round trips to the database
-- before anything paints — on a phone in Siliguri talking to ap-south-1 that
-- was the single biggest source of lag.
--
-- This returns all of it in one call.
-- ============================================================================

create or replace function public.session_bundle()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    return null;
  end if;

  select jsonb_build_object(
    'profile', to_jsonb(p),
    'department', case when d.id is null then null else to_jsonb(d) end,
    'managed_department_ids', coalesce(
      (select jsonb_agg(dm.department_id)
         from department_members dm
        where dm.user_id = uid and dm.is_manager),
      '[]'::jsonb
    ),
    'pending_approvals', (
      select count(*)
        from approval_requests ar
       where ar.assigned_to = uid and ar.status = 'pending'
    )
  )
  into result
  from profiles p
  left join departments d on d.id = p.primary_department_id
  where p.id = uid;

  return result;
end;
$$;

-- Callable by signed-in users only. It is SECURITY DEFINER but scoped strictly
-- to auth.uid(), so it can only ever return the caller's own context.
revoke all on function public.session_bundle() from public, anon;
grant execute on function public.session_bundle() to authenticated;
