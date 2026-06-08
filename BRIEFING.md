# Healtrack SaaS — Briefing atualizado

> Cole este documento no início do novo chat para retomar de onde paramos.
> Gerado em: 08/06/2026

---

## Identidade do produto

**Healtrack** — sistema de gestão clínica para fisioterapia pós-operatória estética.
Rebrand do Fisiovida. Produto SaaS multi-tenant, single-file HTML.

- **Desenvolvedor:** Matheus Rodrigues (`matheusrodriguesidk@gmail.com`)
- **Cliente piloto:** Cleise Santos — continua usando o Fisiovida v1 (repo separado, não mexer)

---

## Repositórios e credenciais

### Healtrack SaaS (este trabalho)
- **Repo:** `matheusrodriguesidk-creator/fisiovida-saas`
- **Token GitHub:** `[fornecer no novo chat — tokens expiram]`
- **Vercel:** ainda não importado → importar em vercel.com após Supabase pronto
- **Supabase:** ainda não criado → criar em `ccppymtcvrwhcpxsqikt`, região `sa-east-1`, nome `healtrack`

### Fisiovida v1 (produção — NÃO MEXER)
- **Repo:** `matheusrodriguesidk-creator/fisiovida-posop`
- **URL:** `https://fisiovida-posop.vercel.app/`
- **Supabase:** `tvheuwykjdohdqrtwmne`

---

## Estado atual do repo `fisiovida-saas`

```
index.html                              ← app principal (231 KB, 3768 linhas)
vercel.json                             ← headers de segurança completos
BRIEFING.md                             ← briefing anterior (desatualizado)
supabase/
  config.toml                           ← configuração local
  functions/
    ia-proxy/index.ts                   ← Edge Function IA (pronta para deploy)
    webhook-gateway/index.ts            ← Edge Function pagamentos (pronta)
```

---

## O que já está implementado no index.html

### Produto
- Rebrand completo: Fisiovida → Healtrack (título, meta, sidebar, PDFs, bucket, salt PIN)
- Toda funcionalidade clínica do v1: pacientes, anamnese, pacotes, sessões, fotos, prontuário, agenda, PDFs, perfis/PIN

### SaaS
- **`S.assinatura`** — state com `{bloqueado, plano, dias_restantes, motivo, ia_habilitada, max_pacientes}`
- **`verificarAssinatura()`** — chama RPC `verificar_assinatura()` no boot
- **`navBloqueado(ass)`** — tela de bloqueio com motivo + link suporte
- **`mostrarBannerTrial(dias)`** — banner amarelo no topo quando trial ≤ 5 dias
- **`verificarLimitePacientes()`** — bloqueia cadastro acima do limite do plano
- Boot: verifica assinatura antes de renderizar; trial expirando → banner
- Bloqueio de IA por plano (`ia_habilitada === false`)

### Telas
- **Login** com link "Criar conta grátis"
- **Cadastro self-service** (`/cadastro`): nome clínica, email, senha → Supabase Auth → tela de confirmação
- **Planos** (`/planos`): Starter R$97, Pro R$197, Enterprise sob consulta — FAQ, card do plano atual
- **Admin** (`/admin`): acesso restrito por email, KPIs (total/ativos/trials/pagantes/inadim/tokens 24h), tabela assinantes, tabela uso IA

### Segurança
- `vercel.json`: CSP, HSTS, X-Frame-Options, XSS-Protection, Referrer-Policy
- Chave Anthropic removida do client — gerenciada via Edge Function server-side
- Seção configurações IA substituída por card informativo do plano atual
- Bucket Supabase renomeado: `fisiovida` → `healtrack`
- PIN salt atualizado: `fisiovida_salt` → `healtrack_salt_2024`

### SUPA_URL/SUPA_KEY no HTML
Ainda com **placeholders** (`__HEALTRACK_SUPABASE_URL__` e `__HEALTRACK_SUPABASE_ANON_KEY__`).
**Precisa ser atualizado quando o projeto Supabase for criado.**

---

## Edge Functions (prontas, aguardando deploy)

### `ia-proxy`
- Valida JWT do usuário
- Verifica assinatura ativa + `ia_habilitada`
- Rate limit: 30 chamadas/hora por user (tabela `ia_usage`)
- Chama Anthropic com chave server-side (`ANTHROPIC_API_KEY` como secret)
- Registra uso em `ia_usage`

**Secrets necessários:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

### `webhook-gateway`
- Valida header `x-healtrack-token` (secret próprio)
- Compatível com Asaas e Iugu
- Atualiza `assinaturas.status` e `valido_ate` conforme evento
- Upgrade automático: trial → starter ao pagar

**Secrets necessários:**
```
GATEWAY_WEBHOOK_TOKEN=<gerar token aleatório>
```

---

## Schema SQL (aguardando aplicar no Supabase novo)

Tabelas: `assinaturas`, `configuracoes`, `pacientes`, `anamnese`, `pacotes`, `sessoes`,
`fotos_sessao`, `agenda`, `profissionais`, `prontuario_evolucao`, `ia_usage`

Funções RPC: `verificar_assinatura()`, `contar_pacientes_ativos()`

Trigger automático: `on_auth_user_created` → cria trial de 14 dias ao cadastrar

Storage bucket: `healtrack` (privado, 10MB, apenas imagens)

**O schema completo está na sessão anterior — 510 linhas de SQL.**
Pedir ao assistente para reexibi-lo se necessário.

---

## Planos definidos

| Plano    | Preço     | Pacientes | IA             |
|----------|-----------|-----------|----------------|
| trial    | grátis    | 30        | 30/hora        |
| starter  | R$ 97/mês | 50        | 30/hora        |
| pro      | R$197/mês | 200       | sem limite     |
| enterprise | sob consulta | ilimitado | sem limite  |

---

## O que falta para ir ao ar

### BLOQUEANTE (depende de Supabase)
- [ ] Criar projeto Supabase `healtrack` (sa-east-1, organização `ccppymtcvrwhcpxsqikt`)
- [ ] Aplicar schema SQL (510 linhas)
- [ ] Substituir placeholders no HTML:
  - `__HEALTRACK_SUPABASE_URL__` → URL real
  - `__HEALTRACK_SUPABASE_ANON_KEY__` → anon key real
  - Preconnect DNS no `<head>` também
- [ ] Deploy Edge Functions: `supabase functions deploy ia-proxy` + `supabase functions deploy webhook-gateway`
- [ ] Setar secrets: `ANTHROPIC_API_KEY` e `GATEWAY_WEBHOOK_TOKEN`
- [ ] Importar repo no Vercel → auto-deploy

### Fase 2 (após lançamento)
- [ ] Gateway de pagamento (Asaas) — criar conta, configurar webhook
- [ ] Supabase Pro (elimina auto-pause, backups diários) — OBRIGATÓRIO antes de ter clientes pagantes
- [ ] E-mails transacionais (boas-vindas, confirmação, recibo)
- [ ] Domínio `healtrack.com.br`
- [ ] Landing page pública

---

## Padrões de código

```python
# Deploy via Python (arquivo grande demais para curl)
import base64, json, urllib.request
# PUT /contents/index.html com SHA + base64 + committer fixo

# Patch seguro
assert "string_exata" in html
html = html.replace("string_exata", "novo", 1)

# Validar antes de push
node --check /tmp/t.js
js.count('{') == js.count('}')
js.count('(') == js.count(')')
js.count('`') % 2 == 0
```

### State global
```js
S = {
  user, config, pacientes, pac, assinatura,  // assinatura: NOVO
  view, tab, fotos, iaResult, editAnam,
  agenda, evolucao, calAno, calMes, calDiaSel, agView, semanaOffset,
  profissionais, profAtual, evolucaoIA, loadingEvolucao
}
```

### Funções críticas SaaS (NOVAS)
- `verificarAssinatura()` — RPC + fallback fail-open
- `navBloqueado(ass)` — tela de bloqueio
- `mostrarBannerTrial(dias)` — banner amarelo
- `verificarLimitePacientes()` — gate de pacientes
- `isAdmin()` — verifica email em `ADMIN_EMAILS`
- `loadAdminData()` + `bindAdmin()` — painel admin

---

## Para retomar

Ao abrir novo chat, cole este briefing e diga:

> "Briefing do Healtrack carregado. Supabase criado — URL: https://XXX.supabase.co, anon key: eyJ... Aplicar schema e substituir placeholders no index.html."

