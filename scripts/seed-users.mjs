/**
 * Seed-Script: Legt 10 Testnutzer in Supabase an.
 *
 * Voraussetzung: Service Role Key in .env eintragen:
 *   SUPABASE_SERVICE_KEY=eyJ...
 *
 * Ausführen:  node scripts/seed-users.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync }  from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// .env manuell einlesen (kein dotenv nötig)
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '../.env')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)

const SUPABASE_URL  = env.VITE_SUPABASE_URL
const SERVICE_KEY   = env.SUPABASE_SERVICE_KEY
const PASSWORD      = 'RideLog2025!'

if (!SERVICE_KEY) {
  console.error('\n  ✗ SUPABASE_SERVICE_KEY fehlt in der .env-Datei!\n')
  console.error('  Supabase Dashboard → Project Settings → API → service_role (secret)')
  console.error('  Dann in .env eintragen: SUPABASE_SERVICE_KEY=eyJ...\n')
  process.exit(1)
}

// Admin-Client mit Service Role Key (nur server-seitig verwenden!)
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const USERS = [
  { email: 'testuser01@ridelog-app.io', username: 'bergfahrer_max',    display_name: 'Max Bergmann',     bio: 'Immer auf der Suche nach neuen Pässen. Die Alpen sind mein Zuhause.',         location: 'München'   },
  { email: 'testuser02@ridelog-app.io', username: 'alpenpilot_lena',   display_name: 'Lena Huber',        bio: 'Kurventechnik, Kaffee und Kilometer — in genau dieser Reihenfolge.',          location: 'Innsbruck' },
  { email: 'testuser03@ridelog-app.io', username: 'strassenjaeger_tom',display_name: 'Tom Richter',       bio: 'Café Racer durch und durch. Weniger Schnickschnack, mehr Fahren.',             location: 'Hamburg'   },
  { email: 'testuser04@ridelog-app.io', username: 'kurvenkoenigin',    display_name: 'Sara Wolf',         bio: 'Erste Frau im Verein, schnellste auf der Nordschleife.',                      location: 'Köln'      },
  { email: 'testuser05@ridelog-app.io', username: 'motoradler_felix',  display_name: 'Felix Braun',       bio: 'Enduro-Fan und Wochenendfahrer. Kaffee nach jeder Tour ist Pflicht.',         location: 'Stuttgart' },
  { email: 'testuser06@ridelog-app.io', username: 'asphaltcowboy_kai', display_name: 'Kai Müller',        bio: 'Tourer. Zelt, Schlafsack und voller Tank reichen für alles.',                 location: 'Berlin'    },
  { email: 'testuser07@ridelog-app.io', username: 'vollgas_vroni',     display_name: 'Veronika Schmidt',  bio: 'Trackdays, Sonntagsausfahrten und zu viel Kaffee.',                           location: 'Augsburg'  },
  { email: 'testuser08@ridelog-app.io', username: 'nordschleifer_jan', display_name: 'Jan Weber',         bio: 'Die Grüne Hölle ruft — jedes Wochenende aufs Neue.',                         location: 'Koblenz'   },
  { email: 'testuser09@ridelog-app.io', username: 'enduro_erik',       display_name: 'Erik Koch',         bio: 'Offroad wo es geht, Asphalt wenn es muss. Immer dreckig, immer happy.',       location: 'Freiburg'  },
  { email: 'testuser10@ridelog-app.io', username: 'cafe_racer_jo',     display_name: 'Johanna Bauer',     bio: 'Vintage-Bikes, frischer Kaffee und alte Landstraßen — mehr brauche ich nicht.',location: 'Leipzig'   },
]

console.log(`\n  RideLog – Testnutzer anlegen`)
console.log(`  ${'─'.repeat(44)}\n`)

let ok = 0, skipped = 0, failed = 0

for (const user of USERS) {
  process.stdout.write(`  ${user.username.padEnd(24)}`)

  // 1. Auth-User via Admin-API anlegen (kein E-Mail-Versand, direkt bestätigt)
  const { data, error } = await admin.auth.admin.createUser({
    email:            user.email,
    password:         PASSWORD,
    email_confirm:    true,   // direkt als bestätigt markieren
  })

  if (error) {
    if (error.message?.toLowerCase().includes('already been registered') ||
        error.message?.toLowerCase().includes('already exists') ||
        error.code === '23505') {
      process.stdout.write(`⚠  bereits vorhanden\n`)
      skipped++
      continue
    }
    process.stdout.write(`✗  ${error.message}\n`)
    failed++
    continue
  }

  const userId = data.user.id

  // 2. Profil schreiben / aktualisieren
  const { error: profErr } = await admin
    .from('profiles')
    .upsert({
      id:           userId,
      username:     user.username,
      display_name: user.display_name,
      bio:          user.bio,
      location:     user.location,
      is_online:    false,
    }, { onConflict: 'id' })

  if (profErr) {
    // display_name oder andere Spalte fehlt noch → ohne versuchen
    await admin.from('profiles').upsert({
      id:        userId,
      username:  user.username,
      bio:       user.bio,
      location:  user.location,
      is_online: false,
    }, { onConflict: 'id' })
    process.stdout.write(`✓  ${user.email}  (display_name übersprungen)\n`)
  } else {
    process.stdout.write(`✓  ${user.email}\n`)
  }
  ok++
}

console.log(`\n  ${'─'.repeat(44)}`)
console.log(`  ✓ Erstellt: ${ok}   ⚠ Vorhanden: ${skipped}   ✗ Fehler: ${failed}`)
console.log(`  Passwort (alle Nutzer):  ${PASSWORD}`)
console.log(`  ${'─'.repeat(44)}\n`)
