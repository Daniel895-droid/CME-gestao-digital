# CME Digital

Sistema de gestão, rastreabilidade e qualidade da Central de Material e Esterilização.
Feito para a Enfª Juliana Lima da Rocha.

HTML5 + CSS3 + JavaScript, sem framework e sem dependência de servidor. Todos os dados ficam
gravados no próprio aparelho, em IndexedDB.

## Como publicar

Suba a pasta inteira num repositório e ligue o GitHub Pages. Funciona também abrindo o
`index.html` direto do arquivo — os scripts são clássicos, não módulos ES6, justamente para
não quebrar em `file://`.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | Casco: cabeçalho, menu e container das telas |
| `style.css` | Identidade visual inteira |
| `db.js` | IndexedDB: stores, índices, numeração de cargas, backup |
| `core.js` | Roteador, helpers de tela e **as regras de liberação** |
| `seed.js` | Cadastros iniciais (equipamentos, ciclos, PPS, insumos) |
| `mod-hoje.js` | Painel CME Hoje e o semáforo |
| `mod-cargas.js` | Fluxo da carga, trilha, monitoramento, etiqueta QR |
| `mod-equipamentos.js` | Autoclaves, ciclos validados, Bowie-Dick |
| `mod-pps.js` | Catálogo de PPS e matriz de embalagem |
| `mod-apoio.js` | Insumos, qualidade da água, não conformidades |
| `mod-checklist.js` | Checklist diário e ajustes/backup |
| `sw.js` | Cache para uso offline |
| `vendor/qrcode.js` | Gerador de QR (MIT, Kazuhiko Arase) |

## O coração do sistema

`podeAvancar()` em `core.js`. Toda etapa de toda carga passa por essa função, duas vezes:
ao desenhar a tela e ao confirmar o registro. Ela separa dois níveis:

- **duro** — nada no formulário resolve. O botão nem aparece. Ex.: Bowie-Dick pendente,
  equipamento interditado, água de enxágue reprovada, IB aguardando leitura.
- **do formulário** — some quando a enfermeira preenche o campo. Ex.: escolher o esterilizador.

Bloqueios ativos em carga, PPS ou equipamento travam o fluxo em qualquer ponto, e sair do
bloqueio é sempre ação manual e explícita — encerrar a não conformidade não destrava sozinho.

## Como acrescentar um módulo

Crie `mod-nome.js`, registre a rota e inclua o script no `index.html`:

```js
CME.registrar('relatorios', {
  titulo: 'Relatórios',
  render: function (alvo) { /* monte a tela dentro de alvo */ }
});
```

Depois adicione o botão no `<nav>` com `data-rota="relatorios"` e o arquivo na lista do `sw.js`.

## Banco de dados

Versão 1 já cria **todas** as object stores e índices, inclusive os que ainda não têm tela
(`documentos`, `movimentos`, `pessoas`). Acrescentar store depois é simples; acrescentar índice
em store com dados é o que dá trabalho. Para mudar o esquema, suba `DB_VERSAO` em `db.js` e trate
no `onupgradeneeded`.

## O que ainda não existe

Indicadores gerenciais, arsenal e distribuição por paciente, POPs e IFUs, treinamentos,
auditoria Check-up CME com score, temporalidade documental. As stores e o fluxo já foram
desenhados para receber tudo isso sem migração dolorosa.

---

## Motor de conformidade e IFUs (v2)

`motor.js` cruza, para cada item da carga: IFU do PPS, IFU do equipamento, cadastro
institucional e ciclo validado. Devolve achados em três níveis:

- **bloqueio** — impede o processamento
- **conflito** — a IFU do fabricante diverge do cadastro institucional. O app **não escolhe
  sozinho**: encaminha para a enfermeira responsável
- **alerta** — informa, não impede

Cada achado carrega sua fonte (`IFU Karl Storz — rev. 04 de 2025-11-18`), para a decisão ser
auditável. A avaliação roda ao vivo dentro do formulário de esterilização, assim que o
esterilizador e o ciclo são escolhidos.

IFUs são versionadas: cadastrar nova versão arquiva a anterior como `substituida` e marca
`revisaoPendente`, que gera conflito nas cargas até alguém confirmar a revisão do processo.

### Banco na versão 2

Duas stores novas: `ifus` e `normas`. Quem já tinha o app aberto recebe a migração
automaticamente ao abrir — o `onupgradeneeded` cria só o que falta e **não toca nos dados
existentes**. Cache do service worker subiu para `cme-v3`.

### O que precisa de servidor

Três itens da especificação não são honestamente entregáveis com IndexedDB local:

- **§35 trilha inviolável** — o banco fica no navegador, acessível a quem tem o aparelho
- **§36/§37 perfis e assinatura eletrônica** — sem servidor, login não é barreira real
- **§24/§25 vínculo com paciente e recall entre setores** — exige banco compartilhado, e dado
  de paciente no navegador é problema de LGPD

O modelo de dados já está desenhado para migrar para backend sem reescrever as regras: o motor
e o `podeAvancar()` são funções puras sobre os dados.
