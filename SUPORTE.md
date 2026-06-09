# Guia de Suporte — Healtrack / Insive / Labtrack

## Configurações necessárias (após Supabase)

### 1. Sentry (monitoramento de erros) — GRATUITO

Crie **3 projetos** em https://sentry.io (um por produto):

1. Acesse sentry.io → Create Project → Browser JavaScript
2. Nome: `healtrack` / `insive` / `labtrack`
3. Copie a **DSN** (formato: `https://xxx@xxx.ingest.sentry.io/xxx`)
4. Substitua no HTML:
   - Healtrack: `__HEALTRACK_SENTRY_DSN__`
   - Insive: `__INSIVE_SENTRY_DSN__`
   - Labtrack: `__LABTRACK_SENTRY_DSN__`

Plano gratuito: 5.000 erros/mês — suficiente para 100 clientes.

### 2. Resend (e-mails transacionais) — GRATUITO

Sem isso: confirmação de cadastro e reset de senha são limitados a 4/hora pelo Supabase.

1. Crie conta em https://resend.com
2. Crie um domínio (ou use o gratuito @resend.dev para testes)
3. Copie a API Key (`re_xxx...`)
4. No Supabase → Authentication → SMTP Settings:
   - Host: `smtp.resend.com`
   - Port: `465`
   - User: `resend`
   - Password: `<sua API key do Resend>`
   - Sender email: `noreply@seudominio.com.br`

Plano gratuito: 3.000 e-mails/mês — suficiente para 100 clientes.

### 3. Asaas (cobranças) — NECESSÁRIO PARA COBRAR

1. Crie conta em https://asaas.com
2. Complete o cadastro PJ (CNPJ)
3. Em Integrações → API → copie a chave de API
4. Configure o webhook:
   - URL: `https://<projeto>.supabase.co/functions/v1/webhook-gateway`
   - Header: `x-healtrack-token: <gere um token aleatório>`
   - Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `SUBSCRIPTION_INACTIVATED`
5. No Supabase → Edge Functions → Secrets:
   - `GATEWAY_WEBHOOK_TOKEN` = o mesmo token que você configurou no Asaas

### 4. PgBouncer (pool de conexões Supabase)

No Supabase Pro:
- Settings → Database → Connection Pooling
- Ativar: **Supavisor** (modo Transaction)
- Usar a connection string do pooler (não a direta) nos Edge Functions

---

## Quando um cliente reportar problema

### Passo 1 — Pedir o diagnóstico
Instrua o cliente a:
1. Abrir o app
2. Pressionar F12 (ou Cmd+Option+I no Mac)
3. Ir na aba Console
4. Digitar: `suporte()` e pressionar Enter
5. Copiar tudo que aparecer e enviar para você

O resultado mostra: produto, versão, plano, ID do usuário, se está online, URL.

### Passo 2 — Verificar no Sentry
- Acesse sentry.io → selecione o projeto
- Filtre por data e nível (Error)
- O ID do usuário do passo anterior aparece nos eventos

### Passo 3 — Verificar nos logs do Vercel
- Acesse vercel.com → projeto → Deployments → Functions
- Filtre por `/api/chat` (Labtrack) ou Edge Functions (Healtrack)
- Logs estruturados mostram: serviço, user, IP, timestamp

### Passo 4 — Verificar no Supabase
- Logs → API Logs: mostra todas as queries
- Logs → Edge Functions: mostra chamadas ao ia-proxy e webhook-gateway
- Authentication → Users: confirmar se o usuário existe e está confirmado

---

## Problemas comuns e soluções

| Problema | Causa provável | Solução |
|---|---|---|
| "Sessão expirada" ao usar IA | Token do Supabase expirou | Cliente faz logout e login novamente |
| E-mail de confirmação não chega | SMTP não configurado | Configurar Resend (seção 2 acima) |
| IA retorna "Limite de 30/hora" | Rate limit atingido | Aguardar 1 hora ou fazer upgrade de plano |
| App trava no "Carregando…" | Supabase offline ou timeout | Verificar status.supabase.com |
| "Acesso bloqueado" após trial | Trial expirado | Cliente precisa assinar plano |
| PDF não gera | pdfmake não carregou | Problema de CDN — recarregar página |
| Fotos não abrem | URL assinada expirada (1h) | Reabrir o paciente/caso |

---

## Variáveis de ambiente necessárias

### Vercel (todos os produtos)
```
# Labtrack apenas
ANTHROPIC_API_KEY=sk-ant-...
```

### Supabase Edge Functions (Healtrack, e futuramente Insive/Labtrack)
```
ANTHROPIC_API_KEY=sk-ant-...
GATEWAY_WEBHOOK_TOKEN=<token-aleatorio-seguro>
```

---

## Checklist pré-lançamento

- [ ] Supabase Pro ativo (elimina auto-pause)
- [ ] Schema SQL aplicado com RLS
- [ ] Edge Functions deployed (ia-proxy + webhook-gateway)
- [ ] Secrets configurados no Supabase
- [ ] Resend configurado como SMTP
- [ ] Sentry DSNs substituídos nos HTMLs
- [ ] Domínio próprio configurado no Vercel
- [ ] Asaas conta criada e webhook configurado
- [ ] Primeiro cadastro de teste realizado
- [ ] Primeiro e-mail de confirmação recebido
- [ ] Primeira análise de IA testada
- [ ] Backup testado (Supabase → Backups → Restore)

