// ============================================================
// Healtrack — Edge Function: ia-proxy
// Deploy: supabase functions deploy ia-proxy
// Secrets necessários:
//   ANTHROPIC_API_KEY — chave da Anthropic (server-side, nunca exposta ao client)
//   SUPABASE_URL — preenchido automaticamente pelo Supabase
//   SUPABASE_SERVICE_ROLE_KEY — preenchido automaticamente pelo Supabase
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'
const RATE_LIMIT_PER_HOUR = 30

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json('ok', 200)
  }

  try {
    // ── 1. Validar JWT ─────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Não autorizado' }, 401)
    }
    const token = authHeader.slice(7)

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authErr } = await sb.auth.getUser(token)
    if (authErr || !user) return json({ error: 'Sessão inválida' }, 401)

    // ── 2. Verificar assinatura ────────────────────────────
    const { data: ass } = await sb
      .from('assinaturas')
      .select('status, plano, trial_fim, valido_ate, ia_habilitada')
      .eq('user_id', user.id)
      .single()

    if (!ass) return json({ error: 'Assinatura não encontrada' }, 403)
    if (!ass.ia_habilitada) return json({ error: 'IA não disponível no seu plano' }, 403)

    const agora = new Date()
    const bloqueado =
      ass.status === 'suspenso' || ass.status === 'cancelado' ||
      (ass.plano === 'trial' && ass.trial_fim && new Date(ass.trial_fim) < agora) ||
      (ass.plano !== 'trial' && ass.valido_ate && new Date(ass.valido_ate) < agora)

    if (bloqueado) return json({ error: 'Assinatura expirada. Renove para continuar.' }, 403)

    // ── 3. Rate limiting ───────────────────────────────────
    const horaAtual = new Date(); horaAtual.setMinutes(0, 0, 0)
    const { count } = await sb
      .from('ia_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', horaAtual.toISOString())

    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return json({ error: `Limite de ${RATE_LIMIT_PER_HOUR} análises/hora atingido.` }, 429)
    }

    // ── 4. Parsear body ────────────────────────────────────
    const { messages, system, max_tokens = 1024 } = await req.json()
    if (!messages || !Array.isArray(messages)) {
      return json({ error: 'Parâmetro messages inválido' }, 400)
    }

    // ── 5. Chamar Anthropic ────────────────────────────────
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return json({ error: 'Configuração de IA indisponível' }, 500)

    const payload: Record<string, unknown> = { model: MODEL, max_tokens, messages }
    if (system) payload.system = system

    const iaRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    })

    const iaData = await iaRes.json()
    if (!iaRes.ok) {
      console.error('Anthropic error:', iaData)
      return json({ error: iaData.error?.message || 'Erro na IA' }, iaRes.status)
    }

    // ── 6. Registrar uso ───────────────────────────────────
    await sb.from('ia_usage').insert({
      user_id: user.id,
      plano: ass.plano,
      tokens_input: iaData.usage?.input_tokens ?? 0,
      tokens_output: iaData.usage?.output_tokens ?? 0,
    })

    return json(iaData, 200)

  } catch (err) {
    // Log estruturado para facilitar suporte
    console.error(JSON.stringify({
      service: 'ia-proxy',
      event: 'unhandled_error',
      error: err instanceof Error ? err.message : String(err),
      ts: new Date().toISOString()
    }))
    return json({ error: 'Erro interno do servidor. Tente novamente em instantes.' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(
    typeof data === 'string' ? data : JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
