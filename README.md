# Prancheta 📋

Agenda web para personal trainers — alunos, horários sem conflito, presenças, pagamentos e evolução.

**Acesse:** https://jcgoliver21.github.io/prancheta/

Instale na tela inicial pelo menu do navegador — o app é um PWA com ícone próprio,
tela cheia e notificações (Android).

## Funcionalidades

- Cadastro do treinador (nome, CREF, e-mail) com senha de bloqueio de tela
- Escolha dos dias e horários de atuação — só eles ficam disponíveis para agendar
- Bloqueio automático de conflitos de agenda em todos os fluxos (cadastro, remarcação, sessão avulsa, restauração, reativação)
- Localizador de horários livres ao cadastrar aluno, ou escolha manual de dia/horário
- Agenda semanal (desktop) e diária (celular), com remarcação e cancelamento por data
- Presença/falta com um toque e taxa de frequência por aluno
- Controle financeiro mensal (pago / em aberto / atrasado) com receita do mês
- Evolução de peso com gráfico, aniversariantes, atalho de WhatsApp
- Pacotes de aulas por ciclo com valores pré-definidos, desconto automático por presença e alertas de renovação
- Planos e promoções cadastráveis, enviados por WhatsApp com seleção do que incluir
- Mensagens de WhatsApp com variáveis e assinatura automática ("Do seu Personal …")
- Avaliações físicas completas: peso, IMC, massa magra/gorda, % gordura, medidas, RCQ, índice de corrida (ritmo/km) e meta com progresso
- Treino de cada dia por aluno (ex.: Seg — Superior), visível na agenda
- Gastos por categoria, formas de recebimento, academias com repasse e relatórios com gráficos + CSV
- Lembretes com antecedência, notificações, arquivos/links para envio, foto de aluno e do treinador
- 20 temas de cor, seletor de data com ano/mês, bloqueio automático
- Backup exportável/importável em JSON
- Tema claro/escuro automático, mobile-first

## Dados

Os dados ficam salvos no navegador de cada aparelho (`localStorage`). Para levar para outro
aparelho, use **Mais → Dados → Exportar/Importar backup**. A senha é uma trava de tela do
app, não criptografia dos dados.

## Desenvolvimento

Arquivo único (`index.html`), sem build e sem dependências — HTML, CSS e JavaScript puros.
A única dependência externa é a fonte Archivo, do Google Fonts.

---

🤖 Gerado com [Claude Code](https://claude.com/claude-code)
