/* CME Digital — Insumos, Água e Não conformidades. */
(function (CME) {
  'use strict';
  var U = CME.ui, T = CME.util, h = U.h;

  /* ============ INSUMOS ============ */
  function renderInsumos(alvo) {
    return CME.db.todos('insumos').then(function (insumos) {
      insumos.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
      var criticos = insumos.filter(function (i) { return i.saldo <= i.minimo; });

      if (criticos.length) {
        alvo.appendChild(h('div', { class: 'faixa-bloqueio compacta' }, [
          h('strong', { text: 'Estoque crítico' }),
          h('p', { text: criticos.map(function (i) { return i.nome; }).join(', ') })
        ]));
      }

      alvo.appendChild(U.secao('Consumo e saldo', insumos.map(function (i) {
        var dias = i.consumoDia ? Math.floor(i.saldo / i.consumoDia) : null;
        var sit = i.saldo <= i.minimo ? 'reprovado' : dias !== null && dias <= 10 ? 'atencao' : 'ok';
        var pct = Math.max(4, Math.min(100, (i.saldo / (i.minimo * 3)) * 100));
        return U.cartao([
          h('div', { class: 'cartao-topo' }, [
            h('span', { class: 'eq-nome', text: i.nome }),
            U.selo(sit, dias !== null ? dias + ' dias' : '—')
          ]),
          h('div', { class: 'barra' }, [h('span', { class: 'barra-preench s-' + sit,
            style: 'width:' + pct + '%' })]),
          h('p', { class: 'cartao-sub', text: 'Saldo ' + i.saldo + ' ' + i.unidade +
            ' · mínimo ' + i.minimo + ' · consumo médio ' + i.consumoDia + '/dia' }),
          h('div', { class: 'barra-acao compacta' }, [
            h('button', { class: 'btn plano peq', onclick: function () { movimentar(i, -1); } },
              ['Registrar baixa']),
            h('button', { class: 'btn plano peq', onclick: function () { movimentar(i, 1); } },
              ['Entrada'])
          ])
        ]);
      })));
    });
  }

  function movimentar(insumo, sinal) {
    var qtd = U.numero('qtd', null, { min: '0' });
    var form = h('div', {}, [
      U.campo('Quantidade (' + insumo.unidade + ')', qtd),
      U.campo('Lote', U.texto('lote')),
      U.campo('Observação', h('textarea', { name: 'obs', rows: '2' }))
    ]);
    U.folha((sinal > 0 ? 'Entrada' : 'Baixa') + ' — ' + insumo.nome, form, [
      { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
      { rotulo: 'Confirmar', estilo: 'primario', acao: function (fechar) {
        var v = U.valores(form);
        if (!v.qtd || v.qtd <= 0) return U.aviso('Informe a quantidade.', 'erro');
        if (sinal < 0 && v.qtd > insumo.saldo) {
          return U.aviso('Saldo disponível: ' + insumo.saldo + ' ' + insumo.unidade + '.', 'erro');
        }
        insumo.saldo = insumo.saldo + sinal * v.qtd;
        Promise.all([
          CME.db.put('insumos', insumo),
          CME.db.put('movimentos', { insumoId: insumo.id, ts: Date.now(), qtd: sinal * v.qtd,
            lote: v.lote, obs: v.obs })
        ]).then(function () {
          fechar(); U.aviso('Movimentação registrada.', 'ok'); location.reload();
        });
      } }
    ]);
  }

  /* ============ ÁGUA ============ */
  var PONTOS = ['Água de entrada', 'Osmose reversa', 'Enxágue final', 'Gerador de vapor',
                'Alimentação de equipamentos'];

  function renderAgua(alvo) {
    return CME.db.todos('agua').then(function (analises) {
      analises.sort(function (a, b) { return b.ts - a.ts; });

      alvo.appendChild(h('div', { class: 'barra-acao' }, [
        h('button', { class: 'btn primario', onclick: function () { novaAnalise(); } },
          ['Registrar análise'])
      ]));

      var ultimas = {};
      analises.forEach(function (a) { if (!ultimas[a.ponto]) ultimas[a.ponto] = a; });

      alvo.appendChild(U.secao('Situação por ponto de coleta', PONTOS.map(function (ponto) {
        var a = ultimas[ponto];
        if (!a) {
          return U.cartao([
            h('div', { class: 'cartao-topo' }, [
              h('span', { class: 'eq-nome', text: ponto }), U.selo('neutro', 'sem coleta')
            ]),
            h('p', { class: 'cartao-sub', text: 'Nenhuma análise registrada para este ponto.' })
          ]);
        }
        return U.cartao([
          h('div', { class: 'cartao-topo' }, [
            h('span', { class: 'eq-nome', text: ponto }),
            U.selo(a.situacao === 'conforme' ? 'ok' : a.situacao === 'atencao' ? 'atencao' : 'reprovado',
                   a.situacao)
          ]),
          h('p', { class: 'cartao-sub', text: 'Coleta de ' + a.data }),
          h('div', { class: 'tabela' }, [
            par('pH', a.ph), par('Condutividade (µS/cm)', a.condutividade),
            par('Dureza (mg/L CaCO₃)', a.dureza), par('Microbiologia', a.microbiologia)
          ]),
          a.obs ? h('p', { class: 'dica', text: a.obs }) : null
        ]);
      })));

      if (analises.length) {
        alvo.appendChild(U.secao('Histórico de coletas', [
          h('div', { class: 'tabela' }, analises.slice(0, 20).map(function (a) {
            return h('div', { class: 'tab-lin' }, [
              h('span', { text: a.ponto }),
              h('span', { class: 'cod', text: a.data }),
              U.selo(a.situacao === 'conforme' ? 'ok' : a.situacao === 'atencao' ? 'atencao'
                     : 'reprovado', a.situacao)
            ]);
          }))
        ]));
      }
    });
  }

  function par(rot, valor) {
    return h('div', { class: 'tab-lin' }, [
      h('span', { text: rot }),
      h('span', { class: 'cod', text: valor === null || valor === undefined ? '—' : String(valor) })
    ]);
  }

  function novaAnalise() {
    var form = h('div', {}, [
      U.campo('Ponto de coleta', U.selecao('ponto', PONTOS)),
      U.campo('Data da coleta', h('input', { type: 'date', name: 'data', value: T.hojeISO() })),
      U.campo('pH', U.numero('ph')),
      U.campo('Condutividade (µS/cm)', U.numero('condutividade')),
      U.campo('Dureza (mg/L CaCO₃)', U.numero('dureza')),
      U.campo('Microbiologia', U.selecao('microbiologia', ['ausente', 'presente'])),
      U.campo('Conclusão', U.selecao('situacao', ['conforme', 'atencao', 'reprovado'])),
      U.campo('Observação', h('textarea', { name: 'obs', rows: '2' }))
    ]);
    U.folha('Nova análise de água', form, [
      { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
      { rotulo: 'Salvar análise', estilo: 'primario', acao: function (fechar) {
        var v = U.valores(form);
        v.ts = new Date(v.data + 'T08:00:00').getTime();
        CME.db.put('agua', v).then(function () {
          if (v.situacao === 'reprovado') {
            return CME.db.put('nc', { ts: Date.now(), status: 'aberta', alvoTipo: 'agua',
              alvoId: v.ponto, titulo: 'Água reprovada — ' + v.ponto, origem: 'Qualidade da água',
              descricao: v.obs || 'Análise reprovada. Investigar causa e recoletar.' });
          }
        }).then(function () {
          fechar();
          U.aviso(v.situacao === 'reprovado'
            ? 'Análise reprovada. Não conformidade aberta e esterilização bloqueada.'
            : 'Análise registrada.', v.situacao === 'reprovado' ? 'erro' : 'ok');
          location.reload();
        });
      } }
    ]);
  }

  /* ============ NÃO CONFORMIDADES ============ */
  function renderNC(alvo) {
    return CME.db.todos('nc').then(function (ncs) {
      ncs.sort(function (a, b) { return b.ts - a.ts; });
      var abertas = ncs.filter(function (n) { return n.status === 'aberta'; });
      var fechadas = ncs.filter(function (n) { return n.status !== 'aberta'; });

      alvo.appendChild(h('div', { class: 'barra-acao' }, [
        h('button', { class: 'btn primario', onclick: function () { novaNC(); } },
          ['Abrir não conformidade'])
      ]));

      if (!ncs.length) {
        alvo.appendChild(U.vazio('Nenhuma não conformidade registrada.', 'Abrir não conformidade',
          novaNC));
        return;
      }

      alvo.appendChild(U.secao('Abertas', abertas.length ? abertas.map(cartaoNC)
        : [h('p', { class: 'p', text: 'Nenhuma não conformidade aberta.' })]));
      if (fechadas.length) {
        alvo.appendChild(U.secao('Encerradas', fechadas.slice(0, 15).map(cartaoNC)));
      }
    });
  }

  function cartaoNC(n) {
    return U.cartao([
      h('div', { class: 'cartao-topo' }, [
        h('span', { class: 'eq-nome', text: n.titulo }),
        U.selo(n.status === 'aberta' ? 'reprovado' : 'ok', n.status)
      ]),
      h('p', { class: 'cartao-sub', text: n.origem + ' · ' + T.dataHora(n.ts) +
        (n.alvoId ? ' · ' + n.alvoId : '') }),
      h('p', { class: 'p', text: n.descricao }),
      n.causa ? h('div', { class: 'tabela' }, [
        h('div', { class: 'tab-lin' }, [h('span', { text: 'Causa' }),
          h('span', { class: 'dica', text: n.causa })]),
        h('div', { class: 'tab-lin' }, [h('span', { text: 'Ação' }),
          h('span', { class: 'dica', text: n.acao })]),
        h('div', { class: 'tab-lin' }, [h('span', { text: 'Responsável' }),
          h('span', { class: 'dica', text: n.responsavel })])
      ]) : null,
      n.status === 'aberta'
        ? h('div', { class: 'barra-acao compacta' }, [
            h('button', { class: 'btn plano peq', onclick: function () { tratar(n); } },
              ['Tratar e encerrar'])
          ])
        : null
    ]);
  }

  function novaNC() {
    var form = h('div', {}, [
      U.campo('Título', U.texto('titulo')),
      U.campo('Onde foi identificada', U.selecao('origem',
        ['Recepção', 'Limpeza', 'Preparo', 'Embalagem', 'Esterilização', 'Liberação',
         'Armazenamento', 'Qualidade da água', 'Equipamentos'])),
      U.campo('Descrição do ocorrido', h('textarea', { name: 'descricao', rows: '4' }))
    ]);
    U.folha('Abrir não conformidade', form, [
      { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
      { rotulo: 'Abrir', estilo: 'primario', acao: function (fechar) {
        var v = U.valores(form);
        if (!v.titulo) return U.aviso('Informe o título da não conformidade.', 'erro');
        v.ts = Date.now(); v.status = 'aberta'; v.alvoTipo = 'geral';
        CME.db.put('nc', v).then(function () {
          fechar(); U.aviso('Não conformidade aberta.', 'ok'); location.reload();
        });
      } }
    ]);
  }

  function tratar(n) {
    var form = h('div', {}, [
      U.campo('Análise de causa', h('textarea', { name: 'causa', rows: '3' })),
      U.campo('Ação corretiva executada', h('textarea', { name: 'acao', rows: '3' })),
      U.campo('Responsável', U.texto('responsavel')),
      U.campo('Evidência de conclusão', h('textarea', { name: 'evidencia', rows: '2' }))
    ]);
    U.folha('Encerrar — ' + n.titulo, form, [
      { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
      { rotulo: 'Encerrar não conformidade', estilo: 'primario', acao: function (fechar) {
        var v = U.valores(form);
        if (!v.causa || !v.acao) return U.aviso('Registre a causa e a ação corretiva.', 'erro');
        Object.assign(n, v, { status: 'encerrada', encerradaEm: Date.now() });
        CME.db.put('nc', n).then(function () {
          fechar();
          U.aviso('Não conformidade encerrada. Bloqueios ligados a ela seguem ativos até ' +
            'serem removidos manualmente.', 'ok');
          location.reload();
        });
      } }
    ]);
  }

  CME.registrar('insumos', { titulo: 'Insumos e estoque', render: renderInsumos });
  CME.registrar('agua', { titulo: 'Qualidade da água', render: renderAgua });
  CME.registrar('nc', { titulo: 'Não conformidades', render: renderNC });
})(window.CME = window.CME || {});
