# ADR002: Janus86 clean coreの実装範囲を定める

## Status

Accepted — Implemented

## Current state

Level 0〜3は実装済みである。`src/janus`はscalar、固定長array、式、可逆update、swap、exit assertion付き`if`、可逆loop、再帰、canonical / Janus86構文profileを実装している。公開されたJanus86の因数分解sampleを含むround-trip testも通過している。

Pure Janusと非同期host effectを別layerにする境界も維持されている。両者のstructured controlを混在させる場合は、本ADRの実装済み範囲の延長とは扱わず、別ADRで判断する。

## Date

2026-07-18

## 概要

UNCALLが実装するJanusは、歴史的なJanus86のうち、外部との対話を除いた可逆計算部分を対象とする。

初期MVPではADR001どおり、引数なしの`procedure`、`call`、`uncall`だけを実装する。これを「Janus86対応完了」とは呼ばず、**calls-only kernel**と呼ぶ。

その後、次の順に実装する。

1. scalar、式、可逆update、swap
2. exit assertionを持つ可逆`if`
3. 固定長array、可逆loop、再帰呼び出し
4. 歴史的Janus86構文を受理するcompatibility profile

ここまでを**Janus86 clean core**とする。

一方、`READ`、`WRITE`、歴史的runtime command scanner、procedure引数、local変数、動的データ構造、Janusの派生言語、外部effectの永続化とcrash recoveryは対象外とする。

外部effect primitiveはJanus86そのものではなく、UNCALLのhost extensionとして別レイヤーに置く。

---

## ADR000、ADR001との関係

ADR000の「Janus86をコアにし、TypeScript host primitiveへ接続する」という方針を具体化する。

ADR001のPhase 0〜2の範囲、順序、完了条件は変更しない。特に、現在進行中のPhase 1へ変数、式、条件分岐を追加しない。

ADR001完了時点で得られるものは、Janus86全体ではなく次のkernelである。

```text
procedure
statement sequence
call / uncall
direction-aware evaluator
host primitive linkage
```

このkernelを捨てずにJanus86 clean coreまで拡張できるよう、ASTとevaluatorの境界だけを本ADRで先に決める。

---

## 背景

Janusには少なくとも次の二つの意味がある。

1. LutzとDerbyが1982年頃に実装し、1986年の文書で公開した元のJanus86
2. 2007年以降に意味論が整理され、構文や機能が調整・拡張されたJanus群

UNCALLの既存ADRにある次の構文は、元のJanus86をそのまま転記したものではない。

```janus
procedure deploy()
    call create_network()
```

元のJanus86では空の丸括弧を付けず、XOR updateは`!=`、swapは`:`で記述する。一方、後年の文献では`<=>`など別の表記も使われている。

また、Janus86のstatementは計算状態に対して厳密に可逆だが、クラウドリソースの作成と削除は一般には厳密な逆関数ではない。この二つを同じ実装層に混ぜると、Janus互換性とUNCALL独自の補償動作のどちらを検証しているのか分からなくなる。

本ADRでは、互換対象、内部意味論、host extensionとの境界を先に固定する。

### 参照仕様

優先順位は次のとおりとする。

1. [Lutz and Derby, JANUS: A TIME-REVERSIBLE LANGUAGE](https://revcomp.info/legacy/mpf/rc/janus.html) — Janus86の構文と挙動
2. [Yokoyama, Reversible Computation and Reversible Programming Languages](https://doi.org/10.1016/j.entcs.2010.08.016) — 後年に整理された可逆構造の説明
3. [Mogensen, Partial Evaluation of the Reversible Language Janus](https://static.aminer.org/pdf/20170130/pdfs/popl/9yh4dqunnmfhvzee62lwsfriaoxjgbp0.pdf) — `if`、loop、`call` / `uncall`の明示的な逆意味論

参照間で違いがある場合、Janus86 compatibility profileは1を優先する。UNCALLのcanonical syntaxは、既存デモとの一貫性を優先して別途定義する。

---

## 決定

## 1. 互換性の定義

互換性を次の三段階に分ける。

| 呼称 | 意味 | 完了時期 |
| --- | --- | --- |
| calls-only kernel | `procedure`、`call`、`uncall`の方向反転が動く | ADR001 Phase 2 |
| Janus computational core | scalar、式、update、swap、`if`が可逆に動く | Janus Level 2 |
| Janus86 clean core | array、loop、再帰、Janus86構文profileを含み、`READ` / `WRITE`以外のcleanなプログラムを実行できる | Janus Level 3 |

READMEやUIでは、Level 3のconformance testが通るまで「Janus86 compatible」と表示しない。

Level 3完了後も、より正確には「Janus86 clean core compatible」と表記する。元実装の対話I/Oとruntime commandまで含む完全再現は主張しない。

## 2. 二つのsource profileを一つのASTへ正規化する

### UNCALL canonical profile

新しく書くコードとUIで表示するコードは、既存ADRに合わせて次をcanonicalとする。

```janus
procedure exchange()
    x += y
    x ^= mask
    x <=> y
    call child()
```

### Janus86 compatibility profile

Level 3では、同じ意味の歴史的表記も受理する。

```janus
PROCEDURE EXCHANGE
    X += Y
    X != MASK
    X : Y
    CALL CHILD
```

次をlexer/parserでaliasとして扱い、ASTには構文profileの違いを残さない。

| 意味 | Canonical | Janus86 alias |
| --- | --- | --- |
| procedure宣言 | `procedure p()` | `PROCEDURE P` |
| call | `call p()` | `CALL P` |
| uncall | `uncall p()` | `UNCALL P` |
| XOR update | `x ^= e` | `X != E` |
| swap | `x <=> y` | `X : Y` |
| コメント | `// ...` | `; ...`から行末 |

空の`()`だけを許可する。引数構文として一般化しない。

identifierはASCIIの英字または`_`で始まり、以後に英数字または`_`を許可する。比較はASCII case-insensitiveとし、symbol tableでは小文字へ正規化する。`_`と数字はUNCALL extensionだが、`create_network`など既存primitive名のために許可する。

semicolonはJanus86どおり行コメントの開始とし、statement separatorには使用しない。

Janus86で省略可能だった`THEN`、`ELSE`、`DO`、`LOOP`の空bodyもLevel 3で受理し、空のstatement sequenceへ正規化する。canonical profileでは可読性のためkeywordを明記する。

Phase 1ではcanonical profileだけを実装してよい。compatibility aliasをPhase 1の完了条件へ追加しない。

## 3. programとstate

programは次から構成する。

```text
module        := declaration* procedure+
declaration   := IDENT | IDENT "[" positive_integer "]"
procedure     := "procedure" IDENT optional_empty_parens statement*
```

* 変数はmodule globalとする
* scalarは長さ1の値、arrayは宣言時に長さが決まる固定長配列とする
* すべて0で初期化する
* host APIから初期stateを注入し、終了stateを取得できる
* procedure引数、返り値、local変数、shadowingは導入しない
* forward referenceを許可する
* 実行開始procedureを言語仕様で固定しない

実行は`module.call(name, state)`または`module.uncall(name, state)`のようにhostが明示的に開始する。`main`の自動実行はUI convenienceに留め、core semanticsには含めない。

同じ正規化名を持つ変数同士、procedure同士、procedureとhost primitiveの衝突はlink errorにする。

## 4. integerと式

ブラウザ、Node.js、Cloudflare Workersで結果を一致させるため、値は**signed 32-bit integer**とする。

* arithmeticとbit operationの結果は2の補数32 bitへ正規化する
* 除算は0方向へ丸め、剰余は `a = (a / b) * b + remainder` を満たす値とする
* 0除算、arrayの範囲外accessはruntime errorにする
* falseは`0`、trueは`-1`とする
* 条件位置では`0`だけをfalse、それ以外をtrueとする
* binary operatorはJanus86どおり同一precedence、左結合とする
* logical operatorを含むbinary operatorは両operandを評価し、short-circuitしない
* 丸括弧で評価順を変更できる
* unary `-`と`~`はbinary operatorより強く結合する

Level 1で対象とするoperatorは次とする。

```text
arithmetic: + - * / \
bit/logical: ! & |
comparison: = # < > <= >=
unary:      - ~
```

`!`は式中ではXOR、`~`はlogical NOT、`&`と`|`はlogical AND/ORとする。comparisonとlogical operatorは`0`または`-1`を返す。

32 bit幅は元文書が固定していない箇所に対するUNCALLの決定であり、歴史的な実装依存overflowまで再現するものではない。

## 5. statementと逆意味論

ASTは一つだけ持ち、evaluatorへ`forward`または`backward`のdirectionを渡す。backward用ASTの複製をruntimeの正しさの前提にしない。

| Statement | Forward | Backward |
| --- | --- | --- |
| `x += e` | `x = x + e` | `x = x - e` |
| `x -= e` | `x = x - e` | `x = x + e` |
| `x ^= e` | `x = x XOR e` | 同じ操作 |
| `x <=> y` | 値を交換 | 同じ操作 |
| `call p()` | `p`をforward実行 | `p`をbackward実行 |
| `uncall p()` | `p`をbackward実行 | `p`をforward実行 |
| sequence | 先頭から実行 | 末尾から実行 |
| `skip` | 何もしない | 何もしない |

### 可逆updateの制約

`x += e`、`x -= e`、`x ^= e`では、更新対象のstorage locationが`e`の評価によって変化してはならず、`e`自身も更新対象へ依存してはならない。

最初は保守的なidentifier単位の静的検査を行う。

* scalar `x`へのupdateでは、右辺に`x`が出現したらcompile error
* `a[i]`へのupdateでは、右辺に`a`が出現したらcompile error
* `a[i]`のindex式に、updateによって変化するidentifierが含まれる形をcompile error
* swapの一方で更新されるidentifierを、どちらかのarray index式が参照する場合はcompile error

実行時の値を使えば安全と分かるケースでも、alias safetyを静的に証明できなければ拒否する。将来この制約を緩和する場合は別ADRとする。

### 可逆conditional

```janus
if entry_condition then
    s1
else
    s2
fi exit_condition
```

forwardでは`entry_condition`でbranchを選び、branch終了後に`exit_condition`が同じtruth valueであることを検査する。

backwardでは`exit_condition`でbranchを選び、そのbranchを逆順実行した後、`entry_condition`が同じtruth valueであることを検査する。

assertion不一致はruntime errorであり、別branchを試さない。

### 可逆loop

```janus
from entry_assertion do
    first_body
loop
    next_body
until exit_test
```

forward規則は次とする。

1. entry assertionがtrueでなければerror
2. `first_body`を実行
3. exit testがtrueなら終了
4. `next_body`を実行
5. entry assertionがfalseでなければerror
6. 2へ戻る

backwardではentryとexitを交換し、各bodyをbackward実行する。これは構文上、次のinverseと等価である。

```janus
from exit_test do
    inverse(first_body)
loop
    inverse(next_body)
until entry_assertion
```

## 6. procedure、再帰、実行limit

procedureは引数なしとし、global stateに対して動作する。

再帰と相互再帰はJanus86 clean coreの対象に含める。ただしブラウザを停止させないため、evaluatorは次のlimitを持つ。

* total step budget
* call depth budget
* loop iteration budget

limit値はruntime optionで変更可能にする。limit到達はJanusの意味論上の正常終了ではなく、`ExecutionLimitExceeded`とする。

ADR001 Phase 2では再帰禁止を維持する。Level 3でbudgetと再帰testを実装した時点で解禁する。

## 7. compile、link、runを分離する

処理系の境界を次のようにする。

```text
source
  -> tokenize / parse
  -> AST with source spans
  -> static check
  -> link with host primitive manifest
  -> executable module
  -> call / uncall with state and runtime options
```

`parse`はhost primitive registryを参照しない。

`link`でcall targetをuser procedureまたはhost primitiveへ一意に解決する。未定義名、同名衝突、方向handler不足をここでdiagnosticにする。

ADR001の「未定義procedureと未登録primitiveの検出」は、parser単体の責務ではなく、static checkとlink完了時までの責務として解釈する。

## 8. Phase 1 ASTへ今から課す制約

進行中のPhase 1では機能を増やさず、次だけを守る。

* すべてのnodeがsource spanを持つ
* call nodeはcallee名と`call` / `uncall`の向きを持つ
* user procedure callとprimitive callでAST nodeを分けない
* primitive receiptやbrowser UI stateをASTへ入れない
* statement sequenceを配列として保持し、source順を失わない
* parser、checker、linker、evaluatorの責務を分けられるmodule境界にする
* backward実行でも元のsource spanを報告できる形にする

Level 1以降のAST variantをPhase 1で先回り実装する必要はない。

---

## Janus coreとUNCALL effect extensionの境界

## Pure Janus core

Pure coreが直接扱うのは次だけである。

* integer state
* fixed array state
* reversible statement
* assertion failure
* call direction

Pure coreの正しさは、許可された初期stateについて次のround-tripで検証する。

```text
backward(program, forward(program, state)) == state
```

## Host primitive

host primitiveはlink時にcallableとして注入するopaque extensionとする。

```ts
type PrimitiveManifest = {
  name: string;
  hasForward: boolean;
  hasBackward: boolean;
};
```

receipt stack、async I/O、自動cleanup、`checked` / `compensating` / `irreversible`分類はJanus ASTやinteger storeへ入れない。

calls-only kernelでは、ADR001どおり同一runtime session内のreceipt stackを使ってstraight-lineな自動cleanupを行う。

変数、conditional、loopとhost effectを混在させた途中失敗から、どの粒度でatomic rollbackするかは本ADRでは決めない。Level 2で混在を有効にする前に、control position、完了済みaction journal、cleanup失敗を扱う別ADRを作る。

この制限により、Pure Janusの「逆関数」と外部effectの「補償」を同じ保証として扱わない。

---

## 実装Level

ADR001のPhase番号との混同を避けるため、以後はJanus Levelと呼ぶ。

## Level 0: calls-only kernel

ADR001 Phase 1〜2そのもの。

```text
procedure
call / uncall
sequence
source span
name resolution / link
forward / backward evaluator
```

完了条件はADR001を正とする。

## Level 1: reversible data core

追加するもの:

* global scalar declaration
* 32-bit expression evaluator
* `+=`、`-=`、`^=`
* `<=>`
* `skip`
* updateとswapの静的reversibility check
* state注入・取得API

完了条件:

1. updateのforward/backward round-trip testが通る
2. XORとswapのself-inverse testが通る
3. 自己依存updateと危険なaliasをcompile errorにできる
4. overflow、0除算、未宣言変数の挙動が仕様どおりである
5. effect primitiveを一つも登録せずにPure Janus programが動く

## Level 2: reversible structured control

追加するもの:

* `if` / `then` / `else` / `fi`
* entry conditionとexit assertion
* nested conditional

完了条件:

1. true/false両branchのround-trip testが通る
2. backward時にexit assertionから正しいbranchを選ぶ
3. assertion不一致をsource span付きruntime errorにできる
4. nested procedureとconditionalを組み合わせたtestが通る

このLevelで、UNCALLを単なる逆順cleanup runnerではなくJanus computational coreと呼べる。

## Level 3: Janus86 clean core

追加するもの:

* fixed-length array
* array element updateとswap
* `from` / `do` / `loop` / `until`
* 再帰・相互再帰とexecution budget
* Janus86 compatibility profileのlexer/parser alias
* 公開されているJanus sample programによるconformance test

完了条件:

1. scalar、array、conditional、loop、call、uncallを含むprogramがround-tripする
2. nested loopをbackward実行できる
3. recursive procedureをcall後にuncallして初期stateへ戻せる
4. Janus86表記のsampleをsource rewriteなしでparseできる
5. 元資料のfactorizationなど、`READ` / `WRITE`へ依存しない代表例を実行できる
6. compatibility matrixをREADMEまたは仕様書として公開する

ここまでをJanus86実装の到達点とする。Level 4として機能を自動追加しない。

---

## Conformance test方針

unit testだけでなく、可逆性そのものをtestする。

### 必須の性質

1. **Round trip**: `B(F(s)) = s`
2. **Reverse round trip**: `F(B(s)) = s`
3. **Direction involution**: directionを二度反転すると元の実行規則になる
4. **Sequence reversal**: backwardではstatement順が反転する
5. **Failure locality**: assertion errorは該当source spanを指す

### testの種類

* lexer/parserのgolden test
* invalid programのdiagnostic test
* 各statementのtable test
* 小さい整数範囲を列挙するproperty test
* published Janus sampleのconformance test
* host primitiveを使わないPure Janus integration test
* host primitiveを使うUNCALL extension integration test

Pure Janus testとeffect testはdirectoryまたはtest suiteを分け、片方の成功をもう片方の互換性の根拠にしない。

---

## 実装しないもの

Janus86 clean coreの完了条件には、次を含めない。

* `READ` / `WRITE`の対話的再入力
* 元のruntime command scanner、`TRACE`、`RESET`、symbol table UI
* 元のSLIMEULA実装のbugやmachine依存overflowの再現
* procedure parameter、return value、local variable
* heap、pointer、動的array、list、object
* irreversible assignment
* automatic garbage history
* 任意のTypeScript関数の自動反転
* compiler、native code、PISA、Wasm生成
* 並行・分散Janus
* quantum gateまたはmeasurement
* step debugger、breakpoint、time-travel UI
* receiptのlinear type、永続化、crash recovery
* 外部effectを含むprogram全体のatomic transaction保証
* 後年のJanus派生言語との完全互換

これらが必要になった場合は、Janus86 clean core完了後に価値ごとに別ADRで判断する。

---

## 却下した案

### 最初からJanus86全構文を一括実装する

却下する。parser、式、alias解析、control assertion、loop、再帰を同時に実装すると、ADR001で分けた小さい成果単位を失う。

### `call` / `uncall`だけをJanus86実装と呼ぶ

却下する。それだけでは可逆updateや可逆control flowがなく、Janus固有の意味論を検証できない。

### 歴史的構文だけをcanonicalにする

却下する。`!=`をXOR、`:`をswapとして新規ユーザーへ提示するのは現代の読み方と衝突し、既存ADRのデモ構文もすべて変更することになる。

### host effectをJanusの新しいstatementとしてASTへ直接追加する

却下する。pureな逆関数とcompensating actionの保証が混ざり、Janus conformance testを独立して行えなくなる。

### snapshotをbackward semanticsにする

却下する。Janus statement自身の逆意味論を実装したことにならず、ADR000の設計思想にも反する。

---

## トレードオフ

二つのsource profileを受け入れるためlexer/parserにはalias処理が増える。一方、ASTと意味論は一つなので、evaluatorの複雑さは増やさない。

32-bit integerを選ぶことでブラウザとWorkerで決定的に実行でき、有限幅の加減算も正確に反転できる。一方、元の実装が動作したmachine固有の整数幅とは一致しない可能性がある。この差はcompatibility matrixに明記する。

host effectとの混在rollbackを本ADRから外すため、Level 2〜3のJanus機能が完成しても、複雑な外部workflowへ直ちに使えるわけではない。ただし、Pure Janusの意味論とeffect recoveryを個別に検証できる。

`READ` / `WRITE`を除外するため完全な歴史再現にはならない。一方、外部入力の再入力に依存せず、ブラウザ上で自動test可能なclean coreへ集中できる。

---

## Accept条件

本ADRをAcceptedにする前に、次の4点をレビューする。

1. canonical syntaxとJanus86 aliasを両方持つ方針
2. signed 32-bit integer semantics
3. 再帰をLevel 3でbudget付き解禁する方針
4. `READ` / `WRITE`とmixed-effect rollbackをJanus86 clean coreから除外する方針

Accept後もADR001 Phase 0〜2のscopeは変更しない。
