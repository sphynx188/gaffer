// create-coach — club tenancy (spec §7). Creating a login requires the
// service-role key, so it can't happen client-side. Verifies the caller's
// JWT is an admin of the target club (via the service-role client, so the
// check itself isn't subject to RLS — but it's keyed on the caller's OWN
// server-verified user id, never a client-supplied one), then creates the
// user via the admin API and inserts club_member(role='coach'). Email
// confirmation is already disabled on the project, so the new login works
// immediately.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { club_id, email, password, display_name } = await req.json()
    if (!club_id || !email || !password) return json({ error: 'club_id, email, password required' }, 400)

    const url = Deno.env.get('SUPABASE_URL')!
    const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: caller } = await asCaller.auth.getUser()
    if (!caller?.user) return json({ error: 'not signed in' }, 401)

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: mem } = await admin
      .from('club_member')
      .select('role')
      .eq('club_id', club_id)
      .eq('user_id', caller.user.id)
      .maybeSingle()
    if (mem?.role !== 'admin') return json({ error: 'not an admin of this club' }, 403)

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) return json({ error: error.message }, 400)

    const { error: e2 } = await admin.from('club_member').insert({
      club_id,
      user_id: created.user.id,
      role: 'coach',
      display_name: display_name ?? null,
    })
    if (e2) return json({ error: e2.message }, 400)

    return json({ user_id: created.user.id })
  } catch (e) {
    return json({ error: String(e) }, 400)
  }
})
