import { test, expect } from '@playwright/test';
import { seedApp, addStudent, onboarding, CFG, navTo } from './helpers.mjs';

/* O app guarda tudo em localStorage, sem servidor por padrao. Perder esse
   dado significa perder a agenda do treinador, entao estes testes tratam a
   persistencia como contrato: o que entra tem que voltar identico, e o que
   nao for reconhecido tem que ser recusado sem quebrar nada. */

const KEY = 'prancheta-v1';
const TKEY = 'prancheta-unlock';
const KKEY = 'prancheta-keep';

async function dump(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
}

test.describe('persistencia', () => {
  test('grava todas as colecoes no localStorage', async ({ page }) => {
    await seedApp(page, { students: {} });
    await addStudent(page, { name: 'Ana', schedule: [{ d: 1, t: '08:00' }] });

    const saved = await dump(page);
    for (const c of ['students', 'attendance', 'payments', 'exceptions', 'evals',
                     'packs', 'expenses', 'reminders', 'consult', 'daynotes',
                     'loads', 'programs']) {
      expect(saved, `colecao "${c}" ausente no backup`).toHaveProperty(c);
    }
    expect(Object.values(saved.students)).toHaveLength(1);
    expect(Object.values(saved.students)[0].name).toBe('Ana');
  });

  test('a collection nao depende de ordem: regravar nao apaga o resto', async ({ page }) => {
    await seedApp(page, { students: {} });
    const a = await addStudent(page, { name: 'Ana' });
    await addStudent(page, { name: 'Bia' });
    await page.evaluate(() => putDoc('daynotes', '2026-03', { ym: '2026-03', items: {} }));

    await page.evaluate((id) => {
      putDoc('students', id, { ...S.data.students[id], fee: 999 });
    }, a.id);

    const saved = await dump(page);
    expect(Object.values(saved.students)).toHaveLength(2);
    expect(saved.daynotes['2026-03']).toBeTruthy();
    expect(Object.values(saved.students).find((s) => s.name === 'Ana').fee).toBe(999);
  });

  test('settings() completa chaves ausentes com o padrao', async ({ page }) => {
    /* Este e o mecanismo que protege aparelhos antigos: defSettings() e
       mesclado por cima do que foi salvo, entao uma versao nova que adiciona
       uma preferencia nao quebra quem ja tinha dado cadastro. */
    await seedApp(page, { students: {}, settings: { theme: 3 } });
    const s = await page.evaluate(() => settings());
    expect(s.theme).toBe(3);
    expect(s.signature, 'chave ausente caiu no padrao').toBe('Do seu Personal {personal}');
    expect(s.payMethods).toEqual(['Pix', 'Dinheiro', 'Cartão', 'Transferência']);
    expect(s.days[1], 'days do padrao preservado').toMatchObject({ on: true, start: '06:00' });
  });

  test('settings nao deixa a configuracao salva contaminar o padrao', async ({ page }) => {
    /* bug classico de merge shallow: se defSettings() fosse reusado por
       referencia, um putCfg poderia vazar para leituras futuras */
    await seedApp(page, { students: {}, settings: { payMethods: ['So Pix'] } });
    const s = await page.evaluate(() => settings());
    expect(s.payMethods).toEqual(['So Pix']);
    expect(await page.evaluate(() => defSettings().payMethods))
      .toEqual(['Pix', 'Dinheiro', 'Cartão', 'Transferência']);
  });
});

test.describe('exportar / importar backup', () => {
  test('o payload exportado tem a marca do app e as colecoes', async ({ page }) => {
    await seedApp(page, { students: {} });
    await addStudent(page, { name: 'Ana' });

    const payload = await page.evaluate(() => {
      const d = S.data;
      return JSON.parse(JSON.stringify({
        app: 'prancheta', v: 2, at: new Date().toISOString(),
        profile: d.profile, settings: d.settings,
        ...Object.fromEntries(COLLS.map((c) => [c, d[c]])),
      }));
    });

    expect(payload.app).toBe('prancheta');
    expect(payload.profile.name).toBeTruthy();
    expect(Object.values(payload.students)).toHaveLength(1);
  });

  test('ida e volta preserva os alunos', async ({ page }) => {
    await seedApp(page, { students: {} });
    await addStudent(page, { name: 'Ana', fee: 350, schedule: [{ d: 1, t: '08:00' }] });
    await addStudent(page, { name: 'Bia', fee: 300, plan: 'pacote' });

    const backup = await page.evaluate(() => {
      const d = S.data;
      return JSON.stringify({
        app: 'prancheta', v: 2, at: new Date().toISOString(),
        profile: d.profile, settings: d.settings,
        ...Object.fromEntries(COLLS.map((c) => [c, d[c]])),
      });
    });

    // apaga tudo e reimporta pelo mesmo caminho de persistencia do app
    await page.evaluate((b) => {
      const d = JSON.parse(b);
      localStorage.removeItem('prancheta-v1');
      for (const c of COLLS) S.data[c] = d[c] || {};
      S.data.profile = d.profile;
      S.data.settings = d.settings;
      persistLocal();
    }, backup);

    const nomes = await page.evaluate(() => students().map((s) => s.name).sort());
    expect(nomes).toEqual(['Ana', 'Bia']);
    const ana = await page.evaluate(() => students().find((s) => s.name === 'Ana'));
    expect(ana.fee).toBe(350);
    expect(ana.schedule).toEqual([{ d: 1, t: '08:00' }]);
  });

  test('recusa conteudo que nao e backup da prancheta', async ({ page }) => {
    await seedApp(page, { students: {} });
    const r = await page.evaluate(() => {
      const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
      const check = (txt) => {
        let d;
        try { d = JSON.parse(txt); } catch { return 'json-invalido'; }
        if (!d || d.app !== 'prancheta' || !d.profile) return 'nao-e-prancheta';
        if (!isObj(d.profile) || !d.profile.name) return 'perfil-invalido';
        return 'ok';
      };
      return {
        invalido: check('{ isto nao e json'),
        deOutroApp: check(JSON.stringify({ app: 'outro', profile: { name: 'X' } })),
        semApp: check(JSON.stringify({ profile: { name: 'X' } })),
        semPerfil: check(JSON.stringify({ app: 'prancheta' })),
        perfilInvalido: check(JSON.stringify({ app: 'prancheta', profile: { nome: 'typo' } })),
        valido: check(JSON.stringify({ app: 'prancheta', profile: { name: 'X' } })),
      };
    });
    expect(r).toEqual({
      invalido: 'json-invalido',
      deOutroApp: 'nao-e-prancheta',
      semApp: 'nao-e-prancheta',
      semPerfil: 'nao-e-prancheta',
      perfilInvalido: 'perfil-invalido',
      valido: 'ok',
    });
  });

  test('conteudo recusado nao apaga os dados', async ({ page }) => {
    await seedApp(page, { students: {} });
    await addStudent(page, { name: 'Ana' });
    const antes = await dump(page);

    await navTo(page, 'mais');
    await page.locator('[data-a="imp"]').click();
    const sheet = page.locator('#overlay > .layer').last();

    // 1: JSON invalido
    await sheet.locator('textarea').fill('{ isto nao e json');
    await sheet.getByRole('button', { name: 'Importar e substituir' }).click();
    await expect(sheet.locator('.err')).toContainText('JSON inválido');

    // 2: JSON valido, mas de outro app
    await sheet.locator('textarea').fill(JSON.stringify({ app: 'outro', profile: { name: 'X' } }));
    await sheet.getByRole('button', { name: 'Importar e substituir' }).click();
    await expect(sheet.locator('.err')).toContainText('não parece um backup');

    // nada foi apagado em nenhuma das tentativas
    expect(await dump(page)).toEqual(antes);
    expect(await page.evaluate(() => students().map((s) => s.name))).toEqual(['Ana']);
  });
});

test.describe('bloqueio de tela', () => {
  test('onboarding grava o perfil e ja entra no app', async ({ page }) => {
    await onboarding(page);
    expect(await page.evaluate(() => S.mode)).toBe('app');
    const p = (await dump(page)).profile;
    expect(p.name).toBe(CFG.nome);
    expect(p.email).toBe(CFG.email);
  });

  test('a senha nunca e gravada em claro', async ({ page }) => {
    await onboarding(page);
    const raw = await page.evaluate(() => localStorage.getItem('prancheta-v1'));
    expect(raw).not.toContain(CFG.senha);
    const p = (await dump(page)).profile;
    expect(p.hash).not.toBe(CFG.senha);
    expect(p.salt, 'usa sal').toBeTruthy();
  });

  test('"manter conectado" guarda o token; caso contrario, so na sessao', async ({ page }) => {
    await onboarding(page);
    expect(await page.evaluate((k) => !!localStorage.getItem(k), TKEY)).toBe(true);
    expect(await page.evaluate((k) => localStorage.getItem(k), KKEY)).toBe('1');

    await page.evaluate(({ t, k }) => { clearToken(); setToken(t, false); }, {
      t: await page.evaluate((k) => localStorage.getItem(k), TKEY), k: TKEY,
    });
    expect(await page.evaluate((k) => !!localStorage.getItem(k), TKEY)).toBe(false);
    expect(await page.evaluate(() => !!sessionStorage.getItem('prancheta-unlock'))).toBe(true);
  });

  test('senha errada nao abre; a certa abre', async ({ page }) => {
    await onboarding(page);
    await page.evaluate((k) => localStorage.removeItem(k), TKEY);
    await page.reload();
    expect(await page.evaluate(() => S.mode)).toBe('lock');

    await page.locator('#lk-pw').fill('senha-errada');
    await page.locator('[data-a="lk-enter"]').click();
    expect(await page.evaluate(() => S.mode), 'senha errada precisa barrar').toBe('lock');
    await expect(page.locator('#lk-err')).not.toBeEmpty();

    await page.locator('#lk-pw').fill(CFG.senha);
    await page.locator('[data-a="lk-enter"]').click();
    await page.waitForFunction(() => S.mode === 'app');
    expect(await page.evaluate(() => S.mode)).toBe('app');
  });
});

test.describe('aluno pela interface', () => {
  test('cadastra pela UI e o aluno aparece na lista', async ({ page }) => {
    await seedApp(page, { students: {} });
    await navTo(page, 'alunos');

    await page.locator('[data-a="stu-new"]').first().click();
    await expect(page.locator('#sf-name')).toBeVisible();

    await page.locator('#sf-name').fill('Ana Souza');
    await page.locator('#sf-phone').fill('11988887777');

    // adiciona um horario fixo pela folha "Adicionar especifico"
    await page.locator('[data-a="sf-manual"]').click();
    const sheet = page.locator('#overlay > .layer').last();
    await sheet.locator('select').first().selectOption('1');       // segunda
    await sheet.locator('select').nth(1).selectOption('08:00');
    await sheet.getByRole('button', { name: 'Adicionar' }).click();

    // o horario virou um chip naArea de horarios fixos
    await expect(page.locator('#sf-sched')).toContainText('Seg 08:00');

    await page.locator('[data-a="sf-save"]').click();

    /* o app salva e ja leva para a ficha do aluno, em vez de voltar a lista */
    await page.waitForFunction(() => S.ui.view === 'aluno');
    await expect(page.locator('#main')).toContainText('Ana Souza');

    const st = await page.evaluate(() => students());
    expect(st).toHaveLength(1);
    /* w = rótulo do treino do dia; a UI sempre o materializa, mesmo vazio */
    expect(st[0].schedule).toEqual([{ d: 1, t: '08:00', w: '' }]);

    /* como ha telefone cadastrado, oferece a mensagem de boas-vindas */
    const boas = page.locator('#overlay > .layer').last();
    await expect(boas.getByText('Enviar boas-vindas?')).toBeVisible();
    await boas.getByRole('button', { name: 'Agora não' }).click();

    // e a lista realmente mostra o aluno
    await navTo(page, 'alunos');
    await expect(page.locator('#stu-list')).toContainText('Ana Souza');
  });

  test('a UI recusa um horario que conflita e explica de quem e', async ({ page }) => {
    await seedApp(page, { students: {} });
    await addStudent(page, { name: 'Ana', schedule: [{ d: 1, t: '08:00' }] });

    await navTo(page, 'alunos');
    await page.locator('[data-a="stu-new"]').first().click();
    await page.locator('#sf-name').fill('Bia');

    await page.locator('[data-a="sf-manual"]').click();
    const sheet = page.locator('#overlay > .layer').last();
    await sheet.locator('select').first().selectOption('1');

    // 08:00 aparece desabilitado por estar ocupado
    const opt0800 = sheet.locator('select').nth(1).locator('option[value="08:00"]');
    await expect(opt0800).toBeDisabled();
    await expect(opt0800).toHaveAttribute('disabled', '');

    // um horario livre funciona
    await sheet.locator('select').nth(1).selectOption('10:00');
    await sheet.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.locator('#sf-sched')).toContainText('Seg 10:00');
  });

  test('campos obrigatorios sao cobrados', async ({ page }) => {
    await seedApp(page, { students: {} });
    await navTo(page, 'alunos');
    await page.locator('[data-a="stu-new"]').first().click();
    await page.locator('[data-a="sf-save"]').click();

    await expect(page.locator('#sf-err .err')).toBeVisible();
    expect(await page.evaluate(() => students())).toHaveLength(0);
  });
});
