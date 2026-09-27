import { test, expect } from '@playwright/test';
import { seedApp, addStudent, setDays, nextDow } from './helpers.mjs';

/* "Sem conflito de horario" e a promessa central do app (esta no subtitulo do
   README e na descricao do repositorio). Estes testes travam o comportamento
   da deteccao de conflito e da geracao de sessoes.

   Convencoes:
     - weekday 1 = segunda ... 0 = domingo
     - duracao padrao de sessao: 60 min (settings().dur)
     - o padrao de weekDay dos dias: seg-sex 06:00-21:00, sab/dom desligados */

const SEG = 1;

test.describe('intervalos', () => {
  test('ovl trata o intervalo como meio-aberto: sessions encostadas nao conflitam', async ({ page }) => {
    await seedApp(page, { students: {} });
    const r = await page.evaluate(() => ({
      igual:      ovl(480, 60, 480, 60),  // 08:00-09:00 x 08:00-09:00
      sobreposto: ovl(480, 60, 510, 60),  // 08:00-09:00 x 08:30-09:30
      contiguo:   ovl(480, 60, 540, 60),  // 08:00-09:00 x 09:00-10:00
      contiguoV:  ovl(540, 60, 480, 60),  // o inverso
      separado:   ovl(480, 60, 600, 60),  // 08:00-09:00 x 10:00-11:00
      contido:    ovl(480, 120, 510, 30), // uma sessao longa engolindo outra
      // 08:00-09:00 x 08:50-08:55: encosta no fim da primeira? nao -> 08:50 < 09:00 e 08:00 < 08:55
      parcialFim: ovl(480, 60, 530, 60),
    }));
    expect(r).toEqual({
      igual: true, sobreposto: true, contiguo: false, contiguoV: false,
      separado: false, contido: true, parcialFim: true,
    });
  });
});

test.describe('conflito por horario fixo (conflictAt)', () => {
  test('detecta conflito com outro aluno e devolve quem ocupa', async ({ page }) => {
    await seedApp(page, { students: {} });
    await addStudent(page, { name: 'Ana', schedule: [{ d: SEG, t: '08:00' }] });

    const livre = await page.evaluate(() => conflictAt(1, '10:00', 60, null, null));
    const ocupado = await page.evaluate(() => conflictAt(1, '08:00', 60, null, null));

    expect(livre).toBeNull();
    expect(ocupado.s.name).toBe('Ana');
  });

  test('encaixe as bordas: 07:00 termina 08:00, 09:00 comeca 09:00', async ({ page }) => {
    await seedApp(page, { students: {} });
    await addStudent(page, { name: 'Ana', schedule: [{ d: SEG, t: '08:00' }] });

    const antes = await page.evaluate(() => conflictAt(1, '07:00', 60, null, null));
    const depois = await page.evaluate(() => conflictAt(1, '09:00', 60, null, null));
    const sobre = await page.evaluate(() => conflictAt(1, '07:30', 60, null, null));

    expect(antes, '07:00-08:00 encosta em 08:00 e cabe').toBeNull();
    expect(depois, '09:00-10:00 comeca quando a anterior acaba').toBeNull();
    expect(sobre.s.name).toBe('Ana');
  });

  test('respeita a duracao por aluno: 90 min bloqueia mais que 60', async ({ page }) => {
    await seedApp(page, { students: {} });
    await addStudent(page, { name: 'Longo', dur: 90, schedule: [{ d: SEG, t: '08:00' }] });

    const com90 = await page.evaluate(() => !!conflictAt(1, '09:00', 60, null, null));
    const sem = await page.evaluate(() => conflictAt(1, '10:00', 60, null, null));

    expect(com90, '08:00+90min = 09:30, entao 09:00-10:00 colide').toBe(true);
    expect(sem, '10:00-11:00 esta livre').toBeNull();
  });

  test('exceptSid ignora o proprio aluno, para nao travar a edicao dele', async ({ page }) => {
    await seedApp(page, { students: {} });
    const ana = await addStudent(page, { name: 'Ana', schedule: [{ d: SEG, t: '08:00' }] });

    const semExcept = await page.evaluate(() => !!conflictAt(1, '08:00', 60, null, null));
    const comExcept = await page.evaluate((id) => conflictAt(1, '08:00', 60, id, null), ana.id);

    expect(semExcept).toBe(true);
    expect(comExcept, 'o proprio horario nao e conflito dele').toBeNull();
  });

  test('draftSched aponta conflito do proprio rascunho como "voce"', async ({ page }) => {
    /* o rascunho esta sendo editado: os horarios ja lançados como "você" na
       propria grade, contra os dos outros alunos (que vem com s.name) */
    await seedApp(page, { students: {} });
    const c = await page.evaluate(() =>
      conflictAt(1, '10:00', 60, null, [{ d: 1, t: '09:30' }]));
    expect(c.self).toBe(true);
    expect(c.s, 'conflito proprio nao tem aluno Foreigno').toBeUndefined();
  });

  test('draftSched encaixado entre dois horarios nao acusa conflito', async ({ page }) => {
    await seedApp(page, { students: {} });
    const c = await page.evaluate(() =>
      conflictAt(1, '10:00', 60, null, [{ d: 1, t: '09:00' }, { d: 1, t: '11:00' }]));
    expect(c, '10:00-11:00 cabe entre 09:00-10:00 e 11:00-12:00').toBeNull();
  });

  test('aluno pausado nao bloqueia horario', async ({ page }) => {
    await seedApp(page, { students: {} });
    await addStudent(page, { name: 'Pausada', active: false, schedule: [{ d: SEG, t: '08:00' }] });
    expect(await page.evaluate(() => conflictAt(1, '08:00', 60, null, null))).toBeNull();
  });
});

test.describe('grade de horarios livres (freeSlots)', () => {
  test('respeita inicio, fim, passo e duracao', async ({ page }) => {
    await seedApp(page, { students: {} });
    await setDays(page, { 1: { on: true, start: '09:00', end: '12:00' } });

    const slots = await page.evaluate(() => freeSlots(1, 60, null, null).map((s) => s.t));
    // 09:00, 10:00, 11:00 -- 12:00 nao entra porque 12:00+60 > 12:00
    expect(slots).toEqual(['09:00', '10:00', '11:00']);
  });

  test(' sessao mais longa que a janela nao gera nenhum horario', async ({ page }) => {
    await seedApp(page, { students: {} });
    await setDays(page, { 1: { on: true, start: '09:00', end: '10:00' } });
    expect(await page.evaluate(() => freeSlots(1, 90, null, null))).toEqual([]);
  });

  test('dia desligado nao devolve horario nenhum', async ({ page }) => {
    await seedApp(page, { students: {} });
    await setDays(page, { 0: { on: false, start: '09:00', end: '12:00' } });
    expect(await page.evaluate(() => freeSlots(0, 60, null, null))).toEqual([]);
  });

  test('marca quem ocupa e o que esta livre', async ({ page }) => {
    await seedApp(page, { students: {} });
    await setDays(page, { 1: { on: true, start: '09:00', end: '12:00' } });
    await addStudent(page, { name: 'Ana', schedule: [{ d: SEG, t: '10:00' }] });

    const slots = await page.evaluate(() => freeSlots(1, 60, null, null));
    expect(slots).toEqual([
      { t: '09:00', free: true,  by: null, self: false },
      { t: '10:00', free: false, by: 'Ana', self: false },
      { t: '11:00', free: true,  by: null, self: false },
    ]);
  });

  test('passo de 30 min gera a grade dobrada', async ({ page }) => {
    await seedApp(page, { students: {} });
    await setDays(page, { 1: { on: true, start: '09:00', end: '11:00' } });
    await page.evaluate(() => putCfg('settings', { ...settings(), step: 30 }));
    const slots = await page.evaluate(() => freeSlots(1, 60, null, null).map((s) => s.t));
    expect(slots).toEqual(['09:00', '09:30', '10:00']);
  });
});

test.describe('geracao de sessoes do dia (daySessions)', () => {
  test('gera a sessao semanal no dia certo, nao nos outros', async ({ page }) => {
    await seedApp(page, { students: {} });
    await addStudent(page, { name: 'Ana', schedule: [{ d: SEG, t: '08:00' }] });

    const seg = await page.evaluate((iso) => daySessions(iso).list.length, nextDow(1));
    const ter = await page.evaluate((iso) => daySessions(iso).list.length, nextDow(2));
    expect(seg).toBe(1);
    expect(ter, 'terca nao tem sessao da Ana').toBe(0);
  });

  test('ordena por horario e traz duracao e tipo', async ({ page }) => {
    await seedApp(page, { students: {} });
    await addStudent(page, { name: 'Ana', dur: 45, schedule: [{ d: SEG, t: '14:00' }] });
    await addStudent(page, { name: 'Bia', schedule: [{ d: SEG, t: '08:00' }] });

    const list = await page.evaluate((iso) => daySessions(iso).list, nextDow(1));
    expect(list.map((i) => [i.time, i.dur, i.kind])).toEqual([
      ['08:00', 60, 'reg'],
      ['14:00', 45, 'reg'],
    ]);
  });

  test('aluno que comecou depois da data nao aparece', async ({ page }) => {
    await seedApp(page, { students: {} });
    const amanha = await page.evaluate(() => addDays(todayISO(), 1));
    await addStudent(page, { name: 'Ana', start: amanha, schedule: [{ d: SEG, t: '08:00' }] });

    const hoje = todayISONode();
    const antes = await page.evaluate((iso) => daySessions(iso).list.length, hoje);
    const depois = await page.evaluate((iso) => daySessions(iso).list.length, amanha);
    expect(antes).toBe(0);
    expect(depois).toBe(1);
  });

  test('aluno pausado desaparece da agenda', async ({ page }) => {
    await seedApp(page, { students: {} });
    await addStudent(page, { name: 'Ana', schedule: [{ d: SEG, t: '08:00' }] });
    const iso = nextDow(1);
    expect(await page.evaluate((i) => daySessions(i).list.length, iso)).toBe(1);

    await page.evaluate(() => {
      const id = students()[0].id;
      putDoc('students', id, { ...S.data.students[id], active: false });
    });
    expect(await page.evaluate((i) => daySessions(i).list.length, iso)).toBe(0);
  });

  test('cancelar move a sessao para "cancelled" com a excecao', async ({ page }) => {
    await seedApp(page, { students: {} });
    const ana = await addStudent(page, { name: 'Ana', schedule: [{ d: SEG, t: '08:00' }] });
    const iso = nextDow(1);

    await page.evaluate(({ id, date }) => {
      addExc({ type: 'cancel', sid: id, date, time: '08:00', why: 'enfermidade' });
    }, { id: ana.id, date: iso });

    const r = await page.evaluate((i) => daySessions(i), iso);
    expect(r.list).toHaveLength(0);
    expect(r.cancelled).toHaveLength(1);
    expect(r.cancelled[0].exc.why).toBe('enfermidade');
  });

  test('remarcar tira da data antiga e traz para a nova com kind "moved"', async ({ page }) => {
    await seedApp(page, { students: {} });
    const ana = await addStudent(page, { name: 'Ana', schedule: [{ d: SEG, t: '08:00' }] });
    const seg = nextDow(1);
    const qua = nextDow(3);

    await page.evaluate(({ id, from, to }) => {
      addExc({ type: 'move', sid: id, date: from, time: '08:00', toDate: to, toTime: '10:00' });
    }, { id: ana.id, from: seg, to: qua });

    const naOrigem = await page.evaluate((i) => daySessions(i), seg);
    expect(naOrigem.list, 'saiu da segunda').toHaveLength(0);

    const noDestino = await page.evaluate((i) => daySessions(i), qua);
    expect(noDestino.list).toHaveLength(1);
    expect(noDestino.list[0]).toMatchObject({ time: '10:00', kind: 'moved' });
  });

  test('sessao avulsa entra na data pedida com kind "extra"', async ({ page }) => {
    await seedApp(page, { students: {} });
    const ana = await addStudent(page, { name: 'Ana', schedule: [{ d: SEG, t: '08:00' }] });
    const iso = nextDow(1);

    await page.evaluate(({ id, date }) => {
      addExc({ type: 'extra', sid: id, date, time: '16:00' });
    }, { id: ana.id, date: iso });

    const r = await page.evaluate((i) => daySessions(i), iso);
    expect(r.list.map((i) => [i.time, i.kind])).toEqual([['08:00', 'reg'], ['16:00', 'extra']]);
  });

  test('dia bloqueado esvazia a agenda e marca como bloqueado', async ({ page }) => {
    await seedApp(page, { students: {} });
    await addStudent(page, { name: 'Ana', schedule: [{ d: SEG, t: '08:00' }] });
    const iso = nextDow(1);

    await page.evaluate((date) => {
      addExc({ type: 'block', date, why: 'feriado' });
    }, iso);

    const r = await page.evaluate((i) => daySessions(i), iso);
    expect(r.list).toHaveLength(0);
    expect(r.cancelled).toHaveLength(1);
    expect(r.cancelled[0].blocked).toBe(true);
    expect(r.block.why).toBe('feriado');
  });
});

test.describe('conflito por data (conflictOnDate)', () => {
  test('encontra a sessao do dia', async ({ page }) => {
    await seedApp(page, { students: {} });
    await addStudent(page, { name: 'Ana', schedule: [{ d: SEG, t: '08:00' }] });
    const iso = nextDow(1);
    const c = await page.evaluate((i) => conflictOnDate(i, '08:00', 60, null), iso);
    expect(c.time).toBe('08:00');
  });

  test('skip so ignora a ocorrencia exata, inclusive a data', async ({ page }) => {
    /* Este e o caso documentado no codigo (linha 848): sem comparar a data,
       remarcar "Seg 10:00" para o mesmo horario na semana seguinte brigaria
       com a gêmea recorrente do dia de destino. */
    await seedApp(page, { students: {} });
    const ana = await addStudent(page, { name: 'Ana', schedule: [{ d: SEG, t: '08:00' }] });
    const seg = nextDow(1);
    const seg2 = nextDow(8);   // segunda seguinte

    const comSkipNaData = await page.evaluate(({ d, id }) =>
      conflictOnDate(d, '08:00', 60, { sid: id, time: '08:00', kind: 'reg', date: d }),
      { d: seg, id: ana.id });
    expect(comSkipNaData, 'na propria data o skip vale').toBeNull();

    const comSkipDeOutraData = await page.evaluate(({ d, id }) =>
      conflictOnDate(d, '08:00', 60, { sid: id, time: '08:00', kind: 'reg', date: '2020-01-01' }),
      { d: seg, id: ana.id });
    expect(comSkipDeOutraData, 'skip de outra data nao vale; a sessao e a mesma').not.toBeNull();
    expect(comSkipDeOutraData.time).toBe('08:00');
  });

  test('remarcar para um horario livre nao acusa conflito', async ({ page }) => {
    await seedApp(page, { students: {} });
    const ana = await addStudent(page, { name: 'Ana', schedule: [{ d: SEG, t: '08:00' }] });
    const seg = nextDow(1);
    const c = await page.evaluate(({ d, id }) =>
      conflictOnDate(d, '11:00', 60, { sid: id, time: '08:00', kind: 'reg', date: d }),
      { d: seg, id: ana.id });
    expect(c).toBeNull();
  });
});

/* helper local: o app roda no navegador, mas o teste precisa da data de hoje no Node */
function todayISONode() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
