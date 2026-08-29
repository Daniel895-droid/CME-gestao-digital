/* CME Digital — núcleo: roteador, helpers de DOM, regras de liberação */
(function (CME) {
  'use strict';

  /* ---------- helpers de DOM ---------- */
  function h(tag, attrs, filhos) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) {
      if (f === null || f === undefined || f === false) return;
      e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
    });
    return e;
  }
  function q(sel, raiz) { return (raiz || document).querySelector(sel); }
  function limpar(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }

  /* ---------- datas ---------- */
  function hojeISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }
  function hora(ts) {
    var d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function dataHora(ts) {
    var d = new Date(ts);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') +
           ' ' + hora(ts);
  }
  function diasAte(dataISO) {
    return Math.ceil((new Date(dataISO + 'T23:59:59') - Date.now()) / 86400000);
  }

  /* ---------- avisos ---------- */
  var avisoTimer;
  function aviso(msg, tipo) {
    var box = q('#aviso');
    box.textContent = msg;
    box.className = 'aviso vis ' + (tipo || 'ok');
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { box.className = 'aviso'; }, 4200);
  }

  /* ---------- painel lateral (formulários) ---------- */
  function folha(titulo, conteudo, acoes) {
    var fundo = h('div', { class: 'folha-fundo' });
    var painel = h('section', { class: 'folha', role: 'dialog', 'aria-modal': 'true',
                                'aria-label': titulo });
    function fechar() { fundo.remove(); painel.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') fechar(); }
    painel.appendChild(h('header', { class: 'folha-topo' }, [
      h('h2', { text: titulo }),
      h('button', { class: 'ico', 'aria-label': 'Fechar', onclick: fechar, html: '&times;' })
    ]));
    var corpo = h('div', { class: 'folha-corpo' }, [conteudo]);
    painel.appendChild(corpo);
    if (acoes && acoes.length) {
      painel.appendChild(h('footer', { class: 'folha-pe' }, acoes.map(function (a) {
        return h('button', {
          class: 'btn ' + (a.estilo || ''),
          onclick: function () { a.acao(fechar); }
        }, [a.rotulo]);
      })));
    }
    fundo.addEventListener('click', fechar);
    document.addEventListener('keydown', esc);
    document.body.appendChild(fundo);
    document.body.appendChild(painel);
    var primeiro = painel.querySelector('input,select,textarea,button');
    if (primeiro) primeiro.focus();
    return { fechar: fechar, corpo: corpo };
  }

  function confirmar(titulo, texto, aoConfirmar, rotulo) {
    folha(titulo, h('p', { class: 'p', text: texto }), [
      { rotulo: 'Voltar', estilo: 'plano', acao: function (f) { f(); } },
      { rotulo: rotulo || 'Confirmar', estilo: 'perigo', acao: function (f) { f(); aoConfirmar(); } }
    ]);
  }

  /* ---------- campos de formulário ---------- */
  function campo(rotulo, entrada, dica) {
    return h('label', { class: 'campo' }, [
      h('span', { class: 'rot', text: rotulo }),
      entrada,
      dica ? h('span', { class: 'dica', text: dica }) : null
    ]);
  }
  function texto(nome, valor, attrs) {
    return h('input', Object.assign({ type: 'text', name: nome, value: valor || '' }, attrs || {}));
  }
  function numero(nome, valor, attrs) {
    return h('input', Object.assign({ type: 'number', name: nome, value: valor !== undefined && valor !== null ? valor : '', step: 'any' }, attrs || {}));
  }
  function selecao(nome, opcoes, valor) {
    return h('select', { name: nome }, opcoes.map(function (o) {
      var v = typeof o === 'string' ? o : o.v, r = typeof o === 'string' ? o : o.r;
      var op = h('option', { value: v, text: r });
      if (String(v) === String(valor)) op.selected = true;
      return op;
    }));
  }
  function valores(raiz) {
    var out = {};
    raiz.querySelectorAll('input,select,textarea').forEach(function (e) {
      if (!e.name) return;
      if (e.type === 'checkbox') out[e.name] = e.checked;
      else if (e.type === 'number') out[e.name] = e.value === '' ? null : parseFloat(e.value);
      else out[e.name] = e.value;
    });
    return out;
  }

  /* ---------- etapas da carga (a trilha) ---------- */
  var ETAPAS = [
    { id: 'recepcao',      rot: 'Recepção',      curto: 'Recep' },
    { id: 'limpeza',       rot: 'Limpeza',       curto: 'Limpeza' },
    { id: 'preparo',       rot: 'Preparo',       curto: 'Preparo' },
    { id: 'embalagem',     rot: 'Embalagem',     curto: 'Embal' },
    { id: 'esterilizacao', rot: 'Esterilização', curto: 'Esteril' },
    { id: 'liberacao',     rot: 'Liberação',     curto: 'Liberar' },
    { id: 'distribuicao',  rot: 'Distribuição',  curto: 'Entrega' }
  ];
  function indiceEtapa(id) {
    for (var i = 0; i < ETAPAS.length; i++) if (ETAPAS[i].id === id) return i;
    return -1;
  }

  /* ---------- bloqueios ---------- */
  function bloqueiosAtivos() {
    return CME.db.porIndice('bloqueios', 'ativo', 1);
  }
  function bloqueioDe(lista, tipo, id) {
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].alvoTipo === tipo && String(lista[i].alvoId) === String(id)) return lista[i];
    }
    return null;
  }

  /* ---------- regra central: a carga pode avançar? ---------- */
  /* Devolve { pode: bool, motivos: [] }. Nada avança sem passar por aqui. */
  /* Dois níveis de impedimento:
     - duro: nada no formulário desta etapa resolve. O botão nem aparece.
     - do formulário: some assim que o enfermeiro preenche o campo.
     Na confirmação, os dois são revalidados: nada passa com pendência. */
  function podeAvancar(carga, proxima, ctx, extra) {
    var motivos = [], duros = [];
    function trava(t) { motivos.push(t); duros.push(t); }
    function pede(t) { motivos.push(t); }

    var atual = indiceEtapa(carga.etapa);
    var alvo = indiceEtapa(proxima);

    if (carga.status === 'reprovada') {
      trava('Carga reprovada. Trate a não conformidade antes de seguir.');
    }
    if (alvo !== atual + 1) {
      trava('As etapas seguem a ordem do fluxo sujo → limpo. Registre ' +
            ETAPAS[atual + 1].rot + ' primeiro.');
    }

    var bloq = bloqueioDe(ctx.bloqueios, 'carga', carga.id);
    if (bloq) trava('Carga bloqueada: ' + bloq.motivo);

    (carga.itens || []).forEach(function (it) {
      var b = bloqueioDe(ctx.bloqueios, 'pps', it.ppsId);
      if (b) trava(it.nome + ' está bloqueado: ' + b.motivo);
    });

    if (proxima === 'esterilizacao') {
      var aguaRuim = ctx.agua.filter(function (a) {
        return a.situacao === 'reprovado' && a.ponto === 'Enxágue final';
      })[0];
      if (aguaRuim) trava('Água de enxágue final reprovada na coleta de ' + aguaRuim.data + '.');

      var eq = ctx.equipamentos.filter(function (e) { return e.id === carga.equipamentoId; })[0];
      if (!eq) {
        pede('Escolha o esterilizador.');
      } else {
        if (eq.status !== 'disponivel' && eq.status !== 'em ciclo') {
          trava(eq.nome + ' está ' + eq.status + '.');
        }
        var be = bloqueioDe(ctx.bloqueios, 'equipamento', eq.id);
        if (be) trava(eq.nome + ' bloqueado: ' + be.motivo);
        if (eq.bowieDick && eq.bowieDickData !== hojeISO()) {
          trava('Bowie-Dick do dia não registrado em ' + eq.nome + '.');
        }
        if (eq.manutencaoAte && diasAte(eq.manutencaoAte) < 0) {
          trava('Manutenção de ' + eq.nome + ' vencida em ' + eq.manutencaoAte + '.');
        }
      }

      var ciclo = ctx.ciclos.filter(function (c) { return c.id === carga.cicloId; })[0];
      if (!ciclo) pede('Escolha um ciclo validado.');
    }

    if (proxima === 'liberacao') {
      if (carga.iq !== 'aprovado') trava('Indicador químico ainda não aprovado.');
      if (carga.temIB) {
        if (!carga.ib) trava('Indicador biológico da carga aguardando leitura.');
        else if (carga.ib !== 'aprovado') trava('Indicador biológico reprovado.');
      }
      if (carga.registroFisico !== true) trava('Registro físico do ciclo não conferido.');
      if (carga.pacoteMolhado) trava('Pacote molhado registrado. A carga não pode ser liberada.');
    }

    /* Motor de conformidade (§38): IFU × cadastro × ciclo validado.
       Bloqueio impede; conflito exige avaliação do enfermeiro; alerta só informa. */
    var conformidade = [];
    if (CME.motor && ctx.ifus) {
      conformidade = CME.motor.avaliar(carga, proxima, ctx, extra);
      conformidade.forEach(function (a) {
        if (a.nivel === 'bloqueio') pede(a.texto);
        else if (a.nivel === 'conflito') pede(a.texto);
      });
    }

    return { pode: motivos.length === 0, motivos: motivos, duros: duros,
             conformidade: conformidade };
  }

  /* ---------- roteador ---------- */
  var modulos = {};
  function registrar(id, def) { modulos[id] = def; }

  function ir(id, params) {
    if (!modulos[id]) id = 'hoje';
    location.hash = '#/' + id + (params ? '/' + params : '');
  }

  function renderRota() {
    var partes = (location.hash || '#/hoje').replace(/^#\//, '').split('/');
    var id = partes[0] || 'hoje';
    var param = partes.slice(1).join('/');
    if (!modulos[id]) id = 'hoje';
    var alvo = limpar(q('#tela'));
    document.querySelectorAll('.nav-item').forEach(function (b) {
      b.classList.toggle('atual', b.dataset.rota === id);
    });
    q('#titulo').textContent = modulos[id].titulo;
    document.body.classList.remove('menu-aberto');
    var r = modulos[id].render(alvo, param);
    if (r && r.then) r.catch(function (e) {
      console.error(e);
      alvo.appendChild(h('p', { class: 'p', text: 'Não foi possível carregar esta tela: ' + e.message }));
    });
    alvo.scrollTop = 0;
  }

  /* ---------- pedaços de UI reutilizados ---------- */
  var ROTULO_STATUS = { disponivel: 'disponível', 'em ciclo': 'em ciclo',
                        manutencao: 'manutenção', interditado: 'interditado' };
  function rotuloStatus(s) { return ROTULO_STATUS[s] || s; }

  function selo(situacao, rotulo) {
    return h('span', { class: 'selo s-' + situacao, text: rotulo || situacao });
  }
  function cartao(filhos, attrs) {
    return h('article', Object.assign({ class: 'cartao' }, attrs || {}), filhos);
  }
  function vazio(texto, rotuloAcao, acao) {
    return h('div', { class: 'vazio' }, [
      h('p', { text: texto }),
      acao ? h('button', { class: 'btn primario', onclick: acao }, [rotuloAcao]) : null
    ]);
  }
  function secao(titulo, filhos, acao) {
    return h('section', { class: 'secao' }, [
      h('div', { class: 'secao-topo' }, [
        h('h2', { class: 'secao-tit', text: titulo }),
        acao || null
      ])
    ].concat(filhos));
  }

  CME.ui = { h: h, q: q, limpar: limpar, aviso: aviso, folha: folha, confirmar: confirmar,
             campo: campo, texto: texto, numero: numero, selecao: selecao, valores: valores,
             selo: selo, cartao: cartao, vazio: vazio, secao: secao,
             rotuloStatus: rotuloStatus };
  CME.util = { hojeISO: hojeISO, hora: hora, dataHora: dataHora, diasAte: diasAte };
  CME.fluxo = { ETAPAS: ETAPAS, indiceEtapa: indiceEtapa, podeAvancar: podeAvancar,
                bloqueiosAtivos: bloqueiosAtivos, bloqueioDe: bloqueioDe };
  CME.registrar = registrar;
  CME.ir = ir;

  /* contexto compartilhado — recarregado a cada validação */
  CME.contexto = function () {
    return Promise.all([
      bloqueiosAtivos(), CME.db.todos('equipamentos'), CME.db.todos('ciclos'),
      CME.db.todos('pps'), CME.db.todos('agua'), CME.db.todos('ifus')
    ]).then(function (r) {
      return { bloqueios: r[0], equipamentos: r[1], ciclos: r[2], pps: r[3], agua: r[4],
               ifus: r[5] || [] };
    });
  };

  /* A abertura espera a curva terminar e então oferece o botão.
     Quem entra decide a hora — não há tempo limite. */
  var CURVA_MS = 2300;
  var inicioApp = Date.now();

  function fecharAbertura() {
    var espera = Math.max(0, CURVA_MS - (Date.now() - inicioApp));
    setTimeout(function () {
      var estado = q('#carregando');
      var botao = q('#entrar');
      var data = q('#abertura-data');
      if (data) {
        var d = new Date().toLocaleDateString('pt-BR',
          { weekday: 'long', day: 'numeric', month: 'long' });
        data.textContent = d.charAt(0).toUpperCase() + d.slice(1);
        data.classList.add('vis');
      }
      if (estado) estado.remove();
      if (!botao) return;
      botao.hidden = false;
      botao.addEventListener('click', entrar);
      botao.focus();
    }, espera);
  }

  function entrar() {
    var a = q('#abertura');
    if (!a) return;
    a.classList.add('sai');
    setTimeout(function () { a.remove(); }, 500);
  }

  window.addEventListener('hashchange', renderRota);
  CME.iniciar = function () {
    CME.db.abrir()
      .then(CME.semear)
      .then(function () {
        document.querySelectorAll('.nav-item').forEach(function (b) {
          b.addEventListener('click', function () { ir(b.dataset.rota); });
        });
        q('#abrir-menu').addEventListener('click', function () {
          document.body.classList.toggle('menu-aberto');
        });
        renderRota();
        fecharAbertura();
      })
      .catch(function (e) {
        console.error(e);
        q('#carregando').textContent = 'Não foi possível abrir o banco local: ' + e.message;
      });
  };
})(window.CME = window.CME || {});
