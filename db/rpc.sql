create or replace function next_sequence(counter_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare next_value integer;
begin
  insert into sequence_counters(key, current)
  values (counter_key, 1)
  on conflict (key)
  do update set current = sequence_counters.current + 1
  returning current into next_value;

  return next_value;
end;
$$;

revoke all on function next_sequence(text) from public;
grant execute on function next_sequence(text) to anon, authenticated, service_role;
