import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GITHUB_MODELS_URL = 'https://models.github.ai/inference/chat/completions'
const TOP_K = 6
const MATCH_THRESHOLD = 0.5

interface ReqBody {
  dialog_id: string
  message: string
}

interface CaseChunk {
  id: string
  content: string
  case_number: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (req: Request) => {
  // Обработка OPTIONS запроса
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ message: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Создаем клиент Supabase с токеном
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Парсим тело запроса
    let body: ReqBody
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ message: 'Invalid JSON' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { dialog_id, message } = body
    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ message: 'message is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // // Проверяем, что диалог принадлежит пользователю
    // const { data: dialog, error: dialogError } = await supabase
    //   .from('dialogs')
    //   .select('id')
    //   .eq('id', dialog_id)
    //   .single()

    // if (dialogError || !dialog) {
    //   return new Response(
    //     JSON.stringify({ message: 'Dialog not found' }),
    //     {
    //       status: 404,
    //       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    //     }
    //   )
    // }

    // Генерируем эмбеддинг
    const model = new Supabase.ai.Session('gte-small')
    const embedding = await model.run(message.trim(), { mean_pool: true, normalize: true }) as number[]

    // Поиск похожих чанков
    const { data: chunks, error: rpcError } = await supabase.rpc('match_case_chunks', {
      query_embedding: embedding,
      match_threshold: MATCH_THRESHOLD,
      match_count: TOP_K,
    })

    if (rpcError) {
      console.error('match_case_chunks error:', rpcError)
      return new Response(
        JSON.stringify({ message: 'Search failed' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const sources = (chunks ?? []) as CaseChunk[]
    const contextText = sources.length > 0
      ? sources.map((s, i) => `[${i + 1}] ${s.case_number ? `Дело ${s.case_number}. ` : ''}${s.content}`).join('\n\n')
      : ''

    // LLM через GitHub Models
    const githubToken = Deno.env.get('GITHUB_MODELS_TOKEN')
    if (!githubToken) {
      return new Response(
        JSON.stringify({ message: 'LLM not configured' }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const systemPrompt = `Ты — юридический ассистент. Отвечай на вопросы пользователя, опираясь только на приведённые фрагменты судебной практики. Если в контексте нет подходящей информации, так и скажи. Отвечай кратко и по делу, на русском языке.`

    const userPrompt = contextText
      ? `Контекст (фрагменты судебных дел):\n\n${contextText}\n\n---\n\nВопрос пользователя: ${message.trim()}`
      : `Вопрос пользователя: ${message.trim()}\n\n(Контекст по делам не найден — ответь, что по заданному запросу релевантных дел в базе нет.)`




    const llmBody = {
      model: Deno.env.get('GITHUB_MODELS_MODEL') || 'deepseek/DeepSeek-V3-0324',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2048,
      temperature: 0.3,
      stream: false
    }

    const llmRes = await fetch(GITHUB_MODELS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(llmBody),
    })

    if (!llmRes.ok) {
      const errText = await llmRes.text()
      console.error('GitHub Models error:', llmRes.status, errText)
      return new Response(
        JSON.stringify({ message: 'Ошибка генерации ответа', details: errText }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const llmData = await llmRes.json()
    const content = llmData?.choices?.[0]?.message?.content ?? 'Нет ответа от модели.'

    const responseSources = sources.map((s) => ({
      id: s.id,
      content: s.content.slice(0, 500),
      case_number: s.case_number ?? undefined,
    }))

    return new Response(
      JSON.stringify({ content, sources: responseSources }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ message: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})