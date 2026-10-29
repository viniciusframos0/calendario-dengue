(function () {
  "use strict";
  const E = window.ELECTRE;
  const MESES = E.MESES;
  const ABR = MESES.map((m) => m.slice(0, 3));
  const CRIT = E.CRITERIOS;
  const ROT = { casos_est: "Casos estimados", Rt: "Rt", umidmed: "Umidade média", tempmed: "Temperatura média" };
  const ROT_CURTO = { casos_est: "Casos", Rt: "Rt", umidmed: "Umidade", tempmed: "Temperatura" };
  const UNID = { casos_est: "", Rt: "", umidmed: " %", tempmed: " °C" };
  const CASAS = { casos_est: 1, Rt: 2, umidmed: 1, tempmed: 2 };
  const METODOS = { iii: "ELECTRE III", iv: "ELECTRE IV" };
  const COR_MET = { iii: "var(--s1)", iv: "var(--s2)" };
  const SIT = {
    "P+": "a prefere (estrito)", "Q+": "a prefere (fraco)", I: "indiferentes",
    "Q-": "b prefere (fraco)", "P-": "b prefere (estrito)", "V-": "b veta a",
  };
  const CAPITAIS = [
    ["Aracaju", "SE", "2800308"], ["Belém", "PA", "1501402"], ["Belo Horizonte", "MG", "3106200"],
    ["Boa Vista", "RR", "1400100"], ["Brasília", "DF", "5300108"], ["Campo Grande", "MS", "5002704"],
    ["Cuiabá", "MT", "5103403"], ["Curitiba", "PR", "4106902"], ["Florianópolis", "SC", "4205407"],
    ["Fortaleza", "CE", "2304400"], ["Goiânia", "GO", "5208707"], ["João Pessoa", "PB", "2507507"],
    ["Macapá", "AP", "1600303"], ["Maceió", "AL", "2704302"], ["Manaus", "AM", "1302603"],
    ["Natal", "RN", "2408102"], ["Palmas", "TO", "1721000"], ["Porto Alegre", "RS", "4314902"],
    ["Porto Velho", "RO", "1100205"], ["Recife", "PE", "2611606"], ["Rio Branco", "AC", "1200401"],
    ["Rio de Janeiro", "RJ", "3304557"], ["Salvador", "BA", "2927408"], ["São Luís", "MA", "2111300"],
    ["São Paulo", "SP", "3550308"], ["Teresina", "PI", "2211001"], ["Vitória", "ES", "3205309"],
  ];

  const $ = (id) => document.getElementById(id);
  const fmt = (x, c) =>
    Number.isFinite(x) ? x.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c }) : "—";
  const fmtV = (crit, x) => fmt(x, CASAS[crit]) + UNID[crit];
  const lista = (arr) => (arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + " e " + arr[arr.length - 1]);
  const minus = (s) => s.replace("-", "−");

  /* ---------------- dados ---------------- */
  const cidades = {};
  const ordemCidades = [];
  for (const [id, v] of Object.entries(window.DADOS.cidades)) {
    const linhas = v.rows.map((r) => Object.fromEntries(window.DADOS.cols.map((c, i) => [c, r[i] === null ? "" : r[i]])));
    adicionarCidade(id, v.nome, v.uf, E.normalizarSemanas(linhas), false);
  }

  function adicionarCidade(id, nome, uf, semanas, enviada) {
    const contagem = {};
    for (const s of semanas) contagem[s.ano] = (contagem[s.ano] || 0) + 1;
    const anos = Object.keys(contagem).map(Number).filter((a) => contagem[a] >= 4).sort((a, b) => a - b);
    const completos = anos.filter((a) => new Set(semanas.filter((s) => s.ano === a).map((s) => s.mes)).size === 12);
    cidades[id] = { id, nome, uf, semanas, ordenadas: E.ordenarPorData(semanas), anos, completos, enviada };
    if (!ordemCidades.includes(id)) ordemCidades.push(id);
  }

  /* ---------------- estado ---------------- */
  const PADRAO = { pesos: E.PESOS_PADRAO.slice(), fr: Object.assign({}, E.FRACOES_PADRAO) };
  const state = {
    cidade: "belem",
    anos: [2025],
    pesos: PADRAO.pesos.slice(),
    fr: Object.assign({}, PADRAO.fr),
    metSigma: "iii", metGrafo: "iii", metCid: "iii",
    par: null,
  };
  let atual = null; // resultado corrente

  function ehPadrao() {
    return state.pesos.every((w, j) => Math.abs(w - PADRAO.pesos[j]) < 1e-9) &&
      ["q", "p", "v"].every((k) => Math.abs(state.fr[k] - PADRAO.fr[k]) < 1e-9);
  }
  const mesmoConj = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

  function calcular(idCidade, anos) {
    const c = cidades[idCidade];
    const usar = anos.filter((a) => c.anos.includes(a));
    if (!usar.length) return { semDados: true, anos: usar };
    const ag = E.agregar(c.semanas, usar);
    if (ag.vazios.length) {
      const meses = [...new Set(ag.vazios.map((v) => v.split("/")[0]))];
      return { ag, anos: usar, faltam: meses };
    }
    const r = E.rodar(ag.matriz, { pesos: state.pesos, fracoes: state.fr });
    return { ag, r, anos: usar };
  }

  function textoPeriodo(anos) {
    if (!anos.length) return "";
    const s = anos.slice().sort((a, b) => a - b);
    const contiguo = s.every((a, i) => i === 0 || a === s[i - 1] + 1);
    if (s.length === 1) return String(s[0]);
    return contiguo ? s[0] + "–" + s[s.length - 1] : lista(s.map(String));
  }

  /* ---------------- tema e cores ---------------- */
  function escuro() {
    const t = document.documentElement.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  const RAMPA_CLARA = ["#eef4fc", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
  const RAMPA_ESCURA = ["#1a2431", "#15345b", "#184f95", "#1c5cab", "#2a78d6", "#5598e7", "#86b6ef", "#cde2fb"];
  const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  function rampa(t) {
    const st = escuro() ? RAMPA_ESCURA : RAMPA_CLARA;
    t = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
    const x = t * (st.length - 1), i = Math.min(st.length - 2, Math.floor(x)), f = x - i;
    const a = hex2rgb(st[i]), b = hex2rgb(st[i + 1]);
    return a.map((v, k) => Math.round(v + (b[k] - v) * f));
  }
  const rgb = (c) => "rgb(" + c.join(",") + ")";
  function tintaSobre(c) {
    const l = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    const L = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    return L > 0.36 ? "#14201b" : "#ffffff";
  }
  function pintar(elm, t) {
    const c = rampa(t);
    elm.style.background = rgb(c);
    elm.style.color = tintaSobre(c);
  }
  function legendaRampa(alvo, esq, dir) {
    alvo.textContent = "";
    const s1 = document.createElement("span"); s1.textContent = esq;
    const barra = document.createElement("span"); barra.className = "barra";
    const st = escuro() ? RAMPA_ESCURA : RAMPA_CLARA;
    barra.style.background = "linear-gradient(90deg," + st.join(",") + ")";
    const s2 = document.createElement("span"); s2.textContent = dir;
    alvo.append(s1, barra, s2);
  }

  /* ---------------- svg e tooltip ---------------- */
  const NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, pai) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
    if (pai) pai.appendChild(e);
    return e;
  }
  function txt(pai, x, y, s, attrs) {
    const t = el("text", Object.assign({ x, y }, attrs || {}), pai);
    t.textContent = s;
    return t;
  }
  function limpar(svg, W, H, minW) {
    svg.textContent = "";
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.style.minWidth = minW ? minW + "px" : "";
    return svg;
  }

  const tipEl = $("tip");
  function mostrarTip(ev, titulo, linhas, rodape) {
    tipEl.textContent = "";
    const t = document.createElement("div"); t.className = "t"; t.textContent = titulo; tipEl.appendChild(t);
    for (const [k, v] of linhas) {
      const r = document.createElement("div"); r.className = "r";
      const a = document.createElement("span"); a.textContent = k;
      const b = document.createElement("b"); b.textContent = v;
      r.append(a, b); tipEl.appendChild(r);
    }
    if (rodape) {
      const f = document.createElement("div"); f.style.marginTop = "6px"; f.style.color = "var(--ink-3)"; f.textContent = rodape;
      tipEl.appendChild(f);
    }
    tipEl.hidden = false;
    posTip(ev);
  }
  function posTip(ev) {
    let x, y;
    if (ev && ev.clientX !== undefined && !(ev.type === "focus" || ev.type === "focusin")) { x = ev.clientX; y = ev.clientY; }
    else if (ev && ev.target && ev.target.getBoundingClientRect) {
      const b = ev.target.getBoundingClientRect(); x = b.left + b.width / 2; y = b.bottom;
    } else return;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let left = x + 14, top = y + 14;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top + h > window.innerHeight - 8) top = y - h - 14;
    tipEl.style.left = Math.max(8, left) + "px";
    tipEl.style.top = Math.max(8, top) + "px";
  }
  const esconderTip = () => { tipEl.hidden = true; };
  function ligarTip(alvo, fn) {
    alvo.addEventListener("pointermove", (ev) => { fn(ev); });
    alvo.addEventListener("pointerleave", esconderTip);
    alvo.addEventListener("focus", (ev) => fn(ev));
    alvo.addEventListener("blur", esconderTip);
  }

  /* ---------------- controles ---------------- */
  function montarCidades() {
    const sel = $("sel-cidade");
    sel.textContent = "";
    for (const id of ordemCidades) {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = cidades[id].nome + (cidades[id].uf ? " (" + cidades[id].uf + ")" : "") + (cidades[id].enviada ? " · enviada" : "");
      sel.appendChild(o);
    }
    sel.value = state.cidade;
  }

  function presetsDe(c) {
    const ps = [];
    if (c.id === "belem") {
      ps.push(["2025 · artigo", [2025]]);
      ps.push(["2023–2026 · histórico", [2023, 2024, 2025, 2026]]);
    } else {
      const ult = c.completos[c.completos.length - 1];
      if (ult) ps.push([String(ult), [ult]]);
      const rec = c.anos.filter((a) => a >= 2023);
      if (rec.length > 1) ps.push([textoPeriodo(rec), rec]);
    }
    if (c.anos.length > 1) ps.push(["Todos os anos", c.anos.slice()]);
    return ps;
  }

  function montarAnos() {
    const c = cidades[state.cidade];
    const box = $("anos");
    box.textContent = "";
    const todos = [];
    for (const id of ordemCidades) for (const a of cidades[id].anos) if (!todos.includes(a)) todos.push(a);
    todos.sort((a, b) => a - b);
    for (const a of todos) {
      const b = document.createElement("button");
      b.className = "chip"; b.type = "button"; b.textContent = a;
      const tem = c.anos.includes(a);
      b.disabled = !tem;
      b.setAttribute("aria-pressed", state.anos.includes(a) ? "true" : "false");
      if (tem && !c.completos.includes(a)) b.title = "Ano incompleto: faltam semanas de alguns meses";
      b.addEventListener("click", () => {
        if (state.anos.includes(a)) {
          if (state.anos.length === 1) return;
          state.anos = state.anos.filter((x) => x !== a);
        } else state.anos = state.anos.concat(a).sort((x, y) => x - y);
        atualizar();
      });
      box.appendChild(b);
    }
    const pr = $("presets");
    pr.textContent = "";
    for (const [rot, anos] of presetsDe(c)) {
      const b = document.createElement("button");
      b.className = "chip"; b.type = "button"; b.textContent = rot;
      b.setAttribute("aria-pressed", mesmoConj(anos, state.anos) ? "true" : "false");
      b.addEventListener("click", () => { state.anos = anos.slice(); atualizar(); });
      pr.appendChild(b);
    }
  }

  function montarSliders() {
    const sp = $("sl-pesos");
    sp.textContent = "";
    CRIT.forEach((c, j) => {
      const d = document.createElement("div"); d.className = "slider";
      const l = document.createElement("label"); l.htmlFor = "peso-" + c; l.textContent = ROT_CURTO[c];
      const i = document.createElement("input"); i.type = "range"; i.id = "peso-" + c; i.min = 0; i.max = 1; i.step = 0.05;
      i.value = state.pesos[j];
      const o = document.createElement("output"); o.htmlFor = i.id; o.textContent = fmt(state.pesos[j], 2);
      i.addEventListener("input", () => {
        const v = Number(i.value);
        const resto = state.pesos.reduce((s, w, k) => (k === j ? s : s + w), 0);
        state.pesos[j] = resto + v > 0 ? v : 0.05;
        i.value = state.pesos[j];
        o.textContent = fmt(state.pesos[j], 2);
        atualizar(true);
      });
      d.append(l, i, o); sp.appendChild(d);
    });
    const sl = $("sl-limiares");
    sl.textContent = "";
    const nomes = { q: "q · indiferença", p: "p · preferência", v: "v · veto" };
    for (const k of ["q", "p", "v"]) {
      const d = document.createElement("div"); d.className = "slider";
      const l = document.createElement("label"); l.htmlFor = "lim-" + k; l.textContent = nomes[k];
      const i = document.createElement("input"); i.type = "range"; i.id = "lim-" + k; i.min = 0; i.max = 1; i.step = 0.05;
      i.value = state.fr[k];
      const o = document.createElement("output"); o.htmlFor = i.id; o.textContent = Math.round(state.fr[k] * 100) + " %";
      i.addEventListener("input", () => {
        let v = Number(i.value);
        if (k === "q") v = Math.min(v, state.fr.p);
        if (k === "p") v = Math.min(Math.max(v, state.fr.q), state.fr.v);
        if (k === "v") v = Math.max(v, state.fr.p);
        state.fr[k] = v; i.value = v;
        o.textContent = Math.round(v * 100) + " %";
        atualizar(true);
      });
      d.append(l, i, o); sl.appendChild(d);
    }
    atualizarSomaPesos();
  }
  function atualizarSomaPesos() {
    const s = state.pesos.reduce((a, b) => a + b, 0);
    $("soma-pesos").textContent = "soma " + fmt(s, 2);
  }

  $("btn-ajustes").addEventListener("click", () => {
    const p = $("painel-ajustes");
    p.hidden = !p.hidden;
    $("btn-ajustes").setAttribute("aria-expanded", p.hidden ? "false" : "true");
  });
  $("btn-artigo").addEventListener("click", () => {
    state.pesos = PADRAO.pesos.slice();
    state.fr = Object.assign({}, PADRAO.fr);
    montarSliders();
    atualizar();
  });
  $("sel-cidade").addEventListener("change", (ev) => {
    state.cidade = ev.target.value;
    const c = cidades[state.cidade];
    let anos = state.anos.filter((a) => c.anos.includes(a));
    if (!anos.length) anos = [c.completos[c.completos.length - 1] || c.anos[c.anos.length - 1]];
    state.anos = anos;
    state.par = null;
    atualizar();
  });

  function alternador(id, chave) {
    const box = $(id);
    box.textContent = "";
    for (const m of ["iii", "iv"]) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-pressed", state[chave] === m ? "true" : "false");
      const k = document.createElement("span"); k.className = "chave"; k.style.background = COR_MET[m];
      b.append(k, document.createTextNode(METODOS[m]));
      b.addEventListener("click", () => { state[chave] = m; atualizar(true); });
      box.appendChild(b);
    }
  }

  /* ---------------- cabeçalho e resumo ---------------- */
  function renderCabecalho(res) {
    const c = cidades[state.cidade];
    const h = $("titulo");
    h.textContent = "Em quais meses priorizar o combate à dengue em ";
    const s = document.createElement("span"); s.className = "cidade-destaque"; s.textContent = c.nome;
    h.append(s, document.createTextNode("?"));
    const n = res.ag ? res.ag.usadas.length : 0;
    $("lede").textContent = n
      ? "Média semanal de " + n + " semanas epidemiológicas (" + textoPeriodo(res.anos) + ") em quatro critérios: casos estimados, Rt, umidade e temperatura. O ELECTRE III pondera os critérios; o ELECTRE IV não usa pesos."
      : "";
    const selo = $("selo");
    selo.textContent = "";
    const b = document.createElement("span");
    const padrao = ehPadrao();
    let texto, ok = true;
    if (padrao && state.cidade === "belem" && mesmoConj(state.anos, [2025])) texto = "Configuração do artigo · mesmos resultados dos scripts Python";
    else if (padrao && state.cidade === "belem" && mesmoConj(state.anos, [2023, 2024, 2025, 2026])) texto = "Configuração da proposta 2027 (série histórica) · mesmos resultados dos scripts";
    else if (padrao) texto = "Pesos e limiares do artigo aplicados a outro recorte";
    else { texto = "Pesos ou limiares alterados em relação ao artigo"; ok = false; }
    b.className = "badge" + (ok ? "" : " off");
    const ic = el("svg", { viewBox: "0 0 16 16", "aria-hidden": "true" });
    if (ok) el("path", { d: "M3 8.5l3 3 7-7", stroke: "currentColor", "stroke-width": 2, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, ic);
    else { el("circle", { cx: 8, cy: 8, r: 6, stroke: "currentColor", "stroke-width": 1.6, fill: "none" }, ic); el("path", { d: "M8 4.8v3.6M8 10.6v.6", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round" }, ic); }
    b.append(ic, document.createTextNode(texto));
    selo.appendChild(b);
  }

  function nomesNaPosicao(r, m, p) { return r[m].ordem.filter((i) => r[m].posicao[i] === p).map((i) => MESES[i]); }

  function renderResumo(res) {
    const r = res.r;
    const box = $("resumo");
    box.textContent = "";
    const c = cidades[state.cidade];
    const p1 = nomesNaPosicao(r, "iii", 1), p1v = nomesNaPosicao(r, "iv", 1);
    $("txt-resumo").textContent =
      "Em " + c.nome + (res.anos.length === 1 ? ", em " : ", no período ") + textoPeriodo(res.anos) + ", o ELECTRE III coloca " + lista(p1) + " em primeiro" +
      (mesmoConj(p1, p1v) ? ", e o ELECTRE IV concorda." : "; o ELECTRE IV coloca " + lista(p1v) + ".");

    for (const m of ["iii", "iv"]) {
      const card = document.createElement("div"); card.className = "metodo-card";
      const h = document.createElement("h3");
      const k = document.createElement("span"); k.className = "chave"; k.style.background = COR_MET[m];
      h.append(k, document.createTextNode(METODOS[m] + (m === "iii" ? " · com pesos" : " · sem pesos")));
      const ul = document.createElement("ol"); ul.className = "top-lista";
      const topo = r[m].ordem.filter((i) => r[m].posicao[i] <= 3);
      let ultimaPos = null;
      for (const i of topo) {
        const li = document.createElement("li");
        const a = document.createElement("span"); a.className = "pos";
        a.textContent = r[m].posicao[i] === ultimaPos ? "" : r[m].posicao[i] + "º";
        ultimaPos = r[m].posicao[i];
        const b = document.createElement("span"); b.className = "mes"; b.textContent = MESES[i];
        const d = document.createElement("span"); d.className = "rk";
        d.textContent = "desc " + r[m].ranksDesc[i] + " · asc " + r[m].ranksAsc[i];
        li.append(a, b, d); ul.appendChild(li);
      }
      const ult = Math.max(...r[m].posicao);
      const fim = document.createElement("p"); fim.className = "small muted";
      fim.textContent = "Último lugar: " + lista(nomesNaPosicao(r, m, ult)) + ".";
      card.append(h, ul, fim);
      box.appendChild(card);
    }
    const ambos = MESES.map((_, i) => i).filter((i) => r.iii.posicao[i] <= 3 && r.iv.posicao[i] <= 3);
    const cons = document.createElement("div"); cons.className = "consenso";
    const ey = document.createElement("span"); ey.className = "eyebrow"; ey.textContent = "Nos dois métodos";
    const st = document.createElement("strong");
    const exp = document.createElement("p"); exp.className = "small";
    if (ambos.length) {
      st.textContent = lista(ambos.map((i) => MESES[i]));
      exp.textContent = "Ficam entre as três primeiras posições com e sem pesos. É a conclusão mais robusta deste recorte.";
    } else {
      st.textContent = "Sem consenso no topo";
      exp.textContent = "Nenhum mês fica entre as três primeiras posições nos dois métodos. A prioridade depende de como os critérios são ponderados.";
    }
    cons.append(ey, st, exp);
    box.appendChild(cons);
  }

  function renderAvisos(res) {
    const box = $("aviso-dados");
    box.textContent = "";
    if (!res.ag || res.anos.length < 2) return;
    const faltas = [];
    res.ag.metas.forEach((mt, i) => {
      const sem = res.anos.filter((a) => !mt.anos.includes(a));
      if (sem.length) faltas.push(MESES[i] + " (sem " + lista(sem.map(String)) + ")");
    });
    if (!faltas.length) return;
    box.appendChild(alerta("Nem todos os meses têm os mesmos anos: " + lista(faltas) + ". Esses meses entram pela média dos anos que existem.", false));
  }

  function alerta(texto, erro) {
    const d = document.createElement("div"); d.className = "alerta" + (erro ? " erro" : "");
    const ic = el("svg", { viewBox: "0 0 16 16", "aria-hidden": "true" });
    el("circle", { cx: 8, cy: 8, r: 6.5, fill: "none", stroke: erro ? "var(--critical)" : "var(--ink-3)", "stroke-width": 1.5 }, ic);
    el("path", { d: "M8 4.5v4.2M8 10.8v.5", stroke: erro ? "var(--critical)" : "var(--ink-3)", "stroke-width": 1.8, "stroke-linecap": "round" }, ic);
    const p = document.createElement("p"); p.textContent = texto;
    d.append(ic, p);
    return d;
  }

  /* ---------------- slope III x IV ---------------- */
  function renderSlope(res) {
    const r = res.r;
    const W = 660, rowH = 30, top = 44, H = top + 12 * rowH + 6;
    const svg = limpar($("slope"), W, H, 520);
    const xL = 230, xR = 430;
    const yDe = (m, i) => top + r[m].ordem.indexOf(i) * rowH;
    // cabeçalhos
    for (const [m, x, anc] of [["iii", xL, "end"], ["iv", xR, "start"]]) {
      el("line", { x1: anc === "end" ? x - 92 : x, x2: anc === "end" ? x - 74 : x + 18, y1: 15, y2: 15, stroke: COR_MET[m], "stroke-width": 3, "stroke-linecap": "round" }, svg);
      txt(svg, anc === "end" ? x - 68 : x + 24, 20, METODOS[m], { "font-size": 14, "font-weight": 600, style: "fill:var(--ink)" });
    }
    txt(svg, 48, 20, "pos.", { "font-size": 11, class: "rot-mono", "text-anchor": "middle" });
    txt(svg, W - 40, 20, "pos.", { "font-size": 11, class: "rot-mono", "text-anchor": "middle" });
    el("line", { x1: 20, x2: W - 20, y1: 30, y2: 30, class: "eixo" }, svg);

    // números de posição com colchete para empates
    for (const [m, xNum, xCol] of [["iii", 48, 66], ["iv", W - 40, W - 58]]) {
      const grupos = {};
      r[m].ordem.forEach((i, idx) => { (grupos[r[m].posicao[i]] = grupos[r[m].posicao[i]] || []).push(idx); });
      for (const [p, idxs] of Object.entries(grupos)) {
        const y0 = top + idxs[0] * rowH, y1 = top + idxs[idxs.length - 1] * rowH;
        txt(svg, xNum, y0 + 4, p + "º", { "font-size": 12, class: "rot-mono", "text-anchor": "middle" });
        if (idxs.length > 1) el("path", { d: `M${xCol} ${y0 - 6} V${y1 + 6}`, stroke: "var(--rule)", "stroke-width": 2, fill: "none", "stroke-linecap": "round" }, svg);
      }
    }

    const consenso = (i) => r.iii.posicao[i] <= 3 && r.iv.posicao[i] <= 3;
    const grupos = [];
    for (let i = 0; i < 12; i++) {
      const g = el("g", { tabindex: 0, class: "anim", role: "img", "aria-label": `${MESES[i]}: ${r.iii.posicao[i]}º no III, ${r.iv.posicao[i]}º no IV` }, svg);
      const y1 = yDe("iii", i), y2 = yDe("iv", i);
      const d = `M${xL} ${y1} C${(xL + xR) / 2} ${y1} ${(xL + xR) / 2} ${y2} ${xR} ${y2}`;
      const forte = consenso(i);
      el("path", { d, stroke: forte ? "var(--accent)" : "var(--ink-3)", "stroke-width": forte ? 2.5 : 1.5, fill: "none", opacity: forte ? 1 : 0.55 }, g);
      el("circle", { cx: xL, cy: y1, r: 5, fill: "var(--s1)", stroke: "var(--surface)", "stroke-width": 2 }, g);
      el("circle", { cx: xR, cy: y2, r: 5, fill: "var(--s2)", stroke: "var(--surface)", "stroke-width": 2 }, g);
      const est = forte ? "fill:var(--ink);font-weight:600" : "fill:var(--ink-2)";
      txt(g, xL - 14, y1 + 4.5, MESES[i], { "font-size": 13.5, "text-anchor": "end", style: est });
      txt(g, xR + 14, y2 + 4.5, MESES[i], { "font-size": 13.5, style: est });
      el("path", { d, stroke: "transparent", "stroke-width": 18, fill: "none" }, g);
      el("rect", { x: 80, y: y1 - rowH / 2, width: xL - 80, height: rowH, fill: "transparent" }, g);
      el("rect", { x: xR, y: y2 - rowH / 2, width: W - 80 - xR, height: rowH, fill: "transparent" }, g);
      grupos.push(g);
      const foco = (ev) => {
        grupos.forEach((o, k) => { o.style.opacity = k === i ? 1 : 0.18; });
        mostrarTip(ev, MESES[i], [
          ["ELECTRE III", r.iii.posicao[i] + "º (desc " + r.iii.ranksDesc[i] + ", asc " + r.iii.ranksAsc[i] + ")"],
          ["ELECTRE IV", r.iv.posicao[i] + "º (desc " + r.iv.ranksDesc[i] + ", asc " + r.iv.ranksAsc[i] + ")"],
        ]);
      };
      g.addEventListener("pointermove", foco);
      g.addEventListener("focus", foco);
      const sair = () => { grupos.forEach((o) => { o.style.opacity = 1; }); esconderTip(); };
      g.addEventListener("pointerleave", sair);
      g.addEventListener("blur", sair);
    }
  }

  /* ---------------- matriz de decisão ---------------- */
  function renderMatriz(res) {
    const M = res.ag.matriz, lim = res.r.lim;
    const t = $("matriz");
    t.textContent = "";
    const thead = t.createTHead(), hr = thead.insertRow();
    hr.appendChild(document.createElement("th"));
    CRIT.forEach((c, j) => {
      const th = document.createElement("th"); th.className = "col"; th.scope = "col";
      th.append(document.createTextNode(ROT[c] + (UNID[c] ? " (" + UNID[c].trim() + ")" : "")));
      const pw = document.createElement("span"); pw.className = "peso";
      const W = state.pesos.reduce((a, b) => a + b, 0);
      pw.textContent = "peso " + fmt(state.pesos[j] / W, 2);
      const lm = document.createElement("span"); lm.className = "peso";
      lm.textContent = "q " + fmt(lim.q[j], CASAS[c]) + " · p " + fmt(lim.p[j], CASAS[c]) + " · v " + fmt(lim.v[j], CASAS[c]);
      th.append(pw, lm); hr.appendChild(th);
    });
    const ths = document.createElement("th"); ths.className = "col"; ths.scope = "col"; ths.textContent = "Semanas";
    hr.appendChild(ths);
    const cols = CRIT.map((_, j) => M.map((l) => l[j]));
    const mins = cols.map((c) => Math.min(...c)), maxs = cols.map((c) => Math.max(...c));
    const tb = t.createTBody();
    M.forEach((linha, i) => {
      const tr = tb.insertRow();
      const th = document.createElement("th"); th.className = "lin"; th.scope = "row"; th.textContent = MESES[i];
      tr.appendChild(th);
      linha.forEach((v, j) => {
        const td = tr.insertCell();
        td.textContent = fmt(v, CASAS[CRIT[j]]);
        const tt = maxs[j] > mins[j] ? (v - mins[j]) / (maxs[j] - mins[j]) : 0.5;
        pintar(td, tt);
        if (v === maxs[j]) td.classList.add("maxcol");
        td.tabIndex = 0;
        const ordem = cols[j].slice().sort((a, b) => b - a).indexOf(v) + 1;
        ligarTip(td, (ev) => mostrarTip(ev, MESES[i] + " · " + ROT[CRIT[j]], [
          ["Média semanal", fmtV(CRIT[j], v)],
          ["Posição no critério", ordem + "º de 12"],
          ["Semanas na média", String(res.ag.metas[i].semanas - res.ag.metas[i].ausentes[j])],
        ]));
      });
      const td = tr.insertCell(); td.className = "sem";
      const mt = res.ag.metas[i];
      td.textContent = mt.semanas + (res.anos.length > 1 ? " · " + mt.anos.map((a) => String(a).slice(2)).join(" ") : "");
    });
    legendaRampa($("leg-matriz"), "menor do critério", "maior do critério");
  }

  /* ---------------- séries semanais ---------------- */
  function renderSeries(res) {
    const sem = cidades[state.cidade].ordenadas.filter((s) => res.anos.includes(s.ano));
    const W = 1000, L = 128, R = 16, top = 8, pH = 70, gap = 18, rodape = 26;
    const H = top + CRIT.length * (pH + gap) + rodape;
    const svg = limpar($("series"), W, H, 680);
    if (!sem.length) return;
    const ts = sem.map((s) => Date.parse(s.data));
    const t0 = ts[0], t1 = ts[ts.length - 1] || t0 + 1;
    const X = (t) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
    // viradas de ano / mês
    const umAno = res.anos.length === 1;
    const marcas = [];
    sem.forEach((s, k) => {
      const ant = sem[k - 1];
      if (umAno) { if (!ant || ant.mes !== s.mes) marcas.push([X(ts[k]), ABR[s.mes - 1]]); }
      else if (!ant || ant.ano !== s.ano) marcas.push([X(ts[k]), String(s.ano)]);
    });
    const baseY = top + CRIT.length * (pH + gap) - gap;
    for (const [x, rot] of marcas) {
      el("line", { x1: x, x2: x, y1: top, y2: baseY, class: "grade" }, svg);
      txt(svg, x + 4, baseY + 17, rot, { "font-size": 12, class: "rot-mono" });
    }
    const paineis = [];
    CRIT.forEach((c, j) => {
      const y0 = top + j * (pH + gap);
      const vals = sem.map((s) => s[c]).filter(Number.isFinite);
      let lo = Math.min(...vals), hi = Math.max(...vals);
      if (hi === lo) { hi += 1; lo -= 1; }
      const pad = (hi - lo) * 0.08;
      lo -= pad; hi += pad;
      const Y = (v) => y0 + pH - ((v - lo) / (hi - lo)) * pH;
      el("line", { x1: L, x2: W - R, y1: y0 + pH, y2: y0 + pH, class: "eixo" }, svg);
      txt(svg, 0, y0 + 14, ROT_CURTO[c] + (UNID[c] ? " (" + UNID[c].trim() + ")" : ""), { "font-size": 13, "font-weight": 600, style: "fill:var(--ink)" });
      const vmax = Math.max(...vals), vmin = Math.min(...vals);
      txt(svg, 0, y0 + 32, "máx " + fmt(vmax, CASAS[c]), { "font-size": 11.5, class: "rot-mono" });
      txt(svg, 0, y0 + 48, "mín " + fmt(vmin, CASAS[c]), { "font-size": 11.5, class: "rot-mono" });
      if (c === "Rt" && lo < 1 && hi > 1) {
        el("line", { x1: L, x2: W - R, y1: Y(1), y2: Y(1), stroke: "var(--ink-3)", "stroke-width": 1, opacity: 0.6 }, svg);
        txt(svg, L - 6, Y(1) + 4, "Rt = 1", { "font-size": 11, class: "rot-mono", "text-anchor": "end" });
      }
      let d = "", aberto = false;
      sem.forEach((s, k) => {
        const v = s[c];
        if (!Number.isFinite(v)) { aberto = false; return; }
        d += (aberto ? "L" : "M") + X(ts[k]).toFixed(1) + " " + Y(v).toFixed(1) + " ";
        aberto = true;
      });
      el("path", { d, fill: "none", stroke: "var(--s1)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
      paineis.push({ c, Y });
    });
    // crosshair
    const cruz = el("g", { style: "pointer-events:none", visibility: "hidden" }, svg);
    const linha = el("line", { y1: top, y2: baseY, stroke: "var(--ink-2)", "stroke-width": 1 }, cruz);
    const pts = paineis.map(() => el("circle", { r: 4.5, fill: "var(--s1)", stroke: "var(--surface)", "stroke-width": 2 }, cruz));
    const hit = el("rect", { x: L, y: top, width: W - L - R, height: baseY - top, fill: "transparent", tabindex: 0, "aria-label": "Explorar semanas" }, svg);
    let foco = sem.length - 1;
    const mostrar = (k, ev) => {
      const s = sem[k], x = X(ts[k]);
      cruz.setAttribute("visibility", "visible");
      linha.setAttribute("x1", x); linha.setAttribute("x2", x);
      paineis.forEach((p, j) => {
        const v = s[p.c];
        pts[j].setAttribute("cx", x); pts[j].setAttribute("cy", Number.isFinite(v) ? p.Y(v) : -50);
      });
      const [a, m, d] = s.data.split("-");
      mostrarTip(ev, "SE " + s.se + " · início " + d + "/" + m + "/" + a, [
        ["Casos estimados", fmt(s.casos_est, 0)],
        ["Rt", fmt(s.Rt, 2)],
        ["Umidade média", fmtV("umidmed", s.umidmed)],
        ["Temperatura média", fmtV("tempmed", s.tempmed)],
      ], "Entra na média de " + MESES[s.mes - 1].toLowerCase() + (res.anos.length > 1 ? " (ano " + s.ano + ")" : ""));
    };
    hit.addEventListener("pointermove", (ev) => {
      const b = svg.getBoundingClientRect();
      const x = ((ev.clientX - b.left) / b.width) * W;
      const t = t0 + ((x - L) / (W - L - R)) * (t1 - t0);
      let k = 0, best = Infinity;
      ts.forEach((tt, i) => { const dd = Math.abs(tt - t); if (dd < best) { best = dd; k = i; } });
      foco = k; mostrar(k, ev);
    });
    hit.addEventListener("pointerleave", () => { cruz.setAttribute("visibility", "hidden"); esconderTip(); });
    hit.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
        ev.preventDefault();
        foco = Math.max(0, Math.min(sem.length - 1, foco + (ev.key === "ArrowLeft" ? -1 : 1)));
        mostrar(foco, { target: hit, type: "focus" });
      }
    });
    hit.addEventListener("focus", () => mostrar(foco, { target: hit, type: "focus" }));
    hit.addEventListener("blur", () => { cruz.setAttribute("visibility", "hidden"); esconderTip(); });
  }

  /* ---------------- destilações (halteres) ---------------- */
  function renderHalteres(res, m) {
    const r = res.r[m];
    const k = Math.max(...r.ranksDesc, ...r.ranksAsc);
    const W = 470, L = 96, R = 22, top = 34, rowH = 25;
    const H = top + 12 * rowH + 4;
    const svg = limpar($("dumb-" + m), W, H, 380);
    const X = (c) => L + (k === 1 ? 0.5 : (c - 1) / (k - 1)) * (W - L - R);
    for (let c = 1; c <= k; c++) {
      el("line", { x1: X(c), x2: X(c), y1: top - 10, y2: H - 4, class: "grade" }, svg);
      txt(svg, X(c), top - 16, String(c), { "font-size": 11.5, class: "rot-mono", "text-anchor": "middle" });
    }
    txt(svg, L - 10, top - 16, "classe →", { "font-size": 11, class: "rot-mono", "text-anchor": "end" });
    const gapLim = Math.max(2, Math.ceil(k / 3));
    r.ordem.forEach((i, idx) => {
      const y = top + idx * rowH + rowH / 2 - 4;
      const d = r.ranksDesc[i], a = r.ranksAsc[i];
      const longe = Math.abs(d - a) >= gapLim;
      const g = el("g", { tabindex: 0, role: "img", "aria-label": `${MESES[i]}: descendente ${d}, ascendente ${a}` }, svg);
      el("rect", { x: 0, y: y - rowH / 2, width: W, height: rowH, fill: "transparent" }, g);
      txt(g, L - 10, y + 4.5, MESES[i], { "font-size": 13, "text-anchor": "end", style: longe ? "fill:var(--ink);font-weight:600" : "fill:var(--ink-2)" });
      if (d !== a) el("line", { x1: X(d), x2: X(a), y1: y, y2: y, stroke: longe ? "var(--ink-2)" : "var(--ink-3)", "stroke-width": 2, "stroke-linecap": "round" }, g);
      el("circle", { cx: X(a), cy: y, r: 5.5, fill: "var(--surface)", stroke: COR_MET[m], "stroke-width": 2 }, g);
      el("circle", { cx: X(d), cy: y, r: d === a ? 3 : 5.5, fill: COR_MET[m], stroke: d === a ? "none" : "var(--surface)", "stroke-width": 2 }, g);
      const incomp = MESES.map((_, j) => j).filter((j) => r.relacao[i][j] === "R").map((j) => ABR[j]);
      ligarTip(g, (ev) => mostrarTip(ev, MESES[i] + " · " + METODOS[m], [
        ["Destilação descendente", "classe " + d],
        ["Destilação ascendente", "classe " + a],
        ["Posição de compromisso", r.posicao[i] + "º"],
      ], incomp.length ? "Incomparável com: " + incomp.join(", ") : "Comparável com todos os meses"));
    });
  }

  /* ---------------- credibilidade ---------------- */
  function temVeto(r, m, i, k) {
    if (i === k) return false;
    if (m === "iii") return r.iii.dj[i][k].some((d) => d >= 1);
    return r.iv.situ[i][k].includes("V-");
  }
  function renderSigma(res) {
    const r = res.r, m = state.metSigma, S = r[m].sigma;
    if (!state.par) {
      const o = r.iii.ordem;
      state.par = [o[0], o[1]];
    }
    const t = $("sigma");
    t.textContent = "";
    const hr = t.createTHead().insertRow();
    const c0 = document.createElement("th");
    c0.innerHTML = "<span class='mono' style='font-size:.68rem'>a \\ b</span>";
    hr.appendChild(c0);
    ABR.forEach((a) => { const th = document.createElement("th"); th.scope = "col"; th.textContent = a; hr.appendChild(th); });
    const tb = t.createTBody();
    for (let i = 0; i < 12; i++) {
      const tr = tb.insertRow();
      const th = document.createElement("th"); th.className = "lin"; th.scope = "row"; th.textContent = ABR[i];
      tr.appendChild(th);
      for (let k = 0; k < 12; k++) {
        const td = tr.insertCell();
        const b = document.createElement("button"); b.type = "button";
        if (i === k) { b.className = "diag"; b.textContent = "—"; b.tabIndex = -1; b.setAttribute("aria-hidden", "true"); td.appendChild(b); continue; }
        const v = S[i][k];
        pintar(b, v);
        b.textContent = v === 0 ? "0" : fmt(v, 2).replace(/^0/, "");
        if (temVeto(r, m, i, k)) {
          const x = document.createElement("span"); x.className = "veto"; x.textContent = "×"; x.setAttribute("aria-hidden", "true");
          b.appendChild(x);
        }
        if (state.par[0] === i && state.par[1] === k) b.classList.add("sel");
        b.setAttribute("aria-label", `σ(${MESES[i]}, ${MESES[k]}) = ${fmt(v, 2)}${temVeto(r, m, i, k) ? ", com veto" : ""}`);
        ligarTip(b, (ev) => mostrarTip(ev, MESES[i] + " sobre " + MESES[k], [
          ["σ(a, b) " + METODOS[m], fmt(v, 2)],
          [m === "iii" ? "Concordância C(a, b)" : "Relação", m === "iii" ? fmt(r.iii.C[i][k], 2) : (r.iv.rotulo[i][k] === "-" ? "nenhuma" : r.iv.rotulo[i][k])],
        ], temVeto(r, m, i, k) ? "Há veto. Clique para ver o critério." : "Clique para ver a conta."));
        b.addEventListener("click", () => { state.par = [i, k]; renderSigma(res); });
        td.appendChild(b);
      }
    }
    legendaRampa($("leg-sigma"), "σ = 0", "σ = 1");
    renderPar(res);
  }

  function renderPar(res) {
    const r = res.r, M = res.ag.matriz, lim = r.lim;
    const [i, k] = state.par;
    const box = $("par");
    box.textContent = "";
    const h = document.createElement("h3"); h.textContent = MESES[i] + " × " + MESES[k];
    const sub = document.createElement("p"); sub.className = "small muted";
    sub.textContent = "a = " + MESES[i] + ", b = " + MESES[k] + ". Diferença b − a: positiva quando b tem valor maior.";
    const tw = document.createElement("div"); tw.className = "rolagem";
    const t = document.createElement("table");
    const hr = t.createTHead().insertRow();
    for (const s of ["Critério", "a", "b", "b − a", "c", "d", "IV"]) { const th = document.createElement("th"); th.textContent = s; hr.appendChild(th); }
    const tb = t.createTBody();
    CRIT.forEach((c, j) => {
      const tr = tb.insertRow();
      const dif = M[k][j] - M[i][j];
      const cj = r.iii.cj[i][k][j], dj = r.iii.dj[i][k][j], sit = r.iv.situ[i][k][j];
      const cel = (s, cls) => { const td = tr.insertCell(); td.textContent = s; if (cls) td.className = cls; return td; };
      const tdc = cel(ROT_CURTO[c]);
      tdc.title = "q " + fmt(lim.q[j], CASAS[c]) + " · p " + fmt(lim.p[j], CASAS[c]) + " · v " + fmt(lim.v[j], CASAS[c]);
      cel(fmt(M[i][j], CASAS[c])); cel(fmt(M[k][j], CASAS[c]));
      cel(minus((dif > 0 ? "+" : "") + fmt(dif, CASAS[c])));
      cel(fmt(cj, 2)); cel(fmt(dj, 2), dj >= 1 ? "vt" : "");
      const td = tr.insertCell(); const sp = document.createElement("span");
      sp.className = "sit" + (sit === "V-" || sit === "P-" ? " neg" : ""); sp.textContent = minus(sit); sp.title = SIT[sit];
      td.appendChild(sp);
    });
    tw.appendChild(t);
    const resd = document.createElement("div"); resd.className = "resultado-par";
    const bloco = (rot, val, det) => {
      const d = document.createElement("div");
      const s = document.createElement("span"); s.className = "small muted"; s.textContent = rot;
      const b = document.createElement("b"); b.textContent = val;
      const p = document.createElement("span"); p.className = "small muted"; p.textContent = det;
      d.append(s, b, p); return d;
    };
    const rot4 = (a, b) => (r.iv.rotulo[a][b] === "-" ? "sem relação" : "relação " + r.iv.rotulo[a][b]);
    resd.append(
      bloco("ELECTRE III · σ(a, b)", fmt(r.iii.sigma[i][k], 2), "C = " + fmt(r.iii.C[i][k], 2) + " · σ(b, a) = " + fmt(r.iii.sigma[k][i], 2)),
      bloco("ELECTRE IV · σ(a, b)", fmt(r.iv.sigma[i][k], 2), rot4(i, k) + " · σ(b, a) = " + fmt(r.iv.sigma[k][i], 2))
    );
    const expl = document.createElement("p"); expl.className = "small";
    const vetos = CRIT.filter((_, j) => r.iii.dj[i][k][j] >= 1).map((c) => ROT_CURTO[c].toLowerCase());
    const final = r.iii.relacao[i][k];
    const relTxt = { P: "a é preferido a b", p: "b é preferido a a", I: "a e b são indiferentes", R: "a e b são incomparáveis" };
    expl.textContent =
      (vetos.length ? "Veto em " + lista(vetos) + ": b supera a por mais que v, e a credibilidade de “a sobreclassifica b” cai a zero. " : "") +
      "Na pré-ordem final do III, " + relTxt[final] + "; no IV, " + relTxt[r.iv.relacao[i][k]] + ".";
    const inv = document.createElement("button"); inv.className = "btn"; inv.type = "button"; inv.textContent = "Inverter o par (b × a)";
    inv.addEventListener("click", () => { state.par = [k, i]; renderSigma(res); });
    const leg = document.createElement("p"); leg.className = "small muted";
    leg.textContent = "c = concordância parcial, d = discordância parcial (ELECTRE III). IV = situação de a frente a b: P+ / Q+ a melhor, I indiferente, Q− / P− b melhor, V− veto de b.";
    box.append(h, sub, tw, resd, expl, leg, inv);
  }

  /* ---------------- grafo da pré-ordem ---------------- */
  function renderGrafo(res) {
    const m = state.metGrafo, r = res.r[m];
    const n = 12, P = (a, b) => r.relacao[a][b] === "P";
    // redução transitiva
    const arestas = [];
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      if (!P(a, b)) continue;
      let via = false;
      for (let c = 0; c < n && !via; c++) if (c !== a && c !== b && P(a, c) && P(c, b)) via = true;
      if (!via) arestas.push([a, b]);
    }
    const K = Math.max(...r.posicao);
    const colunas = {};
    r.ordem.forEach((i) => { (colunas[r.posicao[i]] = colunas[r.posicao[i]] || []).push(i); });
    const maxCol = Math.max(...Object.values(colunas).map((c) => c.length));
    const nw = 84, nh = 28, colW = 128, rowGap = 44, L = 18, top = 30;
    const W = L * 2 + (K - 1) * colW + nw;
    const H = top + maxCol * rowGap + 10;
    const svg = limpar($("grafo"), W, H, Math.min(W, 560));
    const defs = el("defs", null, svg);
    const mk = el("marker", { id: "seta", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0 0 L10 5 L0 10 z", fill: "var(--ink-3)" }, mk);
    const mk2 = el("marker", { id: "seta-on", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0 0 L10 5 L0 10 z", fill: "var(--accent)" }, mk2);
    const pos = {};
    for (const [p, ids] of Object.entries(colunas)) {
      const x = L + (p - 1) * colW;
      const h0 = top + ((maxCol - ids.length) * rowGap) / 2;
      ids.forEach((i, idx) => { pos[i] = { x, y: h0 + idx * rowGap + nh / 2 }; });
      txt(svg, x + nw / 2, 16, p + "º", { "font-size": 12, class: "rot-mono", "text-anchor": "middle" });
    }
    const gA = el("g", null, svg);
    const caminhos = arestas.map(([a, b]) => {
      const p1 = pos[a], p2 = pos[b];
      const x1 = p1.x + nw, x2 = p2.x - 2, mx = (x1 + x2) / 2;
      return { a, b, e: el("path", { d: `M${x1} ${p1.y} C${mx} ${p1.y} ${mx} ${p2.y} ${x2} ${p2.y}`, fill: "none", stroke: "var(--ink-3)", "stroke-width": 1.3, opacity: 0.65, "marker-end": "url(#seta)" }, gA) };
    });
    const nos = {};
    for (let i = 0; i < n; i++) {
      const p = pos[i];
      const g = el("g", { tabindex: 0, role: "img", "aria-label": `${MESES[i]}, ${r.posicao[i]}º lugar` }, svg);
      const rect = el("rect", { x: p.x, y: p.y - nh / 2, width: nw, height: nh, rx: 6, fill: "var(--surface-2)", stroke: "var(--rule)", "stroke-width": 1.2 }, g);
      txt(g, p.x + nw / 2, p.y + 4.5, MESES[i], { "font-size": 12.5, "text-anchor": "middle", style: "fill:var(--ink);font-weight:500" });
      nos[i] = rect;
      const on = (ev) => {
        for (const c of caminhos) {
          const ativo = c.a === i || c.b === i;
          c.e.setAttribute("stroke", ativo ? "var(--accent)" : "var(--ink-3)");
          c.e.setAttribute("opacity", ativo ? 1 : 0.15);
          c.e.setAttribute("stroke-width", ativo ? 2 : 1.3);
          c.e.setAttribute("marker-end", ativo ? "url(#seta-on)" : "url(#seta)");
        }
        for (let j = 0; j < n; j++) {
          const rel = r.relacao[i][j];
          const rc = nos[j];
          rc.setAttribute("fill", j === i ? "var(--accent-soft)" : "var(--surface-2)");
          rc.setAttribute("stroke", j === i ? "var(--accent)" : rel === "R" ? "var(--s2)" : "var(--rule)");
          rc.setAttribute("stroke-width", j === i || rel === "R" ? 2.4 : 1.2);
        }
        const conta = (x) => MESES.map((_, j) => j).filter((j) => r.relacao[i][j] === x).map((j) => ABR[j]);
        const sup = conta("P"), inf = conta("p"), inc = conta("R"), ind = conta("I").filter((x) => x !== ABR[i]);
        mostrarTip(ev, MESES[i] + " · " + r.posicao[i] + "º no " + METODOS[m], [
          ["Preferido a", sup.length ? sup.join(", ") : "nenhum"],
          ["Abaixo de", inf.length ? inf.join(", ") : "nenhum"],
          ["Incomparável com", inc.length ? inc.join(", ") : "nenhum"],
        ].concat(ind.length ? [["Indiferente a", ind.join(", ")]] : []));
      };
      const off = () => {
        for (const c of caminhos) { c.e.setAttribute("stroke", "var(--ink-3)"); c.e.setAttribute("opacity", 0.65); c.e.setAttribute("stroke-width", 1.3); c.e.setAttribute("marker-end", "url(#seta)"); }
        for (let j = 0; j < n; j++) { nos[j].setAttribute("fill", "var(--surface-2)"); nos[j].setAttribute("stroke", "var(--rule)"); nos[j].setAttribute("stroke-width", 1.2); }
        esconderTip();
      };
      g.addEventListener("pointermove", on); g.addEventListener("focus", on);
      g.addEventListener("pointerleave", off); g.addEventListener("blur", off);
    }
    const leg = $("leg-grafo");
    leg.textContent = "";
    const item = (cor, texto, borda) => {
      const s = document.createElement("span");
      const sw = document.createElement("span");
      sw.style.cssText = "width:16px;height:12px;border-radius:3px;display:inline-block;background:var(--surface-2);border:2px solid " + (borda || cor);
      s.append(sw, document.createTextNode(texto)); return s;
    };
    leg.append(item("var(--accent)", "mês em foco"), item("var(--s2)", "incomparável com ele"));
  }

  /* ---------------- calendário por cidade ---------------- */
  function renderCidades() {
    const m = state.metCid;
    const t = $("cal");
    t.textContent = "";
    const hr = t.createTHead().insertRow();
    hr.appendChild(document.createElement("th"));
    ABR.forEach((a) => { const th = document.createElement("th"); th.scope = "col"; th.textContent = a; hr.appendChild(th); });
    const tb = t.createTBody();
    for (const id of ordemCidades) {
      const c = cidades[id];
      const res = calcular(id, state.anos);
      const tr = tb.insertRow();
      const th = document.createElement("th"); th.className = "lin"; th.scope = "row";
      th.append(document.createTextNode(c.nome));
      const sm = document.createElement("small");
      sm.textContent = res.semDados ? "sem dados no período" : textoPeriodo(res.anos) + (res.ag ? " · " + res.ag.usadas.length + " semanas" : "");
      th.appendChild(sm);
      if (id === state.cidade) th.style.color = "var(--accent)";
      tr.appendChild(th);
      if (!res.r) {
        const td = tr.insertCell(); td.colSpan = 12; td.className = "sem";
        td.textContent = res.semDados ? "Nenhum dos anos escolhidos existe para esta cidade." : "Faltam semanas de " + lista(res.faltam.map((x) => x.toLowerCase())) + ".";
        continue;
      }
      const rr = res.r[m];
      const K = Math.max(...rr.posicao);
      for (let i = 0; i < 12; i++) {
        const td = tr.insertCell();
        const p = rr.posicao[i];
        td.textContent = p;
        pintar(td, K > 1 ? 1 - (p - 1) / (K - 1) : 1);
        td.tabIndex = 0;
        const g = res.ag.matriz[i];
        ligarTip(td, (ev) => mostrarTip(ev, c.nome + " · " + MESES[i], [
          [METODOS[m], p + "º de " + K],
          ["Destilações", "desc " + rr.ranksDesc[i] + " · asc " + rr.ranksAsc[i]],
          ["Casos (média sem.)", fmt(g[0], 1)],
          ["Rt", fmt(g[1], 2)],
          ["Umidade", fmtV("umidmed", g[2])],
          ["Temperatura", fmtV("tempmed", g[3])],
        ]));
      }
    }
    legendaRampa($("leg-cidades"), "última posição", "1ª posição");
  }

  /* ---------------- envio de arquivo ---------------- */
  let nEnviadas = 0;
  function lerArquivo(arq) {
    const msg = $("msg-arquivo");
    msg.textContent = "Lendo " + arq.name + "…";
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const texto = String(fr.result);
        let linhas;
        if (/\.json$/i.test(arq.name) || /^\s*[\[{]/.test(texto)) {
          const j = JSON.parse(texto);
          linhas = Array.isArray(j) ? j : Object.values(j).find(Array.isArray) || [];
        } else linhas = E.parseCSV(texto);
        const sem = E.normalizarSemanas(linhas);
        if (!sem.length) throw new Error("Nenhuma semana válida no arquivo.");
        const nome = (linhas[0] && (linhas[0].municipio_nome || linhas[0].municipio)) || arq.name.replace(/\.[^.]+$/, "");
        const id = "env-" + (++nEnviadas);
        adicionarCidade(id, String(nome).slice(0, 60), "", sem, true);
        state.cidade = id;
        const c = cidades[id];
        state.anos = c.completos.length ? [c.completos[c.completos.length - 1]] : c.anos.slice();
        state.par = null;
        const ord = c.ordenadas;
        msg.textContent = "";
        msg.appendChild(alerta(c.nome + " carregada: " + sem.length + " semanas, de SE " + ord[0].se + " a SE " + ord[ord.length - 1].se + ". Escolha os anos na barra do topo.", false));
        montarCidades();
        atualizar();
        document.getElementById("titulo").scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e) {
        msg.textContent = "";
        msg.appendChild(alerta("Não consegui ler " + arq.name + ". " + (e.colunas ? "Faltam as colunas " + e.colunas.join(", ") + ". Use o CSV do endpoint alertcity do InfoDengue." : e.message), true));
      }
    };
    fr.onerror = () => { msg.textContent = ""; msg.appendChild(alerta("O navegador não conseguiu abrir o arquivo.", true)); };
    fr.readAsText(arq, "utf-8");
  }
  $("arquivo").addEventListener("change", (ev) => { if (ev.target.files[0]) lerArquivo(ev.target.files[0]); ev.target.value = ""; });
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (ev) => { ev.preventDefault(); drop.classList.add("ativo"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (ev) => { ev.preventDefault(); drop.classList.remove("ativo"); }));
  drop.addEventListener("drop", (ev) => { const f = ev.dataTransfer && ev.dataTransfer.files[0]; if (f) lerArquivo(f); });

  /* ---------------- link do InfoDengue ---------------- */
  function montarApi() {
    const sel = $("sel-capital");
    for (const [nome, uf, geo] of CAPITAIS) {
      const o = document.createElement("option"); o.value = geo; o.textContent = nome + " (" + uf + ")"; sel.appendChild(o);
    }
    const outro = document.createElement("option"); outro.value = ""; outro.textContent = "Outro município…"; sel.appendChild(outro);
    sel.value = "1501402";
    $("inp-geocode").value = "1501402";
    sel.addEventListener("change", () => { if (sel.value) $("inp-geocode").value = sel.value; else $("inp-geocode").focus(); atualizarApi(); });
    $("inp-geocode").addEventListener("input", () => {
      const g = $("inp-geocode").value.trim();
      sel.value = CAPITAIS.some((c) => c[2] === g) ? g : "";
      atualizarApi();
    });
    $("inp-ano1").addEventListener("input", atualizarApi);
    $("inp-ano2").addEventListener("input", atualizarApi);
    $("btn-copiar").addEventListener("click", () => {
      const u = $("url-api").textContent;
      const ok = () => { $("btn-copiar").textContent = "Endereço copiado"; setTimeout(() => { $("btn-copiar").textContent = "Copiar endereço"; }, 1800); };
      try {
        navigator.clipboard.writeText(u).then(ok, () => selecionar($("url-api")));
      } catch (e) { selecionar($("url-api")); }
    });
    atualizarApi();
  }
  function selecionar(n) { const r = document.createRange(); r.selectNodeContents(n); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
  function atualizarApi() {
    const g = $("inp-geocode").value.trim();
    let a1 = parseInt($("inp-ano1").value, 10), a2 = parseInt($("inp-ano2").value, 10);
    const valido = /^\d{7}$/.test(g) && a1 >= 2010 && a2 >= a1;
    const u = "https://info.dengue.mat.br/api/alertcity?geocode=" + encodeURIComponent(g) + "&disease=dengue&format=csv&ew_start=1&ew_end=53&ey_start=" + a1 + "&ey_end=" + a2;
    $("url-api").textContent = valido ? u : "Informe um código IBGE de 7 dígitos e um período válido.";
    const l = $("lnk-api");
    l.href = valido ? u : "#";
    l.setAttribute("aria-disabled", valido ? "false" : "true");
    l.style.opacity = valido ? 1 : 0.5;
    l.style.pointerEvents = valido ? "" : "none";
  }

  /* ---------------- ciclo principal ---------------- */
  function atualizar(rapido) {
    atualizarSomaPesos();
    if (!rapido) { montarCidades(); montarAnos(); }
    else montarAnos();
    alternador("alt-sigma", "metSigma");
    alternador("alt-grafo", "metGrafo");
    alternador("alt-cidades", "metCid");
    const res = calcular(state.cidade, state.anos);
    atual = res;
    renderCabecalho(res);
    const secoes = document.querySelectorAll("main > section.bloco:not(#sec-resumo):not(#sec-dados)");
    if (!res.r) {
      $("resumo").textContent = "";
      $("txt-resumo").textContent = "";
      const av = $("aviso-dados"); av.textContent = "";
      av.appendChild(alerta(res.semDados
        ? "Esta cidade não tem dados nos anos marcados. Escolha outros anos na barra do topo."
        : "Faltam semanas de " + lista(res.faltam.map((x) => x.toLowerCase())) + " nos anos marcados. Marque mais anos para que todos os meses tenham dados.", true));
      secoes.forEach((s) => { if (s.querySelector("#cal")) return; s.hidden = true; });
      renderCidades();
      return;
    }
    secoes.forEach((s) => { s.hidden = false; });
    renderAvisos(res);
    renderResumo(res);
    renderSlope(res);
    renderMatriz(res);
    renderSeries(res);
    renderHalteres(res, "iii");
    renderHalteres(res, "iv");
    renderSigma(res);
    renderGrafo(res);
    renderCidades();
  }

  const reRender = () => atualizar(true);
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", reRender);
  }
  new MutationObserver(reRender).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  montarSliders();
  montarApi();
  atualizar();
})();
