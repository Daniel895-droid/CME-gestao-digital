/* CME Digital — IFU: instruções do fabricante (§4).
   A IFU é a regra específica que nenhuma regra genérica pode substituir. */
(function (CME) {
  'use strict';
  var U = CME.ui, T = CME.util, h = U.h;

  var METODOS = ['Vapor', 'H₂O₂', 'Óxido de etileno'];
  var BARREIRAS = ['SMS 60 g/m²', 'Papel grau cirúrgico', 'Container validado', 'Tyvek® compatível'];

  function render(alvo) {
    return Promise.all([CME.db.todos('ifus'), CME.db.todos('pps'), CME.db.todos('equipamentos')])
      .then(function (r) {
        var ifus = r[0], pps = r[1], equipamentos = r[2];

        alvo.appendChild(h('div', { class: 'barra-acao' }, [
          h('button', { class: 'btn primario', onclick: function () { editar(null, pps, equipamentos); } },
            ['Cadastrar IFU'])
        ]));

        alvo.appendChild(h('p', { class: 'p', text:
          'A IFU do fabricante manda. Quando ela diverge do cadastro institucional, o app não ' +
          'escolhe sozinho: marca conflito e encaminha para a enfermeira responsável.' }));

        var pendentes = ifus.filter(function (i) { return i.revisaoPendente; });
        if (pendentes.length) {
          alvo.appendChild(h('div', { class: 'faixa-bloqueio compacta' }, [
            h('strong', { text: 'IFU atualizada — revisão de processo necessária' }),
            h('p', { text: pendentes.map(function (i) { return i.alvoNome; }).join(', ') })
          ]));
        }

        var vigentes = ifus.filter(function (i) { return i.status === 'vigente'; });
        var antigas = ifus.filter(function (i) { return i.status !== 'vigente'; });

        if (!ifus.length) {
          alvo.appendChild(U.vazio('Nenhuma IFU cadastrada. Sem IFU, o processamento segue pelo ' +
            'cadastro institucional.', 'Cadastrar IFU',
            function () { editar(null, pps, equipamentos); }));
          return;
        }

        alvo.appendChild(U.secao('IFUs vigentes', vigentes.map(function (i) {
          return cartaoIFU(i, pps, equipamentos);
        })));
        if (antigas.length) {
          alvo.appendChild(U.secao('Versões substituídas', antigas.map(function (i) {
            return U.cartao([
              h('div', { class: 'cartao-topo' }, [
                h('span', { class: 'eq-nome', text: i.alvoNome }),
                U.selo('neutro', 'rev. ' + i.versao)
              ]),
              h('p', { class: 'cartao-sub', text: i.fabricante + ' · substituída em ' +
                (i.substituidaEm ? T.dataHora(i.substituidaEm) : '—') })
            ]);
          })));
        }
      });
  }

  function cartaoIFU(i, pps, equipamentos) {
    var r = i.regras || {};
    var linhas = [];
    function lin(rot, valor) {
      if (valor === null || valor === undefined || valor === '') return;
      linhas.push(h('div', { class: 'tab-lin' }, [
        h('span', { text: rot }), h('span', { class: 'cod', text: valor })
      ]));
    }
    lin('Métodos permitidos', (r.metodosPermitidos || []).join(', '));
    lin('Métodos proibidos', (r.metodosProibidos || []).join(', '));
    lin('Ciclos permitidos', (r.ciclosPermitidos || []).join(', '));
    lin('Temperatura máxima', r.tempMaxC ? r.tempMaxC + ' °C' : '');
    lin('Barreiras previstas', (r.barreiras || []).join(', '));
    lin('Limpeza ultrassônica', r.ultrassonica === false ? 'não permitida' :
        r.ultrassonica === true ? 'permitida' : '');
    lin('Termodesinfecção', r.termodesinfeccao === false ? 'não permitida' :
        r.termodesinfeccao === true ? 'permitida' : '');

    return U.cartao([
      h('div', { class: 'cartao-topo' }, [
        h('span', { class: 'eq-nome', text: i.alvoNome }),
        i.revisaoPendente ? U.selo('atencao', 'revisar processo')
                          : U.selo('ok', 'rev. ' + i.versao)
      ]),
      h('p', { class: 'cartao-sub', text: i.fabricante + ' · IFU de ' + i.dataIFU }),
      i.revisaoPendente ? h('div', { class: 'faixa-bloqueio compacta' }, [
        h('strong', { text: 'Revisão pendente' }),
        h('p', { text: 'Esta IFU foi atualizada. As cargas com este item ficam em conflito até ' +
          'a revisão do processo.' })
      ]) : null,
      h('div', { class: 'tabela' }, linhas),
      r.observacao ? h('p', { class: 'dica', text: r.observacao }) : null,
      h('div', { class: 'barra-acao compacta' }, [
        h('button', { class: 'btn plano peq',
          onclick: function () { editar(i, pps, equipamentos); } }, ['Nova versão']),
        i.revisaoPendente
          ? h('button', { class: 'btn plano peq', onclick: function () { concluirRevisao(i); } },
              ['Marcar processo revisado'])
          : null
      ])
    ]);
  }

  function editar(base, pps, equipamentos) {
    var nova = !!base;   /* editar = cadastrar nova versão, a anterior é preservada */
    var b = base || { alvoTipo: 'pps', alvoId: '', fabricante: '', versao: '01',
                      dataIFU: T.hojeISO(), regras: {} };
    var r = b.regras || {};

    var selTipo = U.selecao('alvoTipo', [{ v: 'pps', r: 'Produto para saúde' },
                                         { v: 'equipamento', r: 'Equipamento' }], b.alvoTipo);
    var selAlvo = U.selecao('alvoId', [], b.alvoId);
    function popular() {
      var lista = selTipo.value === 'pps'
        ? pps.map(function (p) { return { v: p.id, r: p.nome }; })
        : equipamentos.map(function (e) { return { v: e.id, r: e.nome }; });
      U.limpar(selAlvo);
      [{ v: '', r: 'Escolher…' }].concat(lista).forEach(function (o) {
        var op = h('option', { value: o.v, text: o.r });
        if (o.v === b.alvoId) op.selected = true;
        selAlvo.appendChild(op);
      });
    }
    popular();
    selTipo.addEventListener('change', popular);

    function multi(nome, opcoes, marcados) {
      marcados = marcados || [];
      return h('div', { class: 'multi' }, opcoes.map(function (o) {
        var cx = h('input', { type: 'checkbox', name: nome + ':' + o });
        cx.checked = marcados.indexOf(o) > -1;
        return h('label', { class: 'check' }, [cx, h('span', { text: o })]);
      }));
    }

    var form = h('div', {}, [
      U.campo('Aplica-se a', selTipo),
      U.campo('Item', selAlvo),
      U.campo('Fabricante', U.texto('fabricante', b.fabricante)),
      U.campo('Versão da IFU', U.texto('versao', nova ? proximaVersao(b.versao) : b.versao)),
      U.campo('Data da IFU', h('input', { type: 'date', name: 'dataIFU', value: b.dataIFU })),
      h('h3', { class: 'sub', text: 'Métodos permitidos' }),
      multi('perm', METODOS, r.metodosPermitidos),
      h('h3', { class: 'sub', text: 'Métodos expressamente proibidos' }),
      multi('proi', METODOS, r.metodosProibidos),
      h('h3', { class: 'sub', text: 'Barreiras previstas' }),
      multi('barr', BARREIRAS, r.barreiras),
      U.campo('Ciclos permitidos', U.texto('ciclos', (r.ciclosPermitidos || []).join(', ')),
        'Separe por vírgula, exatamente como o ciclo está cadastrado. Ex.: Lúmen, Flexível.'),
      U.campo('Temperatura máxima (°C)', U.numero('tempMaxC', r.tempMaxC)),
      U.campo('Limpeza ultrassônica', U.selecao('ultrassonica',
        [{ v: '', r: 'não especificado' }, { v: 'sim', r: 'permitida' },
         { v: 'nao', r: 'não permitida' }],
        r.ultrassonica === true ? 'sim' : r.ultrassonica === false ? 'nao' : '')),
      U.campo('Termodesinfecção', U.selecao('termodesinfeccao',
        [{ v: '', r: 'não especificado' }, { v: 'sim', r: 'permitida' },
         { v: 'nao', r: 'não permitida' }],
        r.termodesinfeccao === true ? 'sim' : r.termodesinfeccao === false ? 'nao' : '')),
      U.campo('Observação do fabricante', h('textarea', { name: 'observacao', rows: '3' },
        [r.observacao || '']))
    ]);

    U.folha(nova ? 'Nova versão da IFU' : 'Cadastrar IFU', form, [
      { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
      { rotulo: 'Salvar IFU', estilo: 'primario', acao: function (fechar) {
        var v = U.valores(form);
        if (!v.alvoId || !v.fabricante) {
          return U.aviso('Informe o item e o fabricante.', 'erro');
        }
        function marcados(prefixo) {
          return Object.keys(v).filter(function (k) {
            return k.indexOf(prefixo + ':') === 0 && v[k];
          }).map(function (k) { return k.split(':')[1]; });
        }
        var lista = v.alvoTipo === 'pps' ? pps : equipamentos;
        var alvo = lista.filter(function (x) { return x.id === v.alvoId; })[0];

        var reg = {
          id: v.alvoTipo + ':' + v.alvoId + ':v' + v.versao,
          alvoTipo: v.alvoTipo, alvoId: v.alvoId,
          alvoNome: alvo ? alvo.nome : v.alvoId,
          fabricante: v.fabricante, versao: v.versao, dataIFU: v.dataIFU,
          status: 'vigente', revisaoPendente: nova ? 1 : 0, ts: Date.now(),
          regras: {
            metodosPermitidos: marcados('perm'),
            metodosProibidos: marcados('proi'),
            barreiras: marcados('barr'),
            ciclosPermitidos: v.ciclos ? v.ciclos.split(',').map(function (s) { return s.trim(); })
              .filter(Boolean) : [],
            tempMaxC: v.tempMaxC,
            ultrassonica: v.ultrassonica === 'sim' ? true : v.ultrassonica === 'nao' ? false : null,
            termodesinfeccao: v.termodesinfeccao === 'sim' ? true
              : v.termodesinfeccao === 'nao' ? false : null,
            observacao: v.observacao
          }
        };

        /* versões anteriores do mesmo item são preservadas, nunca apagadas (§30) */
        CME.db.porIndice('ifus', 'alvoId', v.alvoId).then(function (antigas) {
          var arquivar = antigas.filter(function (a) {
            return a.alvoTipo === v.alvoTipo && a.status === 'vigente' && a.id !== reg.id;
          }).map(function (a) {
            a.status = 'substituida'; a.revisaoPendente = 0; a.substituidaEm = Date.now();
            return a;
          });
          return arquivar.length ? CME.db.putVarios('ifus', arquivar) : null;
        }).then(function () {
          return CME.db.put('ifus', reg);
        }).then(function () {
          fechar();
          U.aviso(nova ? 'Nova versão registrada. Revise o processo antes de liberar cargas.'
                       : 'IFU cadastrada.', nova ? 'erro' : 'ok');
          location.reload();
        });
      } }
    ]);
  }

  function proximaVersao(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? v : String(n + 1).padStart(2, '0');
  }

  function concluirRevisao(i) {
    U.confirmar('Processo revisado',
      'Confirme que o processamento foi conferido contra a versão ' + i.versao + ' da IFU de ' +
      i.alvoNome + '.', function () {
        i.revisaoPendente = 0;
        i.revisadoEm = Date.now();
        CME.db.put('ifus', i).then(function () {
          U.aviso('Revisão concluída.', 'ok'); location.reload();
        });
      }, 'Confirmar revisão');
  }

  CME.registrar('ifus', { titulo: 'IFUs dos fabricantes', render: render });
})(window.CME = window.CME || {});
