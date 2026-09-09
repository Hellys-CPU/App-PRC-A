import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

// Explicação curta de cada tela — não é um tour interativo clicando em cada
// botão, é um resumo rápido de "pra que serve essa tela e como usar".
const HELP_CONTENT = {
  '/': {
    title: 'Painel',
    text: 'Aqui você vê todas as viagens organizadas por etapa (Kanban), de atribuída até finalizada. Clique num card pra expandir e ver fotos, documentos e assinatura. O botão "Só hoje" filtra as finalizadas do dia; desmarcado mostra o histórico completo.',
  },
  '/nova-viagem': {
    title: 'Programação em Massa',
    text: 'Defina quantas viagens quer criar por rota de uma vez, depois escolha o motorista de cada uma na tabela que aparece. Pra programar recorrência semanal automática, use o botão "Programação Recorrente".',
  },
  '/motoristas': {
    title: 'Motoristas',
    text: 'Cadastre motoristas novos aqui — o CPF vira o login dele. A lista completa com telefone, CNH e avaliação fica na tela do Painel, mais abaixo.',
  },
  '/frota': {
    title: 'Frota',
    text: 'Cadastre veículos e acompanhe CRLV. O botão "Manutenção" em cada veículo registra troca de óleo, revisão, e avisa quando a próxima está perto.',
  },
  '/mapa': {
    title: 'Mapa',
    text: 'Mostra a localização mais recente de cada motorista em viagem, atualizando sozinho conforme o rastreamento do celular dele chega.',
  },
  '/chat': {
    title: 'Chat',
    text: 'Conversa direta com cada motorista. Toca um som quando chega mensagem nova e você não está nessa tela.',
  },
  '/financeiro': {
    title: 'Financeiro',
    text: 'Contas a receber (cliente) e a pagar (motorista), geradas automaticamente quando a rota tem valores cadastrados. Marque como paga quando a baixa acontecer.',
  },
  '/folha-pagamento': {
    title: 'Folha de Pagamento',
    text: 'Escolha um período e veja quanto cada motorista tem a receber pelas viagens feitas. Adicione desconto ou bônus, e gere o recibo em PDF.',
  },
  '/relatorios': {
    title: 'Análise',
    text: 'Filtre por período (inclusive semana ISO ou dias avulsos) e monte sua própria visão: escolha o que agrupar, a métrica e o tipo de gráfico.',
  },
  '/configuracoes': {
    title: 'Configurações',
    text: 'Rotas (com duração planejada), Clientes (com login pro portal deles), Logins administrativos, Auditoria de exclusões, e Ocorrências reportadas pelos motoristas — tudo em sub-abas aqui.',
  },
  '/recorrencia': {
    title: 'Programação Recorrente',
    text: 'Cadastre "toda segunda, rota X" uma vez só. Depois clique em "Gerar Viagens dos Próximos 7 Dias" sempre que quiser criar as viagens da semana de uma vez.',
  },
};

export default function HelpButton() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const content = HELP_CONTENT[location.pathname];

  if (!content) return null;

  return (
    <>
      <button className="secondary-button" onClick={() => setOpen(true)} aria-label="Ajuda desta tela">❓</button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-panel" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0 }}>{content.title}</h2>
              <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>{content.text}</p>
          </div>
        </div>
      )}
    </>
  );
}
