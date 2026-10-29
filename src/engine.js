/*
 * Motor ELECTRE III / IV — porte fiel dos scripts Python do artigo
 * (Electre/scripts: dados_dengue.py, electre_comum.py, electre_iii.py,
 * electre_iv.py e Historico_2023-2026/scripts/dados_historico.py).
 *
 * Mesma ordem de operações e mesmas tolerâncias (1e-12) para que os
 * resultados sejam idênticos aos do Python.
 */
(function (root) {
  "use strict";

  const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const CRITERIOS = ["casos_est", "Rt", "umidmed", "tempmed"];
  const PESOS_PADRAO = [0.40, 0.30, 0.15, 0.15];
  const FRACOES_PADRAO = { q: 0.10, p: 0.30, v: 0.70 };
  const NIVEIS_SIGMA = { S1: 1.0, S2: 0.8, S3: 0.6, S4: 0.4, S5: 0.2 };

  /** sum() do Python ≥ 3.12 para floats: soma compensada de Neumaier. */
  function pysum(xs) {
    let f = 0.0, c = 0.0;
    for (const x of xs) {
      const t = f + x;
      if (Math.abs(f) >= Math.abs(x)) c += (f - t) + x;
      else c += (x - t) + f;
      f = t;
    }
    if (c !== 0 && Number.isFinite(c)) f += c;
    return f;
  }

  /* ---------------- leitura de dados ---------------- */

  function parseCSV(texto) {
    texto = texto.replace(/^﻿/, "");
    const linhas = [];
    let campo = "", linha = [], aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const ch = texto[i];
      if (aspas) {
        if (ch === '"') {
          if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
        } else campo += ch;
      } else if (ch === '"') aspas = true;
      else if (ch === "," || ch === ";") { linha.push(campo); campo = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && texto[i + 1] === "\n") i++;
        linha.push(campo); campo = "";
        if (linha.length > 1 || linha[0] !== "") linhas.push(linha);
        linha = [];
      } else campo += ch;
    }
    if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
    if (!linhas.length) return [];
    const cab = linhas[0].map((c) => c.trim());
    return linhas.slice(1).map((l) => {
      const o = {};
      cab.forEach((c, j) => { o[c] = l[j] === undefined ? "" : l[j].trim(); });
      return o;
    });
  }

  function num(v) {
    if (v === null || v === undefined) return NaN;
    if (typeof v === "number") return v;
    const s = String(v).trim();
    if (s === "" || /^nan$/i.test(s) || /^null$/i.test(s)) return NaN;
    return Number(s);
  }

  function dataISO(v) {
    // CSV traz "AAAA-MM-DD"; a API em JSON pode trazer milissegundos.
    if (typeof v === "number" || /^\d{11,}$/.test(String(v))) {
      return new Date(Number(v)).toISOString().slice(0, 10);
    }
    return String(v).slice(0, 10);
  }

  /** (ano epidemiológico, mês) — regra de dados_historico.mes_da_semana. */
  function mesDaSemana(dataIni, se) {
    const ano = Number(dataIni.slice(0, 4));
    const mes = Number(dataIni.slice(5, 7));
    const anoSE = Number(String(se).slice(0, 4));
    if (mes === 12 && anoSE === ano + 1) return { ano: anoSE, mes: 1 };
    return { ano: anoSE, mes: mes };
  }

  /** Linhas cruas (CSV/JSON do InfoDengue) -> semanas normalizadas. */
  function normalizarSemanas(linhas) {
    const faltam = ["data_iniSE", "SE", ...CRITERIOS].filter(
      (c) => !linhas.length || !(c in linhas[0])
    );
    if (faltam.length) {
      const e = new Error("Colunas ausentes: " + faltam.join(", "));
      e.colunas = faltam;
      throw e;
    }
    const porSE = new Map();
    for (const l of linhas) {
      const data = dataISO(l.data_iniSE);
      const se = String(l.SE).trim();
      if (!/^\d{6}$/.test(se) || !/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
      const { ano, mes } = mesDaSemana(data, se);
      porSE.set(se, {
        se, data, ano, mes,
        casos_est: num(l.casos_est), Rt: num(l.Rt),
        umidmed: num(l.umidmed), tempmed: num(l.tempmed),
        casos: num(l.casos), pop: num(l.pop), nivel: num(l.nivel),
        p_inc100k: num(l.p_inc100k),
        municipio: l.municipio_nome || "",
      });
    }
    // Mantém a ordem do arquivo: a soma das médias segue essa ordem, como no Python.
    return [...porSE.values()];
  }

  function ordenarPorData(semanas) {
    return semanas.slice().sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  }

  /**
   * Matriz de decisão: média semanal de cada critério em cada mês,
   * reunindo os anos epidemiológicos pedidos (agregar_meses).
   * Valores ausentes ficam fora da média do critério (o Python não os aceita).
   */
  function agregar(semanas, anos) {
    const filtro = anos ? new Set(anos) : null;
    const usadas = semanas.filter((s) => !filtro || filtro.has(s.ano));
    const bk = MESES.map(() => ({ n: 0, v: CRITERIOS.map(() => []), anos: new Map() }));
    for (const s of usadas) {
      const b = bk[s.mes - 1];
      b.n += 1;
      b.anos.set(s.ano, (b.anos.get(s.ano) || 0) + 1);
      CRITERIOS.forEach((c, j) => { if (Number.isFinite(s[c])) b.v[j].push(s[c]); });
    }
    const vazios = [];
    const matriz = bk.map((b, m) =>
      b.v.map((vals, j) => {
        if (!vals.length) { vazios.push(MESES[m] + "/" + CRITERIOS[j]); return NaN; }
        return pysum(vals) / vals.length;
      })
    );
    const metas = bk.map((b, m) => ({
      nome: MESES[m],
      semanas: b.n,
      ausentes: CRITERIOS.map((_, j) => b.n - b.v[j].length),
      anos: [...b.anos.keys()].sort(),
      semanasPorAno: Object.fromEntries([...b.anos.entries()].sort()),
    }));
    return { matriz, metas, vazios, usadas };
  }

  function amplitudes(matriz) {
    return CRITERIOS.map((_, j) => {
      const col = matriz.map((l) => l[j]);
      return Math.max(...col) - Math.min(...col);
    });
  }

  function limiares(matriz, fr) {
    fr = fr || FRACOES_PADRAO;
    const amp = amplitudes(matriz);
    return {
      amplitude: amp,
      q: amp.map((a) => fr.q * a),
      p: amp.map((a) => fr.p * a),
      v: amp.map((a) => fr.v * a),
    };
  }

  /* ---------------- ELECTRE III ---------------- */

  function concordanciaParcial(ga, gb, q, p) {
    const dif = gb - ga; // todos os critérios são de maximização
    if (dif <= q) return 1.0;
    if (dif >= p) return 0.0;
    return (p - dif) / (p - q);
  }

  function discordanciaParcial(ga, gb, p, v) {
    const dif = gb - ga;
    if (dif <= p) return 0.0;
    if (dif >= v) return 1.0;
    return (dif - p) / (v - p);
  }

  function credibilidadeIII(matriz, pesos, q, p, v) {
    const n = matriz.length, m = pesos.length;
    const W = pysum(pesos);
    const mk = () => matriz.map(() => matriz.map(() => 0));
    const C = mk(), sigma = mk(), dmax = mk();
    const cj = matriz.map(() => matriz.map(() => null));
    const dj = matriz.map(() => matriz.map(() => null));
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) {
        if (i === k) { C[i][k] = 1; sigma[i][k] = 1; continue; }
        const c = [], d = [];
        for (let j = 0; j < m; j++) {
          c.push(concordanciaParcial(matriz[i][j], matriz[k][j], q[j], p[j]));
          d.push(discordanciaParcial(matriz[i][j], matriz[k][j], p[j], v[j]));
        }
        const Cik = pysum(pesos.map((w, j) => w * c[j])) / W;
        C[i][k] = Cik;
        dmax[i][k] = Math.max(...d);
        let cred = Cik;
        for (let j = 0; j < m; j++) {
          if (d[j] > Cik + 1e-12) cred *= (1.0 - d[j]) / (1.0 - Cik);
        }
        sigma[i][k] = cred;
        cj[i][k] = c; dj[i][k] = d;
      }
    }
    return { C, sigma, dmax, cj, dj };
  }

  /* ---------------- ELECTRE IV ---------------- */

  function situacaoCriterio(ga, gb, q, p, v) {
    const dif = ga - gb; // > 0 => a é melhor
    if (dif >= v) return "P+";
    if (dif > p) return "P+";
    if (dif > q) return "Q+";
    if (dif >= -q) return "I";
    if (dif >= -p) return "Q-";
    if (dif > -v) return "P-";
    return "V-";
  }

  function relacaoAninhada(ct) {
    const np = ct["P+"], nq = ct["Q+"], nqm = ct["Q-"], npm = ct["P-"], nv = ct["V-"];
    if (nv > 0) return [null, 0.0];
    if (npm === 0 && nqm === 0 && np >= 1) return ["S1", NIVEIS_SIGMA.S1];
    if (npm === 0 && np >= nqm && np >= 1) return ["S2", NIVEIS_SIGMA.S2];
    if (npm === 0 && np + nq >= nqm) return ["S3", NIVEIS_SIGMA.S3];
    if (npm === 0) return ["S4", NIVEIS_SIGMA.S4];
    if (npm <= 1 && np >= npm + nqm && nv === 0) return ["S5", NIVEIS_SIGMA.S5];
    return [null, 0.0];
  }

  function credibilidadeIV(matriz, q, p, v) {
    const n = matriz.length;
    const sigma = matriz.map(() => matriz.map(() => 0));
    const rotulo = matriz.map(() => matriz.map(() => ""));
    const situ = matriz.map(() => matriz.map(() => null));
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) {
        if (i === k) { sigma[i][k] = 1; rotulo[i][k] = "—"; continue; }
        const ct = { "P+": 0, "Q+": 0, I: 0, "Q-": 0, "P-": 0, "V-": 0 };
        const det = [];
        for (let j = 0; j < CRITERIOS.length; j++) {
          const s = situacaoCriterio(matriz[i][j], matriz[k][j], q[j], p[j], v[j]);
          ct[s] += 1; det.push(s);
        }
        const [rel, val] = relacaoAninhada(ct);
        sigma[i][k] = val;
        rotulo[i][k] = rel || "-";
        situ[i][k] = det;
      }
    }
    return { sigma, rotulo, situ };
  }

  /* ---------------- destilação e pré-ordem ---------------- */

  function destilacao(sigma, descendente, alfa, beta) {
    alfa = alfa === undefined ? 0.30 : alfa;
    beta = beta === undefined ? -0.15 : beta;
    const n = sigma.length;
    let restantes = [...Array(n).keys()];
    const niveis = [];
    while (restantes.length) {
      let D = restantes.slice();
      for (;;) {
        let lam = 0.0;
        for (const i of D) for (const k of D) if (i !== k) lam = Math.max(lam, sigma[i][k]);
        const corte = lam - (alfa + beta * lam);
        const qual = new Map();
        for (const i of D) {
          let forca = 0, fraqueza = 0;
          for (const k of D) {
            if (i === k) continue;
            if (sigma[i][k] + 1e-12 >= corte) forca++;
            if (sigma[k][i] + 1e-12 >= corte) fraqueza++;
          }
          qual.set(i, forca - fraqueza);
        }
        const vals = [...qual.values()];
        const extremo = descendente ? Math.max(...vals) : Math.min(...vals);
        const novo = D.filter((i) => qual.get(i) === extremo);
        if (novo.length === D.length || novo.length === 1) { D = novo; break; }
        D = novo;
      }
      niveis.push(D.slice().sort((a, b) => a - b));
      const tirar = new Set(D);
      restantes = restantes.filter((i) => !tirar.has(i));
    }
    return niveis;
  }

  function ranksDeNiveis(niveis, n, invertido) {
    const ordem = invertido ? niveis.slice().reverse() : niveis;
    const ranks = new Array(n).fill(0);
    ordem.forEach((classe, r) => classe.forEach((i) => { ranks[i] = r + 1; }));
    return ranks;
  }

  function preordemFinal(rd, ra, nomes) {
    const n = nomes.length;
    const rel = nomes.map((_, i) => nomes.map((_, k) => (i === k ? "I" : "")));
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) {
        if (i === k) continue;
        const md = rd[i] < rd[k], ma = ra[i] < ra[k];
        const pd = rd[i] > rd[k], pa = ra[i] > ra[k];
        if ((md || ma) && !(pd || pa)) rel[i][k] = "P";
        else if ((pd || pa) && !(md || ma)) rel[i][k] = "p";
        else if (rd[i] === rd[k] && ra[i] === ra[k]) rel[i][k] = "I";
        else rel[i][k] = "R";
      }
    }
    const mediano = rd.map((d, i) => (d + ra[i]) / 2);
    const ordem = [...Array(n).keys()].sort((a, b) =>
      mediano[a] - mediano[b] || rd[a] - rd[b] || (nomes[a] < nomes[b] ? -1 : nomes[a] > nomes[b] ? 1 : 0)
    );
    // posição de compromisso (mesma numeração dos .txt)
    const posicao = new Array(n).fill(0);
    let pos = 0, ultimo = null;
    for (const i of ordem) {
      if (mediano[i] !== ultimo) { pos++; ultimo = mediano[i]; }
      posicao[i] = pos;
    }
    return { relacao: rel, mediano, ordem, posicao, ranksDesc: rd, ranksAsc: ra };
  }

  function explorar(sigma, nomes, alfa, beta) {
    const n = nomes.length;
    const nd = destilacao(sigma, true, alfa, beta);
    const na = destilacao(sigma, false, alfa, beta);
    const rd = ranksDeNiveis(nd, n, false);
    const ra = ranksDeNiveis(na, n, true);
    return Object.assign(preordemFinal(rd, ra, nomes), { niveisDesc: nd, niveisAsc: na });
  }

  /** Tudo de uma vez: matriz -> III e IV. */
  function rodar(matriz, opcoes) {
    opcoes = opcoes || {};
    const pesos = opcoes.pesos || PESOS_PADRAO;
    const fr = opcoes.fracoes || FRACOES_PADRAO;
    const alfa = opcoes.alfa === undefined ? 0.30 : opcoes.alfa;
    const beta = opcoes.beta === undefined ? -0.15 : opcoes.beta;
    const lim = limiares(matriz, fr);
    const iii = credibilidadeIII(matriz, pesos, lim.q, lim.p, lim.v);
    const iv = credibilidadeIV(matriz, lim.q, lim.p, lim.v);
    return {
      lim, pesos,
      iii: Object.assign(iii, explorar(iii.sigma, MESES, alfa, beta)),
      iv: Object.assign(iv, explorar(iv.sigma, MESES, alfa, beta)),
    };
  }

  const API = {
    MESES, CRITERIOS, PESOS_PADRAO, FRACOES_PADRAO,
    parseCSV, normalizarSemanas, ordenarPorData, mesDaSemana, agregar, amplitudes, limiares,
    credibilidadeIII, credibilidadeIV, situacaoCriterio, relacaoAninhada,
    destilacao, ranksDeNiveis, preordemFinal, explorar, rodar,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.ELECTRE = API;
})(typeof window !== "undefined" ? window : globalThis);
