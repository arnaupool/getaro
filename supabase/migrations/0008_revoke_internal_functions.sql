-- getaro: las migraciones anteriores terminaban con "grant execute on all functions ... to authenticated",
-- lo que dejaba llamables por /rest/v1/rpc funciones internas. write_audit permitía a cualquier cuenta
-- escribir entradas falsas en el historial. Los triggers no necesitan EXECUTE para dispararse.
-- A partir de aquí: conceder EXECUTE función a función, nunca "on all functions".

revoke execute on function
  public.write_audit(text, uuid, text, uuid, text, jsonb),
  public.handle_new_user(),
  public.handle_new_room(),
  public.handle_profile_deleted(),
  public.handle_member_removed(),
  public.handle_member_added(),
  public.handle_approval_disabled(),
  public.audit_room_deleted(),
  public.audit_owner_changed(),
  public.audit_event_deleted(),
  public.audit_member_removed(),
  public.audit_request_resolved(),
  public.audit_profile_changed(),
  public.audit_profile_deleted()
from public, anon, authenticated;
