// Histórico de versões do PRC App. Adicione um novo bloco no topo a cada leva de mudanças.
export const CHANGELOG = [
  {
    version: '3.0',
    date: '04/09/2026',
    items: [
      '📱 Bolha flutuante nas telas com tabela (Motoristas, Frota, Rotas, Clientes, Logins, Financeiro, Relatórios) — só aparece no celular, toca e abre a tabela num painel por cima da tela, sem precisar mais ficar rolando de lado.',
    ],
  },

  {
    version: '2.9',
    date: '04/09/2026',
    items: [
      '📱 Correções de visual pro Painel Admin no celular: cards de estatística empilham certinho, tabelas não vazam mais pra fora da tela (rolam por dentro delas mesmas), e a página não desliza mais pro lado inteira.',
    ],
  },

  {
    version: '2.8',
    date: '03/09/2026',
    items: [
      '🐛 Corrigido bug sério: o Painel pedia pro banco uma coluna que não existia mais (sobrou de um ajuste anterior), e isso fazia a consulta de viagens falhar em silêncio — parecia que às viagens tinham sumido, mas continuavam no banco o tempo todo.',
      '🛡️ Agora erro de consulta no Painel aparece num aviso na tela, em vez de falhar quieto.',
    ],
  },

  {
    version: '2.7',
    date: '03/09/2026',
    items: [
      '📊 Relatórios ganhou gráficos: faturamento por dia, viagens por status, e pontualidade planejado x real por etapa.',
      '🏆 Ranking de pontualidade por motorista (% de apresentações no horário).',
      '🐛 Corrigido input branco chapado nas edições dentro de tabela (rotas, veículos, etc.) — agora todo input/select do app segue o tema escuro por padrão.',
    ],
  },

  {
    version: '2.6',
    date: '03/09/2026',
    items: [
      '🔧 Correção de modelo: horário de apresentação planejado agora é definido em CADA viagem (Nova Viagem ou Programação em Massa), não fixo na rota — a rota só guarda quantas horas até saída e chegada.',
      '📅 Programação em Massa ganhou coluna de apresentação planejada por linha, já que viagens da mesma rota podem sair em horários diferentes.',
    ],
  },

  {
    version: '2.5',
    date: '03/09/2026',
    items: [
      '⏰ Horário planejado por rota: Apresentação (horário fixo) + horas até a Saída + horas até a Chegada, cadastrado em Configurações > Rotas.',
      '📋 No Painel, cada viagem expandida mostra planejado x real dessas três etapas — inclusive as que ainda não aconteceram, como lembrete do que falta.',
    ],
  },

  {
    version: '2.4',
    date: '03/09/2026',
    items: [
      '👁️ Botão "Só hoje" no Painel: por padrão só mostra viagens finalizadas do dia (as ativas continuam sempre visíveis). Clique pra ver o histórico completo quando precisar.',
      '🗃️ Tirado o fundo em caixa de cada coluna do Kanban — agora é só uma linha fina dividindo, com uma cor no topo de cada coluna (azul/laranja/verde conforme a etapa).',
    ],
  },

  {
    version: '2.3',
    date: '03/09/2026',
    items: [
      '🔠 Tipografia trocada: Space Grotesk (títulos) + DM Sans (corpo), saindo das fontes genéricas.',
      '✨ Cards do Painel e do Kanban entram em sequência (stagger), não tudo de uma vez.',
      '🏙️ Textura sutil no fundo do app, bem discreta, pra tirar a sensação de tela chapada.',
    ],
  },

  {
    version: '2.2',
    date: '03/09/2026',
    items: [
      '🗂️ Configurações e Admin viraram uma aba só, com sub-abas Rotas / Clientes / Logins.',
      '🎨 Visual mais trabalhado nas telas de formulário e tabelas (Frota, Motoristas, etc.): destaque no topo, sombra, foco nos campos, listras nas tabelas.',
    ],
  },

  {
    version: '2.1',
    date: '03/09/2026',
    items: [
      '👥 Login de cliente: em Configurações > Clientes, botão "Gerar Login" cria um acesso pro cliente acompanhar as próprias viagens (rota, status, fotos), sem ver nada de outros clientes.',
      '🌫️ Carimbo da foto do motorista mais transparente, deixa a foto aparecer por baixo do texto.',
      '🎨 Corrigido o botão de tema claro/escuro que aparecia com fundo branco destoando do resto da tela.',
    ],
  },

  {
    version: '2.0',
    date: '03/09/2026',
    items: [
      '📍 Foto da etapa agora vem carimbada com nome do motorista, placa(s) do veículo, endereço (via OpenStreetMap) e data/hora — direto na imagem, igual apps de foto com localização.',
    ],
  },

  {
    version: '1.9',
    date: '03/09/2026',
    items: [
      '🔒 Motorista não consegue mais registrar a mesma etapa duas vezes (Parada Eventual continua podendo repetir).',
      '↩️ Motorista pode desfazer a última etapa registrada e refazer, se errou.',
      '🗑️ Admin pode excluir uma etapa/foto e liberar pro motorista tirar de novo.',
      '📸 Texto do WhatsApp agora inclui o link da foto da etapa mais recente.',
    ],
  },

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
