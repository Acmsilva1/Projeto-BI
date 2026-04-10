/**
 * Popula tabelas da réplica SQLite usadas pela visão Gerência (totais, tempos,
 * Metas por volumes, Metas de acompanhamento, % conformes, indicadores por unidade).
 *
 * - Últimos 12 meses corridos: séries mensais dos gráficos (acompanhamento / conformes).
 * - Últimos ~28 dias: reforço para totais PS e tempo médio (filtro period=30).
 *
 * Uso: na raiz do repositório: node scripts/seed-gerencia-dados.js
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const root = path.join(__dirname, '..');
const dbPath = path.join(root, 'db local', 'db_testes_replica.sqlite3');

const T = {
  flux: 'cmc_hospital.tbl_tempos_entrada_consulta_saida',
  med: 'cmc_hospital.tbl_tempos_medicacao',
  lab: 'cmc_hospital.tbl_tempos_laboratorio',
  rx: 'cmc_hospital.tbl_tempos_rx_e_ecg',
  tcus: 'cmc_hospital.tbl_tempos_tc_e_us',
  reav: 'cmc_hospital.tbl_tempos_reavaliacao',
  altas: 'cmc_hospital.tbl_altas_ps',
  conv: 'cmc_hospital.tbl_intern_conversoes',
  vias: 'cmc_hospital.tbl_vias_medicamentos',
  meta: 'cmc_hospital.meta_tempos',
};

const CDS = [1, 3, 13, 25, 26, 31, 33, 39, 45];
const UNIDADE_NOME = {
  1: 'PS HOSPITAL VITÓRIA',
  3: 'PS VILA VELHA',
  13: 'PS SIG',
  25: 'PS BARRA DA TIJUCA',
  26: 'PS BOTAFOGO',
  31: 'PS GUTIERREZ',
  33: 'PS PAMPULHA',
  39: 'PS TAGUATINGA',
  45: 'PS CAMPO GRANDE',
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Mesmo critério que buildRollingMonthKeys(12) no backend (1º de cada mês). */
function last12MonthSpecs() {
  const now = new Date();
  const out = [];
  for (let i = 11; i >= 0; i -= 1) {
    const first = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = first.getFullYear();
    const mo = first.getMonth() + 1;
    const monthKey = `${y}-${pad2(mo)}`;
    out.push({ y, mo, monthKey, mi: 11 - i });
  }
  return out;
}

function recentDays() {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 28; i += 2) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(10 + (i % 5), 20, 0, 0);
    out.push(d);
  }
  return out;
}

function isoLocal(y, mo, day, h = 12, min = 0) {
  return new Date(y, mo - 1, Math.min(day, 28), h, min, 0).toISOString();
}

if (!fs.existsSync(dbPath)) {
  console.error('[seed-gerencia] Arquivo não encontrado:', dbPath);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

const del = (name) => db.prepare(`DELETE FROM "${name}"`).run();

db.exec('BEGIN IMMEDIATE');
Object.values(T).forEach(del);

const metas = [
  [1, 'META_TRIAGEM_PS', 12, 8],
  [2, 'META_CONSULTA_PS', 90, 60],
  [3, 'META_MEDICACAO_PS', 30, 20],
  [4, 'META_REAVALI_PS', 60, 45],
  [5, 'META_ALTA_PERM_PS', 240, 200],
  [6, 'META_RX_PS', 60, 45],
  [7, 'META_TC_PS', 120, 90],
];
const insMeta = db.prepare(
  `INSERT INTO "${T.meta}" (id, CD_ESTABELECIMENTO, CHAVE, VALOR_MIN, ALERTA_MIN) VALUES (?,?,?,?,?)`,
);
metas.forEach((row) => insMeta.run(...row));

const insFlux = db.prepare(`INSERT INTO "${T.flux}"
  (UNIDADE, CD_ESTABELECIMENTO, NR_ATENDIMENTO, PACIENTE, DATA, DT_ENTRADA,
   MIN_ENTRADA_X_TRIAGEM, MIN_ENTRADA_X_CONSULTA, MIN_ENTRADA_X_ALTA,
   DESTINO, DT_INTERNACAO, MEDICO_ATENDIMENTO, DT_DESFECHO, MEDICO_DESFECHO)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

const insMed = db.prepare(`INSERT INTO "${T.med}"
  (UNIDADE, CD_ESTABELECIMENTO, NR_ATENDIMENTO, PACIENTE, DATA, MINUTOS, DT_PRESCRICAO)
  VALUES (?,?,?,?,?,?,?)`);

const insLab = db.prepare(`INSERT INTO "${T.lab}"
  (UNIDADE, CD_ESTABELECIMENTO, NR_ATENDIMENTO, PACIENTE, DATA, DT_SOLICITACAO, DS_PROC_EXAME)
  VALUES (?,?,?,?,?,?,?)`);

const insRx = db.prepare(`INSERT INTO "${T.rx}"
  (UNIDADE, CD_ESTABELECIMENTO, NR_ATENDIMENTO, PACIENTE, TIPO, EXAME, DATA, MINUTOS, DT_SOLICITACAO)
  VALUES (?,?,?,?,?,?,?,?,?)`);

const insTcus = db.prepare(`INSERT INTO "${T.tcus}"
  (UNIDADE, CD_ESTABELECIMENTO, NR_ATENDIMENTO, PACIENTE, TIPO, EXAME, DATA, MINUTOS, DT_EXAME)
  VALUES (?,?,?,?,?,?,?,?,?)`);

const insReav = db.prepare(`INSERT INTO "${T.reav}"
  (UNIDADE, CD_ESTABELECIMENTO, NR_ATENDIMENTO, PACIENTE, DATA, DT_SOLIC_REAVALIACAO, DT_FIM_REAVALIACAO, MINUTOS, DT_EVO_PRESC)
  VALUES (?,?,?,?,?,?,?,?,?)`);

const insVias = db.prepare(`INSERT INTO "${T.vias}"
  (UNIDADE, CD_ESTABELECIMENTO, CD_PESSOA_FISICA, NR_ATENDIMENTO, PACIENTE, DATA, NR_PRESCRICAO, CD_MATERIAL, DS_MATERIAL, IE_VIA_APLICACAO)
  VALUES (?,?,?,?,?,?,?,?,?,?)`);

const insAlta = db.prepare(`INSERT INTO "${T.altas}"
  (CD_PESSOA_FISICA, CD_ESTABELECIMENTO, NR_ATENDIMENTO_URG, DT_ALTA, TIPO_DESFECHO, DT_ENTRADA, DS_MOTIVO_ALTA, QTD_OBITO)
  VALUES (?,?,?,?,?,?,?,?)`);

const insConv = db.prepare(`INSERT INTO "${T.conv}"
  (CD_PESSOA_FISICA, NR_ATENDIMENTO_URG, CD_ESTAB_URG, NR_ATENDIMENTO_INT, CD_ESTAB_INT, DT_ENTRADA, TIPO_DESFECHO)
  VALUES (?,?,?,?,?,?,?)`);

let nrSeq = 500000;

function nextNr() {
  nrSeq += 1;
  return nrSeq;
}

function insertAtendimentoBundle({
  un, cd, pessoaBase, ds, mi, mo, slot, extraConv, unitIdx,
}) {
  const nr = nextNr();
  const pessoaId = String(pessoaBase + slot + mi * 10);

  let tipoAlta = 'ALTA MEDICA';
  let motivo = 'ALTA';
  let obito = 0;
  if (cd === 1 && mi === 11 && slot === 0) {
    tipoAlta = 'OBITO';
    motivo = 'OBITO';
    obito = 1;
  } else if (cd === 3 && mi === 11 && slot === 1) {
    tipoAlta = 'EVASAO';
    motivo = 'EVASAO PACIENTE';
  } else if ((slot + mo + cd + unitIdx * 2) % 11 === 0) {
    tipoAlta = 'ENCAMINHAMENTO HOSPITALAR';
    motivo = 'TRANSFERENCIA';
  } else if (unitIdx >= 6 && (slot + mo) % 9 === 0) {
    tipoAlta = 'EVASAO';
    motivo = 'EVASAO PACIENTE';
  }

  /* Deslocamento forte por unidade (0–8) + estabelecimento — séries mensais bem separadas nos gráficos. */
  const uSkew = unitIdx * 9 + (cd % 11) * 2;
  const triBase =
    (slot + mo * 3 + cd + unitIdx) % 5 === 0 ? 16 + (mi % 9) + (slot % 4) : 6 + (mi % 7) + (slot % 3) + (cd % 4);
  const tri = Math.min(45, Math.max(4, triBase + (unitIdx % 5) * 3 + (uSkew % 4)));
  const consHigh =
    (slot + mi + cd + unitIdx) % 5 === 0 || (slot + mo + unitIdx) % 6 === 4 || (unitIdx >= 6 && (slot + mi) % 3 === 0);
  const consBase = consHigh ? 95 + (mi % 28) + (slot % 5) : 38 + (mi % 20) + (slot % 8);
  const cons = Math.min(130, Math.max(25, consBase + (unitIdx % 6) * 4 + (uSkew % 7)));
  const permHigh = (slot + cd + mi + unitIdx) % 7 === 0;
  const permBase = permHigh ? 255 + (mi % 45) + (slot % 12) : 110 + (mi % 60) + (slot * 5);
  const perm = Math.min(400, Math.max(85, permBase + unitIdx * 8 + (unitIdx >= 5 ? 25 : 0)));

  const medicoAtend = `DR_SEED_${(nr % 37) + 1}`;
  let destino = 'Alta';
  let dtInternacao = null;
  if (extraConv) {
    destino = 'Internado';
    const ti = new Date(ds);
    if ((slot + mi + cd) % 7 === 0) {
      ti.setMonth(ti.getMonth() + 1);
      ti.setDate(Math.min(8 + slot, 28));
    }
    dtInternacao = ti.toISOString();
  }
  let dtDesfecho = null;
  let medicoDesfecho = null;
  if (/ALTA\s*MED/i.test(tipoAlta) || tipoAlta === 'ALTA MEDICA') {
    const td = new Date(ds);
    td.setMinutes(td.getMinutes() + 20 + (slot % 12));
    dtDesfecho = td.toISOString();
    medicoDesfecho = medicoAtend;
  } else if (tipoAlta === 'OBITO' && (slot + mi) % 4 === 0) {
    const td = new Date(ds);
    td.setMinutes(td.getMinutes() + 12);
    dtDesfecho = td.toISOString();
    medicoDesfecho = 'OUTRO_MEDICO';
  }

  insFlux.run(un, cd, nr, `Pac ${nr}`, ds, ds, tri, cons, perm, destino, dtInternacao, medicoAtend, dtDesfecho, medicoDesfecho);

  /* Taxa “sem med” varia por unidade (não só por slot) — curvas de pacs medicados distintas. */
  const semMedicacao = (slot + cd + mo + unitIdx * 2) % 7 === 0;
  if (!semMedicacao) {
    const medLento = slot % 3 === 0 ? 42 + (unitIdx % 4) * 3 : 16 + (unitIdx % 3);
    insMed.run(un, cd, nr, `Pac ${nr}`, ds, medLento, ds);
    insVias.run(un, cd, pessoaId, nr, `Pac ${nr}`, ds, 1, 99100 + (slot % 5), 'Simulado via A', 'EV');
    if ((slot + cd) % 9 === 0) {
      insVias.run(un, cd, pessoaId, nr, `Pac ${nr}`, ds, 1, 84278, 'Excluído PBI (teste)', 'EV');
    }
    if ((slot + mi + unitIdx) % 4 === 0 || (mo % 2 === 0 && slot % 3 === 1) || (unitIdx <= 2 && slot < 2)) {
      insMed.run(un, cd, nr, `Pac ${nr}`, ds, 22 + (slot % 18) + (mo % 5) + (unitIdx % 4), ds);
      insVias.run(un, cd, pessoaId, nr, `Pac ${nr}`, ds, 2, 99101 + (mo % 3), 'Simulado via B', 'IM');
    }
  }
  if (slot !== 2 && (slot + unitIdx) % 5 !== 0) {
    insLab.run(un, cd, nr, `Pac ${nr}`, ds, ds, 'HEMOGRAMA');
  }
  if ((slot + mi + unitIdx) % 5 === 0 && slot !== 2) {
    insLab.run(un, cd, nr, `Pac ${nr}`, ds, ds, 'GLICEMIA');
  }
  if (slot % 2 === 0) {
    insRx.run(un, cd, nr, `Pac ${nr}`, 'RX', 'RX TORAX', ds, 32 + (mi % 18) + (unitIdx % 5), ds);
  } else {
    insRx.run(un, cd, nr, `Pac ${nr}`, 'ECG', 'ECG 12D', ds, 26 + (mi % 12) + (unitIdx % 4), ds);
  }
  const tcRich = unitIdx % 3 === 0 || unitIdx >= 5;
  if (slot % 3 === 0 && (tcRich || (slot + unitIdx) % 4 !== 0)) {
    insTcus.run(un, cd, nr, `Pac ${nr}`, 'TC', 'TC CRANIO', ds, 88 + (mi % 35) + unitIdx * 2, ds);
    if ((mi + cd + unitIdx) % 4 === 0) {
      insTcus.run(un, cd, nr, `Pac ${nr}`, 'TC', 'TC ABDOME', ds, 92 + (slot % 20), ds);
    }
  }
  if (slot % 3 === 1 && (unitIdx % 2 === 1 || unitIdx < 4)) {
    insTcus.run(un, cd, nr, `Pac ${nr}`, 'US', 'US ABDOME', ds, 40 + (mi % 15) + unitIdx, ds);
  }
  const reavHot = (slot + mo * 2 + mi + unitIdx) % 3 === 0;
  const reavMin = reavHot
    ? 68 + (mi % 22) + (slot % 8) + (unitIdx % 5) * 2
    : 18 + (mi % 38) + (slot % 6) + (mo % 4) + (unitIdx % 7);
  const tSolic = new Date(ds);
  const tFim = new Date(tSolic.getTime() + reavMin * 60000);
  const evoOff = Math.min(14, Math.max(1, reavMin - 3));
  const tEvo = reavHot ? new Date(tSolic.getTime() + evoOff * 60000) : null;
  insReav.run(
    un,
    cd,
    nr,
    `Pac ${nr}`,
    ds,
    tSolic.toISOString(),
    tFim.toISOString(),
    reavMin,
    tEvo ? tEvo.toISOString() : null,
  );

  insAlta.run(pessoaBase + slot + mi * 10, cd, nr, ds, tipoAlta, ds, motivo, obito);

  if (extraConv) {
    insConv.run(pessoaBase + 900 + slot, nr, cd, 8800000 + nr + slot, cd, ds, 'INTERNACAO');
  }
}

const monthSpecs = last12MonthSpecs();
const dayDates = recentDays();

CDS.forEach((cd, idxUn) => {
  const un = UNIDADE_NOME[cd] || `UNIDADE_${cd}`;
  const pessoaBase = 900000 + cd * 10000;
  const unitIdx = idxUn;

  monthSpecs.forEach(({ y, mo, mi }) => {
    /* Volume mensal muito diferente por PS (2–15 atend/mês simulados) — tendências desaninhadas. */
    const nSlots = Math.min(
      15,
      Math.max(2, 2 + (unitIdx % 6) * 2 + (mi % 4) + (cd % 3) + (unitIdx === 0 ? 2 : 0)),
    );
    for (let slot = 0; slot < nSlots; slot += 1) {
      const day = 4 + slot * 9 + (mi % 4);
      const ds = isoLocal(y, mo, day, 9 + slot, 15 + mi);
      /* Conversão: unidades “referência” com mais internações; outras só no 1º slot ou esporádico. */
      let extraConv = false;
      if (slot === 0) {
        if (unitIdx >= 6) extraConv = (mi + cd + slot) % 4 !== 0;
        else extraConv = true;
      } else if (slot === 1 && unitIdx <= 2) {
        extraConv = (mi + unitIdx) % 2 === 0;
      } else if (slot === 2 && unitIdx === 0) {
        extraConv = mi % 3 === 0;
      }
      insertAtendimentoBundle({ un, cd, pessoaBase, ds, mi, mo, slot, extraConv, unitIdx });
    }
  });

  dayDates.forEach((d, di) => {
    if (di % CDS.length !== idxUn) return;
    const ds = d.toISOString();
    const nr = nextNr();
    const u = unitIdx;
    const medicoD = `DR_D_${nr % 20}`;
    const td = new Date(ds);
    td.setMinutes(td.getMinutes() + 25);
    insFlux.run(
      un,
      cd,
      nr,
      `PacD ${nr}`,
      ds,
      ds,
      10 + (u % 4) * 2,
      48 + u * 3,
      180 + u * 5,
      'Alta',
      null,
      medicoD,
      td.toISOString(),
      medicoD,
    );
    const pessoaD = String(pessoaBase + 7000 + di);
    insMed.run(un, cd, nr, `PacD ${nr}`, ds, 18 + (u % 5) * 5, ds);
    insVias.run(un, cd, pessoaD, nr, `PacD ${nr}`, ds, 1, 99200 + (u % 4), 'Simulado dia', 'EV');
    if (u % 4 !== 0) insLab.run(un, cd, nr, `PacD ${nr}`, ds, ds, 'UREIA');
    insRx.run(un, cd, nr, `PacD ${nr}`, 'RX', 'RX', ds, 40 + u * 2, ds);
    if (u % 2 === 0) insTcus.run(un, cd, nr, `PacD ${nr}`, 'TC', 'TC', ds, 95 + u, ds);
    const reavMinD = 35 + (u % 6) * 8;
    const t0 = new Date(ds);
    insReav.run(
      un,
      cd,
      nr,
      `PacD ${nr}`,
      ds,
      t0.toISOString(),
      new Date(t0.getTime() + reavMinD * 60000).toISOString(),
      reavMinD,
      new Date(t0.getTime() + 12 * 60000).toISOString(),
    );
    insAlta.run(pessoaBase + 7000 + di, cd, nr, ds, u % 5 === 0 ? 'EVASAO' : 'ALTA MEDICA', ds, u % 5 === 0 ? 'EVASAO' : 'ALTA', 0);
  });
});

db.exec('COMMIT');
console.log('[seed-gerencia] OK — 12 meses + janela recente. Tabelas:', Object.values(T).join(', '));
console.log('[seed-gerencia] NR_ATENDIMENTO final:', nrSeq);
