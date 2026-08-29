/* CME Digital — CME Hoje: a situação do setor em uma tela. */
(function (CME) {
  'use strict';
  var U = CME.ui, T = CME.util, F = CME.fluxo, h = U.h;

  function alerta(nivel, texto, rotulo, acao) {
    return h('li', { class: 'alerta n-' + nivel }, [
      h('span', { class: 'alerta-txt', text: texto }),
      acao ? h('button', { class: 'btn plano peq', onclick: acao }, [rotulo]) : null
    ]);
  }

  function render(alvo) {
    return Promise.all([
      CME.db.todos('cargas'), CME.contexto(), CME.db.todos('insumos'),
      CME.db.porIndice('nc', 'status', 'aberta'), CME.db.todos('agua')
    ]).then(function (r) {
      var cargas = r[0], ctx = r[1], insumos = r[2], ncs = r[3], agua = r[4];
      var hoje = T.hojeISO();
      var doDia = cargas.filter(function (c) { return c.data === hoje; });
      var aguardando = cargas.filter(function (c) {
        return c.etapa === 'esterilizacao';
      });
      var ibPendente = cargas.filter(function (c) { return c.temIB && !c.ib; });

      var alertas = [];

      ctx.equipamentos.filter(function (e) { return e.bowieDick && e.status === 'disponivel'; })
        .forEach(function (e) {
          if (e.bowieDickData !== hoje) {
            alertas.push(alerta('atencao', 'Bowie-Dick ainda não registrado — ' + e.nome,
              'Registrar', function () { CME.ir('equipamentos'); }));
          }
        });

      ibPendente.forEach(function (c) {
        alertas.push(alerta('atencao', 'Indicador biológico da carga ' + c.numero +
          ' aguardando leitura.', 'Abrir', function () { CME.ir('cargas', c.id); }));
      });

      ctx.bloqueios.forEach(function (b) {
        alertas.push(alerta('critico', 'Bloqueio ativo — ' + b.alvoTipo + ' ' + b.alvoId + ': ' +
          b.motivo, 'Ver', function () {
            if (b.alvoTipo === 'carga') CME.ir('cargas', b.alvoId);
            else CME.ir('equipamentos');
          }));
      });

      insumos.filter(function (i) { return i.saldo <= i.minimo; }).forEach(function (i) {
        var dias = i.consumoDia ? Math.floor(i.saldo / i.consumoDia) : null;
        alertas.push(alerta('atencao', i.nome + ': estoque abaixo do mínimo' +
          (dias !== null ? ' — suficiente para ' + dias + ' dia(s)' : ''), 'Estoque',
          function () { CME.ir('insumos'); }));
      });

      agua.filter(function (a) { return a.situacao === 'reprovado'; }).forEach(function (a) {
        alertas.push(alerta('critico', 'Água — ' + a.ponto + ' reprovada na coleta de ' + a.data,
          'Abrir', function () { CME.ir('agua'); }));
      });
      agua.filter(function (a) { return a.situacao === 'atencao'; }).forEach(function (a) {
        alertas.push(alerta('atencao', 'Água — ' + a.ponto + ': ' + (a.obs || 'parâmetro em atenção'),
          'Abrir', function () { CME.ir('agua'); }));
      });

      ctx.equipamentos.filter(function (e) {
        return e.manutencaoAte && T.diasAte(e.manutencaoAte) <= 30;
      }).forEach(function (e) {
        var d = T.diasAte(e.manutencaoAte);
        alertas.push(alerta(d < 0 ? 'critico' : 'atencao', e.nome + ' — manutenção ' +
          (d < 0 ? 'vencida há ' + Math.abs(d) + ' dia(s)' : 'vence em ' + d + ' dia(s)'),
          'Equipamentos', function () { CME.ir('equipamentos'); }));
      });

      ncs.forEach(function (n) {
        alertas.push(alerta('atencao', 'Não conformidade aberta: ' + n.titulo, 'Tratar',
          function () { CME.ir('nc'); }));
      });

      /* semáforo geral */
      var critico = alertas.filter(function (a) { return a.className.indexOf('n-critico') > -1; }).length;
      var atencao = alertas.length - critico;
      var nivel = critico ? 'critico' : (atencao ? 'atencao' : 'ok');
      var frase = critico ? 'Há ' + critico + ' ponto(s) que exigem ação imediata.'
                : atencao ? 'Há ' + atencao + ' ponto(s) de atenção no plantão.'
                : 'Nenhuma pendência aberta no setor.';

      alvo.appendChild(h('section', { class: 'semaforo s-' + nivel }, [
        h('span', { class: 'semaforo-luz' }),
        h('div', {}, [
          h('h2', { class: 'semaforo-tit', text: nivel === 'ok' ? 'CME conforme'
            : nivel === 'atencao' ? 'CME em atenção' : 'CME com não conformidade' }),
          h('p', { class: 'semaforo-sub', text: frase })
        ])
      ]));

      /* números do dia */
      alvo.appendChild(h('div', { class: 'numeros' }, [
        num(doDia.length, 'cargas hoje'),
        num(aguardando.length, 'aguardando liberação'),
        num(ibPendente.length, 'IB pendentes'),
        num(ncs.length, 'NC abertas')
      ]));

      alvo.appendChild(h('div', { class: 'barra-acao' }, [
        h('button', { class: 'btn primario', onclick: function () { CME.cargas.nova(); } },
          ['Abrir nova carga'])
      ]));

      /* pendências */
      alvo.appendChild(U.secao('Pendências do plantão',
        alertas.length ? [h('ul', { class: 'alertas' }, alertas)]
                       : [h('p', { class: 'p', text:
                           'Checklists em dia, indicadores lidos, nenhum bloqueio ativo.' })]));

      /* equipamentos */
      alvo.appendChild(U.secao('Equipamentos', [
        h('div', { class: 'grade-eq' }, ctx.equipamentos.map(function (e) {
          var b = F.bloqueioDe(ctx.bloqueios, 'equipamento', e.id);
          var sit = b ? 'reprovado' : e.status === 'disponivel' ? 'ok' :
                    e.status === 'manutencao' ? 'atencao' : 'reprovado';
          return h('div', { class: 'eq-mini s-' + sit }, [
            h('span', { class: 'eq-nome', text: e.nome }),
            h('span', { class: 'dica', text: b ? 'bloqueado' : U.rotuloStatus(e.status) })
          ]);
        }))
      ], h('button', { class: 'btn plano peq', onclick: function () { CME.ir('equipamentos'); } },
        ['Ver todos'])));

      /* cargas em andamento */
      var abertas = cargas.filter(function (c) { return c.etapa !== 'distribuicao'; })
        .sort(function (a, b) { return b.criadaEm - a.criadaEm; }).slice(0, 5);
      alvo.appendChild(U.secao('Em processamento',
        abertas.length ? abertas.map(function (c) {
          return U.cartao([
            h('div', { class: 'cartao-topo' }, [
              h('span', { class: 'cod', text: c.numero }),
              U.selo('ok', F.ETAPAS[F.indiceEtapa(c.etapa)].rot)
            ]),
            CME.cargas.trilha(c, !!F.bloqueioDe(ctx.bloqueios, 'carga', c.id))
          ], { class: 'cartao clicavel', tabindex: '0', role: 'button',
               onclick: function () { CME.ir('cargas', c.id); },
               onkeydown: function (e) { if (e.key === 'Enter') CME.ir('cargas', c.id); } });
        }) : [h('p', { class: 'p', text: 'Nenhuma carga em processamento neste momento.' })]));
    });
  }

  function num(valor, rot) {
    return h('div', { class: 'numero' }, [
      h('span', { class: 'numero-v', text: String(valor) }),
      h('span', { class: 'numero-r', text: rot })
    ]);
  }

  CME.registrar('hoje', { titulo: 'CME Hoje', render: render });
})(window.CME = window.CME || {});
