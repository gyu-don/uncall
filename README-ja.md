# UNCALL

[English](README.md)

**1つのプログラムを、両方向に実行する。**

UNCALLは可逆プログラミング言語Janusの処理系です。`call`は手続きを順方向に実行し、`uncall`は同じ手続きを逆方向に実行します。decoder、unsort、undoのための別プログラムは生成も実装もしません。

ブラウザデモは、リポジトリのPure Janus parser、静的検査、名前解決、forward/backward evaluatorを直接使います。

## 2つのデモ

**ソートして元に戻す**では、5個の比較器が`[4, 1, 3, 2]`を`[1, 2, 3, 4]`へ並べ替え、分岐履歴を`trace = [1, 1, 0, 1, 1]`へ残します。`uncall sort4`はその履歴から制御フローを復元し、元の並び順とゼロのtraceを厳密に取り戻します。

**EncodeしてDecodeする**では、5文字の文字コードへshiftを加える`encode`手続きだけを書きます。`call encode`がencoder、`uncall encode`がdecoderになります。

```janus
message[5]
shift

procedure encode()
    message[0] += shift
    message[1] += shift
    message[2] += shift
    message[3] += shift
    message[4] += shift
```

たとえば`HELLO`とshift `3`は`KHOOR`になり、同じ`encode`を`uncall`すると`HELLO`へ戻ります。

## デモを動かす

必要なもの:

- Node.js 22以上
- npm

```sh
npm install
npm run dev
```

WranglerがローカルURLを表示します。通常は`http://localhost:8787`です。

1. **ソートして元に戻す**で`call sort4`を実行し、値と5個の分岐bitを確認する。
2. `uncall sort4`で、元の並び順とゼロのtraceが厳密に戻ることを確認する。
3. **EncodeしてDecodeする**で`call encode`を実行し、`HELLO`が`KHOOR`になることを確認する。
4. decoderを追加せずに`uncall encode`を実行し、`HELLO`へ戻ることを確認する。

リポジトリ全体の検査は次のコマンドで実行します。

```sh
npm run typecheck
npm test
```

## 何を保証するか

UNCALLが仕組みとして保証できる部分と、基本操作を実装するときに人が確認すべき部分は分かれています。

| UNCALLが手順の構造から保証すること | 基本操作（primitive）ごとに人が確認すること |
| --- | --- |
| `uncall`では操作を逆順に実行する | 作成・取消ハンドラーが意図した組になっている |
| `call`と`uncall`の向きを入れ替える | レシートが安全な取消に必要な情報を持っている |
| 途中で失敗したら、成功済みの操作だけを取り消す | `exact`、`checked`、`compensating`、`irreversible`の分類が妥当である |
| 外部操作には、実行前に両方向のハンドラーを要求する | 外部変更と事後条件の検査が対象に対して十分に厳しい |
| 作成手順を変えると、逆向きの手順も更新する | 外部APIが仕様どおりに動作する |

純粋なJanusの計算と、外部サービスなどへの操作は、あえて別の層にしています。

- `src/janus`は、Janus86 clean coreを同期的に実行する評価器です。整数の状態に対する本来の逆実行を扱い、`backward(forward(state)) == state`のような往復テストで検証します。
- `src/host`は、`call` / `uncall`だけを扱う非同期の外部操作ランタイムです。確認済みの基本操作、レシート、永続化した実行記録、検査付きの取消処理を使います。クラウド上のリソース削除が数学的な逆関数だとは主張しません。

制御構造を含む純粋なJanusと、非同期の外部操作を一つの手続きに混在させることはできません。保証できないトランザクション性を暗示しないよう、ホスト側の検査で拒否します。

## Pure Janus API

`compileJanus`は、ホスト側の基本操作を使わないプログラムを構文解析し、静的検査してリンクします。`call`と`uncall`は入力された状態を直接変更せず、それぞれ新しいスナップショットを返します。

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

- グローバルなスカラーと固定長配列、結果が環境に左右されない符号付き32ビット整数演算
- 可逆更新、XOR、交換、終了条件の検査を持つ`if`、可逆ループ
- 前方参照、再帰、相互再帰、変更可能な実行ステップ数の上限
- ソース位置付きの構文解析、静的検査、リンク、アサーション、範囲外アクセス、実行上限のエラー
- `()`、`^=`、`<=>`、`//`コメントを使う標準構文
- `!=`、`:`、セミコロンコメント、省略可能な空節を含む、大文字と小文字を区別しないJanus86構文
- 対話I/Oに依存しない代表的なJanus86プログラム

対応範囲は**Janus86 clean-core compatible**です。歴史的なランタイムを完全に再現するものではありません。`READ`、`WRITE`、コマンドスキャナー、手続きの引数、ローカル変数、動的データ構造は対象外です。

## 外部操作ワークフローの仕組み

外部操作の手続きに書けるのは、引数なしの手続きと`call` / `uncall`だけです。登録するTypeScriptの基本操作は、非同期の`forward`ハンドラーと、対応する`backward`ハンドラーを提供します。`forward`が成功すると、保存可能なレシートを返します。レシートは操作の成功後にだけ履歴へ追加され、対応する`backward`ハンドラーへ渡されます。

`forward`が失敗した場合、元のエラーと片付け時のエラーは分けて保持します。`backward`側のレシートは、ハンドラーと検査の両方が成功したあとにだけ取り除きます。実行記録を見れば、逆実行の前に手順と各レシートを確認でき、未完了または安全のため停止した片付けを再開できます。

このデモは、実際のクラウドとの連携、クラッシュ時のexactly-once実行、複数ワーカー間の競合制御、手順のバージョン変更に対する自動移行、片付けの再試行スケジューラー、任意の外部操作をまたぐ原子的なトランザクションを保証しません。

## 開発とデプロイ

```sh
npm run build:browser
npm run deploy
```

デプロイ先はCloudflare Workersです。ローカルまたはCIからのデプロイには`CLOUDFLARE_API_TOKEN`と`CLOUDFLARE_ACCOUNT_ID`が必要です。値は環境変数かリポジトリのsecretへ置き、ソースにはコミットしないでください。ヘルスチェック用のエンドポイントは`/health`です。

設計上の判断と対象範囲は、[ADR002: Janus86 clean core](adr/ADR002-Janus86実装範囲.md)と[ADR003: reversible-by-construction demo](adr/ADR003-刺さるデモシナリオ.md)に記録しています。
