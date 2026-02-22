// One-time or cron: generate embeddings for case_chunks where embedding is null.
// Call with Authorization: Bearer <service_role_key> or from Dashboard.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: rows, error: fetchError } = await supabase
    .from('case_chunks')
    .select('id, content')
    .is('embedding', null)

  if (fetchError || !rows?.length) {
    return new Response(JSON.stringify({ updated: 0, message: 'No rows to process' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const model = new Supabase.ai.Session('gte-small')
  let updated = 0

  for (const row of rows) {
    const embedding = await model.run(row.content, { mean_pool: true, normalize: true }) as number[]
    const { error } = await supabase
      .from('case_chunks')
      .update({ embedding: JSON.stringify(embedding) })
      .eq('id', row.id)
    if (!error) updated++
  }

  return new Response(JSON.stringify({ updated, total: rows.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
