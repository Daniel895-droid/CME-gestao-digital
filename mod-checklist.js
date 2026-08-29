/* CME Digital — Checklist diário do enfermeiro e ajustes. */
(function (CME) {
  'use strict';
  var U = CME.ui, T = CME.util, h = U.h;

  var BLOCOS = [
    { titulo: 'Estrutura e ambiente', itens: [
      'Fluxo sujo → limpo preservado', 'Barreiras físicas e portas íntegras',
      'Bancadas, piso e paredes íntegros', 'Climatização em funcionamento',
      'Temperatura dentro da faixa', 'Umidade dentro da faixa', 'Limpeza ambiental realizada'] },
    { titulo: 'Expurgo', itens: [
      'EPIs disponíveis para toda a equipe', 'Detergente disponível e dentro da validade',
      'Diluição conferida', 'Escovas e acessórios em condição de uso',
      'Pistolas de água e ar operantes'] },
    { titulo: 'Preparo e inspeção', itens: [
      'Lupas funcionantes', 'Iluminação adequada nas bancadas',
      'Instrumental inspecionado', 'Testes funcionais realizados',
      'Seladora conferida no início do turno'] },
    { titulo: 'Esterilização', itens: [
      'Bowie-Dick realizado nas autoclaves de pré-vácuo',
      'Teste de vácuo conforme rotina', 'Impressora ou registro eletrônico funcionando',
      'Indicadores químicos disponíveis', 'Lote dos indicadores biológicos cadastrado',
      'Incubadora em temperatura operacional'] },
    { titulo: 'Armazenamento e distribuição', itens: [
      'Embalagens íntegras no arsenal', 'Ausência de umidade nas prateleiras',
      'Rodízio por validade em uso', 'Materiais protegidos de manipulação excessiva'] },
    { titulo: 'Equipe', itens: [
      'Dimensionamento suficiente para o turno', 'EPIs em uso correto',
      'Intercorrências do plantão anterior repassadas'] }
  ];

  function renderChecklist(alvo) {
    var hoje = T.hojeISO();
    return CME.db.porIndice('checklists', 'data', hoje).then(function (feitos) {
      alvo.appendChild(h('div', { class: 'barra-acao' }, [
        h('button', { class: 'btn primario', onclick: function () { preencher(); } },
          ['Preencher checklist do turno'])
      ]));

      if (!feitos.length) {
        alvo.appendChild(U.vazio('Checklist de hoje ainda não preenchido.',
          'Preencher agora', preencher));
      }

      return CME.db.todos('checklists').then(function (todos) {
        todos.sort(function (a, b) { return b.ts - a.ts; });
        if (!todos.length) return;
        alvo.appendChild(U.secao('Checklists preenchidos', todos.slice(0, 20).map(function (c) {
          var pct = Math.round((c.conformes / c.total) * 100);
          return U.cartao([
            h('div', { class: 'cartao-topo' }, [
              h('span', { class: 'eq-nome', text: c.data + ' — ' + c.turno }),
              U.selo(pct === 100 ? 'ok' : pct >= 90 ? 'atencao' : 'reprovado', pct + '%')
            ]),
            h('p', { class: 'cartao-sub', text: c.enfermeiro + ' · ' + c.conformes + ' de ' +
              c.total + ' itens conformes' }),
            c.naoConformes && c.naoConformes.length
              ? h('ul', { class: 'impedimentos' }, c.naoConformes.map(function (i) {
                  return h('li', { text: i });
                }))
              : null
          ]);
        })));
      });
    });
  }

  function preencher() {
    CME.db.todos('pessoas').then(function (pessoas) {
      var caixas = [];
      var form = h('div', {}, [
        U.campo('Turno', U.selecao('turno', ['Manhã', 'Tarde', 'Noite'])),
        U.campo('Enfermeiro responsável', U.selecao('enfermeiro',
          pessoas.filter(function (p) { return p.funcao.indexOf('Enfermeir') === 0; })
            .map(function (p) { return { v: p.nome, r: p.nome }; })
            .concat(pessoas.map(function (p) { return { v: p.nome, r: p.nome }; })))),
        U.campo('Técnicos presentes', U.numero('tecnicos', 4)),
        U.campo('Intercorrências do plantão anterior', h('textarea', { name: 'intercorrencias', rows: '2' }))
      ]);

      BLOCOS.forEach(function (b) {
        form.appendChild(h('h3', { class: 'sub', text: b.titulo }));
        b.itens.forEach(function (i) {
          var cx = h('input', { type: 'checkbox' });
          cx.checked = true;
          caixas.push({ item: i, el: cx });
          form.appendChild(h('label', { class: 'check' }, [cx, h('span', { text: i })]));
        });
      });

      U.folha('Checklist diário', form, [
        { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
        { rotulo: 'Salvar checklist', estilo: 'primario', acao: function (fechar) {
          var v = U.valores(form);
          var naoConformes = caixas.filter(function (c) { return !c.el.checked; })
            .map(function (c) { return c.item; });
          var reg = {
            data: T.hojeISO(), ts: Date.now(), turno: v.turno, enfermeiro: v.enfermeiro,
            tecnicos: v.tecnicos, intercorrencias: v.intercorrencias,
            total: caixas.length, conformes: caixas.length - naoConformes.length,
            naoConformes: naoConformes
          };
          CME.db.put('checklists', reg).then(function () {
            if (naoConformes.length) {
              return CME.db.put('nc', { ts: Date.now(), status: 'aberta', alvoTipo: 'checklist',
                alvoId: reg.data + '-' + reg.turno, origem: 'Checklist diário',
                titulo: 'Checklist com ' + naoConformes.length + ' item(ns) não conforme(s)',
                descricao: naoConformes.join('; ') });
            }
          }).then(function () {
            fechar();
            U.aviso(naoConformes.length
              ? 'Checklist salvo. Não conformidade aberta para os itens marcados.'
              : 'Checklist salvo. Setor conforme.', naoConformes.length ? 'erro' : 'ok');
            location.reload();
          });
        } }
      ]);
    });
  }

  /* ============ AJUSTES ============ */
  function renderAjustes(alvo) {
    alvo.appendChild(h('p', { class: 'p', text:
      'Os dados ficam gravados neste aparelho, no banco local do navegador. Nada é enviado para ' +
      'fora. Faça uma cópia de segurança com frequência.' }));

    alvo.appendChild(U.secao('Cópia de segurança', [
      h('div', { class: 'barra-acao' }, [
        h('button', { class: 'btn primario', onclick: exportar }, ['Baixar cópia']),
        h('label', { class: 'btn plano arquivo' }, [
          'Restaurar cópia',
          h('input', { type: 'file', accept: '.json', onchange: importar })
        ])
      ])
    ]));

    return CME.db.exportar().then(function (dump) {
      alvo.appendChild(U.secao('Registros guardados', [
        h('div', { class: 'tabela' }, Object.keys(dump.dados).map(function (k) {
          return h('div', { class: 'tab-lin' }, [
            h('span', { text: k }),
            h('span', { class: 'cod', text: String(dump.dados[k].length) })
          ]);
        }))
      ]));

      alvo.appendChild(U.secao('Zona de risco', [
        h('p', { class: 'p', text: 'Apagar o banco remove todas as cargas, cadastros e registros ' +
          'deste aparelho. Não há como desfazer.' }),
        h('button', { class: 'btn perigo', onclick: function () {
          U.confirmar('Apagar todos os dados',
            'Baixe uma cópia antes. Todos os registros deste aparelho serão perdidos.',
            function () { CME.db.apagarTudo().then(function () { location.reload(); }); },
            'Apagar tudo');
        } }, ['Apagar todos os dados'])
      ]));
    });
  }

  function exportar() {
    CME.db.exportar().then(function (dump) {
      var blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'cme-backup-' + T.hojeISO() + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      U.aviso('Cópia baixada.', 'ok');
    });
  }

  function importar(ev) {
    var f = ev.target.files[0];
    if (!f) return;
    var leitor = new FileReader();
    leitor.onload = function () {
      try {
        var dump = JSON.parse(leitor.result);
        CME.db.importar(dump).then(function () {
          U.aviso('Cópia restaurada.', 'ok'); location.reload();
        });
      } catch (e) {
        U.aviso('Arquivo inválido: ' + e.message, 'erro');
      }
    };
    leitor.readAsText(f);
  }

  CME.registrar('checklist', { titulo: 'Checklist diário', render: renderChecklist });
  CME.registrar('ajustes', { titulo: 'Ajustes', render: renderAjustes });
})(window.CME = window.CME || {});
