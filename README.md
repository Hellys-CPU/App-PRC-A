# PRC App - Controle de Viagens

App web funcional (versão de teste/validação) para controle de etapas de viagens de motoristas, com foto obrigatória, login por telefone (motorista) ou email (admin), e painel administrativo.

Conectado ao banco de dados Supabase real (projeto "App PRC controle A").

## Como rodar localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Como publicar (Cloudflare Pages, gratuito)

### Opção A — Direto pelo GitHub (recomendado)

1. Crie um repositório novo no GitHub (pode ser privado)
2. Suba esta pasta inteira para o repositório:
   ```bash
   git init
   git add .
   git commit -m "Primeira versão do app"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/prc-app.git
   git push -u origin main
   ```
3. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
4. Selecione o repositório `prc-app`
5. Configuração de build:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
6. Clique em **Save and Deploy**
7. Em poucos minutos você recebe uma URL pública tipo `prc-app.pages.dev`

### Opção B — Upload direto (sem GitHub, mais rápido para teste imediato)

1. Rode localmente: `npm install && npm run build`
2. Isso gera a pasta `dist/`
3. No Cloudflare Pages, escolha **"Upload assets"** em vez de conectar Git
4. Arraste a pasta `dist/` inteira

## Primeiro acesso (Admin)

O primeiro administrador já foi cadastrado diretamente no banco durante o desenvolvimento.
Use o mesmo email e senha criados em **Authentication → Users** no Supabase Dashboard,
selecionando "Sou Administrador" na tela de login.

## Cadastrar motoristas

Dentro do próprio app (não precisa entrar no Supabase Dashboard):

1. Faça login como administrador
2. Clique em **Motoristas**
3. Preencha nome, telefone, placa e defina uma senha
4. O motorista loga depois usando **telefone + essa senha** (não usa email)

## Próximos passos (evolução para app nativo)

Esta é a versão web de validação. A migração para React Native/Expo (app nativo real,
com suporte offline via PowerSync) está detalhada no documento
`guia-completo-app-motoristas.md` fornecido junto a este projeto.
