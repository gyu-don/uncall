# ADR001: モックデモから極小Janus処理系へ段階的に進む

## Status

Accepted with conditions

## ADR000との関係

ADR000の将来像は維持する。

ただし、ADR000でMVPとしていた範囲は、言語処理系、外部effect runtime、デバッガ、量子デモを同時に作る計画になっている。これでは、最初の価値を確認する前に作るものが多すぎる。

このADRでは、最初のデモを極限まで小さくしつつ、それを使い捨てのモックで終わらせず、実際のJanus処理系へ置き換えるまでを初期MVPの計画とする。

---

## 条件付きacceptの条件

Janus処理系を作らないモックデモを先に作ることは、次の条件をすべて満たす場合のみacceptする。

1. モックデモの実装、ローカル確認、デプロイ準備を、**compactionなしの1回の連続した実装セッション以内**で完了する
2. モック完了後、価値仮説が否定されない限り、次のセッションから極小Janus処理系の実装を始める
3. Janus処理系の対象構文、テスト、完了条件、および見積もりをこのADRで具体化する
4. ブラウザデモはCloudflare Workersへデプロイ可能な構成にする

Phase 0が1セッションで収まらない場合は、次のセッションへそのまま持ち越さない。装飾、編集機能、中間層を削り、この条件内に戻す。

---

## 価値仮説

> 作る手順と片付ける手順を別々に並べなくても、同じ定義から逆順cleanupを実行できる。

最初に見せるのは、次の2パターンだけとする。

* 通常実行の後に`uncall`すると、逆順でリソースが消える
* 3つ目の操作が失敗すると、成功済みの2つだけが逆順で自動cleanupされる

この見せ方はPhase 0とJanus処理系統合後で共通にする。

---

## 全体計画

初期MVPを3つの小さなphaseに分ける。Phase 0だけでMVP完成とはしない。

| Phase | 作るもの | 見積もり | 完了時に得られるもの |
| --- | --- | --- | --- |
| 0 | ハードコードしたモックデモ | 1セッション以内、compactionなし | 価値の見せ方とデプロイ経路 |
| 1 | 正式な極小Janus parserとAST | 1〜2セッション | 文字列から手順の意味を読み取る処理系 |
| 2 | forward/backward evaluatorとデモ統合 | 1〜2セッション | ハードコードした手順に依存しないUNCALL MVP |

全体で3〜5セッションを目安とする。各phaseを独立したテスト可能な成果物にし、未完成の大きな処理系を数セッション抱えない。

---

## Phase 0: 1セッションのモックデモ

### ユーザーが見るもの

画面には、次のJanus風コードを読み取り専用で表示する。

```janus
procedure deploy()
    call create_network()
    call create_database()
    call deploy_application()
```

Phase 0ではこの文字列をparseしない。実際に実行する手順は、TypeScriptの固定配列とする。

```ts
const demoPlan = [
  "create_network",
  "create_database",
  "deploy_application",
] as const;
```

画面に必要なもは次だけとする。

* Janus風コードの読み取り専用表示
* `Run`ボタン
* `Uncall`ボタン
* `deploy_application`を失敗させるトグル
* 現在存在するモックリソースの一覧
* forwardとbackwardの実行ログ

Monaco Editor、ノードグラフ、アニメーション、コード編集は実装しない。

### モックruntime

primitiveはforwardとbackwardのペアにし、forward成功時のreceiptをstackに積む。

```ts
type Receipt = {
  resourceId: string;
};

type Primitive = {
  forward(): Promise<Receipt>;
  backward(receipt: Receipt): Promise<void>;
};
```

runtimeが行うことは次の4つに限定する。

1. `demoPlan`を上から順に実行する
2. 成功したprimitiveとreceiptをstackに積む
3. `Uncall`時はstackを逆順にたどり、backward handlerを呼ぶ
4. forward失敗時は、それまでのstackを逆順にcleanupする

snapshotで画面を戻すのではなく、backward handlerがブラウザ内のモックリソースを実際に削除する。

登録するprimitiveは固定の3組とする。

| Forward | Backward | Receipt |
| --- | --- | --- |
| `create_network` | `delete_network` | network ID |
| `create_database` | `delete_database` | database ID |
| `deploy_application` | `undeploy_application` | application ID |

### Phase 0の完了条件

1. `Run`後、Network、Database、Applicationが順番に表示される
2. `Uncall`後、Application、Database、Networkが逆順で消える
3. 失敗トグル有効時は、DatabaseとNetworkだけが自動cleanupされる
4. cleanupにforwardが返したreceiptが使われる
5. `npm run typecheck`が成功する
6. `npm run dev`でローカルのブラウザデモを開ける
7. Cloudflareの認証情報があれば`npm run deploy`で公開URLへデプロイできる
8. 上記の実装と確認がcompactionなしの1セッション内で終わる

CloudflareのAPI tokenやaccount IDがまだ用意されていない場合は、実デプロイだけを外部前提として記録する。ただし、デプロイ設定とローカル確認は同じセッションで完了させる。

---

## Cloudflare Workersへのデプロイ

デプロイ構成は、[TeamCanvas commit 977b790](https://github.com/gyu-don/TeamCanvas/commit/977b7902be31093e6f2d6522df244bf5260ed441)の最小構成を参考にする。

参考にするのは次の構成とする。

* [package.json](https://github.com/gyu-don/TeamCanvas/blob/977b7902be31093e6f2d6522df244bf5260ed441/package.json)のHono、TypeScript、Wranglerと`dev`、`deploy`、`typecheck`スクリプト
* [src/index.ts](https://github.com/gyu-don/TeamCanvas/blob/977b7902be31093e6f2d6522df244bf5260ed441/src/index.ts)の小さなHono Workerと`/health`エンドポイント
* [wrangler.jsonc](https://github.com/gyu-don/TeamCanvas/blob/977b7902be31093e6f2d6522df244bf5260ed441/wrangler.jsonc)のWorker entrypointとobservability設定
* [deploy.yml](https://github.com/gyu-don/TeamCanvas/blob/977b7902be31093e6f2d6522df244bf5260ed441/.github/workflows/deploy.yml)の`npm ci` → typecheck → `wrangler deploy`の流れ

依存パッケージのバージョンと`compatibility_date`は、実装時点で検証した値を使う。参考commitの数値を理由なく固定しない。

### Phase 0の配置

```text
Cloudflare Worker / Hono
├── GET /         HTML、CSS、ブラウザ用JavaScriptを返す
└── GET /health   デプロイ確認用JSONを返す

Browser
├── Mock runtime
├── Receipt stack
├── Mock resource state
└── UI / execution log
```

モックのstateはブラウザ内だけに置く。Workerに共有stateを持たせず、別ユーザーとの干渉や永続ストレージの設計をPhase 0へ持ち込まない。

GitHub Actionsからのデプロイでは、参考commitと同様に次のRepository secretsを使う。

* `CLOUDFLARE_API_TOKEN`
* `CLOUDFLARE_ACCOUNT_ID`

実値はrepositoryにcommitしない。

---

## Phase 1: 正式な極小Janus parser

Phase 0の固定配列を置き換えるため、lexer、parser、ASTを作る。正規表現で`call`行だけを拾うデモ専用parserは作らない。

### 対象構文

```text
module      := procedure+
procedure   := "procedure" IDENT "(" ")" statement*
statement   := ("call" | "uncall") IDENT "(" ")"
```

次の範囲に限定する。

* 1つ以上のprocedure
* 引数なしの`call` / `uncall`
* source span付きAST
* 未定義procedureと未登録primitiveの検出
* 行番号と列番号を持つparse error

procedure bodyは次の`procedure`またはEOFまでとする。インデントに意味を持たせない。

### Phase 1の完了条件

1. 標準デモのsourceがASTになる
2. 複数procedureと`call` / `uncall`を読み取れる
3. 不正なtoken、不完全なprocedure、未定義名をテストで検出できる
4. parserがUIやモックリソースに依存しない
5. tokenizer、parser、name resolutionのunit testが通る

このphaseではまだブラウザデモをparserに切り替えない。入力からASTまでを独立して完成させる。

---

## Phase 2: forward/backward evaluatorとデモ統合

ASTを実行するevaluatorを作り、Phase 0の`demoPlan`を削除する。

### 実行規則

* forwardの文列は先頭から実行する
* backwardの文列は末尾から実行する
* backwardでは`call`と`uncall`の意味を入れ替える
* user procedureの`call`はそのprocedureをforward実行する
* user procedureの`uncall`はそのprocedureをbackward実行する
* primitiveの`call`はforward handler、`uncall`はbackward handlerを呼ぶ
* 成功したprimitiveのreceiptだけをstackに残す
* 途中失敗時は成功済みのstackだけを逆順cleanupする
* 再帰は禁止し、検出時に実行エラーにする

### Phase 2の完了条件

1. ユーザーがブラウザでJanus sourceを編集できる
2. `call deploy()`でsourceから読んだ順番にモックリソースが作られる
3. `uncall deploy()`で同じASTから逆順のbackward handlerが実行される
4. 途中失敗時に成功済みのprimitiveだけがcleanupされる
5. forward後にbackwardするround-trip testが通る
6. 入れ子のprocedureで実行順序と逆実行順序をテストで確認できる
7. Phase 0の固定`demoPlan`がproduction codeから削除されている
8. 統合後のデモもCloudflare Workersへデプロイできる

ここまで完了した時点で、初期MVP完了とする。

---

## 初期MVPで実装しないもの

* 完全なJanus86互換
* 変数、式、引数
* `+=`、`-=`、`^=`、swap
* 条件分岐、loop、再帰
* 静的型検査とalias解析
* step forward、step backward、breakpoint
* receiptのlinear typeと永続化
* `exact`、`checked`、`compensating`、`irreversible`の型付け
* cleanup失敗時のretryとcrash recovery
* 実在するcloud APIへの接続
* 量子ゲートのデモ
* npmへのpackage公開
* tagged template
* Web Worker
* AI機能

これらは、極小Janus処理系とモックeffectの統合が完成してから個別に判断する。

---

## この進め方が現実的である理由

* Phase 0は構文解析を行わず、操作列も3つに固定する
* UIは読み取り専用コード、2ボタン、1トグル、state、logだけで構成する
* Worker側にDB、認証、共有stateを持たない
* Cloudflare構成は動作実績のある最小テンプレートを踏襲する
* Phase 1はparserまで、Phase 2はevaluatorと統合までに分ける
* 対象言語をprocedureと引数なしの`call` / `uncall`に限定する
* モックで作ったprimitive interface、receipt stack、UI表示は統合後も使える
* モックの固定配列はPhase 2で削除すると完了条件に明記し、モックの永久化を防ぐ

---

## トレードオフ

この計画では、最初の1セッションでJanus言語としての正しさは証明できない。Phase 0のコード表示は、あくまで将来の操作モデルを説明するもので、実行されるsourceではない。この点はUIとREADMEで明示する。

一方で、モックを初期MVPの完成とは扱わず、固定配列を削除するまでを完了条件に含める。これにより、早く価値を見せることと、Janus処理系を実際に作ることの両方を初期計画に含める。

