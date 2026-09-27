/* Helpers compartilhados pelos testes.
 *
 * O app e um HTML unico com um <script> classico (sem modulo), entao as
 * declaracoes de topo (const S, function renderMain, ...) vivem no escopo
 * lexico global e ficam acessiveis de dentro de page.evaluate(). Os testes
 * usam isso para dirigir a camada de dominio direto, alem de clicar na UI. */

export const CFG = {
  nome: 'Carlos Treinador',
  cref: '123456-G/SP',
  email: 'carlos@exemplo.com',
  senha: 'senha-teste-1234',
};

/* Espera o boot terminar: o app sobe de forma assincrona (initStore -> route).
   S.mode chega a 'onboarding' quando nao ha perfil, 'lock' quando ha perfil mas
   nao ha token, e 'app' quando entrou. */
export async function waitBoot(page) {
  await page.waitForFunction(() => typeof S !== 'undefined' && S.mode !== 'loading', null,
    { timeout: 15_000 });
  return page.evaluate(() => S.mode);
}

/* Cria o cadastro completo (3 passos) e entra no app. */
export async function onboarding(page, cfg = CFG) {
  await page.goto('/');
  await waitBoot(page);

  await page.getByRole('button', { name: 'Começar' }).click();

  await page.locator('#ob-name').fill(cfg.nome);
  await page.locator('#ob-cref').fill(cfg.cref);
  await page.locator('#ob-email').fill(cfg.email);
  await page.locator('#ob-pw').fill(cfg.senha);
  await page.locator('#ob-pw2').fill(cfg.senha);
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByRole('button', { name: 'Concluir cadastro' }).click();
  await page.waitForFunction(() => S.mode === 'app', null, { timeout: 15_000 });
}

/* Entra no app ja com um perfil pronto, injetando os dados direto no
   localStorage. Usado para pular o onboarding em testes de dominio. */
export async function seedApp(page, { students = {}, settings = null, profile = null } = {}) {
  const hash = 'a'.repeat(64);
  await page.addInitScript(
    ({ students, settings, profile, hash }) => {
      localStorage.setItem('prancheta-v1', JSON.stringify({
        profile: profile || {
          name: 'Carlos Treinador', cref: '', email: 'carlos@exemplo.com',
          hash, salt: 's', hint: '', createdAt: '2026-01-01',
        },
        settings,
        students,
        attendance: {}, payments: {}, exceptions: {}, evals: {},
        packs: {}, expenses: {}, reminders: {}, consult: {},
        daynotes: {}, loads: {}, programs: {},
      }));
      localStorage.setItem('prancheta-unlock', hash);
    },
    { students, settings, profile, hash }
  );
  await page.goto('/');
  await waitBoot(page);
  await page.waitForFunction(() => S.mode === 'app', null, { timeout: 15_000 });
}

/* Cria um aluno direto na camada de dominio, sem passar pela UI.
   `start` fica no passado para que daySessions() liste as sessoes em
   qualquer data que o teste usar. */
export async function addStudent(page, s) {
  return page.evaluate((s) => {
    const id = uid('a');
    const body = {
      name: s.name, phone: s.phone || '', goal: s.goal || 'Hipertrofia',
      color: '#0F9D77', fee: s.fee ?? 300, plan: s.plan || 'mensal',
      dur: s.dur || null, active: true, mode: 'presencial',
      createdAt: '2020-01-01', start: '2020-01-01',
      ...s,
    };
    putDoc('students', id, body);
    return { id, ...body };
  }, s);
}

/* Proxima data (ISO) que cai no dia da semana informado. 0 = domingo. */
export function nextDow(weekday) {
  const d = new Date();
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7 || 7));
  return isoOfStr(d);
}

/* ISO de uma data, sem depender dos helpers do app (este arquivo roda no Node). */
function isoOfStr(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/* Configura os dias de atuacao. keys sao 0..6 (0 = domingo). */
export async function setDays(page, days) {
  return page.evaluate((days) => {
    const st = { ...settings(), days: { ...settings().days, ...days } };
    putCfg('settings', st);
    return st.days;
  }, days);
}

/* Clica na aba de navegacao visivel.
 *
 * O app troca a navegacao por media query: abaixo de 960px usa a #tabbar
 * (rodape, no celular), a partir de 960px usa a #sidebar (lateral, no desktop).
 * Os dois conjuntos de botoes existem no DOM o tempo todo, apenas um esta
 * visivel, entao clicamos no que estiver na tela. */
export async function navTo(page, view) {
  const desk = page.locator(`#sidebar button[data-v="${view}"]`);
  const mob = page.locator(`#tabbar button[data-v="${view}"]`);
  if (await desk.isVisible()) await desk.click();
  else await mob.click();
  await page.waitForFunction((v) => S.ui.view === v, view);
}
