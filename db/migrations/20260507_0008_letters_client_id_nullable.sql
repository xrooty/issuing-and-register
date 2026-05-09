do $$
begin
  begin
    alter table public.letters alter column client_id drop not null;
  exception
    when undefined_table then
      null;
    when undefined_column then
      null;
  end;
end $$;
