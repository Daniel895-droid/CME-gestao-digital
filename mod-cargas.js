/* CME Digital — Cargas: o fluxo do material e a trilha de rastreabilidade. */
(function (CME) {
  'use strict';
  var U = CME.ui, T = CME.util, F = CME.fluxo, h = U.h;

  function registrarEvento(carga, etapa, dados) {
    return CME.db.put('eventos', Object.assign({
      cargaId: carga.id, numero: carga.numero, etapa: etapa, ts: Date.now()
    }, dados || {}));
  }

  /* ---------------- trilha ---------------- */
  function trilha(carga, bloqueada) {
    var atual = F.indiceEtapa(carga.etapa);
    var linha = h('ol', { class: 'trilha' + (bloqueada ? ' travada' : '') },
      F.ETAPAS.map(function (e, i) {
        var estado = i < atual ? 'feito' : (i === atual ? 'agora' : 'futuro');
        if (carga.status === 'reprovada' && i >= atual) estado = 'parado';
        return h('li', { class: 'passo ' + estado }, [
          h('span', { class: 'passo-marca' }),
          h('span', { class: 'passo-rot', text: e.curto }),
          carga.marcos && carga.marcos[e.id]
            ? h('span', { class: 'passo-hora', text: T.hora(carga.marcos[e.id]) })
            : null
        ]);
      }));
    return linha;
  }

  /* ---------------- lista ---------------- */
  function lista(alvo) {
    return CME.db.todos('cargas').then(function (cargas) {
      cargas.sort(function (a, b) { return b.criadaEm - a.criadaEm; });

      alvo.appendChild(h('div', { class: 'barra-acao' }, [
        h('button', { class: 'btn primario', onclick: function () { novaCarga(); } },
          ['Abrir nova carga']),
        h('button', { class: 'btn plano', onclick: function () { buscarPorCodigo(); } },
          ['Buscar por código'])
      ]));

      if (!cargas.length) {
        alvo.appendChild(U.vazio(
          'Nenhuma carga registrada ainda. A primeira carga começa na recepção do material.',
          'Abrir nova carga', function () { novaCarga(); }));
        return;
      }

      var abertas = cargas.filter(function (c) { return c.etapa !== 'distribuicao'; });
      var fechadas = cargas.filter(function (c) { return c.etapa === 'distribuicao'; });

      return F.bloqueiosAtivos().then(function (bloqueios) {
        function cartaoCarga(c) {
          var b = F.bloqueioDe(bloqueios, 'carga', c.id);
          var peso = (c.itens || []).reduce(function (s, i) { return s + (i.peso || 0); }, 0);
          return U.cartao([
            h('div', { class: 'cartao-topo' }, [
              h('span', { class: 'cod', text: c.numero }),
              b ? U.selo('reprovado', 'Bloqueada')
                : U.selo(c.status === 'reprovada' ? 'reprovado' : 'ok',
                         F.ETAPAS[F.indiceEtapa(c.etapa)].rot)
            ]),
            h('p', { class: 'cartao-sub', text:
              (c.itens || []).length + ' item(ns) · ' + peso.toFixed(1) + ' kg · ' +
              (c.setor || 'sem destino') }),
            trilha(c, !!b)
          ], { class: 'cartao clicavel', tabindex: '0', role: 'button',
               onclick: function () { CME.ir('cargas', c.id); },
               onkeydown: function (e) { if (e.key === 'Enter') CME.ir('cargas', c.id); } });
        }

        alvo.appendChild(U.secao('Em processamento',
          abertas.length ? abertas.map(cartaoCarga)
                         : [h('p', { class: 'p', text: 'Nenhuma carga em processamento.' })]));
        if (fechadas.length) {
          alvo.appendChild(U.secao('Distribuídas', fechadas.slice(0, 12).map(cartaoCarga)));
        }
      });
    });
  }

  /* ---------------- nova carga ---------------- */
  function novaCarga() {
    Promise.all([CME.db.todos('pps'), CME.db.todos('pessoas')]).then(function (r) {
      var listaPps = r[0], pessoas = r[1].filter(function (p) { return p.ativo; });
      var escolhidos = [];

      var caixaItens = h('div', { class: 'escolhidos' });
      function pintar() {
        U.limpar(caixaItens);
        if (!escolhidos.length) {
          caixaItens.appendChild(h('p', { class: 'dica', text: 'Nenhum item na carga.' }));
        }
        escolhidos.forEach(function (it, i) {
          caixaItens.appendChild(h('div', { class: 'item-lin' }, [
            h('span', { text: it.nome }),
            h('span', { class: 'cod', text: it.peso.toFixed(2) + ' kg' }),
            h('button', { class: 'ico', 'aria-label': 'Remover ' + it.nome, html: '&times;',
              onclick: function () { escolhidos.splice(i, 1); pintar(); } })
          ]));
        });
        var total = escolhidos.reduce(function (s, i) { return s + i.peso; }, 0);
        caixaItens.appendChild(h('p', { class: 'total', text: 'Peso total: ' + total.toFixed(2) + ' kg' }));
      }

      var seletor = U.selecao('addPps', [{ v: '', r: 'Escolher item…' }].concat(
        listaPps.map(function (p) {
          return { v: p.id, r: p.nome + ' — ' + p.metodo + ' — ' + p.pesoKg + ' kg' };
        })));
      seletor.addEventListener('change', function () {
        var p = listaPps.filter(function (x) { return x.id === seletor.value; })[0];
        if (p) { escolhidos.push({ ppsId: p.id, nome: p.nome, peso: p.pesoKg, metodo: p.metodo }); pintar(); }
        seletor.value = '';
      });

      var form = h('div', {}, [
        U.campo('Origem do material',
          U.selecao('setor', ['Centro Cirúrgico', 'Centro Obstétrico', 'UTI', 'Endoscopia',
                              'Unidade de Internação', 'Ambulatório'])),
        U.campo('Recebido por', U.selecao('operador',
          pessoas.map(function (p) { return { v: p.id, r: p.nome }; }))),
        U.campo('Condição do material recebido',
          U.selecao('condicao', ['Íntegro', 'Com resíduo aderido', 'Item faltante', 'Danificado']),
          'Material recusado gera não conformidade automática.'),
        U.campo('Observação da recepção', h('textarea', { name: 'obs', rows: '2' })),
        h('h3', { class: 'sub', text: 'Itens da carga' }),
        U.campo('Adicionar item', seletor),
        caixaItens
      ]);
      pintar();

      U.folha('Nova carga', form, [
        { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
        { rotulo: 'Registrar recepção', estilo: 'primario', acao: function (fechar) {
          var v = U.valores(form);
          if (!escolhidos.length) return U.aviso('Adicione ao menos um item à carga.', 'erro');
          CME.db.proximoNumeroCarga().then(function (numero) {
            var agora = Date.now();
            var carga = {
              id: 'C-' + numero, numero: numero, etapa: 'recepcao', status: 'ativa',
              setor: v.setor, itens: escolhidos, operador: v.operador,
              condicao: v.condicao, obs: v.obs, criadaEm: agora,
              data: T.hojeISO(), marcos: { recepcao: agora },
              iq: null, ib: null, temIB: false, registroFisico: false, pacoteMolhado: false
            };
            return CME.db.put('cargas', carga)
              .then(function () { return registrarEvento(carga, 'recepcao', {
                operador: v.operador, detalhe: v.condicao }); })
              .then(function () {
                if (v.condicao !== 'Íntegro') {
                  return CME.db.put('nc', {
                    ts: agora, status: 'aberta', alvoTipo: 'carga', alvoId: carga.id,
                    titulo: 'Material recebido: ' + v.condicao,
                    descricao: 'Carga ' + numero + ' recebida do ' + v.setor + '. ' + (v.obs || ''),
                    origem: 'Recepção'
                  });
                }
              })
              .then(function () {
                fechar();
                U.aviso('Carga ' + numero + ' aberta.', 'ok');
                CME.ir('cargas', carga.id);
              });
          });
        } }
      ]);
    });
  }

  function buscarPorCodigo() {
    var entrada = U.texto('codigo', '', { placeholder: '2026-000012', inputmode: 'numeric' });
    var form = h('div', {}, [
      U.campo('Código da carga', entrada, 'Leia a etiqueta ou digite o número impresso.')
    ]);
    U.folha('Buscar carga', form, [
      { rotulo: 'Abrir', estilo: 'primario', acao: function (fechar) {
        var cod = entrada.value.trim();
        CME.db.porIndice('cargas', 'numero', cod).then(function (r) {
          if (!r.length) return U.aviso('Nenhuma carga com o código ' + cod + '.', 'erro');
          fechar(); CME.ir('cargas', r[0].id);
        });
      } }
    ]);
  }

  /* ---------------- detalhe ---------------- */
  function detalhe(alvo, id) {
    return Promise.all([CME.db.get('cargas', id), CME.contexto(), CME.db.todos('pessoas'),
                        CME.db.porIndice('eventos', 'cargaId', id)])
      .then(function (r) {
        var carga = r[0], ctx = r[1], pessoas = r[2], eventos = r[3];
        if (!carga) { alvo.appendChild(h('p', { class: 'p', text: 'Carga não encontrada.' })); return; }
        var bloq = F.bloqueioDe(ctx.bloqueios, 'carga', carga.id);
        var iAtual = F.indiceEtapa(carga.etapa);
        var proxima = F.ETAPAS[iAtual + 1];
        var peso = (carga.itens || []).reduce(function (s, i) { return s + (i.peso || 0); }, 0);
        var nomeDe = function (pid) {
          var p = pessoas.filter(function (x) { return x.id === pid; })[0];
          return p ? p.nome : '—';
        };

        alvo.appendChild(h('div', { class: 'cabeca-carga' }, [
          h('button', { class: 'btn voltar', onclick: function () { CME.ir('cargas'); } },
            ['← Cargas']),
          h('div', { class: 'cod-grande', text: carga.numero }),
          h('p', { class: 'cartao-sub', text: carga.setor + ' · ' + peso.toFixed(2) + ' kg · aberta às ' +
                   T.hora(carga.criadaEm) })
        ]));

        if (bloq) {
          alvo.appendChild(h('div', { class: 'faixa-bloqueio' }, [
            h('strong', { text: 'NÃO LIBERAR' }),
            h('p', { text: bloq.motivo }),
            h('button', { class: 'btn plano', onclick: function () { liberarBloqueio(bloq); } },
              ['Remover bloqueio'])
          ]));
        }

        alvo.appendChild(U.secao('Trilha', [trilha(carga, !!bloq)]));

        /* avanço */
        if (proxima) {
          var val = F.podeAvancar(carga, proxima.id, ctx);
          var travado = val.duros.length > 0;
          var painel = h('div', { class: 'painel-avanco' + (travado ? ' impedido' : '') });
          painel.appendChild(h('h3', { class: 'sub', text: 'Próxima etapa: ' + proxima.rot }));
          if (val.duros.length) {
            painel.appendChild(h('ul', { class: 'impedimentos' }, val.duros.map(function (m) {
              return h('li', { text: m });
            })));
            painel.appendChild(h('p', { class: 'dica', text:
              'Resolva os pontos acima para registrar ' + proxima.rot + '.' }));
          } else {
            painel.appendChild(h('button', { class: 'btn primario largo',
              onclick: function () { avancar(carga, proxima.id, ctx, pessoas); } },
              ['Registrar ' + proxima.rot]));
          }
          if (val.conformidade && val.conformidade.length) {
            painel.appendChild(h('div', { class: 'conformidade' }, [
              h('p', { class: 'conf-tit', text: 'Motor de conformidade' })
            ].concat(val.conformidade.map(function (a) {
              return h('div', { class: 'conf-item c-' + a.nivel }, [
                h('span', { class: 'conf-nivel', text:
                  a.nivel === 'bloqueio' ? 'Bloqueio'
                  : a.nivel === 'conflito' ? 'Conflito de requisitos' : 'Alerta' }),
                h('p', { class: 'conf-txt', text: a.texto }),
                h('p', { class: 'conf-fonte', text: a.fonte })
              ]);
            }))));
          }
          alvo.appendChild(painel);
        } else {
          alvo.appendChild(h('div', { class: 'painel-avanco concluido' }, [
            h('h3', { class: 'sub', text: 'Carga distribuída' }),
            h('p', { class: 'p', text: 'Processamento concluído e entregue ao ' + carga.setor + '.' })
          ]));
        }

        /* itens */
        alvo.appendChild(U.secao('Itens', [
          h('div', { class: 'tabela' }, (carga.itens || []).map(function (it) {
            var pps = ctx.pps.filter(function (p) { return p.id === it.ppsId; })[0];
            return h('div', { class: 'tab-lin' }, [
              h('span', { text: it.nome }),
              h('span', { class: 'cod', text: it.peso.toFixed(2) + ' kg' }),
              h('span', { class: 'dica', text: pps ? pps.barreira : it.metodo })
            ]);
          }))
        ]));

        /* ciclo e monitoramento */
        if (F.indiceEtapa(carga.etapa) >= F.indiceEtapa('esterilizacao')) {
          var eq = ctx.equipamentos.filter(function (e) { return e.id === carga.equipamentoId; })[0];
          var ci = ctx.ciclos.filter(function (c) { return c.id === carga.cicloId; })[0];
          alvo.appendChild(U.secao('Ciclo', [
            h('div', { class: 'tabela' }, [
              h('div', { class: 'tab-lin' }, [h('span', { text: 'Esterilizador' }),
                h('span', { class: 'cod', text: eq ? eq.nome : '—' })]),
              h('div', { class: 'tab-lin' }, [h('span', { text: 'Programa' }),
                h('span', { class: 'cod', text: ci ? ci.programa : '—' })]),
              h('div', { class: 'tab-lin' }, [h('span', { text: 'Parâmetros' }),
                h('span', { class: 'cod', text: ci ? ci.tempC + ' °C · ' + ci.exposicaoMin +
                  ' min · secagem ' + ci.secagemMin + ' min' : '—' })]),
              h('div', { class: 'tab-lin' }, [h('span', { text: 'Nº do ciclo no equipamento' }),
                h('span', { class: 'cod', text: carga.numeroCiclo || '—' })])
            ]),
            monitoramento(carga),
            h('div', { class: 'barra-acao compacta' }, [
              h('button', { class: 'btn plano peq',
                onclick: function () { registrarMonitoramento(carga); } },
                ['Registrar monitoramento'])
            ])
          ]));
        }

        /* histórico */
        eventos.sort(function (a, b) { return a.ts - b.ts; });
        alvo.appendChild(U.secao('Histórico', [
          h('div', { class: 'linha-tempo' }, eventos.map(function (ev) {
            var et = F.ETAPAS[F.indiceEtapa(ev.etapa)];
            var detalhe = [ev.detalhe, ev.operador ? nomeDe(ev.operador) : null]
              .filter(Boolean).join(' · ');
            return h('div', { class: 'evento' }, [
              h('div', { class: 'evento-topo' }, [
                h('span', { class: 'evento-etapa', text: et ? et.rot : ev.etapa }),
                h('span', { class: 'cod', text: T.dataHora(ev.ts) })
              ]),
              detalhe ? h('p', { class: 'dica', text: detalhe }) : null
            ]);
          }))
        ]));

        alvo.appendChild(h('div', { class: 'barra-acao' }, [
          h('button', { class: 'btn plano', onclick: function () { etiqueta(carga); } },
            ['Etiqueta e QR']),
          !bloq ? h('button', { class: 'btn perigo', onclick: function () { bloquear(carga); } },
            ['Não liberar']) : null
        ]));
      });
  }

  function monitoramento(carga) {
    function linha(rot, valor, situacao) {
      return h('div', { class: 'tab-lin' }, [
        h('span', { text: rot }),
        U.selo(situacao, valor)
      ]);
    }
    return h('div', { class: 'tabela' }, [
      linha('Indicador químico', carga.iq || 'pendente',
            carga.iq === 'aprovado' ? 'ok' : carga.iq === 'reprovado' ? 'reprovado' : 'atencao'),
      carga.temIB ? linha('Indicador biológico', carga.ib || 'aguardando leitura',
            carga.ib === 'aprovado' ? 'ok' : carga.ib === 'reprovado' ? 'reprovado' : 'atencao')
        : linha('Indicador biológico', 'não previsto nesta carga', 'neutro'),
      linha('Registro físico do ciclo', carga.registroFisico ? 'conferido' : 'pendente',
            carga.registroFisico ? 'ok' : 'atencao'),
      linha('Pacote seco', carga.pacoteMolhado ? 'pacote molhado' : 'sem intercorrência',
            carga.pacoteMolhado ? 'reprovado' : 'ok')
    ]);
  }

  /* ---------------- monitoramento do processo ---------------- */
  function registrarMonitoramento(carga) {
    var campos = [
      U.campo('Indicador químico interno',
        U.selecao('iq', [{ v: '', r: 'pendente' }, { v: 'aprovado', r: 'aprovado' },
                         { v: 'reprovado', r: 'reprovado' }], carga.iq || '')),
      U.campo('Registro físico do ciclo conferido',
        U.selecao('registroFisico', [{ v: 'nao', r: 'não conferido' },
                                     { v: 'sim', r: 'conferido' }],
                  carga.registroFisico ? 'sim' : 'nao'),
        'Temperatura, pressão e tempo do gráfico ou impressão do equipamento.'),
      U.campo('Integridade dos pacotes',
        U.selecao('pacoteMolhado', [{ v: 'nao', r: 'seco e íntegro' },
                                    { v: 'sim', r: 'pacote molhado' }],
                  carga.pacoteMolhado ? 'sim' : 'nao'))
    ];
    if (carga.temIB) {
      campos.unshift(U.campo('Indicador biológico',
        U.selecao('ib', [{ v: '', r: 'aguardando leitura' }, { v: 'aprovado', r: 'aprovado' },
                         { v: 'reprovado', r: 'reprovado' }], carga.ib || ''),
        'Só registre após o tempo de incubação previsto pelo fabricante.'));
    }

    var form = h('div', {}, campos);
    U.folha('Monitoramento — carga ' + carga.numero, form, [
      { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
      { rotulo: 'Salvar', estilo: 'primario', acao: function (fechar) {
        var v = U.valores(form);
        carga.iq = v.iq || null;
        if (carga.temIB) carga.ib = v.ib || null;
        carga.registroFisico = v.registroFisico === 'sim';
        carga.pacoteMolhado = v.pacoteMolhado === 'sim';

        var falhou = carga.iq === 'reprovado' || carga.ib === 'reprovado' || carga.pacoteMolhado;
        if (falhou) carga.status = 'reprovada';

        CME.db.put('cargas', carga)
          .then(function () {
            return registrarEvento(carga, carga.etapa, {
              detalhe: 'Monitoramento: IQ ' + (carga.iq || 'pendente') +
                (carga.temIB ? ' · IB ' + (carga.ib || 'pendente') : '') +
                (carga.pacoteMolhado ? ' · pacote molhado' : '')
            });
          })
          .then(function () {
            if (!falhou) return;
            var motivo = carga.iq === 'reprovado' ? 'Indicador químico reprovado.'
              : carga.ib === 'reprovado' ? 'Indicador biológico reprovado.'
              : 'Pacote molhado identificado na carga.';
            return Promise.all([
              CME.db.put('bloqueios', { alvoTipo: 'carga', alvoId: carga.id, ativo: 1,
                motivo: motivo, ts: Date.now() }),
              CME.db.put('nc', { ts: Date.now(), status: 'aberta', alvoTipo: 'carga',
                alvoId: carga.id, titulo: motivo, origem: 'Esterilização',
                descricao: 'Carga ' + carga.numero + ' reprovada no monitoramento. ' +
                  'Material deve retornar ao processamento.' })
            ]);
          })
          .then(function () {
            fechar();
            U.aviso(falhou ? 'Carga reprovada e bloqueada. Não conformidade aberta.'
                           : 'Monitoramento registrado.', falhou ? 'erro' : 'ok');
            location.reload();
          });
      } }
    ]);
  }

  /* ---------------- registrar etapa ---------------- */
  function avancar(carga, etapa, ctx, pessoas) {
    var campos = [];
    var opPessoas = pessoas.filter(function (p) { return p.ativo; })
      .map(function (p) { return { v: p.id, r: p.nome }; });

    if (etapa === 'limpeza') {
      campos.push(U.campo('Método de limpeza',
        U.selecao('metodo', ['Termodesinfecção', 'Ultrassônica + termodesinfecção', 'Manual'])));
      campos.push(U.campo('Equipamento', U.selecao('equipamentoLimpeza',
        ctx.equipamentos.filter(function (e) { return e.tipo === 'lavadora' || e.tipo === 'ultrassonica'; })
          .map(function (e) { return { v: e.id, r: e.nome }; }))));
      campos.push(U.campo('Lote do detergente', U.texto('lote')));
      campos.push(U.campo('Teste de eficácia da limpeza',
        U.selecao('eficacia', ['aprovado', 'reprovado', 'não aplicável'])));
    }
    if (etapa === 'preparo') {
      campos.push(U.campo('Inspeção com lupa',
        U.selecao('inspecao', ['aprovada', 'item reprovado', 'item enviado a reparo'])));
      campos.push(U.campo('Teste funcional', U.selecao('funcional', ['aprovado', 'reprovado'])));
    }
    if (etapa === 'embalagem') {
      campos.push(U.campo('Barreira utilizada',
        U.selecao('barreira', ['SMS 60 g/m²', 'Papel grau cirúrgico', 'Container validado',
                               'Tyvek® compatível'])));
      campos.push(U.campo('Selagem conferida', U.selecao('selagem', ['sim', 'não'])));
    }
    if (etapa === 'esterilizacao') {
      var esterilizadores = ctx.equipamentos.filter(function (e) {
        return e.tipo === 'autoclave' || e.tipo === 'baixa-temperatura';
      });
      var selEq = U.selecao('equipamentoId', [{ v: '', r: 'Escolher…' }].concat(
        esterilizadores.map(function (e) {
          return { v: e.id, r: e.nome + (e.status !== 'disponivel' ? ' (' + e.status + ')' : '') };
        })), carga.equipamentoId);
      var selCiclo = U.selecao('cicloId', [{ v: '', r: 'Escolha o esterilizador primeiro' }]);
      selEq.addEventListener('change', function () {
        var opts = ctx.ciclos.filter(function (c) { return c.equipamentoId === selEq.value; })
          .map(function (c) { return { v: c.id, r: c.programa + ' — ' + c.tempC + ' °C / ' +
            c.exposicaoMin + ' min' }; });
        U.limpar(selCiclo);
        [{ v: '', r: 'Escolher ciclo validado…' }].concat(opts).forEach(function (o) {
          selCiclo.appendChild(h('option', { value: o.v, text: o.r }));
        });
      });
      campos.push(U.campo('Esterilizador', selEq));
      campos.push(U.campo('Ciclo validado', selCiclo,
        'Só aparecem ciclos cadastrados e validados para este equipamento.'));

      /* avaliação ao vivo: o motor responde antes da confirmação */
      var vivo = h('div', { class: 'conformidade vivo' });
      function avaliarAoVivo() {
        U.limpar(vivo);
        if (!selEq.value || !selCiclo.value) return;
        var provisoria = Object.assign({}, carga, {
          equipamentoId: selEq.value, cicloId: selCiclo.value
        });
        var achados = CME.motor.avaliar(provisoria, 'esterilizacao', ctx);
        if (!achados.length) {
          vivo.appendChild(h('div', { class: 'conf-item c-ok' }, [
            h('span', { class: 'conf-nivel', text: 'Conforme' }),
            h('p', { class: 'conf-txt', text:
              'Combinação autorizada para todos os itens da carga.' })
          ]));
          return;
        }
        vivo.appendChild(h('p', { class: 'conf-tit', text: 'Motor de conformidade' }));
        achados.forEach(function (a) {
          vivo.appendChild(h('div', { class: 'conf-item c-' + a.nivel }, [
            h('span', { class: 'conf-nivel', text:
              a.nivel === 'bloqueio' ? 'Processamento não autorizado'
              : a.nivel === 'conflito' ? 'Conflito de requisitos' : 'Alerta' }),
            h('p', { class: 'conf-txt', text: a.texto }),
            h('p', { class: 'conf-fonte', text: a.fonte })
          ]));
        });
      }
      selEq.addEventListener('change', avaliarAoVivo);
      selCiclo.addEventListener('change', avaliarAoVivo);
      campos.push(vivo);
      campos.push(U.campo('Nº do ciclo no equipamento', U.texto('numeroCiclo')));
      campos.push(U.campo('Carga leva indicador biológico?',
        U.selecao('temIB', [{ v: 'sim', r: 'Sim' }, { v: 'nao', r: 'Não' }])));
    }
    if (etapa === 'liberacao') {
      campos.push(h('p', { class: 'dica', text:
        'A liberação exige indicador químico aprovado, registro físico conferido e, quando houver, ' +
        'indicador biológico lido.' }));
    }
    if (etapa === 'distribuicao') {
      campos.push(U.campo('Entregue em', U.selecao('destino',
        ['Centro Cirúrgico', 'Centro Obstétrico', 'UTI', 'Endoscopia', 'Arsenal',
         'Unidade de Internação'], carga.setor)));
      campos.push(U.campo('Recebido por', U.texto('recebedor')));
    }
    campos.push(U.campo('Responsável pelo registro', U.selecao('operador', opPessoas)));

    var form = h('div', {}, campos);
    U.folha('Registrar ' + F.ETAPAS[F.indiceEtapa(etapa)].rot, form, [
      { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
      { rotulo: 'Confirmar registro', estilo: 'primario', acao: function (fechar) {
        var v = U.valores(form);
        var agora = Date.now();

        if (etapa === 'esterilizacao') {
          if (!v.equipamentoId || !v.cicloId) return U.aviso('Escolha o esterilizador e o ciclo.', 'erro');
          carga.equipamentoId = v.equipamentoId;
          carga.cicloId = v.cicloId;
          carga.numeroCiclo = v.numeroCiclo;
          carga.temIB = v.temIB === 'sim';
        }
        if (etapa === 'limpeza' && v.eficacia === 'reprovado') {
          carga.status = 'reprovada';
        }
        if (etapa === 'distribuicao') {
          carga.setor = v.destino;
          carga.recebedor = v.recebedor;
        }

        /* revalida com o estado já atualizado — nada passa sem a regra */
        var val = F.podeAvancar(carga, etapa, ctx, { metodo: v.metodo });
        if (!val.pode) return U.aviso(val.motivos[0], 'erro');

        carga.etapa = etapa;
        carga.marcos = carga.marcos || {};
        carga.marcos[etapa] = agora;

        CME.db.put('cargas', carga)
          .then(function () {
            return registrarEvento(carga, etapa, {
              operador: v.operador,
              detalhe: [v.metodo, v.barreira, v.inspecao, v.numeroCiclo, v.destino, v.eficacia]
                .filter(Boolean).join(' · ')
            });
          })
          .then(function () {
            if (etapa === 'limpeza' && v.eficacia === 'reprovado') {
              return CME.db.put('nc', {
                ts: agora, status: 'aberta', alvoTipo: 'carga', alvoId: carga.id,
                titulo: 'Falha de limpeza', origem: 'Limpeza',
                descricao: 'Teste de eficácia reprovado na carga ' + carga.numero +
                  '. Material retorna ao expurgo.'
              });
            }
          })
          .then(function () {
            fechar();
            U.aviso(F.ETAPAS[F.indiceEtapa(etapa)].rot + ' registrada.', 'ok');
            CME.ir('cargas', carga.id);
            setTimeout(function () { location.reload(); }, 60);
          });
      } }
    ]);
  }

  /* ---------------- bloqueio ---------------- */
  function bloquear(carga) {
    var motivo = h('textarea', { name: 'motivo', rows: '3',
      placeholder: 'Descreva o que impede a liberação.' });
    var form = h('div', {}, [
      h('p', { class: 'p', text: 'A carga fica travada no sistema até que a não conformidade ' +
        'seja encerrada. Ninguém consegue avançar as etapas enquanto o bloqueio existir.' }),
      U.campo('Motivo do bloqueio', motivo)
    ]);
    U.folha('Não liberar carga ' + carga.numero, form, [
      { rotulo: 'Cancelar', estilo: 'plano', acao: function (f) { f(); } },
      { rotulo: 'Bloquear carga', estilo: 'perigo', acao: function (fechar) {
        if (!motivo.value.trim()) return U.aviso('Descreva o motivo do bloqueio.', 'erro');
        CME.db.put('bloqueios', { alvoTipo: 'carga', alvoId: carga.id, ativo: 1,
                                  motivo: motivo.value.trim(), ts: Date.now() })
          .then(function () {
            return CME.db.put('nc', { ts: Date.now(), status: 'aberta', alvoTipo: 'carga',
              alvoId: carga.id, titulo: 'Carga bloqueada', origem: 'Liberação',
              descricao: motivo.value.trim() });
          })
          .then(function () { fechar(); U.aviso('Carga bloqueada.', 'erro'); location.reload(); });
      } }
    ]);
  }

  function liberarBloqueio(bloq) {
    U.confirmar('Remover bloqueio',
      'Confirme que a não conformidade foi tratada e o item pode voltar ao fluxo.',
      function () {
        bloq.ativo = 0;
        bloq.encerradoEm = Date.now();
        CME.db.put('bloqueios', bloq).then(function () {
          U.aviso('Bloqueio removido.', 'ok'); location.reload();
        });
      }, 'Remover bloqueio');
  }

  /* ---------------- etiqueta ---------------- */
  function etiqueta(carga) {
    var caixa = h('div', { class: 'etiqueta' });
    var qr = qrcode(0, 'M');
    qr.addData('CME|' + carga.numero + '|' + carga.id);
    qr.make();
    caixa.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    var validade = (carga.itens && carga.itens.length) ? carga.itens[0] : null;
    var bloco = h('div', { class: 'etiqueta-dados' }, [
      h('div', { class: 'cod-grande', text: carga.numero }),
      h('p', { text: carga.setor }),
      h('p', { text: (carga.itens || []).map(function (i) { return i.nome; }).join(' · ') }),
      h('p', { class: 'dica', text: 'Processada em ' + T.dataHora(carga.criadaEm) })
    ]);
    U.folha('Etiqueta da carga', h('div', { class: 'etiqueta-wrap' }, [caixa, bloco]), [
      { rotulo: 'Imprimir', estilo: 'primario', acao: function () { window.print(); } }
    ]);
  }

  CME.registrar('cargas', {
    titulo: 'Cargas',
    render: function (alvo, param) { return param ? detalhe(alvo, param) : lista(alvo); }
  });
  CME.cargas = { trilha: trilha, nova: novaCarga };
})(window.CME = window.CME || {});
