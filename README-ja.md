# UNCALL

[English](README.md)

**一つのプログラムを、両方向に実行する。**

UNCALLは、可逆プログラミング言語Janusの処理系です。`call`は手続きを順方向に、`uncall`は同じ手続きを逆方向に実行します。復号、逆ソート、取り消しのために、別のプログラムを書く必要はありません。

**公開デモ:** [Pure Janus](https://uncall.gyu-don.workers.dev/) · [量子回路](https://uncall.gyu-don.workers.dev/quantum)

UNCALLはOpenAI Build Weekの**Developer Tools**部門向けプロジェクトです。デモはアカウントや事前準備なしで、ブラウザから試せます。

## 一つのプログラムを往復させる

最も小さな例は、5文字の暗号化です。

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

`call encode`は`HELLO`を`KHOOR`に変えます。`uncall encode`は同じ文を逆順にたどり、`+=`を`-=`として実行することで`HELLO`を復元します。

ブラウザでは、同じ考え方を5通りの題材で確かめられます。

- **暗号化と復号:** `encode`手続き一つだけで両方向を扱います。
- **ソートと復元:** 通常のソートが捨ててしまう分岐の履歴を、6ビットだけ残します。
- **木の葉と経路:** 親へ進みながら経路を保存し、逆実行ではその経路を使って葉へ戻ります。
- **量子フーリエ変換:** 基底状態の値が位相の並びへ移り、逆実行で値へ戻ります。
- **可逆加算器:** 一つのゲート列が、順方向では加算、逆方向では減算になります。

Pure Janusデモは、画面に表示した編集可能なJanusコードをブラウザ内で解析・検査し、そのまま実行します。入力やコードを変えて、順方向と逆方向の両方を試せます。

## 試してみる

ビルドせずに試す最短ルートです。

1. [Pure Janusデモ](https://uncall.gyu-don.workers.dev/?demo=codec)を開き、`encode`を`call`してから`uncall`する。
2. [量子回路デモ](https://uncall.gyu-don.workers.dev/quantum)でQFTを実行し、逆向きのゲート列が入力を復元する様子を見る。

ローカルで動かすには、Node.js 22以上とnpmが必要です。

```sh
npm install
npm run dev
```

WranglerがローカルURLを表示します。通常は`http://localhost:8787`です。

公開デモはES2022 JavaScriptに対応するブラウザで動作します。ローカル開発とデプロイには、Node.jsとCloudflare Wrangler CLIが動く環境を利用できます。

検査コマンド:

```sh
npm run typecheck
npm test
```

## Pure Janus API

`compileJanus`はプログラムを構文解析し、静的検査してリンクします。`call`と`uncall`は入力を変更せず、新しい状態を返します。

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

主な対応機能:

- グローバル変数、固定長配列、符号付き32ビット整数演算
- 可逆更新、XOR、交換、終了条件を持つ分岐、可逆ループ
- 前方参照、再帰、相互再帰、実行ステップ数の上限
- ソース位置を示す構文解析、静的検査、リンク、アサーション、範囲外アクセス、実行上限のエラー
- 対話入出力を必要としない代表的なJanus86プログラムで使われる構文

`src/janus`は同期的な可逆計算を実行します。`src/host`は別の層として、外部操作の順方向・逆方向の処理を、レシートと再開可能な実行記録に結び付けます。

## CodexとGPT-5.6による開発

UNCALLはOpenAI Build Weekの提出期間中に、GPT-5.6を利用する複数のCodexセッションを通じて作成しました。作者は、プロダクトの方向性、Janus86の中核機能に絞る判断、可逆計算と外部操作を分ける設計、5つのデモの題材と見せ方を決定しました。

Codexは次の作業を加速しました。

- TypeScriptとCloudflare Workersによるアプリケーションの構築
- 字句解析、構文解析、静的検査、名前解決、双方向評価器の実装と改善
- 外部操作層と量子回路シミュレーターの開発
- 往復、全入力、失敗経路、ブラウザ経路のテスト追加
- デモ、文書、アクセシビリティ、デプロイ設定の反復改善

GPT-5.6はCodexを通じて、設計、実装、デバッグ、テスト、文書作成、レビューに使用しました。UNCALL自体は同じ入力に同じ結果を返し、実行時に言語モデルを呼び出しません。

Pure Janusの中核機能の大部分を作成したスレッドのCodex `/feedback` Session ID:

```text
019f73c9-9dc8-7663-aeac-4ce20f64e4cf
```

## 開発とデプロイ

```sh
npm run build:browser
npm run deploy
```

デプロイ先はCloudflare Workersです。ローカルまたはCIからのデプロイには、`CLOUDFLARE_API_TOKEN`と`CLOUDFLARE_ACCOUNT_ID`が必要です。ヘルスチェック用エンドポイントは`/health`です。

設計上の判断は、[ADR002: Janus86 clean core](adr/ADR002-janus86-implementation-scope.md)と[ADR003: reversible-by-construction demo](adr/ADR003-demo-scenario.md)に記録しています。

## ライセンス

UNCALLは[PolyForm Noncommercial License 1.0.0](LICENSE)の下で公開するsource-available softwareです。条件に従う限り、非商用の利用・改変・再配布が許可されます。商用利用にはリポジトリ所有者との別途契約が必要です。

OpenAI Build Weekの審査とテストには、[LICENSE-BUILD-WEEK-EXCEPTION.md](LICENSE-BUILD-WEEK-EXCEPTION.md)で追加の許諾を定めています。第三者コンポーネントについては[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を参照してください。
