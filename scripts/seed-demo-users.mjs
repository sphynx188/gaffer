// scripts/seed-demo-users.mjs — run: node --env-file=.env.local scripts/seed-demo-users.mjs
// Idempotent: signs in when the user already exists rather than erroring.
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const PERSONAS = [
  ['barca.admin@gafferdemo.app', 'BarcaAdmin2026!'],
  ['barca.u12@gafferdemo.app', 'BarcaU12Coach2026!'],
  ['barca.u18@gafferdemo.app', 'BarcaU18Coach2026!'],
  ['riverside.coach@gafferdemo.app', 'RiversideCoach2026!'],
]
for (const [email, password] of PERSONAS) {
  const c = createClient(url, anon)
  let { data, error } = await c.auth.signUp({ email, password })
  if (error || !data?.user?.id) {
    ;({ data, error } = await c.auth.signInWithPassword({ email, password }))
    if (error) throw new Error(`${email}: ${error.message}`)
  }
  console.log(email, data.user.id)
}
