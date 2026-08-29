/* CME Digital — camada de dados (IndexedDB)
   Todas as object stores e índices são criados na versão 1.
   Adicionar store depois é simples; adicionar índice em store com dados, não. */
(function (CME) {
  'use strict';

  var DB_NOME = 'cme-digital';
  var DB_VERSAO = 2;
  var db = null;

  var ESQUEMA = [
    { nome: 'config',       kp: 'chave' },
    { nome: 'pessoas',      kp: 'id',  idx: [['nome', 'nome'], ['ativo', 'ativo']] },
    { nome: 'equipamentos', kp: 'id',  idx: [['tipo', 'tipo'], ['status', 'status']] },
    { nome: 'ciclos',       kp: 'id',  idx: [['equipamentoId', 'equipamentoId'], ['metodo', 'metodo']] },
    { nome: 'pps',          kp: 'id',  idx: [['nome', 'nome'], ['metodo', 'metodo'], ['setor', 'setor']] },
    { nome: 'cargas',       kp: 'id',  idx: [['numero', 'numero', { unique: true }], ['status', 'status'],
                                             ['equipamentoId', 'equipamentoId'], ['data', 'data'],
                                             ['etapa', 'etapa']] },
    { nome: 'eventos',      kp: 'id', auto: true,
                            idx: [['cargaId', 'cargaId'], ['ppsId', 'ppsId'], ['ts', 'ts'],
                                  ['etapa', 'etapa']] },
    { nome: 'insumos',      kp: 'id',  idx: [['nome', 'nome'], ['categoria', 'categoria']] },
    { nome: 'movimentos',   kp: 'id', auto: true, idx: [['insumoId', 'insumoId'], ['ts', 'ts']] },
    { nome: 'agua',         kp: 'id', auto: true, idx: [['ponto', 'ponto'], ['ts', 'ts'],
                                                        ['situacao', 'situacao']] },
    { nome: 'nc',           kp: 'id', auto: true, idx: [['status', 'status'], ['ts', 'ts'],
                                                        ['alvoTipo', 'alvoTipo'], ['alvoId', 'alvoId']] },
    { nome: 'bloqueios',    kp: 'id', auto: true, idx: [['alvoTipo', 'alvoTipo'], ['alvoId', 'alvoId'],
                                                        ['ativo', 'ativo']] },
    { nome: 'checklists',   kp: 'id', auto: true, idx: [['data', 'data'], ['turno', 'turno']] },
    { nome: 'documentos',   kp: 'id', auto: true, idx: [['pasta', 'pasta'], ['ts', 'ts'],
                                                        ['obsoleto', 'obsoleto']] },
    /* v2 — IFUs dos fabricantes e a biblioteca normativa (§4, §5, §39) */
    { nome: 'ifus',         kp: 'id',  idx: [['alvoTipo', 'alvoTipo'], ['alvoId', 'alvoId'],
                                             ['status', 'status'],
                                             ['revisaoPendente', 'revisaoPendente']] },
    { nome: 'normas',       kp: 'id',  idx: [['tema', 'tema'], ['status', 'status']] }
  ];

  function abrir() {
    return new Promise(function (ok, erro) {
      if (db) return ok(db);
      var req = indexedDB.open(DB_NOME, DB_VERSAO);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        ESQUEMA.forEach(function (s) {
          if (d.objectStoreNames.contains(s.nome)) return;
          var st = d.createObjectStore(s.nome, { keyPath: s.kp, autoIncrement: !!s.auto });
          (s.idx || []).forEach(function (i) { st.createIndex(i[0], i[1], i[2] || {}); });
        });
      };
      req.onsuccess = function () { db = req.result; ok(db); };
      req.onerror = function () { erro(req.error); };
    });
  }

  function tx(stores, modo) {
    return abrir().then(function (d) { return d.transaction(stores, modo || 'readonly'); });
  }

  function pedido(r) {
    return new Promise(function (ok, erro) {
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { erro(r.error); };
    });
  }

  var API = {
    abrir: abrir,

    put: function (store, obj) {
      return tx([store], 'readwrite').then(function (t) {
        return pedido(t.objectStore(store).put(obj));
      });
    },

    putVarios: function (store, lista) {
      return tx([store], 'readwrite').then(function (t) {
        var st = t.objectStore(store);
        lista.forEach(function (o) { st.put(o); });
        return new Promise(function (ok, erro) {
          t.oncomplete = function () { ok(lista.length); };
          t.onerror = function () { erro(t.error); };
        });
      });
    },

    get: function (store, chave) {
      return tx([store]).then(function (t) { return pedido(t.objectStore(store).get(chave)); });
    },

    todos: function (store) {
      return tx([store]).then(function (t) { return pedido(t.objectStore(store).getAll()); });
    },

    porIndice: function (store, indice, valor) {
      return tx([store]).then(function (t) {
        return pedido(t.objectStore(store).index(indice).getAll(valor));
      });
    },

    remover: function (store, chave) {
      return tx([store], 'readwrite').then(function (t) {
        return pedido(t.objectStore(store)['delete'](chave));
      });
    },

    contar: function (store) {
      return tx([store]).then(function (t) { return pedido(t.objectStore(store).count()); });
    },

    /* Numeração sequencial de cargas: AAAA-NNNNNN, contador atômico em config. */
    proximoNumeroCarga: function () {
      var ano = new Date().getFullYear();
      return abrir().then(function (d) {
        return new Promise(function (ok, erro) {
          var t = d.transaction(['config'], 'readwrite');
          var st = t.objectStore('config');
          var r = st.get('seq-carga-' + ano);
          r.onsuccess = function () {
            var atual = r.result ? r.result.valor : 0;
            var novo = atual + 1;
            st.put({ chave: 'seq-carga-' + ano, valor: novo });
            t.oncomplete = function () {
              ok(ano + '-' + String(novo).padStart(6, '0'));
            };
          };
          t.onerror = function () { erro(t.error); };
        });
      });
    },

    exportar: function () {
      var dump = { versao: DB_VERSAO, gerado: new Date().toISOString(), dados: {} };
      return Promise.all(ESQUEMA.map(function (s) {
        return API.todos(s.nome).then(function (r) { dump.dados[s.nome] = r; });
      })).then(function () { return dump; });
    },

    importar: function (dump) {
      var nomes = Object.keys(dump.dados || {});
      return nomes.reduce(function (p, n) {
        return p.then(function () { return API.putVarios(n, dump.dados[n]); });
      }, Promise.resolve());
    },

    apagarTudo: function () {
      if (db) { db.close(); db = null; }
      return new Promise(function (ok, erro) {
        var r = indexedDB.deleteDatabase(DB_NOME);
        r.onsuccess = function () { ok(); };
        r.onerror = function () { erro(r.error); };
      });
    }
  };

  CME.db = API;
})(window.CME = window.CME || {});
