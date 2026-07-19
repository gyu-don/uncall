# UNCALL

[English](README.md)

**1つのプログラムを、両方向に実行する。**

UNCALLは可逆プログラミング言語Janusの処理系です。`call`は手続きを順方向に実行し、`uncall`は同じ手続きを逆方向に実行します。decoder、unsort、undoのための別プログラムは生成も実装もしません。

ブラウザデモは、リポジトリのPure Janus parser、静的検査、名前解決、forward/backward evaluatorを直接使います。

**公開デモ:** [Pure Janus](https://uncall.gyu-don.workers.dev/) · [量子回路](https://uncall.gyu-don.workers.dev/quantum)

UNCALLはOpenAI Build Weekの**Developer Tools**部門向けプロジェクトです。公開デモはアカウント、認証情報、サンプルデータの準備なしで試せます。

## 3つのデモ

**ソートして元に戻す**では、可逆な二重ループが`length`個の値をバブルソートします。4要素の`[4, 1, 3, 2]`は`[1, 2, 3, 4]`になり、6回の分岐履歴が`trace = [1, 1, 1, 0, 1, 0]`へ残ります。`uncall sort`は同じループを逆向きに辿り、元の並び順とゼロのtraceを厳密に取り戻します。

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

**木をPathにして戻す**では、固定二分木の葉`A`、`B`、`C`、`D`を、それぞれ`0`、`10`、`110`、`111`というrootからの経路へ変換します。`call encode_path`はループで親へ上がりながら左右のbitをpath stackへ積み、`uncall encode_path`はbitをpopしながら子へ降りて元の葉と空のstackを復元します。木、現在node、path、depth、毎回ゼロへ戻る一時変数`temp`をブラウザ上で可視化します。

## 2つの量子デモ

別ページの[量子回路デモ](https://uncall.gyu-don.workers.dev/quantum)では、同じ`call` / `uncall`のモデルを、逐次出力される論理ゲートへ適用します。

**量子フーリエ変換**では、3量子ビットのQFTを1ゲートずつ実行し、8個すべての複素振幅を可視化します。`uncall`では随伴ゲートを逆順に出力します。これはブラウザ上のstate-vector simulationであり、量子ハードウェア上の実行ではありません。

**可逆論理加算器**では、4ビットの計算基底registerへX、CNOT、論理Toffoliゲートを適用します。`call add`は`b = a + b mod 16`を計算し、`uncall add`は`a`を保ったまま逆向きの減算を行い、carry ancillaをゼロへ戻します。Toffoliは意図的に論理primitiveとして扱うため、Clifford+T分解やハードウェア資源の削減は主張しません。

## デモを動かす

必要なもの:

- Node.js 22以上
- npm

公開版はES2022 JavaScriptを実行できる現代的なブラウザを対象にしています。ローカル開発とデプロイは、Node.jsとCloudflare Wrangler CLIが動くプラットフォームで利用できます。

```sh
npm install
npm run dev
```

WranglerがローカルURLを表示します。通常は`http://localhost:8787`です。

1. **ソートして元に戻す**で`call sort`を実行し、値と6個の分岐bitを確認する。
2. `uncall sort`で、二重ループを逆向きに実行して元の並び順とゼロのtraceが厳密に戻ることを確認する。
3. **EncodeしてDecodeする**で`call encode`を実行し、`HELLO`が`KHOOR`になることを確認する。
4. decoderを追加せずに`uncall encode`を実行し、`HELLO`へ戻ることを確認する。
5. **木をPathにして戻す**で葉を選択し、`call encode_path`でcursorがrootへ移り、path codeが残ることを確認する。
6. `uncall encode_path`でpathが空になり、cursorが選択した葉へ戻ることを確認する。
7. **量子回路**を開き、QFTをcall / uncallして、順方向のゲートと逆順の随伴ゲートを確認する。
8. 論理加算器を実行し、必要なら妥当な出力へ編集してからuncallし、対応する入力を復元する。

審査時に最短で試す場合は、ビルド不要の公開デモを利用できます。**EncodeしてDecodeする**をcall / uncallしたあと、**量子回路**でQFTを往復実行してください。各ページでJanusのソースと状態変化を確認でき、量子回路ページでは逐次出力されるゲート列も表示します。

リポジトリ全体の検査は次のコマンドで実行します。

```sh
npm run typecheck
npm test
```

## CodexとGPT-5.6による開発

UNCALLはOpenAI Build Weekの提出期間中に、GPT-5.6を使う複数のCodexセッションを通じて作成しました。作者がプロダクトの方向性を定め、実装範囲をJanus86 clean coreへ絞り、正しさに関する主張を確認し、プロダクト・技術・デザイン上の主要な判断を行いました。Codexはそれらの判断をADR、実装、テスト、文書、Cloudflare Workersへデプロイ可能なアプリケーションへ具体化しました。

Codexが具体的に開発を加速した部分:

- TypeScriptとCloudflare Workersプロジェクトのひな型作成と、実行可能なデプロイ検査の維持
- 複数ファイルにまたがるtokenizer、parser、静的検査、resolver、双方向evaluatorの実装と改善
- 純粋な可逆計算と、対応するprimitive、receipt、検証、再開可能な実行記録を持つ非同期host-effect層の分離
- 往復、全入力、失敗経路、ブラウザrouteのテスト生成と、その失敗結果に基づく修正
- sort、codec、tree path、QFT、論理adderデモの反復改善、出力編集後の逆変換とアクセシビリティ改善

最終的なプロダクトを定義する判断は作者が行いました。モックで止めず実際のevaluatorを作ること、数学的な逆変換と外部effectの補償を分けること、見え方の異なる複数の逆変換を示すこと、Toffoliを論理primitiveとしてのみ扱うこと、実装とテストで裏付けられない主張を避けることです。

GPT-5.6はCodexを通じて設計、実装、デバッグ、テスト、文書、レビューに使用しました。UNCALL自体は決定的に動作し、実行時に言語モデルを呼び出しません。

Pure Janus coreの大部分を作成したスレッドを示す、主要なCodex `/feedback` Session ID:

```text
019f73c9-9dc8-7663-aeac-4ce20f64e4cf
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

設計上の判断と対象範囲は、[ADR002: Janus86 clean core](adr/ADR002-janus86-implementation-scope.md)と[ADR003: reversible-by-construction demo](adr/ADR003-demo-scenario.md)に記録しています。

## ライセンス

UNCALLは[PolyForm Noncommercial License 1.0.0](LICENSE)の下で公開するsource-available softwareです。

ライセンス条件に従う限り、非商用の利用・改変・再配布が許可されます。商用利用にはリポジトリ所有者との別途商用ライセンスが必要です。

OpenAI Build WeekのSponsor、Administrator、Judgesによる審査・評価・テストについては、[LICENSE-BUILD-WEEK-EXCEPTION.md](LICENSE-BUILD-WEEK-EXCEPTION.md)で追加の許諾を定めています。

商用利用を制限しているため、OSIの定義におけるオープンソースソフトウェアとは表記していません。第三者コンポーネントはそれぞれのライセンスに従います。詳細は[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を参照してください。
