// Histórico de versões do PRC App. Adicione um novo bloco no topo a cada leva de mudanças.
export const CHANGELOG = [
  {
    version: '1.8',
    date: '03/09/2026',
    items: [
      '🐛 Correção crítica: o motorista nunca teve permissão no banco pra mudar o status da própria viagem. Toda viagem ficava travada em "Atribuída" pra sempre, mesmo registrando todas as etapas certinho — o Kanban não tinha como saber que ela avançou.',
    ],
  },

  {
    version: '1.7',
    date: '03/09/2026',
    items: [
      '🐛 Correção importante: Kanban, mapa e chat agora atualizam de verdade em tempo real. Antes, o Supabase nunca estava configurado pra transmitir mudanças — parecia travado até trocar de aba.',
      '📴 Chat do motorista agora funciona offline: manda a mensagem sem internet, ela aparece marcada como "enviando quando tiver internet" e sincroniza sozinha quando a conexão voltar.',
      '🪟 "+ Nova Viagem" no Painel agora abre um modal rápido, em vez de levar pra aba de Programação em Massa.',
    ],
  },

  {
    version: '1.6',
    date: '02/09/2026',
    items: [
      '🟢 Indicador "Ao vivo" no Painel mostra se a conexão em tempo real com o banco está ativa.',
      '⏱️ Tempo "parada Xh Ym" nos cards do Kanban agora anda sozinho, sem esperar evento novo.',
      '✨ Hover nas tabelas e cards do Kanban (leve elevação com sombra).',
      '📋 Esta aba de Novidades.',
    ],
  },
  {
    version: '1.5',
    date: '02/09/2026',
    items: [
      '➕ Botão "+ Nova Viagem" direto no Painel principal.',
      '📦 "Nova Viagem" virou Programação em Massa: define quantidade de viagens por rota e gera uma tabela pra preencher motorista de cada uma de uma vez.',
      '📅 Viagens agora podem ter uma data programada.',
    ],
  },
  {
    version: '1.4',
    date: '02/09/2026',
    items: [
      '✏️ Edição de verdade (não só ativar/desativar) em Rotas, Clientes e Frota.',
      '👤 Cargos reais da transportadora: Diretora de Operação, Supervisora, Líder, Manutenção, Captação, Torre de Controle, Diretor Financeiro, Assistentes Financeiros — com nível de acesso técnico separado do cargo de exibição.',
      '🔐 Permissão personalizada por usuário: dá pra ajustar exatamente quais abas cada pessoa vê, além do padrão do cargo.',
      '🛡️ Corrigida falha de segurança: só Diretoria pode criar/editar outros logins de admin (antes qualquer admin conseguia).',
    ],
  },
  {
    version: '1.3',
    date: '02/09/2026',
    items: [
      '🎨 Visual mais suave: preto puro trocado por grafite escuro em todo o app.',
      '🚛 Cargo Captação: acesso só a Painel e Motoristas.',
      '📡 Rastreamento por intervalo agora funciona offline — posição fica guardada no celular e reenviada quando a internet voltar.',
    ],
  },
  {
    version: '1.2',
    date: '02/09/2026',
    items: [
      '💰 Financeiro: contas a pagar (motorista) e a receber (cliente), com cálculo automático quando a viagem usa uma rota cadastrada com valores formalizados.',
      '🛣️ Rotas com código padronizado (SIGLA_SIGLA), frete do cliente e pagamento do motorista definidos por rota.',
      '👥 Cadastro de clientes.',
      '🏢 Frota separada do motorista, com tipo de veículo (toco/3-4/VUC/carreta) e placa dupla pra carreta.',
      '🪪 CNH do motorista com validade e alerta de vencimento.',
      '👔 Cargos de admin (Diretoria, Operacional, Financeiro, Tráfego) com permissões diferentes por área.',
      '💬 Chat em tempo real entre motorista e central.',
      '🗺️ Mapa em tempo real das viagens em andamento (OpenStreetMap, sem custo).',
      '📲 App instalável no celular (PWA).',
    ],
  },
  {
    version: '1.1',
    date: '01/09/2026',
    items: [
      '📊 Painel virou Kanban com 5 colunas: Atribuída → Apresentação na Origem → Em Trânsito → Chegada no Destino → Finalizada.',
      '⚠️ Alerta visual de viagem atrasada (parada há mais de 2h sem nova etapa).',
      '📱 Envio de resumo da viagem pro WhatsApp com um clique.',
      '🎨 Identidade visual própria da PRC (logo real, cores extraídas da marca).',
      '🌗 Modo claro/escuro.',
    ],
  },
  {
    version: '1.0',
    date: '01/09/2026',
    items: [
      '🚀 Primeira versão: login por CPF (motorista) e email (admin), câmera com geolocalização por etapa, cadastro de motorista pelo admin, histórico de viagens.',
    ],
  },
];
