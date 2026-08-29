/* CME Digital — carga inicial de cadastros.
   Roda uma única vez; depois disso o banco é do serviço. */
(function (CME) {
  'use strict';

  var hoje = function () { return CME.util.hojeISO(); };

  CME.semear = function () {
    return CME.db.get('config', 'semeado').then(function (r) {
      if (r) return;

      var equipamentos = [
        { id: 'AV01', nome: 'Autoclave 01', tipo: 'autoclave', fabricante: 'Baumer', metodo: 'Vapor',
          status: 'disponivel', bowieDick: true, bowieDickData: null, camaraL: 440,
          manutencaoAte: '2026-11-30', qualificacaoAte: '2027-02-14' },
        { id: 'AV02', nome: 'Autoclave 02', tipo: 'autoclave', fabricante: 'Baumer', metodo: 'Vapor',
          status: 'disponivel', bowieDick: true, bowieDickData: null, camaraL: 440,
          manutencaoAte: '2026-09-10', qualificacaoAte: '2027-02-14' },
        { id: 'AV03', nome: 'Autoclave 03', tipo: 'autoclave', fabricante: 'Cisa', metodo: 'Vapor',
          status: 'manutencao', bowieDick: true, bowieDickData: null, camaraL: 250,
          manutencaoAte: '2026-09-05', qualificacaoAte: '2026-12-01' },
        { id: 'BT01', nome: 'Peróxido 01', tipo: 'baixa-temperatura', fabricante: 'Steris',
          metodo: 'H₂O₂', status: 'disponivel', bowieDick: false, camaraL: 130,
          manutencaoAte: '2027-01-05', qualificacaoAte: '2027-01-05' },
        { id: 'LT01', nome: 'Termodesinfectora 01', tipo: 'lavadora', fabricante: 'Getinge',
          metodo: 'Termodesinfecção', status: 'disponivel', bowieDick: false,
          manutencaoAte: '2026-10-22' },
        { id: 'LT02', nome: 'Termodesinfectora 02', tipo: 'lavadora', fabricante: 'Getinge',
          metodo: 'Termodesinfecção', status: 'disponivel', bowieDick: false,
          manutencaoAte: '2026-10-22' },
        { id: 'US01', nome: 'Ultrassônica 01', tipo: 'ultrassonica', fabricante: 'Lavo',
          metodo: 'Limpeza', status: 'disponivel', bowieDick: false, manutencaoAte: '2026-12-15' },
        { id: 'IN01', nome: 'Incubadora 01', tipo: 'incubadora', fabricante: '3M',
          metodo: 'Leitura IB', status: 'disponivel', bowieDick: false, manutencaoAte: '2027-03-01' }
      ];

      var ciclos = [
        { id: 'AV01-INST', equipamentoId: 'AV01', programa: 'Instrumental', metodo: 'Vapor',
          tipo: 'pré-vácuo', tempC: 134, exposicaoMin: 4, secagemMin: 20, cargaMaxKg: 8 },
        { id: 'AV01-TEXTIL', equipamentoId: 'AV01', programa: 'Têxtil', metodo: 'Vapor',
          tipo: 'pré-vácuo', tempC: 134, exposicaoMin: 4, secagemMin: 30, cargaMaxKg: 6 },
        { id: 'AV01-CONT', equipamentoId: 'AV01', programa: 'Container', metodo: 'Vapor',
          tipo: 'pré-vácuo', tempC: 134, exposicaoMin: 4, secagemMin: 30, cargaMaxKg: 10 },
        { id: 'AV02-INST', equipamentoId: 'AV02', programa: 'Instrumental', metodo: 'Vapor',
          tipo: 'pré-vácuo', tempC: 134, exposicaoMin: 4, secagemMin: 20, cargaMaxKg: 8 },
        { id: 'AV02-POROSO', equipamentoId: 'AV02', programa: 'Poroso', metodo: 'Vapor',
          tipo: 'pré-vácuo', tempC: 134, exposicaoMin: 4, secagemMin: 30, cargaMaxKg: 6 },
        { id: 'AV03-INST', equipamentoId: 'AV03', programa: 'Instrumental', metodo: 'Vapor',
          tipo: 'pré-vácuo', tempC: 134, exposicaoMin: 4, secagemMin: 20, cargaMaxKg: 5 },
        { id: 'BT01-LUMEN', equipamentoId: 'BT01', programa: 'Lúmen', metodo: 'H₂O₂',
          tipo: 'plasma', tempC: 50, exposicaoMin: 47, secagemMin: 0, cargaMaxKg: 4 },
        { id: 'BT01-NAOLUMEN', equipamentoId: 'BT01', programa: 'Não lúmen', metodo: 'H₂O₂',
          tipo: 'plasma', tempC: 50, exposicaoMin: 28, secagemMin: 0, cargaMaxKg: 4 },
        { id: 'BT01-FLEX', equipamentoId: 'BT01', programa: 'Flexível', metodo: 'H₂O₂',
          tipo: 'plasma', tempC: 47, exposicaoMin: 60, secagemMin: 0, cargaMaxKg: 3 }
      ];

      var pps = [
        { id: 'PPS-001', nome: 'Caixa de Ortopedia 04', setor: 'Centro Cirúrgico', pesoKg: 6.3,
          metodo: 'Vapor', cicloPermitido: 'Instrumental', barreira: 'Container validado',
          camadas: 1, validadeDias: 180, itens: 42 },
        { id: 'PPS-002', nome: 'Caixa Básica de Cirurgia Geral', setor: 'Centro Cirúrgico',
          pesoKg: 2.3, metodo: 'Vapor', cicloPermitido: 'Instrumental', barreira: 'SMS 60 g/m²',
          camadas: 2, validadeDias: 90, itens: 28 },
        { id: 'PPS-003', nome: 'Caixa de Videolaparoscopia', setor: 'Centro Cirúrgico', pesoKg: 5.6,
          metodo: 'Vapor', cicloPermitido: 'Instrumental', barreira: 'SMS 60 g/m²', camadas: 2,
          validadeDias: 90, itens: 19 },
        { id: 'PPS-004', nome: 'Óptica 30° Rígida', setor: 'Centro Cirúrgico', pesoKg: 0.35,
          metodo: 'H₂O₂', cicloPermitido: 'Lúmen', barreira: 'Tyvek® compatível', camadas: 1,
          validadeDias: 365, itens: 1 },
        { id: 'PPS-005', nome: 'Pinça Bipolar', setor: 'Centro Cirúrgico', pesoKg: 0.12,
          metodo: 'Vapor', cicloPermitido: 'Instrumental', barreira: 'Papel grau cirúrgico',
          camadas: 1, validadeDias: 180, itens: 1 },
        { id: 'PPS-006', nome: 'Campo Cirúrgico Têxtil — Pacote', setor: 'Centro Cirúrgico',
          pesoKg: 4.1, metodo: 'Vapor', cicloPermitido: 'Têxtil', barreira: 'SMS 60 g/m²',
          camadas: 2, validadeDias: 60, itens: 6 },
        { id: 'PPS-007', nome: 'Caixa de Parto', setor: 'Centro Obstétrico', pesoKg: 3.2,
          metodo: 'Vapor', cicloPermitido: 'Instrumental', barreira: 'SMS 60 g/m²', camadas: 2,
          validadeDias: 90, itens: 16 },
        { id: 'PPS-008', nome: 'Caixa de Curativo', setor: 'Unidade de Internação', pesoKg: 0.8,
          metodo: 'Vapor', cicloPermitido: 'Instrumental', barreira: 'Papel grau cirúrgico',
          camadas: 1, validadeDias: 180, itens: 5 },
        { id: 'PPS-009', nome: 'Broncoscópio Flexível', setor: 'Endoscopia', pesoKg: 1.4,
          metodo: 'H₂O₂', cicloPermitido: 'Flexível', barreira: 'Tyvek® compatível', camadas: 1,
          validadeDias: 180, itens: 1 },
        { id: 'PPS-010', nome: 'Caixa de Traqueostomia', setor: 'UTI', pesoKg: 1.9, metodo: 'Vapor',
          cicloPermitido: 'Instrumental', barreira: 'SMS 60 g/m²', camadas: 2, validadeDias: 90,
          itens: 12 }
      ];

      var insumos = [
        { id: 'INS-01', nome: 'Detergente enzimático', categoria: 'Limpeza', unidade: 'L',
          saldo: 28, minimo: 20, consumoDia: 2.4 },
        { id: 'INS-02', nome: 'SMS 60 g/m²', categoria: 'Barreira', unidade: 'folhas',
          saldo: 420, minimo: 250, consumoDia: 36 },
        { id: 'INS-03', nome: 'Papel grau cirúrgico', categoria: 'Barreira', unidade: 'rolos',
          saldo: 15, minimo: 8, consumoDia: 1 },
        { id: 'INS-04', nome: 'Indicador químico classe 5', categoria: 'Monitoramento',
          unidade: 'un', saldo: 680, minimo: 300, consumoDia: 64 },
        { id: 'INS-05', nome: 'Indicador biológico', categoria: 'Monitoramento', unidade: 'un',
          saldo: 72, minimo: 30, consumoDia: 9 },
        { id: 'INS-06', nome: 'Teste Bowie-Dick', categoria: 'Monitoramento', unidade: 'un',
          saldo: 46, minimo: 20, consumoDia: 3 },
        { id: 'INS-07', nome: 'Fita indicadora', categoria: 'Monitoramento', unidade: 'rolos',
          saldo: 22, minimo: 10, consumoDia: 1.5 },
        { id: 'INS-08', nome: 'Filtro de container', categoria: 'Barreira', unidade: 'un',
          saldo: 310, minimo: 150, consumoDia: 22 },
        { id: 'INS-09', nome: 'Etiqueta de rastreabilidade', categoria: 'Identificação',
          unidade: 'un', saldo: 1800, minimo: 800, consumoDia: 120 },
        { id: 'INS-10', nome: 'Cartucho de H₂O₂', categoria: 'Esterilizante', unidade: 'un',
          saldo: 9, minimo: 6, consumoDia: 1 }
      ];

      var pessoas = [
        { id: 'P-01', nome: 'Juliana Lima da Rocha', funcao: 'Enfermeira responsável — CME',
          conselho: 'COREN-RJ', ativo: 1 },
        { id: 'P-02', nome: 'Marcos Antônio Silva', funcao: 'Técnico de enfermagem', ativo: 1 },
        { id: 'P-03', nome: 'Renata Cardoso', funcao: 'Técnica de enfermagem', ativo: 1 },
        { id: 'P-04', nome: 'Débora Nunes', funcao: 'Técnica de enfermagem', ativo: 1 },
        { id: 'P-05', nome: 'Alex Ferreira', funcao: 'Técnico de enfermagem', ativo: 1 }
      ];

      var d = new Date(); d.setDate(d.getDate() - 3);
      var tresDias = d.toISOString().slice(0, 10);
      var agua = [
        { ponto: 'Enxágue final', data: tresDias, ts: d.getTime(), situacao: 'conforme',
          ph: 6.8, condutividade: 8, dureza: 0.4, microbiologia: 'ausente', responsavel: 'P-01' },
        { ponto: 'Osmose reversa', data: tresDias, ts: d.getTime(), situacao: 'atencao',
          ph: 6.5, condutividade: 14, dureza: 0.6, microbiologia: 'ausente', responsavel: 'P-01',
          obs: 'Condutividade em tendência de elevação nas últimas três coletas.' },
        { ponto: 'Água de entrada', data: tresDias, ts: d.getTime(), situacao: 'conforme',
          ph: 7.1, condutividade: 190, dureza: 42, microbiologia: 'ausente', responsavel: 'P-01' }
      ];

      /* IFUs — a regra específica do fabricante (§4).
         A Óptica 30° é o caso da especificação: vapor proibido, só H₂O₂ em ciclo lúmen,
         e limpeza ultrassônica não permitida. */
      var ifus = [
        { id: 'pps:PPS-004:v04', alvoTipo: 'pps', alvoId: 'PPS-004',
          alvoNome: 'Óptica 30° Rígida', fabricante: 'Karl Storz', versao: '04',
          dataIFU: '2025-11-18', status: 'vigente', revisaoPendente: 0, ts: Date.now(),
          regras: { metodosPermitidos: ['H₂O₂'], metodosProibidos: ['Vapor'],
                    ciclosPermitidos: ['Lúmen'], barreiras: ['Tyvek® compatível'],
                    tempMaxC: 60, ultrassonica: false, termodesinfeccao: true,
                    observacao: 'Não submeter a vapor saturado. Limpeza manual com escova macia.' } },
        { id: 'pps:PPS-009:v02', alvoTipo: 'pps', alvoId: 'PPS-009',
          alvoNome: 'Broncoscópio Flexível', fabricante: 'Olympus', versao: '02',
          dataIFU: '2026-02-09', status: 'vigente', revisaoPendente: 0, ts: Date.now(),
          regras: { metodosPermitidos: ['H₂O₂'], metodosProibidos: ['Vapor'],
                    ciclosPermitidos: ['Flexível'], barreiras: ['Tyvek® compatível'],
                    tempMaxC: 55, ultrassonica: false, termodesinfeccao: false,
                    observacao: 'Teste de vedação obrigatório antes de cada processamento.' } },
        { id: 'pps:PPS-001:v03', alvoTipo: 'pps', alvoId: 'PPS-001',
          alvoNome: 'Caixa de Ortopedia 04', fabricante: 'Baumer', versao: '03',
          dataIFU: '2025-06-30', status: 'vigente', revisaoPendente: 0, ts: Date.now(),
          regras: { metodosPermitidos: ['Vapor'], metodosProibidos: [],
                    ciclosPermitidos: ['Instrumental', 'Container'],
                    barreiras: ['Container validado'], tempMaxC: 137,
                    ultrassonica: true, termodesinfeccao: true, observacao: '' } },
        { id: 'equipamento:AV01:v02', alvoTipo: 'equipamento', alvoId: 'AV01',
          alvoNome: 'Autoclave 01', fabricante: 'Baumer', versao: '02',
          dataIFU: '2025-03-12', status: 'vigente', revisaoPendente: 0, ts: Date.now(),
          regras: { metodosPermitidos: ['Vapor'], metodosProibidos: [],
                    ciclosPermitidos: ['Instrumental', 'Têxtil', 'Container'],
                    barreiras: [], tempMaxC: null,
                    ultrassonica: null, termodesinfeccao: null, observacao: '' } }
      ];

      return Promise.all([
        CME.db.putVarios('ifus', ifus),
        CME.db.putVarios('equipamentos', equipamentos),
        CME.db.putVarios('ciclos', ciclos),
        CME.db.putVarios('pps', pps),
        CME.db.putVarios('insumos', insumos),
        CME.db.putVarios('pessoas', pessoas),
        CME.db.putVarios('agua', agua),
        CME.db.put('config', { chave: 'unidade', valor: 'CME — Hospital' }),
        CME.db.put('config', { chave: 'responsavel', valor: 'P-01' })
      ]).then(function () {
        return CME.db.put('config', { chave: 'semeado', valor: hoje() });
      });
    });
  };
})(window.CME = window.CME || {});
