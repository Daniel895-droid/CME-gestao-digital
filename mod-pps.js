/* CME Digital — Catálogo de PPS e matriz de embalagem. */
(function (CME) {
  'use strict';
  var U = CME.ui, F = CME.fluxo, h = U.h;

  var BARREIRAS = ['SMS 60 g/m²', 'Papel grau cirúrgico', 'Container validado', 'Tyvek® compatível'];
  var METODOS = ['Vapor', 'H₂O₂'];

  function render(alvo) {
    return CME.contexto().then(function (ctx) {
      alvo.appendChild(h('div', { class: 'barra-acao' }, [
        h('button', { class: 'btn primario', onclick: function () { editar(null, ctx); } },
          ['Cadastrar PPS'])
      ]));

      alvo.appendChild(h('p', { class: 'p', text:
        'A embalagem não é decidida só pelo peso. Cada item guarda o método autorizado, o ciclo ' +
        'permitido e a barreira validada — e a carga não avança se a combinação não bater.' }));

      var porSetor = {};
      ctx.pps.forEach(function (p) { (porSetor[p.setor] = porSetor[p.setor] || []).push(p); });

      Object.keys(porSetor).sort().forEach(function (setor) {
        alvo.appendChild(U.secao(setor, porSetor[setor].map(function (p) {
          var bloq = F.bloqueioDe(ctx.bloqueios, 'pps', p.id);
          return U.cartao([
            h('div', { class: 'cartao-topo' }, [
              h('span', { class: 'eq-nome', text: p.nome }),
              bloq ? U.selo('reprovado', 'Bloqueado') : U.selo('neutro', p.id)
            ]),
            bloq ? h('div', { class: 'faixa-bloqueio compacta' }, [
              h('strong', { text: 'NÃO LIBERAR' }), h('p', { text: bloq.motivo })
            ]) : null,
            h('div', { class: 'tabela' }, [
              lin('Peso', p.pesoKg + ' kg'),
              lin('Método autorizado', p.metodo),
              lin('Ciclo permitido', p.cicloPermitido || 'qualquer validado'),
              lin('Barreira validada', p.barreira + (p.camadas > 1 ? ' · ' + p.camadas + ' camadas' : '')),
              lin('Validade da barreira', p.validadeDias + ' dias'),
              lin('Itens no conjunto', String(p.itens))
            ]),
            h('div', { class: 'barra-acao compacta' }, [
              h('button', { class: 'btn plano peq', onclick: function () { editar(p, ctx); } },
                ['Editar']),
              bloq
                ? h('button', { class: 'btn plano peq', onclick: function () { desbloquear(bloq); } },
                    ['Remover bloqueio'])
                : h('button', { class: 'btn perigo peq', onclick: function () { bloquear(p); } },
                    ['Não liberar'])
            ])
          ]);
        })));
      });
    });
  }

  function lin(rot, valor) {
    return h('div', { class: 'tab-lin' }, [
      h('span', { text: rot }), h('span', { class: 'cod', text: valor })
    ]);
  }

  function editar(p, ctx) {
    var novo = !p;
    p = p || { id: '', nome: '', setor: 'Centro Cirúrgico', pesoKg: 0, metodo: 'Vapor',
               cicloPermitido: '', barreira: BARREIRAS[0], camadas: 2, validadeDias: 90, itens: 1 };
    var programas = {};
    ctx.ciclos.forEach(function (c) { programas[c.programa] = true; });

    var form = h('div', {}, [
      U.campo('Código', U.texto('id', p.id, novo ? {} : { readonly: 'readonly' })),
      U.campo('Nome do produto ou conjunto', U.texto('nome', p.nome)),
      U.campo('Setor de origem', U.selecao('setor',
        ['Centro Cirúrgico', 'Centro Obstétrico', 'UTI', 'Endoscopia', 'Unidade de Internação',
         'Ambulatório'], p.setor)),
      U.campo('Peso (kg)', U.numero('pesoKg', p.pesoKg)),
      U.campo('Itens no conjunto', U.numero('itens', p.itens)),
      U.campo('Método de esterilização', U.selecao('metodo', METODOS, p.metodo),
        'Definido pela IFU do fabricante do produto.'),
      U.campo('Ciclo permitido', U.selecao('cicloPermitido',
        [{ v: '', r: 'Qualquer ciclo validado do método' }].concat(Object.keys(programas)),
        p.cicloPermitido)),
      U.campo('Barreira estéril validada', U.selecao('barreira', BARREIRAS, p.barreira)),
      U.campo('Camadas', U.numero('camadas', p.camadas)),
      U.campo('Validade da barreira (dias)', U.numero('validadeDias', p.validadeDias))
    ]);

    U.folha(novo ? 'Cadastrar PPS' : p.nome, form, [
      { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
      { rotulo: 'Salvar', estilo: 'primario', acao: function (fechar) {
        var v = U.valores(form);
        if (!v.id || !v.nome) return U.aviso('Informe código e nome do produto.', 'erro');
        if (v.metodo === 'H₂O₂' && v.barreira !== 'Tyvek® compatível') {
          return U.aviso('Peróxido de hidrogênio não é compatível com ' + v.barreira +
            '. Use barreira Tyvek® compatível.', 'erro');
        }
        if (v.metodo === 'Vapor' && v.barreira === 'Tyvek® compatível') {
          return U.aviso('Tyvek® não é a barreira prevista para vapor.', 'erro');
        }
        if (v.pesoKg > 5 && v.barreira === 'Papel grau cirúrgico') {
          return U.aviso('Papel grau cirúrgico não é validado para conjuntos acima de 5 kg.', 'erro');
        }
        CME.db.put('pps', Object.assign({}, p, v)).then(function () {
          fechar(); U.aviso('Cadastro salvo.', 'ok'); location.reload();
        });
      } }
    ]);
  }

  function bloquear(p) {
    var motivo = h('textarea', { name: 'motivo', rows: '3' });
    U.folha('Não liberar ' + p.nome, h('div', {}, [
      h('p', { class: 'p', text: 'Nenhuma carga que contenha este item poderá avançar enquanto ' +
        'o bloqueio estiver ativo.' }),
      U.campo('Motivo', motivo)
    ]), [
      { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
      { rotulo: 'Bloquear PPS', estilo: 'perigo', acao: function (fechar) {
        if (!motivo.value.trim()) return U.aviso('Descreva o motivo do bloqueio.', 'erro');
        Promise.all([
          CME.db.put('bloqueios', { alvoTipo: 'pps', alvoId: p.id, ativo: 1,
            motivo: motivo.value.trim(), ts: Date.now() }),
          CME.db.put('nc', { ts: Date.now(), status: 'aberta', alvoTipo: 'pps', alvoId: p.id,
            titulo: 'PPS bloqueado — ' + p.nome, origem: 'Preparo',
            descricao: motivo.value.trim() })
        ]).then(function () { fechar(); U.aviso(p.nome + ' bloqueado.', 'erro'); location.reload(); });
      } }
    ]);
  }

  function desbloquear(bloq) {
    U.confirmar('Remover bloqueio', 'Confirme que o item pode voltar ao processamento.', function () {
      bloq.ativo = 0; bloq.encerradoEm = Date.now();
      CME.db.put('bloqueios', bloq).then(function () {
        U.aviso('Item liberado.', 'ok'); location.reload();
      });
    }, 'Remover bloqueio');
  }

  CME.registrar('pps', { titulo: 'PPS e embalagem', render: render });
})(window.CME = window.CME || {});
