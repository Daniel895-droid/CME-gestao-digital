/* CME Digital — MOTOR DE CONFORMIDADE (§5, §38)
   Cruza, para cada item da carga: IFU do PPS, IFU do equipamento, cadastro
   institucional, ciclo validado e qualidade da água.

   Não escolhe regra sozinho quando há divergência entre a IFU do fabricante e o
   cadastro da instituição: devolve CONFLITO e manda para o enfermeiro (§5).

   Cada achado carrega sua FONTE, para a decisão ser auditável. */
(function (CME) {
  'use strict';

  /* nível: 'bloqueio' impede o processamento
            'conflito' exige avaliação do enfermeiro/RT
            'alerta'   informa, não impede */
  function achado(nivel, texto, fonte) {
    return { nivel: nivel, texto: texto, fonte: fonte };
  }

  function ifuDe(ctx, tipo, id) {
    for (var i = 0; i < ctx.ifus.length; i++) {
      var f = ctx.ifus[i];
      if (f.alvoTipo === tipo && String(f.alvoId) === String(id) && f.status === 'vigente') return f;
    }
    return null;
  }

  function fonteIFU(ifu) {
    return 'IFU ' + ifu.fabricante + ' — rev. ' + ifu.versao + ' de ' + ifu.dataIFU;
  }

  /* ---- limpeza: método permitido pela IFU? (§11, §12) ---- */
  function avaliarLimpeza(carga, metodo, ctx) {
    var achados = [];
    (carga.itens || []).forEach(function (it) {
      var ifu = ifuDe(ctx, 'pps', it.ppsId);
      if (!ifu || !ifu.regras) return;
      if (ifu.regras.ultrassonica === false && metodo &&
          metodo.toLowerCase().indexOf('ultrass') > -1) {
        achados.push(achado('bloqueio',
          it.nome + ': limpeza ultrassônica não permitida pelo fabricante.', fonteIFU(ifu)));
      }
      if (ifu.regras.termodesinfeccao === false && metodo === 'Termodesinfecção') {
        achados.push(achado('bloqueio',
          it.nome + ': termodesinfecção não permitida pelo fabricante.', fonteIFU(ifu)));
      }
    });
    return achados;
  }

  /* ---- esterilização: o cruzamento principal (§38) ---- */
  function avaliarEsterilizacao(carga, ctx) {
    var achados = [];
    var eq = ctx.equipamentos.filter(function (e) { return e.id === carga.equipamentoId; })[0];
    var ciclo = ctx.ciclos.filter(function (c) { return c.id === carga.cicloId; })[0];
    if (!eq || !ciclo) return achados;

    var ifuEq = ifuDe(ctx, 'equipamento', eq.id);
    if (ifuEq && ifuEq.regras && ifuEq.regras.ciclosPermitidos &&
        ifuEq.regras.ciclosPermitidos.indexOf(ciclo.programa) === -1) {
      achados.push(achado('conflito',
        'Ciclo "' + ciclo.programa + '" está cadastrado em ' + eq.nome +
        ', mas não consta na IFU do equipamento.', fonteIFU(ifuEq)));
    }

    (carga.itens || []).forEach(function (it) {
      var pps = ctx.pps.filter(function (p) { return p.id === it.ppsId; })[0];
      var ifu = ifuDe(ctx, 'pps', it.ppsId);

      if (!ifu) {
        achados.push(achado('alerta',
          it.nome + ': sem IFU cadastrada. Processamento segue pelo cadastro institucional.',
          'Cadastro institucional'));
        if (pps && pps.metodo !== ciclo.metodo) {
          achados.push(achado('bloqueio',
            it.nome + ' não é autorizado para ' + ciclo.metodo + '. Método do cadastro: ' +
            pps.metodo + '.', 'Cadastro institucional'));
        }
        return;
      }

      var r = ifu.regras || {};

      if (r.metodosProibidos && r.metodosProibidos.indexOf(ciclo.metodo) > -1) {
        achados.push(achado('bloqueio',
          it.nome + ': ' + ciclo.metodo + ' não permitido pelo fabricante.', fonteIFU(ifu)));
      } else if (r.metodosPermitidos && r.metodosPermitidos.indexOf(ciclo.metodo) === -1) {
        achados.push(achado('bloqueio',
          it.nome + ': ' + ciclo.metodo + ' não consta entre os métodos da IFU (' +
          r.metodosPermitidos.join(', ') + ').', fonteIFU(ifu)));
      }

      if (r.ciclosPermitidos && r.ciclosPermitidos.length &&
          r.ciclosPermitidos.indexOf(ciclo.programa) === -1) {
        achados.push(achado('bloqueio',
          it.nome + ': ciclo "' + ciclo.programa + '" fora do previsto na IFU (' +
          r.ciclosPermitidos.join(', ') + ').', fonteIFU(ifu)));
      }

      if (r.tempMaxC !== null && r.tempMaxC !== undefined && ciclo.tempC > r.tempMaxC) {
        achados.push(achado('bloqueio',
          it.nome + ': ciclo a ' + ciclo.tempC + ' °C acima do máximo de ' + r.tempMaxC +
          ' °C da IFU.', fonteIFU(ifu)));
      }

      /* divergência IFU x cadastro institucional — não decidimos sozinhos (§5) */
      if (pps && r.metodosPermitidos && r.metodosPermitidos.indexOf(pps.metodo) === -1) {
        achados.push(achado('conflito',
          it.nome + ': cadastro institucional indica ' + pps.metodo +
          ', a IFU do fabricante indica ' + r.metodosPermitidos.join(', ') + '.',
          fonteIFU(ifu) + ' × cadastro institucional'));
      }
      if (pps && r.barreiras && r.barreiras.length &&
          r.barreiras.indexOf(pps.barreira) === -1) {
        achados.push(achado('conflito',
          it.nome + ': barreira cadastrada (' + pps.barreira +
          ') não consta na IFU (' + r.barreiras.join(', ') + ').',
          fonteIFU(ifu) + ' × cadastro institucional'));
      }

      if (ifu.revisaoPendente) {
        achados.push(achado('conflito',
          it.nome + ': IFU atualizada e o processo ainda não foi revisado.', fonteIFU(ifu)));
      }
    });

    /* peso validado do sistema de barreira estéril (§15) */
    var peso = (carga.itens || []).reduce(function (s, i) { return s + (i.peso || 0); }, 0);
    if (ciclo.cargaMaxKg && peso > ciclo.cargaMaxKg) {
      achados.push(achado('bloqueio',
        'Peso da carga (' + peso.toFixed(2) + ' kg) acima do validado para o ciclo (' +
        ciclo.cargaMaxKg + ' kg).', 'Validação institucional do ciclo'));
    }

    return achados;
  }

  function avaliar(carga, etapa, ctx, extra) {
    if (etapa === 'esterilizacao') return avaliarEsterilizacao(carga, ctx);
    if (etapa === 'limpeza') return avaliarLimpeza(carga, (extra || {}).metodo, ctx);
    return [];
  }

  CME.motor = { avaliar: avaliar, ifuDe: ifuDe, fonteIFU: fonteIFU };
})(window.CME = window.CME || {});
