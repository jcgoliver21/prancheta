# Prancheta 📋

Agenda web para personal trainers — alunos, horários sem conflito, presenças, pagamentos e evolução.

**Acesse:** https://jcgoliver21.github.io/prancheta/

## Funcionalidades

- Cadastro do treinador (nome, CREF, e-mail) com senha de bloqueio de tela
- Escolha dos dias e horários de atuação — só eles ficam disponíveis para agendar
- Bloqueio automático de conflitos de agenda em todos os fluxos (cadastro, remarcação, sessão avulsa, restauração, reativação)
- Localizador de horários livres ao cadastrar aluno, ou escolha manual de dia/horário
- Agenda semanal (desktop) e diária (celular), com remarcação e cancelamento por data
- Presença/falta com um toque e taxa de frequência por aluno
- Controle financeiro mensal (pago / em aberto / atrasado) com receita do mês
- Evolução de peso com gráfico, aniversariantes, atalho de WhatsApp
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
