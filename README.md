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

O `index.html` é a aplicação inteira: HTML nas linhas 13–452, CSS e JavaScript depois,
tudo marcado por seções (`/* ================= dominio ================= */` e afins). O
delegador de eventos no fim do arquivo resolve os cliques por `data-a`, procurando a
função correspondente no objeto `A`.

### Testes

Há uma suíte de Playwright que sobe o app de verdade num navegador e verifica o
comportamento — não só a estrutura:

```bash
npm install
npx playwright install chromium
npm test              # 46 testes, ~10s
npm run test:ui       # abre o modo visual do Playwright
```

O servidor usado nos testes é `tools/serve.mjs`, sem dependências. Ele existe só para
servir o app por `http://` (assim o manifest e o service worker se comportam como em
produção) — o app em si não precisa de servidor nenhum.

O que é coberto:

| Arquivo | Foco |
|---|---|
| `tests/smoke.spec.mjs` | Carrega sem erro de JS, as 5 telas navegam, layout de celular vs desktop, e todo `data-a` renderizado tem um handler no objeto `A` (botão sem handler é falha silenciosa) |
| `tests/conflitos.spec.mjs` | Detecção de conflito de horário, bordas de sessão, grade de horários livres, cancelamento, remarcação, sessão avulsa, dia bloqueado |
| `tests/dados.spec.mjs` | Persistência no `localStorage`, merge de configurações com padrão, ida e volta de backup, recusa de conteúdo inválido, bloqueio de tela, cadastro de aluno pela interface |

Os testes de conflito e de dados são os que mais valem: “sem conflito de horário” é a
promessa do app, e os dados do treinador moram no `localStorage`, sem servidor — perder
isso é perder a agenda.

### CI

`.github/workflows/ci.yml` roda a suíte a cada push na `main` e em cada pull request.
Um teste quebrado barra o merge.

---

🤖 Gerado com [Claude Code](https://claude.com/claude-code)
