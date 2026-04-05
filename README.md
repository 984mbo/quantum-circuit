# Quantum Circuit Simulator

量子計算の「回路設計 → シミュレーション → 状態遷移の可視化 → 測定結果の確認」を、直感的なUIとアニメーションで学習・理解できるWebアプリケーションです。

---

## 起動方法

ES Modules を使用しているため、ローカルHTTPサーバー経由でアクセスする必要があります。

```bash
# macOS / Linux
cd /path/to/quantum-circuit
python3 -m http.server 8080

# Windows
cd C:\Users\...\quantum-circuit
python -m http.server 8080
```

ブラウザで `http://localhost:8080` を開いてください。

---

## ファイル構成

```
quantum-circuit/
├── index.html              # エントリポイント (KaTeX CDN, Google Fonts 読み込み)
├── styles.css              # グローバルスタイル
├── model/
│   ├── circuit.js          # データモデル (Gate, Circuit, InputState, SimulationStep)
│   └── customGate.js       # カスタムゲート定義・ユニタリ行列計算
├── sim/
│   ├── complex.js          # 複素数演算 (cMul, cAdd, cSub, cAbs2 等) + Seeded RNG
│   ├── statevector.js      # 状態ベクトルシミュレーションエンジン (QuantumEngine)
│   ├── densitymatrix.js    # 密度行列エンジン (混合状態対応)
│   ├── fraction.js         # シンボリック分数表示 (SymbolicValue)
│   ├── gates_extra.js      # 拡張ゲート (CP, CRZ, CSWAP)
│   └── texParser.js        # LaTeX量子状態パーサー
├── ui/
│   ├── controls.js         # アプリケーションコントローラー (App クラス)
│   ├── svgCanvas.js        # SVG回路描画 + 電流アニメーション
│   ├── stateViewer.js      # 状態表示 (Dirac記法, Timeline, Histogram)
│   ├── animation.js        # 再生制御 (Play/Pause/Step)
│   ├── dragDrop.js         # ドラッグ＆ドロップ操作
│   ├── inputDrawer.js      # 入力状態設定 (5タブ: Presets, Bloch, Vector, TeX, Density)
│   ├── learnDrawer.js      # Learnモードドロワー
│   ├── gateDesigner.js     # カスタムゲートデザイナー
│   ├── texRenderer.js      # KaTeX描画ユーティリティ
│   └── blochSphere.js      # Bloch球可視化
├── lessons/
│   └── labs.js             # 学習ラボ定義 (Hadamard, SWAP, QFT, Phase Estimation)
├── storage/
│   ├── localStorage.js     # 回路保存・読み込み
│   └── customGateStore.js  # カスタムゲート永続化
└── tests/                  # テストスイート (Vitest)
    ├── complex.test.js
    ├── circuit.test.js
    ├── statevector.test.js
    ├── gates_extra.test.js
    ├── customGate.test.js
    ├── fraction.test.js
    ├── texParser.test.js
    └── densitymatrix.test.js
```

---

## アーキテクチャ概要

### データフロー

```
ユーザー操作 (D&D / クリック)
  ↓
DragDropHandler / controls.js
  ↓
Circuit モデル変更 (gate 追加/削除)
  ↓
_onCircuitChange() コールバック
  ↓
canvas.render() + _runSimulation()
  ↓
QuantumEngine.simulate(circuit, inputState, measureMode)
  ↓
SimulationStep[] (列ごとの状態スナップショット)
  ↓
AnimationController.loadSimulation(steps)
  ↓
StateViewer 更新 (Dirac記法 / Timeline / Histogram)
  ↓
SVG アニメーション再生
```

---

## 量子回路の追加ロジック

### Gate クラス (`model/circuit.js`)

各ゲートは以下のプロパティを持つ `Gate` インスタンスとして管理されます:

| プロパティ | 型 | 説明 |
|---|---|---|
| `id` | `number` | 自動採番される一意ID |
| `type` | `string` | ゲート種別 (`'H'`, `'CX'`, `'Rx'` 等) |
| `targets` | `number[]` | ターゲット量子ビットのインデックス |
| `controls` | `number[]` | コントロール量子ビットのインデックス |
| `params` | `object` | パラメータ (例: `{ theta: Math.PI/2 }`) |
| `col` | `number` | 配置カラム (タイムステップ) |

### Circuit クラス (`model/circuit.js`)

`Circuit` は `numQubits` x `numCols` のグリッドにゲートを配置する構造です。

**ゲート追加時のバリデーション (`_validate`)**:

1. **範囲チェック**: 全量子ビットインデックスが `0 <= q < numQubits` の範囲内か
2. **セル衝突検出**: 同一カラム・同一ワイヤーに既存ゲートがないか
3. **パラメータ検証**: 回転ゲート (`Rx`, `Ry`, `Rz`) に `theta` パラメータが指定されているか

**自動拡張**: ゲートが最終カラムに配置されると `numCols` が自動的に +1 されます。

### サポートゲート一覧

| カテゴリ | ゲート | 量子ビット数 | パラメータ | 行列表現 |
|---|---|---|---|---|
| **Single** | I (恒等) | 1 | なし | `[[1,0],[0,1]]` |
| | X (Pauli-X) | 1 | なし | `[[0,1],[1,0]]` |
| | Y (Pauli-Y) | 1 | なし | `[[0,-i],[i,0]]` |
| | Z (Pauli-Z) | 1 | なし | `[[1,0],[0,-1]]` |
| | H (Hadamard) | 1 | なし | `1/sqrt(2) * [[1,1],[1,-1]]` |
| | S (Phase) | 1 | なし | `[[1,0],[0,i]]` |
| | T (T-gate) | 1 | なし | `[[1,0],[0,e^(i*pi/4)]]` |
| **Rotation** | Rx(theta) | 1 | theta | `[[cos(t/2), -i*sin(t/2)],[-i*sin(t/2), cos(t/2)]]` |
| | Ry(theta) | 1 | theta | `[[cos(t/2), -sin(t/2)],[sin(t/2), cos(t/2)]]` |
| | Rz(theta) | 1 | theta | `[[e^(-it/2), 0],[0, e^(it/2)]]` |
| **Multi** | CX/CNOT | 2 | なし | control=1 のとき target に X 適用 |
| | CZ | 2 | なし | 両方 1 のとき位相 -1 |
| | SWAP | 2 | なし | 2量子ビットの状態を交換 |
| **Extra** | CP(phi) | 2 | phi | 両方 1 のとき `e^(i*phi)` |
| | CRZ(theta) | 2 | theta | control=1 のとき target に Rz 適用 |
| | CSWAP | 3 | なし | Fredkin gate (control=1 で SWAP) |
| **Measure** | M | 1 | なし | 計算基底での測定 |
| **Custom** | ユーザー定義 | 可変 | 可変 | サブ回路から計算されたユニタリ行列 |

### カスタムゲート (`model/customGate.js`)

ユーザーが基本ゲートで構成したサブ回路から複合ゲートを作成できます。

**ユニタリ行列の計算方法**:
1. サブ回路の量子ビット数 `n` に対して `dim = 2^n` の単位行列を準備
2. 各標準基底 `|k>` (k = 0, ..., dim-1) をサブ回路でシミュレーション
3. シミュレーション結果 `U|k>` をユニタリ行列 `U` の第 `k` 列に格納
4. マルチコントロール対応: `controls` の全ビットが 1 の場合のみ `U` を適用

**随伴行列 (U†)**: 転置 + 複素共役で計算。逆演算に使用。

### InputState クラス (`model/circuit.js`)

初期量子状態を管理します。

**プリセット状態** (1量子ビット):
- `|0>` = [1, 0], `|1>` = [0, 1]
- `|+>` = [1/sqrt(2), 1/sqrt(2)], `|->` = [1/sqrt(2), -1/sqrt(2)]
- `|i>` = [1/sqrt(2), i/sqrt(2)], `|-i>` = [1/sqrt(2), -i/sqrt(2)]

**エンタングルドプリセット** (N量子ビット):
- `Phi+` = (|00...0> + |11...1>) / sqrt(2)
- `Phi-` = (|00...0> - |11...1>) / sqrt(2)
- `Psi+` = (|0...01> + |1...10>) / sqrt(2)
- `Psi-` = (|0...01> - |1...10>) / sqrt(2)
- `GHZ` = (|00...0> + |11...1>) / sqrt(2)
- `W` = (|100...0> + |010...0> + ... + |00...01>) / sqrt(N)

**テンソル積**: 複数量子ビットの状態は、リンクされていないクラスタ同士のテンソル積として構築されます。q0 が LSB (最右ビット) の規約に従い、高インデックスから低インデックスの順にテンソル積を取ります。

---

## 量子回路の計算ロジック

### QuantumEngine (`sim/statevector.js`)

状態ベクトル法による量子回路シミュレーションの中核エンジンです。

#### 状態表現

- **状態ベクトル**: `[re, im]` ペアの配列。`n` 量子ビットで `2^n` 要素
- **初期状態**: `InputState.toStateVector()` から取得 (デフォルト `|0...0>`)

#### シミュレーションの流れ (`simulate` メソッド)

```
1. 初期状態を取得 → history に初期ステップ (col=-1) を記録
2. 各カラム col = 0, 1, ..., numCols-1 について:
   a. ユニタリゲートを抽出 (Measure以外)
   b. _applyColumnGates() で状態ベクトルを更新
   c. Measureゲートを抽出
   d. _processMeasurements() で測定処理
   e. SimulationStep を history に追加
3. history (SimulationStep[]) を返却
```

#### 1量子ビットゲートの適用 (`_applySingleGate`)

ビット最適化によるペア反復法:

```
targetQubit のビット位置 bit = 1 << targetQubit

全基底 i = 0 ... 2^n - 1 について:
  if (i & bit) == 0:  ← targetQubit が 0 のインデックスのみ処理
    i0 = i          ← targetQubit=0 の基底
    i1 = i | bit    ← targetQubit=1 の基底

    [a0', a1'] = Matrix * [a0, a1]

    ここで:
      a0' = M[0][0]*a0 + M[0][1]*a1
      a1' = M[1][0]*a0 + M[1][1]*a1
```

この方法により、`2^n` 要素を `2^(n-1)` 回のペア演算で処理します。

#### 回転ゲートの適用 (`_applyRotationGate`)

パラメータ `theta` から動的に行列を生成:

- **Rx(theta)**: `[[cos(t/2), -i*sin(t/2)], [-i*sin(t/2), cos(t/2)]]`
- **Ry(theta)**: `[[cos(t/2), -sin(t/2)], [sin(t/2), cos(t/2)]]`
- **Rz(theta)**: `[[e^(-it/2), 0], [0, e^(it/2)]]`

`_applySingleGate` に委譲して適用します。

#### 制御ゲートの適用 (`_applyControlledGate`)

マルチコントロール対応のビットマスク手法:

```
controlMask = OR(1 << c  for each control qubit c)
targetBit = 1 << target

全基底 i について:
  if (i & controlMask) == controlMask:  ← 全コントロールが 1
    if (i & targetBit) == 0:
      i0 = i, i1 = i | targetBit
      CX の場合: swap(state[i0], state[i1])
      CZ の場合: state[i1] *= -1
```

#### SWAPゲートの適用 (`_applySWAP`)

```
b1 = 1 << q1, b2 = 1 << q2

全基底 i について:
  if q1=0 かつ q2=1:  ← ビットが異なる場合のみ
    j = (i | b1) & ~b2  ← q1=1, q2=0 の対応基底
    swap(state[i], state[j])
```

#### カスタムゲートの適用 (`_applyCustomGate`)

1. カスタムゲート定義からユニタリ行列 `U` (dim x dim) を取得
2. コントロールマスクを計算
3. ターゲット量子ビットのサブ空間ごとにグループ化
4. 各グループに対して `U` を行列ベクトル積で適用

```
各基底 i について:
  if コントロール全ビット == 1:
    ターゲットビット抽出 → groupIndices[0..dim-1] を構築
    oldAmps = state[groupIndices[k]] for k = 0..dim-1
    newState[groupIndices[row]] = sum(U[row][col] * oldAmps[col])
```

#### 拡張ゲート (`sim/gates_extra.js`)

- **CP (Controlled-Phase)**: 両方 1 の基底に `e^(i*phi)` を乗算
- **CRZ (Controlled-Rz)**: control=1 の場合、target=0 に `e^(-it/2)`、target=1 に `e^(it/2)` を乗算
- **CSWAP (Fredkin)**: control=1 かつ t1, t2 のビットが異なる場合にスワップ

#### 測定処理 (`_processMeasurements`)

**Probability モード**:
- 各計算基底の確率を `|amplitude|^2` で計算
- 状態ベクトルは変化しない (収縮なし)

**Single Shot モード**:
1. 全基底の確率分布から1つの結果をサンプリング (累積分布法)
2. 測定した量子ビットについて部分収縮 (partial collapse):
   - 測定ビットのマスク `checkMask` を計算
   - サンプリング結果と一致する基底のみ残す
   - 残った状態を正規化 (`1/sqrt(keptNormSq)`)
3. 未測定の量子ビットは重ね合わせを保持

#### ショットヒストグラム (`runShots`)

1. Probability モードでシミュレーションを実行し、最終状態ベクトルを取得
2. 各基底の確率 `|amplitude|^2` を計算
3. Seeded RNG (xoshiro128**) で `shots` 回サンプリング
4. ビット列ごとの出現回数を集計して返却

### 複素数演算 (`sim/complex.js`)

| 関数 | 計算 |
|---|---|
| `cMul(ar, ai, br, bi)` | `(a+bi)(c+di) = (ac-bd) + (ad+bc)i` |
| `cAdd(ar, ai, br, bi)` | `(a+bi) + (c+di)` |
| `cSub(ar, ai, br, bi)` | `(a+bi) - (c+di)` |
| `cAbs2(re, im)` | `re^2 + im^2` |
| `cAbs(re, im)` | `sqrt(re^2 + im^2)` |
| `cScale(re, im, s)` | `s * (re + im*i)` |
| `cConj(re, im)` | `re - im*i` |

### Seeded RNG (`sim/complex.js`)

`xoshiro128**` アルゴリズムに基づく擬似乱数生成器。

- `splitmix32` でシード値から4つの内部状態ワードを初期化
- `next()` で `[0, 1)` の一様分布乱数を返却
- 同一シードから常に同じ乱数列を生成 → 測定結果の再現性を保証

### 密度行列エンジン (`sim/densitymatrix.js`)

混合状態 (pure state でない量子状態) を密度行列で表現・計算するエンジン。

- `fromPureState(n, vec)`: `rho = |psi><psi|` を計算
- `fromEnsemble(n, ensemble)`: `rho = sum(p_k * |psi_k><psi_k|)` を計算
- `applySingleGate(rho, U, target, n)`: `rho' = U * rho * U†` を計算
- `getQubitProbabilities(rho, target, n)`: `Tr(P_1 * rho)` で |1> の確率を計算

### シンボリック分数表示 (`sim/fraction.js`)

浮動小数点値を量子計算でよく使われる正確な分数に変換する表示専用モジュール。

`SymbolicValue.fromFloat(value)` が認識するパターン:
- `1/2`, `1/4`, `3/4`, `1/3`, `2/3`
- `1/sqrt(2)`, `1/sqrt(3)`, `1/sqrt(6)`
- `sqrt(2)/4`, `sqrt(3)/2`, `sqrt(6)/4`
- その他 n/d (n < d, d <= 8)

`formatComplexTeX(re, im)` で複素数を LaTeX 文字列に変換。

### TeX パーサー (`sim/texParser.js`)

LaTeX の量子状態記法を状態ベクトルに変換します。

**サポートする記法**:
- ケット: `|0\rangle`, `|01\rangle`, `\ket{0}`, `|+\rangle`, `|-\rangle`
- 係数: `\frac{1}{\sqrt{2}}`, `\sqrt{3}`, `0.5`, `-1`, `i`, `-i`
- 位相: `e^{i\pi/4}` (Euler位相)
- 演算子: `+`, `-` (項の間), 括弧による分配 `coeff * (term1 + term2)`

**処理フロー**:
1. `tokenize()` でトークン列に変換
2. `Parser.parseStateExpr()` で項の配列を生成
3. 各項の `ketLabel` を基底インデックスに変換
4. 係数を適用して状態ベクトルを構築

---

## 量子回路の表示ロジック

### SVG回路描画 (`ui/svgCanvas.js`)

- **ワイヤー**: 各量子ビットに1本の水平線
- **ゲートブロック**: 色付き矩形 + テキストラベル
- **セルグリッド**: 固定幅 47px x 高さ 40px
- **コントロール線**: コントロール量子ビットからターゲットへの垂直線 + ドット
- **動的 viewBox**: 量子ビット数 x カラム数に応じて自動調整

### 電流アニメーション (`ui/svgCanvas.js` + `ui/animation.js`)

- 白色パルスがワイヤー上をゲート通過時に色付いて流れるアニメーション
- SVG フィルター: `glow`, `glow-intense`, `glow-current` の3種
- 再生速度: 0.25x - 4x (ステップあたり 800ms)

### 状態表示 (`ui/stateViewer.js`)

3つのタブで量子状態を可視化:

1. **Dirac記法タブ**: `|psi> = alpha|0> + beta|1> + ...` を KaTeX でレンダリング。`SymbolicValue` による正確な分数表示。量子ビット数に応じてフォントサイズ自動調整
2. **Timelineタブ**: 各ステップの状態遷移をカード形式で表示。ゲート情報 + 確率バー + 位相カラーコーディング
3. **Measurementsタブ**: ショットヒストグラム (棒グラフ)。ビット列ごとの出現頻度を表示

### Bloch球 (`ui/blochSphere.js`)

1量子ビット状態の3次元表現。斜投影法で描画。
- プリセット状態ドット: |0>, |1>, |+>, |->, |i>, |-i>
- ドラッグ可能なポイント
- theta/phi スライダー制御

---

## 主な機能

### 回路設計
- ドラッグ＆ドロップでゲート配置
- クリック配置モード
- ダブルクリックでゲート削除
- 列の自動拡張
- ワイヤー数変更 (1-10 qubits)

### シミュレーション
- 状態ベクトル法 (最大10 qubits)
- 再現可能な測定 (Seeded RNG: xoshiro128**)
- 測定モード: Probability (収縮なし) / Single Shot (部分収縮)
- ステップ実行・連続再生

### 入力状態設定 (5タブ)
- **Presets**: 量子ビットごとの標準状態選択
- **Bloch**: Bloch球上での直感的な状態設定
- **Vector**: 振幅の直接入力
- **TeX**: LaTeX記法による状態入力
- **Density**: 密度行列による混合状態設定

### カスタムゲートデザイナー
- サブ回路からの複合ゲート作成
- 0-3個のコントロール量子ビット
- アイコン・カラーカスタマイズ
- ユニタリ行列プレビュー
- プリセットテンプレート: Toffoli (CCX), QFT2, SqrtX

### 保存機能
- LocalStorage に回路と入力状態を保存
- カスタムゲートの永続化
- JSON エクスポート/インポート

---

## デモ回路

ヘッダーボタンから即座にロード可能:

| デモ | 内容 | 回路構成 |
|---|---|---|
| H → Measure | 重ね合わせの基本 | 1-qubit: H → M |
| Bell State | 量子もつれ | 2-qubit: H → CX → M, M |
| GHZ State | 3量子ビットのもつれ | 3-qubit: H → CX → CX → M, M, M |

---

## Learn Mode

ヘッダーの **Learn** ボタンから学習ラボを開けます。

| ラボ | 学習内容 |
|---|---|
| Hadamard Test | 干渉と位相の学習 |
| SWAP Test | 量子状態の類似度判定 |
| QFT | 量子フーリエ変換の可視化 |
| Phase Estimation | 位相推定アルゴリズム |

**機能**:
- **Load Lab Circuit**: 回路図を自動ロード
- **Set Inputs**: 入力状態をプリセット
- **Run Shots & Check**: 実行結果と期待値を自動照合 (Pass/Fail)
- **Experiment Scenario**: パラメータをワンクリック適用して挙動比較
- **Insight Panel**: 測定結果と理論値を同一画面で確認

---

## テスト

Vitest を使用したテストスイートを備えています。

```bash
# 依存パッケージのインストール
npm install

# 全テスト実行
npm test

# ウォッチモード (ファイル変更時に自動再テスト)
npm run test:watch

# カバレッジ付きテスト
npm run test:coverage
```

テスト対象:
- 複素数演算 (`sim/complex.js`)
- 回路モデル (`model/circuit.js`)
- シミュレーションエンジン (`sim/statevector.js`)
- 拡張ゲート (`sim/gates_extra.js`)
- カスタムゲート (`model/customGate.js`)
- シンボリック分数 (`sim/fraction.js`)
- TeXパーサー (`sim/texParser.js`)
- 密度行列 (`sim/densitymatrix.js`)
