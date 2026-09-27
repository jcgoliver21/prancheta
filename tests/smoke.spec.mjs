import { test, expect } from '@playwright/test';
import { seedApp, waitBoot, navTo } from './helpers.mjs';

/* Guarda de integridade basica do arquivo unico.
 *
 * O index.html tem ~5.700 linhas de JS editadas a mao, sem build e sem
 * tipagem. Estes testes nao verificam comportamento de negocio (isso fica nos
 * demais specs), e sim as coisas que quebram de forma silenciosa: erro de
 * sintaxe, promessa rejeitada na partida, e botao sem handler. */

test.describe('smoke', () => {
  test('carrega sem erro de JS e sem promessa rejeitada', async ({ page }) => {
    const erros = [];
    page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });

    await seedApp(page, { students: {} });

    expect(erros, 'nenhum erro de JS esperado na partida:\n' + erros.join('\n')).toEqual([]);
  });

  test('monta o shell do app com as 5 abas', async ({ page }) => {
    await seedApp(page, { students: {} });

    await expect(page.locator('#app')).toHaveClass(/on/);
    // as duas navigacoes sao montadas; no desktop a #sidebar e a visivel
    await expect(page.locator('#sidebar button.nv')).toHaveCount(5);
    await expect(page.locator('#tabbar button')).toHaveCount(5);
    for (const nome of ['Hoje', 'Agenda', 'Alunos', 'Financeiro', 'Mais']) {
      await expect(page.locator('#sidebar button.nv', { hasText: nome })).toHaveCount(1);
    }
  });

  test('navega por todas as telas sem quebrar', async ({ page }) => {
    await seedApp(page, { students: {} });

    for (const view of ['agenda', 'alunos', 'fin', 'mais', 'hoje']) {
      await navTo(page, view);
      // o conteudo principal nao pode virar vazio
      const html = await page.locator('#main').innerHTML();
      expect(html.length, `tela "${view}" renderizou vazia`).toBeGreaterThan(50);
    }
  });

  test('no celular a navegacao vai para a barra inferior', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedApp(page, { students: {} });

    await expect(page.locator('#tabbar')).toBeVisible();
    await expect(page.locator('#sidebar')).toBeHidden();

    await navTo(page, 'alunos');
    await expect(page.locator('#tabbar button[data-v="alunos"]')).toHaveClass(/on/);
  });

  test('toda acao data-a na tela tem um handler no mapa A', async ({ page }) => {
    /* O clique e delegado: document.addEventListener pega [data-a] e chama
       A[el.dataset.a]. Se a chave nao existir, o `if(fn)` simplesmente ignora
       e o botao nao faz nada -- falha silenciosa, sem erro no console.
       Aqui cruzamos o que aparece no DOM com as chaves de A.

       Excecao conhecida: ob-day / ob-start / ob-end sao tratados no listener
       de 'change' (linhas 5678-5680), nao no mapa A. */
    const FORA_DO_A = new Set(['ob-day', 'ob-start', 'ob-end']);

    const views = ['hoje', 'agenda', 'alunos', 'fin', 'mais'];
    const orphans = [];
    let total = 0;

    for (const view of views) {
      await seedApp(page, { students: {} });
      await page.evaluate((v) => go(v), view);

      const acoes = await page.evaluate(() =>
        [...document.querySelectorAll('[data-a]')].map((el) => el.dataset.a));

      for (const a of new Set(acoes)) {
        if (FORA_DO_A.has(a)) continue;
        total++;
        const temHandler = await page.evaluate((a) => typeof A[a] === 'function', a);
        if (!temHandler) orphans.push(`${view}: "${a}"`);
      }
    }

    expect(orphans, 'acoes sem handler em A:\n' + orphans.join('\n')).toEqual([]);
    expect(total, 'esperado encontrar varias acoes para checar').toBeGreaterThan(20);
  });

  test('a versao exibida no rodape bate com a constante VERSION', async ({ page }) => {
    await seedApp(page, { students: {} });
    await navTo(page, 'mais');
    const v = await page.evaluate(() => VERSION);
    await expect(page.locator('#main')).toContainText(v);
  });
});

test.describe('boot', () => {
  test('sem perfil vai para onboarding; com perfil e sem token, para o lock', async ({ page }) => {
    await page.goto('/');
    expect(await waitBoot(page)).toBe('onboarding');
    await expect(page.getByRole('button', { name: 'Começar' })).toBeVisible();

    await page.evaluate(() => {
      localStorage.setItem('prancheta-v1', JSON.stringify({
        profile: { name: 'X', hash: 'h'.repeat(64), salt: 's', createdAt: '2026-01-01' },
        settings: null, students: {},
      }));
    });
    await page.goto('/');
    expect(await waitBoot(page)).toBe('lock');
  });
});
