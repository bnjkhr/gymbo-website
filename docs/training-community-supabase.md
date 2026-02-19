# Training Community mit Supabase

## Enthaltene Implementierung

- Datenmodell + RLS: `supabase/migrations/20260219094000_training_community.sql`
- Training UI: `/training/`
- Moderation UI: `/training/moderation.html`

## Setup

1. Supabase Projekt erzeugen.
2. In diesem Repo Migrationen deployen:
   - `supabase link --project-ref <PROJECT_REF>`
   - `supabase db push`
3. Werte in `training/supabase-config.js` eintragen:
   - `url`: `https://<PROJECT_REF>.supabase.co`
   - `anonKey`: Supabase anon key
   - `redirectTo`: `https://gymbo.pro/training/`
4. Mindestens einen Nutzer auf Rolle `moderator` oder `admin` setzen:
   - `update public.profiles set role='admin' where id='<USER_UUID>';`

## Features

- Community Submission (DE + EN Felder) mit Status `pending`
- Moderation via RPC `approve_submission` / `reject_submission`
- Community Katalog in `/training/`
- Voting (+1/-1) und Reporting (`wrong_data`, `duplicate`, `unsafe`, `spam`, `other`)
- Reports und Scores werden per Trigger auf `community_exercises` aggregiert

## Hinweise

- Ohne `training/supabase-config.js` laeuft `/training/` weiter im lokalen Modus.
- Moderationsseite erfordert eingeloggten Moderator/Admin.
