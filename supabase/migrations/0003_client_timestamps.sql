-- updated_at is the *client's* logical timestamp, not server bookkeeping.
--
-- Merging two devices means asking "which edit is newer", and only the client
-- knows when an edit was made — it may have been made offline and pushed
-- hours later. A server-side trigger stamping now() on every upsert would
-- make every push look like the newest edit and quietly win, so the trigger
-- goes and the client writes the column. Row-level security still limits who
-- can write, so the only exposure is a device with a badly wrong clock
-- overwriting its own newer data.
drop trigger if exists touch_networks on public.networks;
drop trigger if exists touch_notes on public.notes;
drop trigger if exists touch_link_types on public.link_types;
drop trigger if exists touch_preferences on public.preferences;
drop function if exists public.touch_updated_at();
