# UNCALL

[English](README.md)

**操作を一度だけ書き、そのundoを後から確認・実行する。**

UNCALLは、操作を開始したprocessの終了後にもundoできるworkflowを扱う実験的runtimeです。Application codeには、意図するforward操作をJanus風の`call` / `uncall`で記述します。Runtimeは同じprocedureから逆操作の順序を導出し、各操作を戻すためのreceiptを引き継ぎ、後日のeventに備えて実行結果を記録します。

中心となるデモは、Pull Requestごとのpreview environmentです。信頼済みprimitiveの追加は、application側では1行の変更になります。

```diff
 procedure preview_environment()
     call create_namespace()
     call create_database()
+    call create_cache()
     call deploy_application()
     call attach_preview_url()
```

別のcleanup workflowを手書きする必要はありません。同じprocedureから、inverse planとすべての途中失敗位置に対するcleanup経路が更新されます。

> 同梱のデモが操作するのはmock resourceです。GitHub、Kubernetes、database service、DNS providerには接続しません。

## Preview environmentの流れ

```text
PR open / runtime A
  call preview_environment
  → preview URLを稼働したままにする
  → execution record exec_7F3を保存する
  → runtime Aは終了する

PR merge / runtime B
  exec_7F3を読み込む
  → 導出されたinverse planとreceiptを確認する
  → uncall preview_environment
  → URL、application、cache、database、namespaceの順に片付ける
```

Execution recordには、procedure identityとplan hash、完了した操作の順序、serialize可能なreceiptが入ります。別のruntime instanceが数時間後、数日後にrecordを読み込み、`uncall`を実行できます。

外部変更によってreceiptのgenerationやpostconditionが古くなっていた場合、無条件には削除しません。Cleanupをblocked状態で止め、対象resource、期待したstate、現在のstate、残っている逆操作を表示し、人間の判断を待ちます。

`try/finally`、`with`、`using`とは主眼が異なります。これらは通常、現在のscopeが所有する値をscope終了時に片付けます。UNCALLは操作を意図的にscopeより長く存続させ、別eventが実行できるundo planとして残します。同じ仕組みをdisposableの周囲に個別実装することもできますが、UNCALLはprocedureの方向、receipt、検査、監査履歴を共通runtimeのmodelとして扱います。

## 何を保証するか

UNCALLは、program構造から導出できる保証と、依然として信頼・reviewすべきcodeを分けます。

| Runtimeが構造から導出すること | Primitive境界で信頼・reviewすること |
| --- | --- |
| `uncall`ではstatementを逆順に実行する | Forward / backward handlerが意図した組である |
| `call`と`uncall`の方向を交換する | Receiptが安全な逆操作に十分な情報を持つ |
| 失敗時は成功済みの操作だけを補償する | exact、checked、compensating、irreversibleの分類が妥当である |
| 実行前に、すべてのeffectへ両方向のhandlerを要求する | driftとpostconditionの検査がresourceに対して十分に厳しい |
| Procedureの変更に合わせてinverse planを更新する | 外部APIがdocumented behaviorを満たす |

Pure Janusの計算と外部effectは、意図的に別layerにしています。

- `src/janus`は同期的なJanus86 clean-core evaluatorです。Integer stateに対する真の逆意味論を持ち、`backward(forward(state)) == state`のようなround tripで検証します。
- `src/host`は非同期のcalls-only effect runtimeです。信頼済みprimitive pair、receipt、durable execution record、checked compensationを使います。Cloud風resourceの削除を数学的な逆関数とは主張しません。

Structured controlを含むPure Janusと非同期host effectを一つのprocedureに混在させることはできません。提供できないtransaction保証を暗示しないよう、host checkerが拒否します。

## デモを動かす

必要なもの:

- Node.js 22以上
- npm

```sh
npm install
npm run dev
```

Wranglerがlocal URLを表示します。通常は`http://localhost:8787`です。Browserでは次を試せます。

1. 信頼済みの`call`を追加・削除し、forward diffと導出されたinverse-plan diffを比較する。
2. Mock PRをopenし、forward側のruntimeを終了してもpreview resourceを稼働させておく。
3. 保存したexecutionを新しいruntime instanceから再開し、receiptを確認してから`uncall`する。
4. 外部driftを発生させ、安全でないcleanupが具体的な理由とともに停止することを確認する。
5. Forward途中の失敗を発生させ、完了済みの操作だけが逆順に補償されることを確認する。

Repositoryの検査は次で実行します。

```sh
npm run typecheck
npm test
```

## Pure Janus API

`compileJanus`はhost primitiveなしでprogramをparse、static check、linkします。`call`と`uncall`はそれぞれ独立したstateを使い、新しいsnapshotを返します。

```ts
import { compileJanus } from "./src/janus";

const counter = compileJanus(`
  value delta
  procedure change()
    value += delta
`);

const changed = counter.call("change", { value: 10, delta: 3 });
const restored = counter.uncall("change", changed);
// restored: { value: 10, delta: 3 }
```

Clean coreが対応する主な機能:

- global scalarと固定長array、決定的なsigned 32-bit arithmetic
- 可逆update、XOR、swap、exit assertion付き`if`、可逆loop
- forward reference、再帰、相互再帰と変更可能なexecution budget
- source span付きのparse、static、link、assertion、bounds、execution-limit error
- `()`、`^=`、`<=>`、`//` commentを使うcanonical syntax
- `!=`、`:`、semicolon comment、省略可能な空clauseを含むcase-insensitiveなJanus86 syntax
- 対話I/Oに依存しない代表的なJanus86 program

互換性の表現は**Janus86 clean-core compatible**です。歴史的runtimeの完全な再現ではありません。`READ`、`WRITE`、command scanner、procedure argument、local variable、dynamic data structureは対象外です。

## Effect workflowのmodel

Effect procedureに書けるのは、引数なしのprocedureと`call` / `uncall`だけです。登録するTypeScript primitiveは、非同期の`forward` handlerと対応する`backward` handlerを提供します。Forwardが成功するとserialize可能なreceiptを返し、成功後にだけjournalへ追加され、対応するbackward handlerへ渡されます。

Forward失敗時は元のerrorとcleanup errorを分けて保持します。Backwardのreceiptは、handlerと検査が成功した後にだけ取り除きます。Execution recordによってplanと各receiptを逆実行前に確認でき、未完了またはblockedになったcleanupを再開できます。

このデモは、実cloud統合、crash時のexactly-once実行、複数workerの競合制御、plan versionの自動migration、cleanup retry scheduler、任意の外部effectをまたぐatomic transactionを保証しません。

## 開発とdeploy

```sh
npm run build:browser
npm run deploy
```

Deploy先はCloudflare Workersです。LocalまたはCIからのdeployには`CLOUDFLARE_API_TOKEN`と`CLOUDFLARE_ACCOUNT_ID`が必要です。値はenvironment variableかrepository secretへ置き、sourceにはcommitしないでください。Health endpointは`/health`です。

設計判断とscopeは、[ADR002: Janus86 clean core](adr/ADR002-Janus86実装範囲.md)と[ADR003: reversible-by-construction demo](adr/ADR003-刺さるデモシナリオ.md)に記録しています。
