// ============================================================
// Healtrack — Edge Function: webhook-gateway
// Deploy: supabase functions deploy webhook-gateway
// Secrets:
//   GATEWAY_WEBHOOK_TOKEN — token secreto gerado por você,
//                           cadastrado no Asaas/Iugu como header
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — automáticos
//
// URL para cadastrar no Asaas/Iugu:
//   https://<projeto>.supabase.co/functions/v1/webhook-gateway
// Header de segurança: x-healtrack-token: <GATEWAY_WEBHOOK_TOKEN>
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Mapeamento de eventos → status interno
// Compatível com Asaas e Iugu (nomes normalizados abaixo)
const STATUS_MAP: Record<string, string> = {
  // Asaas
  'PAYMENT_CONFIRMED':    'ativo',
  'PAYMENT_RECEIVED':     'ativo',
  'PAYMENT_OVERDUE':      'inadimplente',
  'PAYMENT_DELETED':      'cancelado',
  'SUBSCRIPTION_INACTIVATED': 'cancelado',
  // Iugu
  'subscription.activated':   'ativo',
  'subscription.renewed':     'ativo',
  'subscription.suspended':   'inadimplente',
  'subscription.canceled':    'cancelado',
  'invoice.paid':             'ativo',
  'invoice.expired':          'inadimplente',
}

Deno.serve(async (req: Request) => {
  // ── 1. Validar token de segurança ──────────────────────
  const token = req.headers.get('x-healtrack-token')
  const expected = Deno.env.get('GATEWAY_WEBHOOK_TOKEN')

  if (!token || !expected || token !== expected) {
    console.warn('webhook-gateway: token inválido')
    return new Response('Unauthorized', { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  console.log(JSON.stringify({service:"webhook-gateway",event:eventName,ts:new Date().toISOString(),payload_size:JSON.stringify(body).length}))

  // ── 2. Extrair dados do evento ─────────────────────────
  // Asaas: { event: 'PAYMENT_CONFIRMED', payment: { subscription: 'sub_xxx', customer: 'cus_xxx', dueDate: '...' } }
  // Iugu:  { event: 'subscription.activated', data: { id: 'sub_xxx', customer_id: 'cus_xxx', expires_at: '...' } }

  const eventName = (body.event as string) || ''
  const novoStatus = STATUS_MAP[eventName]

  if (!novoStatus) {
    // Evento não mapeado — ignorar silenciosamente
    console.log('webhook-gateway: evento ignorado:', eventName)
    return new Response('OK', { status: 200 })
  }

  // Extrair IDs do gateway (suporte Asaas e Iugu)
  let gatewaySubId: string | null = null
  let gatewayCustomerId: string | null = null
  let validoAte: string | null = null

  // Asaas
  if (body.payment && typeof body.payment === 'object') {
    const p = body.payment as Record<string, unknown>
    gatewaySubId = (p.subscription as string) || null
    gatewayCustomerId = (p.customer as string) || null
    // Calcular próximo vencimento (+30 dias) se for pagamento confirmado
    if (novoStatus === 'ativo' && p.dueDate) {
      const d = new Date(p.dueDate as string)
      d.setDate(d.getDate() + 32) // margem de 2 dias
      validoAte = d.toISOString()
    }
  }

  // Iugu
  if (body.data && typeof body.data === 'object') {
    const d = body.data as Record<string, unknown>
    gatewaySubId = (d.id as string) || null
    gatewayCustomerId = (d.customer_id as string) || null
    if (d.expires_at) {
      const exp = new Date(d.expires_at as string)
      exp.setDate(exp.getDate() + 2) // margem
      validoAte = exp.toISOString()
    }
  }

  if (!gatewaySubId && !gatewayCustomerId) {
    console.warn('webhook-gateway: sem IDs de gateway no payload')
    return new Response('OK', { status: 200 }) // ack para o gateway não retentar
  }

  // ── 3. Atualizar assinatura no banco ───────────────────
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Buscar assinatura pelo gateway_sub_id ou gateway_customer_id
  let query = sb.from('assinaturas').update({
    status: novoStatus,
    ...(validoAte ? { valido_ate: validoAte } : {}),
    ...(novoStatus === 'ativo' ? { plano: 'starter' } : {}), // upgrade de trial para starter ao pagar
    updated_at: new Date().toISOString(),
  })

  if (gatewaySubId) {
    query = query.eq('gateway_sub_id', gatewaySubId)
  } else {
    query = query.eq('gateway_customer_id', gatewayCustomerId!)
  }

  const { error, count } = await query.select('id', { count: 'exact' })

  if (error) {
    console.error('webhook-gateway: erro ao atualizar:', error.message)
    return new Response('Internal Error', { status: 500 })
  }

  if (count === 0) {
    console.warn('webhook-gateway: assinatura não encontrada para:', { gatewaySubId, gatewayCustomerId })
  } else {
    console.log(`webhook-gateway: assinatura atualizada → ${novoStatus} (${count} registro(s))`)
  }

  return new Response('OK', { status: 200 })
})
