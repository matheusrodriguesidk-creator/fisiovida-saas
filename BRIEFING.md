# Fisiovida SaaS — Briefing para novo chat

> Cole este documento inteiro no início do novo chat para retomar de onde paramos.

---

## Contexto geral

Estamos desenvolvendo o **Fisiovida** — sistema de gestão clínica para fisioterapia pós-operatória estética, construído como single-file HTML (~210 KB) com JS (~165 KB). O produto **está em produção e em uso real** pela fisioterapeuta Cleise Santos em Altamira/PA.

O objetivo agora é criar a versão **SaaS multi-tenant** partindo do código atual como base, em um repositório separado.

O Matheus é o desenvolvedor (conta de dev: `matheusrodriguesidk@gmail.com`). A cliente piloto é a Cleise (`cleisegomessantos@hotmail.com`). O Matheus também opera as clínicas Insive (acupuntura) e desenvolveu o app da veterinária Nicolli Azevedo — contexto relevante para reutilização de padrões.

---

## Repositórios e credenciais

### Fisiovida SaaS (NOVO — base para este trabalho)
- **Repo GitHub:** `matheusrodriguesidk-creator/fisiovida-saas`
- **Token GitHub:** `[GITHUB_TOKEN — forneça no novo chat]`
- **Vercel:** ainda não criado — importar o repo em vercel.com (Import Project → GitHub → fisiovida-saas)
- **Supabase:** ainda não criado — precisa de projeto novo (ver seção Supabase abaixo)

### Fisiovida v1 (produto em produção — NÃO MEXER)
- **Repo GitHub:** `matheusrodriguesidk-creator/fisiovida-posop`
- **URL produção:** `https://fisiovida-posop.vercel.app/`
- **Supabase projeto:** `tvheuwykjdohdqrtwmne` (`https://tvheuwykjdohdqrtwmne.supabase.co`)
- **Vercel:** team `team_1KgcHyKBRiWIEJiAF8wSV3Ib`, project `prj_dk1BXvFiWZ0SHLGgqqLnTYBaRgiQ`

### Outros projetos Supabase (não mexer)
- `qspgtyafzyqrkrfozltz` — Insive clinic (PAUSADO)
- `vsvqkzmbhwjfmmqkszcx` — Nicolli Azevedo patologia veterinária (ATIVO)

### Committer padrão em todos os repos
```json
{"name": "Matheus Rodrigues", "email": "matheusrodriguesidk@gmail.com"}
```

---

## Stack técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML single-file, JS vanilla, CSS custom properties |
| Banco | Supabase (Postgres + Auth + Storage + RLS) |
| Deploy | Vercel (auto-deploy via GitHub push) |
| PDF | PDFMake (lazy load) |
| IA | Anthropic Claude API (chamada direta no client) |
| Storage | Bucket privado Supabase `fisiovida` (URLs assinadas) |

**Padrão de deploy:** PUT via API GitHub em `contents/index.html` com SHA, committer fixo. NUNCA slice por índice. Sempre `str.replace` com strings exatas + assert. Validar com `node --check` antes de push.

**Harnesses de teste (manter e rodar antes de cada deploy):**
- `/tmp/check3.js` — boot + login + nav + todas as telas render
- `/tmp/edge.js` — casos extremos (paciente vazio, campos null, etc.)
- `/tmp/extra.js` — fluxos de pacote e foto
- `/tmp/pdftest.js` — geração dos 3 PDFs (usa `/tmp/t_test.js` com stubs)
- `/tmp/perfil.js` — fluxo completo de perfis (NOVO, desta sessão)

---

## Banco de dados v1 (esquema atual — produção)

### Tabelas (todas com RLS ativo)

```
pacientes         — id, user_id, nome, data_nascimento, telefone, email, foto_url
anamnese          — id, paciente_id, tipo_cirurgia, data_cirurgia, comorbidades, ...
pacotes           — id, paciente_id, descricao, total_sessoes, status, data_inicio
sessoes           — id, pacote_id, paciente_id, numero_sessao, data_sessao, procedimentos(jsonb), notas, avaliacao_ia(jsonb), fase_cicatrizacao
fotos_sessao      — id, sessao_id, url, referencia_escala, ordem
configuracoes     — id, user_id UNIQUE, dados(jsonb) — armazena toda config da clínica
agenda            — id, user_id, paciente_id, titulo, data, hora_inicio, hora_fim, status
profissionais     — id, user_id, nome, crefito, nivel, pin_hash, acesso_sensivel, ativo
prontuario_evolucao — id, paciente_id, user_id, data, tipo, conteudo, autor
```

### Cascades
- `sessoes.pacote_id` → `pacotes.id` ON DELETE CASCADE
- `fotos_sessao.sessao_id` → `sessoes.id` ON DELETE CASCADE
- `prontuario_evolucao.paciente_id` → `pacientes.id` ON DELETE CASCADE

### RLS — padrão atual
Todas as policies usam `(select auth.uid())` para evitar re-avaliação por linha. Isolamento por `user_id`. Índices em todas as FKs.

---

## Funcionalidades implementadas (v1)

- **Pacientes:** CRUD completo, foto privada (bucket), busca com debounce
- **Anamnese:** histórico cirúrgico completo, comorbidades, medicamentos
- **Pacotes:** criar, editar, excluir (com warning de cascade), progresso
- **Sessões:** procedimentos, notas, avaliação IA, fotos clínicas privadas, slider before/after
- **Prontuário:** aba editável com anotações datadas (SOAP, avaliação, alta, EVA), salvo em banco, incluso no PDF
- **Agenda:** visões dia/semana/mês, eventos com status
- **Relatórios PDF:** Paciente, Prontuário, Alta — sessões indivisíveis, sem quebra, sem página em branco
- **IA:** avaliação de sessão via Claude API, gráfico de evolução Chart-like
- **Perfis:** seletor "quem está atendendo?" (dono + profissionais com PIN), troca de perfil
- **Configurações:** logo, identidade visual, chave API, profissionais, backup LGPD

---

## Arquitetura de autenticação/perfis (v1)

O modelo atual é **um login por clínica** (`user_id` = conta da clínica). Múltiplos profissionais são gerenciados dentro da mesma conta via tabela `profissionais` + PIN de 4 dígitos. Isso é suficiente para o público-alvo de fisioterapeutas autônomas.

- `S.profAtual` = perfil ativo na sessão (armazenado em `sessionStorage`)
- `ownerProf()` = cria o perfil dono (id: `__owner__`) baseado na config
- `selecionarProf(id)` = seleciona perfil (owner ou profissional, com ou sem PIN)
- `nivelRestrito()` / `temAcessoSensivel()` = controla acesso a fotos/IA por nível

---

## O que falta para virar SaaS (roadmap)

### Fase 0 — Infra (dias, BLOQUEANTE)
- [ ] **Supabase Pro** (~US$ 25/mês) — elimina auto-pause, adiciona backups diários. OBRIGATÓRIO antes de ter clientes pagantes.
- [ ] Abrir conta no gateway de pagamento (Asaas ou Iugu — BR-friendly, Pix recorrente + boleto + cartão)
- [ ] Documentos jurídicos: Termos de Uso, Política de Privacidade, DPA (LGPD — você vira operador de dados de terceiros)

### Fase 1 — Cobrável (~2-4 semanas)
- [ ] Tabela `assinaturas` (user_id, plano, status, valido_ate, gateway_customer_id, gateway_sub_id)
- [ ] Edge Function Supabase como webhook do gateway (atualiza status ao pagar/atrasar/cancelar)
- [ ] Trial de 14 dias automático ao criar conta (sem cartão)
- [ ] Checagem de assinatura no login — tela de "renovar" se vencido
- [ ] Tela de checkout integrada ao gateway
- **No fim desta fase: já dá para cobrar.**

### Fase 2 — Produto redondo (~2-3 semanas)
- [ ] Cadastro self-service (nova clínica se registra sozinha)
- [ ] Gating por plano server-side via RLS (ex: limite de pacientes no free, IA só no Pro)
- [ ] E-mails transacionais (boas-vindas, reset de senha, recibo)
- [ ] Painel admin básico (lista de assinantes, suspender inadimplente)
- [ ] Proteção da chave Claude API em Edge Function (não exposta no client)

### Fase 3 — Escala (quando precisar)
- [ ] Multi-clínica com papéis (tabela `clinicas` + `membros`, migrar scoping de `user_id` → `clinica_id`)
- [ ] Domínio próprio, white-label
- [ ] App/PWA na store

---

## Mudança arquitetural principal para o SaaS

O modelo v1 usa `user_id` para isolar os dados de cada clínica. Isso já está correto e funciona. Para suportar múltiplos profissionais com **logins independentes** (cada um com seu próprio email/senha) dentro de uma clínica, a migração seria:

```
Adicionar: clinicas (id, nome, plano, ...)
Adicionar: membros (user_id, clinica_id, papel)
Migrar scoping: trocar WHERE user_id = auth.uid() 
             → WHERE clinica_id = (select clinica_id from membros where user_id = auth.uid())
```

**Esta migração NÃO é necessária para o lançamento inicial** — o modelo atual (um login por clínica + profissionais via PIN) é suficiente para fisioterapeutas autônomas.

---

## Supabase — próximo passo

Para o SaaS precisará de um **novo projeto Supabase** (não usar o de produção). Ao criar:

1. Criar na organização `ccppymtcvrwhcpxsqikt`
2. Região: `sa-east-1` (São Paulo — menor latência para BR)
3. Upgrade para **Pro** antes de ter clientes pagantes
4. Aplicar o mesmo schema do v1 (migrations documentadas)
5. Storage bucket `fisiovida` privado com policies para `authenticated`

---

## Padrões de código importantes

```python
# Deploy via API GitHub
TOKEN='ghp_...'
REPO='matheusrodriguesidk-creator/fisiovida-saas'
# PUT /contents/index.html com SHA + base64 + committer fixo

# Patch seguro
assert "string_exata" in html
html = html.replace("string_exata", "novo_conteudo", 1)

# Validar antes de push
node --check /tmp/t.js

# Balanceamento (checkar sempre)
js.count('{') == js.count('}')
js.count('(') == js.count(')')
js.count('`') % 2 == 0
```

### State global (S)
```js
S = {
  view, user, pac, pacientes, profissionais, profAtual,
  config, agenda, evolucao, tab, agView, ...
}
```

### Funções críticas de performance
- `q(fn)` — wrapper de queries (sem getSession por chamada, retry em falha)
- `boot()` — carrega dados em `Promise.all` paralelo
- `loadPacs()` — query LEVE (só colunas da lista); loadPac(id) = pesado (paciente aberto)
- Preconnect: `tvheuwykjdohdqrtwmne.supabase.co` + `cdn.jsdelivr.net`

---

## Instrução para o novo chat

Quando abrir o novo chat, cole este documento e diga algo como:

> "Este é o briefing do Fisiovida. Preciso construir a versão SaaS partindo do repo `matheusrodriguesidk-creator/fisiovida-saas` (código base já no GitHub). Vamos começar pela Fase 0/1: criar o Supabase Pro, a tabela de assinaturas, o webhook de gateway e a lógica de trial."

O assistente vai ter todo o contexto necessário para continuar sem ter que reler o histórico desta conversa.

---

*Gerado em: 08/06/2026 | Versão base: commit `fd859bfae95f` (fisiovida-saas)*
