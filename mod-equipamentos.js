/* CME Digital — Equipamentos, ciclos validados e Bowie-Dick. */
(function (CME) {
  'use strict';
  var U = CME.ui, T = CME.util, F = CME.fluxo, h = U.h;

  var ROTULO_TIPO = {
    autoclave: 'Autoclave a vapor', 'baixa-temperatura': 'Baixa temperatura',
    lavadora: 'Termodesinfectora', ultrassonica: 'Ultrassônica', incubadora: 'Incubadora'
  };

  function render(alvo) {
    return Promise.all([CME.contexto(), CME.db.todos('cargas')]).then(function (r) {
      var ctx = r[0], cargas = r[1];
      var porTipo = {};
      ctx.equipamentos.forEach(function (e) {
        (porTipo[e.tipo] = porTipo[e.tipo] || []).push(e);
      });

      Object.keys(porTipo).forEach(function (tipo) {
        alvo.appendChild(U.secao(ROTULO_TIPO[tipo] || tipo, porTipo[tipo].map(function (e) {
          return cartaoEquipamento(e, ctx, cargas);
        })));
      });
    });
  }

  function cartaoEquipamento(e, ctx, cargas) {
    var bloq = F.bloqueioDe(ctx.bloqueios, 'equipamento', e.id);
    var ciclos = ctx.ciclos.filter(function (c) { return c.equipamentoId === e.id; });
    var usoHoje = cargas.filter(function (c) {
      return c.equipamentoId === e.id && c.data === T.hojeISO();
    }).length;
    var bdOk = e.bowieDickData === T.hojeISO();
    var manut = e.manutencaoAte ? T.diasAte(e.manutencaoAte) : null;

    var linhas = [];
    if (e.bowieDick) {
      linhas.push(h('div', { class: 'tab-lin' }, [
        h('span', { text: 'Bowie-Dick de hoje' }),
        U.selo(bdOk ? 'ok' : 'atencao', bdOk ? 'aprovado às ' + (e.bowieDickHora || '—') : 'pendente'),
        h('button', { class: 'btn plano peq', onclick: function () { bowieDick(e); } },
          [bdOk ? 'Refazer' : 'Registrar'])
      ]));
    }
    if (manut !== null) {
      linhas.push(h('div', { class: 'tab-lin' }, [
        h('span', { text: 'Manutenção preventiva' }),
        U.selo(manut < 0 ? 'reprovado' : manut <= 30 ? 'atencao' : 'ok',
               manut < 0 ? 'vencida' : 'até ' + e.manutencaoAte)
      ]));
    }
    if (e.qualificacaoAte) {
      linhas.push(h('div', { class: 'tab-lin' }, [
        h('span', { text: 'Qualificação de desempenho' }),
        U.selo(T.diasAte(e.qualificacaoAte) < 0 ? 'reprovado' : 'ok', 'até ' + e.qualificacaoAte)
      ]));
    }
    linhas.push(h('div', { class: 'tab-lin' }, [
      h('span', { text: 'Cargas processadas hoje' }),
      h('span', { class: 'cod', text: String(usoHoje) })
    ]));

    return U.cartao([
      h('div', { class: 'cartao-topo' }, [
        h('span', { class: 'eq-nome', text: e.nome }),
        bloq ? U.selo('reprovado', 'Bloqueado')
             : U.selo(e.status === 'disponivel' ? 'ok' : 'atencao', U.rotuloStatus(e.status))
      ]),
      h('p', { class: 'cartao-sub', text: e.fabricante + ' · ' + e.metodo +
        (e.camaraL ? ' · câmara ' + e.camaraL + ' L' : '') }),
      bloq ? h('div', { class: 'faixa-bloqueio compacta' }, [
        h('strong', { text: 'NÃO LIBERAR' }), h('p', { text: bloq.motivo })
      ]) : null,
      h('div', { class: 'tabela' }, linhas),
      ciclos.length ? h('details', { class: 'ciclos' }, [
        h('summary', { text: ciclos.length + ' ciclo(s) validado(s)' }),
        h('div', { class: 'tabela' }, ciclos.map(function (c) {
          return h('div', { class: 'tab-lin' }, [
            h('span', { text: c.programa }),
            h('span', { class: 'cod', text: c.tempC + ' °C · ' + c.exposicaoMin + ' min' }),
            h('span', { class: 'dica', text: 'máx ' + c.cargaMaxKg + ' kg' })
          ]);
        }))
      ]) : null,
      h('div', { class: 'barra-acao compacta' }, [
        h('button', { class: 'btn plano peq', onclick: function () { mudarStatus(e); } },
          ['Alterar situação']),
        bloq
          ? h('button', { class: 'btn plano peq', onclick: function () { desbloquear(bloq); } },
              ['Remover bloqueio'])
          : h('button', { class: 'btn perigo peq', onclick: function () { bloquear(e); } },
              ['Não liberar'])
      ])
    ]);
  }

  function bowieDick(e) {
    var form = h('div', {}, [
      h('p', { class: 'p', text: 'O ciclo de teste deve ser o primeiro do dia, com a câmara ' +
        'aquecida e sem carga.' }),
      U.campo('Resultado', U.selecao('resultado', ['aprovado', 'reprovado'])),
      U.campo('Lote do teste', U.texto('lote')),
      U.campo('Observação', h('textarea', { name: 'obs', rows: '2' }))
    ]);
    U.folha('Bowie-Dick — ' + e.nome, form, [
      { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
      { rotulo: 'Registrar resultado', estilo: 'primario', acao: function (fechar) {
        var v = U.valores(form);
        var agora = new Date();
        if (v.resultado === 'aprovado') {
          e.bowieDickData = T.hojeISO();
          e.bowieDickHora = String(agora.getHours()).padStart(2, '0') + ':' +
                            String(agora.getMinutes()).padStart(2, '0');
          e.bowieDickLote = v.lote;
          CME.db.put('equipamentos', e).then(function () {
            fechar(); U.aviso('Bowie-Dick aprovado em ' + e.nome + '.', 'ok'); location.reload();
          });
        } else {
          e.status = 'interditado';
          e.bowieDickData = null;
          Promise.all([
            CME.db.put('equipamentos', e),
            CME.db.put('bloqueios', { alvoTipo: 'equipamento', alvoId: e.id, ativo: 1, ts: Date.now(),
              motivo: 'Bowie-Dick reprovado. ' + (v.obs || '') }),
            CME.db.put('nc', { ts: Date.now(), status: 'aberta', alvoTipo: 'equipamento',
              alvoId: e.id, titulo: 'Bowie-Dick reprovado — ' + e.nome, origem: 'Esterilização',
              descricao: v.obs || 'Teste reprovado. Equipamento interditado até nova avaliação.' })
          ]).then(function () {
            fechar();
            U.aviso(e.nome + ' interditado. Nenhuma carga pode ser processada nele.', 'erro');
            location.reload();
          });
        }
      } }
    ]);
  }

  function mudarStatus(e) {
    var form = h('div', {}, [
      U.campo('Situação do equipamento',
        U.selecao('status', [{ v: 'disponivel', r: 'disponível' }, { v: 'em ciclo', r: 'em ciclo' },
                             { v: 'manutencao', r: 'manutenção' },
                             { v: 'interditado', r: 'interditado' }], e.status)),
      U.campo('Manutenção preventiva até',
        h('input', { type: 'date', name: 'manutencaoAte', value: e.manutencaoAte || '' }))
    ]);
    U.folha('Situação — ' + e.nome, form, [
      { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
      { rotulo: 'Salvar', estilo: 'primario', acao: function (fechar) {
        var v = U.valores(form);
        e.status = v.status;
        e.manutencaoAte = v.manutencaoAte || null;
        CME.db.put('equipamentos', e).then(function () {
          fechar(); U.aviso('Situação atualizada.', 'ok'); location.reload();
        });
      } }
    ]);
  }

  function bloquear(e) {
    var motivo = h('textarea', { name: 'motivo', rows: '3' });
    U.folha('Não liberar ' + e.nome, h('div', {}, [
      h('p', { class: 'p', text: 'Enquanto o bloqueio existir, nenhuma carga pode ser esterilizada ' +
        'neste equipamento.' }),
      U.campo('Motivo', motivo)
    ]), [
      { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
      { rotulo: 'Bloquear equipamento', estilo: 'perigo', acao: function (fechar) {
        if (!motivo.value.trim()) return U.aviso('Descreva o motivo do bloqueio.', 'erro');
        e.status = 'interditado';
        Promise.all([
          CME.db.put('equipamentos', e),
          CME.db.put('bloqueios', { alvoTipo: 'equipamento', alvoId: e.id, ativo: 1,
            motivo: motivo.value.trim(), ts: Date.now() }),
          CME.db.put('nc', { ts: Date.now(), status: 'aberta', alvoTipo: 'equipamento', alvoId: e.id,
            titulo: 'Equipamento interditado — ' + e.nome, origem: 'Equipamentos',
            descricao: motivo.value.trim() })
        ]).then(function () { fechar(); U.aviso(e.nome + ' interditado.', 'erro'); location.reload(); });
      } }
    ]);
  }

  function desbloquear(bloq) {
    U.confirmar('Remover bloqueio', 'Confirme que a causa foi tratada e o equipamento pode voltar ao uso.',
      function () {
        bloq.ativo = 0; bloq.encerradoEm = Date.now();
        CME.db.get('equipamentos', bloq.alvoId).then(function (e) {
          if (e) { e.status = 'disponivel'; return CME.db.put('equipamentos', e); }
        }).then(function () { return CME.db.put('bloqueios', bloq); })
          .then(function () { U.aviso('Equipamento liberado.', 'ok'); location.reload(); });
      }, 'Remover bloqueio');
  }

  CME.registrar('equipamentos', { titulo: 'Equipamentos', render: render });
})(window.CME = window.CME || {});
