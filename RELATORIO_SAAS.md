# Relatório de Migração SaaS
## Insive & Patologia Clínica Veterinária (Nicolli)
> Gerado em: 08/06/2026 | Base de referência: Healtrack SaaS (fisiovida-saas)

---

## 1. Referência: O que o Healtrack já resolveu

Antes de analisar cada produto, estes são os padrões e infraestrutura que o Healtrack estabeleceu e que **devem ser reaproveitados integralmente** nos próximos SaaS:

| Componente | Padrão estabelecido |
|---|---|
| **Auth** | Supabase Auth (email/password) — cadastro self-service com confirmação de e-mail |
| **Isolamento de dados** | RLS por `user_id` — cada clínica vê apenas seus dados |
| **Trial automático** | Trigger `on_auth_user_created` → 14 dias, sem cartão |
| **Assinaturas** | Tabela `assinaturas` (plano, status, trial_fim, valido_ate, max_X, ia_habilitada) |
| **Verificação de plano** | RPC `verificar_assinatura()` chamada no boot + login |
| **IA server-side** | Edge Function `ia-proxy` — chave Anthropic nunca vai ao client |
| **Rate limiting IA** | Tabela `ia_usage` — 30 chamadas/hora por usuário |
| **Webhook de pagamento** | Edge Function `webhook-gateway` — compatível Asaas e Iugu |
| **Segurança HTTP** | `vercel.json` com CSP, HSTS, X-Frame, XSS-Protection |
| **Painel admin** | `/admin` — KPIs, tabela de assinantes, uso de IA, trials expirando |
| **Tela de planos** | `/planos` — Starter / Pro / Enterprise com FAQ |
| **Gating** | Limite de registros por plano bloqueado antes do insert |
| **Branding** | CSS custom properties no `:root`, fontes Google, gradientes |
| **Deploy** | Vercel auto-deploy via push GitHub — Python para arquivos grandes |
| **PDF** | PDFMake lazy-load |
| **Bottom nav mobile** | `rMobBottomNav()` com ícones SVG e badge |

### Planos padrão (reusar nos 3 SaaS)
```
trial      → 14 dias grátis, sem cartão
starter    → R$ 97-147/mês (limite menor)
pro        → R$ 197-297/mês (limite maior + IA sem restrição)
enterprise → sob consulta (ilimitado + white-label)
```

### Edge Functions reutilizáveis
Ambas as Edge Functions do Healtrack são genéricas o suficiente para os outros SaaS:
- `supabase/functions/ia-proxy/index.ts` — só mudar `RATE_LIMIT_PER_HOUR` se necessário
- `supabase/functions/webhook-gateway/index.ts` — idêntico para qualquer produto

---

## 2. Insive SaaS

### 2.1 Estado atual

| Item | Status |
|---|---|
| Arquivo principal | `index.html` — 577 KB / 10.796 linhas (maior dos 3) |
| Supabase | Projeto `qspgtyafzyqrkrfozltz` — **PAUSADO** (não usar) |
| Deploy | Vercel via repo `insive-repo-v1` |
| Auth | Supabase Auth — **contas criadas manualmente pelo admin** (não tem self-service) |
| Navegação | CSS `display:none / display:block` por ID de div (não usa `nav()` do Healtrack) |
| Tabelas ativas | `patients`, `settings` (apenas 2 — dados clínicos vão ao Google Drive/localStorage) |
| IA | Chama `api.anthropic.com` **direto no client** — chave exposta no localStorage |
| Storage | **Google Drive** para fotos e laudos (não Supabase Storage) |
| Offline | Funciona parcialmente offline via localStorage |

### 2.2 Features mapeadas

| ID view | Tela | Complexidade |
|---|---|---|
| `v-dash` | Dashboard — KPIs, agenda do dia | Média |
| `v-pac` | Lista de pacientes | Baixa |
| `v-novo-pac` | Cadastro de paciente + anamnese | Média |
| `v-acu` | Mapa corporal — acupuntura com 174 pontos bilaterais, drag-calibration | **Alta** |
| `v-termo` | Termografia — 24 vistas padronizadas, análise IA, overlay, canvas | **Alta** |
| `v-fer` | Feridas e curativos — fotos, fases de cicatrização, laser | **Alta** |
| `v-anam` | Anamnese detalhada | Média |
| `v-hist` | Histórico de sessões | Média |
| `v-evo` | Gráfico de evolução (Chart.js + IA) | Média |
| `v-comp` | Comparativo de termografias | **Alta** |
| `v-rel` | Geração de relatórios PDF | Média |

**Técnicas clínicas cobertas:** Acupuntura, Eletroacupuntura, Ventosa/Cupping, Laser, Moxabustão, Termografia, Curativos/Feridas

### 2.3 Complexidades específicas do Insive

**Mapa corporal de acupuntura**
- 174 pontos bilaterais com coordenadas calibráveis por arrasto
- SVG dinâmico por vista (anterior, posterior, lateral)
- Estado persistido em `insive_mapa_calibration` no localStorage
- No SaaS: calibração deve ser por `user_id` no banco, não localStorage

**Termografia**
- 24 vistas padronizadas (`insive_config_termografia`) — JSON configurável
- Análise IA: `pontos_locais` + `pontos_distais` separados, lateralidade explícita
- Imagens no Google Drive por `file_id` (não base64)
- Canvas manual com overlay de meridianos
- No SaaS: migrar imagens para Supabase Storage bucket privado; manter config JSON no banco

**Multi-profissional**
- Sistema de profissionais com PIN SHA-256 já implementado
- Perfis: admin, profissional, auxiliar
- No SaaS: idêntico ao Healtrack — reaproveitamento direto

**Google Drive**
- Integração via Google Sign-In (OAuth) para upload/download de fotos
- Pastas organizadas por paciente e tipo
- No SaaS: **substituir por Supabase Storage** — mais simples, sem OAuth extra, RLS nativo

### 2.4 Débitos técnicos a resolver na migração

| Débito | Impacto | Solução |
|---|---|---|
| Chave Anthropic no client (localStorage) | 🔴 Crítico | Edge Function `ia-proxy` (já pronta) |
| Sem self-service de cadastro | 🔴 Crítico para SaaS | Tela de cadastro (igual Healtrack) |
| Dados clínicos no localStorage/Drive | 🔴 Crítico | Migrar para Supabase com schema completo |
| Google Drive OAuth obrigatório | 🟡 Médio | Supabase Storage + URLs assinadas |
| Navegação por CSS display (10k linhas) | 🟡 Médio | Refatorar para padrão `nav()` do Healtrack |
| Sem tabela `assinaturas` | 🔴 Bloqueante | Aplicar schema padrão |
| Sem isolamento multi-tenant (RLS) | 🔴 Bloqueante | RLS por `user_id` em todas as tabelas |

### 2.5 Schema proposto para o Insive SaaS

```sql
-- Tabelas novas (além do padrão do Healtrack)
pacientes         (id, user_id, nome, data_nasc, telefone, email, foto_url, obs)
anamnese          (id, user_id, paciente_id, queixa, historico, comorbidades,
                   medicamentos, contraindicacoes, dados_extras jsonb)
sessoes           (id, user_id, paciente_id, data, tecnicas jsonb,
                   pontos_aplicados jsonb, notas, avaliacao_ia jsonb)
fotos_sessao      (id, user_id, sessao_id, url, tipo, ordem)
termografias      (id, user_id, paciente_id, sessao_id, vista,
                   file_id_storage, analise_ia jsonb, pontos jsonb,
                   created_at)
feridas           (id, user_id, paciente_id, regiao, fase, area_cm2,
                   fotos jsonb, evolucao jsonb)
configuracoes     (id, user_id UNIQUE, dados jsonb) -- inclui config termografia, calibração
profissionais     (id, user_id, nome, coren, nivel, pin_hash, acesso_sensivel, ativo)
assinaturas       ← padrão Healtrack
ia_usage          ← padrão Healtrack
```

### 2.6 Planos sugeridos para o Insive SaaS

| Plano | Preço | Pacientes | Termografia | IA |
|---|---|---|---|---|
| trial | grátis 14d | 20 | ✅ | 20/hora |
| starter | R$ 127/mês | 60 | ✅ | 30/hora |
| pro | R$ 247/mês | 250 | ✅ + comparativo | sem limite |
| enterprise | sob consulta | ilimitado | ✅ | sem limite |

*Preço maior que Healtrack: módulo de termografia eleva o valor percebido*

### 2.7 Estimativa de esforço

| Fase | Tarefas | Estimativa |
|---|---|---|
| 0 — Infra | Supabase novo, schema, Edge Functions, vercel.json | 1 sessão |
| 1 — Auth/Assinatura | Cadastro self-service, verificação de plano, trial, tela de planos | 1 sessão |
| 2 — Migração dados | Substituir localStorage/Drive por Supabase em todas as funções | 3-4 sessões |
| 3 — IA server-side | Plugar `ia-proxy`, remover chave do client | 1 sessão |
| 4 — Polish | Bottom nav, admin panel, testes | 1 sessão |
| **Total** | | **~7 sessões** |

---

## 3. Patologia Clínica Veterinária (Nicolli) SaaS

### 3.1 Estado atual

| Item | Status |
|---|---|
| Arquivos principais | `index.html` (510 KB) + `forms.html` (665 KB) + `api/chat.js` |
| Supabase | Projeto `vsvqkzmbhwjfmmqkszcx` — **ATIVO** (Nicolli usa hoje) |
| Deploy | Vercel via repo `nicolli-azevedo-patologia-clinica-veterinaria-` |
| Auth | Supabase Auth — **sem self-service** (conta única da Nicolli) |
| Proxy IA | Vercel serverless `/api/chat.js` — chave no `.env` do Vercel ✅ |
| Chave Anthropic | **Hardcoded no código** apesar do proxy |
| Tabelas | `animais`, `casos`, `laudos`, `configuracoes` |
| RLS | **Sem RLS** — todos os dados acessíveis sem filtro por user |
| Storage | Não usa (sem fotos no sistema atual) |

### 3.2 Features mapeadas

| View | Tela | Complexidade |
|---|---|---|
| `dashboard` | KPIs — casos do dia, laudos pendentes, urgências | Baixa |
| `animais` | Cadastro e busca de animais + tutores | Baixa |
| `casos` | Gestão de casos — código NAP-XXXX, status, prioridade | Média |
| `novo-caso` | Abertura de caso + anamnese + seleção de exame | Média |
| `laudos` | Editor de laudo (macro + micro + diagnóstico) | **Alta** |
| `ia` | "Completar com IA" — sugestão de laudo via Claude | **Alta** |
| `historico` | Histórico de casos por animal | Média |
| `amostras` | Controle de amostras recebidas | Média |
| `config` | Identidade do laboratório, PDF, watermark | Baixa |

**Tipos de exame:** Citologia, Histopatologia, Hemograma, Bioquímica, Urinálise, Microbiologia

### 3.3 Diferenciais do produto

**Laudo inteligente com IA**
- "Completar com IA" — envia macro + micro + anamnese → Claude retorna diagnóstico
- WhatsApp formatting — laudo formatado para envio direto
- Status do laudo: Rascunho → Revisão → Liberado
- PDF com watermark diagonal configurável, cover page, header/footer por página

**Código de caso único**
- Formato `NAP-AAAA-XXXX` (gerado no banco, sequencial por ano)
- Garante rastreabilidade e profissionalismo
- No SaaS: precisa ser `NAP-AAAA-XXXX` **por clínica** — prefixo configurável

**Multi-espécie**
- Suporte a Cão, Gato, Equino + espécies exóticas
- Mapa SVG do corpo animal para marcar coleta
- Valores de referência por espécie

### 3.4 Débitos técnicos a resolver

| Débito | Impacto | Solução |
|---|---|---|
| Sem RLS — banco sem isolamento | 🔴 Bloqueante para SaaS | RLS por `user_id` em todas as tabelas |
| Chave Anthropic hardcoded | 🔴 Crítico | Usar edge function `ia-proxy` padrão |
| Sem `assinaturas` | 🔴 Bloqueante | Schema padrão |
| 2 arquivos HTML separados (index + forms) | 🟡 Médio | Unificar em single-file ou manter com SPA routing |
| Sem self-service | 🔴 Crítico para SaaS | Tela de cadastro |
| `configuracoes` sem `user_id` | 🔴 Crítico | Adicionar coluna + RLS |
| Código NAP compartilhado | 🟡 Médio | Sequência por `user_id` + prefixo configurável |

### 3.5 Schema proposto para o Nicolli SaaS

```sql
-- Migração do schema atual para multi-tenant
animais       (id, user_id, nome, especie, raca, sexo, idade,
               tutor, telefone, obs, criado_em)
casos         (id, user_id, codigo, animal_id, animal_nome, especie,
               tipo_exame, solicitante, data_entrada, prazo_entrega,
               prioridade, status, suspeita, anamnese, obs_patologista)
laudos        (id, user_id, caso_id, codigo_caso, macro, micro,
               diagnostico, recomendacoes, status, ia_versao)
configuracoes (id, user_id UNIQUE, dados jsonb) -- padrão Healtrack
profissionais (id, user_id, nome, crmv, nivel, pin_hash, ativo) -- opcional
assinaturas   ← padrão Healtrack
ia_usage      ← padrão Healtrack

-- Função: gerar código NAP por usuário
CREATE OR REPLACE FUNCTION gerar_codigo_caso(p_user_id uuid)
RETURNS text AS $$
DECLARE
  v_ano int := EXTRACT(year FROM now());
  v_seq int;
  v_prefixo text;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(codigo, '-', 3) AS int)), 0) + 1
    INTO v_seq
    FROM casos
    WHERE user_id = p_user_id
      AND EXTRACT(year FROM criado_em) = v_ano;
  -- Prefixo configurável por clínica (padrão NAP)
  SELECT COALESCE(dados->>'codigo_prefixo', 'NAP')
    INTO v_prefixo
    FROM configuracoes WHERE user_id = p_user_id;
  RETURN v_prefixo || '-' || v_ano || '-' || LPAD(v_seq::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.6 Planos sugeridos para o Nicolli SaaS

| Plano | Preço | Casos/mês | IA | Usuários |
|---|---|---|---|---|
| trial | grátis 14d | 30 | 20/hora | 1 |
| starter | R$ 97/mês | 100 | 30/hora | 1 |
| pro | R$ 197/mês | ilimitado | sem limite | 3 |
| enterprise | sob consulta | ilimitado | sem limite | ilimitado |

*Produto mais nichado — ticket compatível com clínicas veterinárias de médio porte*

### 3.7 Estimativa de esforço

| Fase | Tarefas | Estimativa |
|---|---|---|
| 0 — Infra | Supabase novo, schema multi-tenant, Edge Functions, vercel.json | 1 sessão |
| 1 — Auth/Assinatura | Self-service, trial, planos | 1 sessão |
| 2 — RLS + user_id | Adicionar `user_id` em todas as tabelas, policies, migrar dados Nicolli | 2 sessões |
| 3 — IA server-side | Plugar `ia-proxy`, remover chave hardcoded | 0.5 sessão |
| 4 — Código NAP | Função `gerar_codigo_caso()` por clínica | 0.5 sessão |
| 5 — Polish | Admin, bottom nav, testes | 1 sessão |
| **Total** | | **~6 sessões** |

---

## 4. Comparativo dos 3 produtos

| | Healtrack | Insive SaaS | Nicolli SaaS |
|---|---|---|---|
| **Status** | ✅ Pronto (aguarda Supabase) | 🔄 A construir | 🔄 A construir |
| **Linhas de código** | 3.825 | 10.796 | ~6.000 |
| **Complexidade** | Média | **Alta** | Média |
| **Features únicas** | Cicatrização pós-op | Termografia + mapa acupuntura | Laudos patológicos + código NAP |
| **IA no client?** | ❌ (proxy) | 🔴 Sim (migrar) | ✅ proxy Vercel |
| **RLS ativo?** | ✅ | ❌ (migrar) | ❌ (migrar) |
| **Self-service?** | ✅ | ❌ (construir) | ❌ (construir) |
| **Multi-profissional** | ✅ | ✅ (migrar) | ⚠️ (construir) |
| **Público-alvo** | Fisioterapeutas | Acupunturistas/Integrativa | Patologistas veterinários |
| **Mercado BR** | Grande | Médio | Nicho |
| **Ticket sugerido** | R$97–197 | R$127–247 | R$97–197 |

---

## 5. Arquitetura compartilhada (reutilizar nos 3)

```
┌─────────────────────────────────────────────────────────┐
│                    PADRÃO SAAS                          │
├─────────────────────────────────────────────────────────┤
│  Frontend (single-file HTML)                            │
│  ├── Boot: verificarAssinatura() → navBloqueado()      │
│  ├── Login: auth + assinatura + trial banner           │
│  ├── Cadastro self-service + confirmação e-mail        │
│  ├── Tela /planos (Starter/Pro/Enterprise)             │
│  ├── Painel /admin (KPIs + assinantes + uso IA)       │
│  ├── Bottom nav mobile                                  │
│  └── Gating por plano antes de inserts críticos       │
├─────────────────────────────────────────────────────────┤
│  Supabase                                               │
│  ├── Auth (email/password, self-service)               │
│  ├── RLS: todas as tabelas isoladas por user_id        │
│  ├── Trigger: trial 14d ao criar conta                 │
│  ├── RPC: verificar_assinatura()                       │
│  ├── RPC: contar_X_ativos() — gating                  │
│  ├── Storage: bucket privado (fotos/PDFs)              │
│  └── Tabelas padrão: assinaturas + ia_usage           │
├─────────────────────────────────────────────────────────┤
│  Edge Functions                                         │
│  ├── ia-proxy (chave Anthropic server-side)           │
│  └── webhook-gateway (Asaas/Iugu → atualiza plano)   │
├─────────────────────────────────────────────────────────┤
│  Vercel                                                 │
│  ├── vercel.json (CSP, HSTS, X-Frame)                 │
│  └── auto-deploy via GitHub push                       │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Ordem de execução recomendada

### Prioridade técnica
1. **Healtrack** — finalizar (só precisa do Supabase)
2. **Nicolli** — menor esforço, cliente real, menor código
3. **Insive** — maior esforço, maior valor de mercado

### Por que Nicolli antes do Insive
- Código menor (~6k linhas vs ~11k)
- IA já tem proxy Vercel (só mover chave para env var)
- Schema simples (4 tabelas)
- Cliente ativa → feedback imediato
- Serve como exercício de migração antes do Insive (mais complexo)

---

## 7. Checklist de abertura de cada novo SaaS

```
□ Criar repo GitHub (ex: insive-saas, nicolli-saas)
□ Criar projeto Supabase (sa-east-1, org ccppymtcvrwhcpxsqikt)
□ Aplicar schema SQL com user_id + RLS + trigger trial
□ Criar bucket Storage privado
□ Copiar supabase/functions/ do Healtrack (ia-proxy + webhook-gateway)
□ Setar secrets: ANTHROPIC_API_KEY + GATEWAY_WEBHOOK_TOKEN
□ Criar vercel.json com headers de segurança
□ Substituir SUPA_URL e SUPA_KEY no index.html
□ Adicionar: S.assinatura, verificarAssinatura(), navBloqueado()
□ Adicionar: tela /cadastro, /planos, /admin
□ Adicionar: boot() verifica assinatura, login() verifica assinatura
□ Adicionar: banner trial + gating de limite
□ Importar repo no Vercel → auto-deploy
□ Testar: cadastro → trial → uso → expiração → bloqueio
```

---

*Relatório gerado por análise automatizada dos repositórios:*
- `matheusrodriguesidk-creator/fisiovida-saas` (Healtrack — referência)
- `matheusrodriguesidk-creator/insive-repo-v1` (Insive)
- `matheusrodriguesidk-creator/nicolli-azevedo-patologia-clinica-veterinaria-` (Nicolli)
