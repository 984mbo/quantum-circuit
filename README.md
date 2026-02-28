# ⚛ Quantum Circuit Simulator

量子計算の「回路設計 → 状態遷移の可視化 → 測定結果の確認」を、直感的なUIとアニメーションで学習・理解できるWebアプリケーションです。

---

## 🛠 開発環境について

このプロジェクトは **Antigravity の GitHub リポジトリクローン機能** を使って管理・編集しています。
ローカルにクローンされたファイルは `/Users/nakadairamasashi/量子回路/` に配置されています。

### ファイルの編集方法
- Antigravity のエディタ機能でファイルを直接開いて編集します
- AI に指示するだけでコードの修正・追加が行えます

---

## 🚀 起動方法（動作確認手順）

ES Modules を使用しているため、ブラウザでファイルを直接開くだけでは動作しません。
**ローカルHTTPサーバー経由でアクセスする**必要があります。

### Step 1: サーバーを起動する

Antigravity のターミナル（または macOS のターミナル）で以下を実行します。

```bash
cd /Users/nakadairamasashi/量子回路
python3 -m http.server 8080
```

> サーバーが起動すると `Serving HTTP on 0.0.0.0 port 8080` と表示されます。

### Step 2: ブラウザで動作確認する

Antigravity のブラウザ拡張機能（またはお使いのブラウザ）で以下のURLを開きます。

```
http://localhost:8080
```

> **Antigravity でのブラウザ確認**: ブラウザエージェントに `http://localhost:8080` を開かせることで、操作録画・スクリーンショット取得・インタラクションテストが可能です。

### Step 3: 動作確認できる内容

| 機能 | 確認方法 |
|---|---|
| 回路設計 | 左パレットからゲートをドラッグ＆ドロップで配置 |
| シミュレーション | ▶ (Play) ボタンで電流アニメーションと状態遷移を確認 |
| 状態表示 | 画面下部の Dirac 記法・振幅グラフ・測定ヒストグラム |
| デモ回路 | ヘッダーの「Bell State」「GHZ State」ボタンで即時ロード |
| Learn モード | 「Learn」ボタンで量子アルゴリズムのラボを起動 |

---

## 📁 ファイル構成 (9モジュール構成)

```
.
├── index.html          # エントリポイント
├── styles.css          # デザイン・レイアウト
├── model/
│   └── circuit.js      # データモデル (Gate, Circuit, InputState)
├── sim/
│   ├── complex.js      # 複素数演算 + Seeded RNG
│   ├── statevector.js  # シミュレーションエンジン
│   └── gates_extra.js  # 追加ゲート定義
├── ui/
│   ├── controls.js     # アプリ制御 (Main Controller)
│   ├── svgCanvas.js    # 回路描画 + 電流アニメーション
│   ├── dragDrop.js     # ドラッグ＆ドロップ操作
│   ├── stateViewer.js  # 状態表示 (Dirac, Amplitudes, Histogram)
│   ├── animation.js    # 再生制御
│   ├── inputDrawer.js  # 入力状態設定ドロワー
│   └── learnDrawer.js  # Learn モードドロワー
├── lessons/
│   └── labs.js         # 学習ラボ定義
└── storage/
    └── localStorage.js # 保存・読み込み
```

---

## 📘 Learn Mode

ヘッダーの **Learn** ボタンから学習ラボを開けます。

- **Hadamard Test**: 干渉と位相の学習
- **SWAP Test**: 量子状態の類似度判定
- **QFT**: 量子フーリエ変換の可視化
- **Phase Estimation**: 位相推定アルゴリズム

**機能**:
- **Load Lab Circuit**: 回路図を自動ロード
- **Set Inputs**: 入力状態をプリセット
- **Run Shots & Check**: 実行結果と期待値を自動照合 (Pass/Fail)
- **Guided Actions**: 手順ボタンで「ロード→入力→実行」を段階的に操作
- **Experiment Scenario**: 典型パラメータ/入力をワンクリック適用して挙動比較
- **Insight Panel**: 測定結果と理論値・主要ビット列を同一画面で確認

---

## 主な機能

1. **回路設計**
   - ドラッグ＆ドロップでゲート配置
   - クリック配置、ダブルクリック削除
   - 列の自動拡張
   - ワイヤー数変更 (1〜5 qubits)

2. **シミュレーション**
   - 状態ベクトル法 (最大5 qubits)
   - 再現可能な測定 (Seeded RNG)
   - 測定モード: Probability / Single Shot

3. **可視化**
   - **電流フロー**: 白色光がゲート通過時に色付くアニメーション
   - **Dirac記法**: |ψ⟩ = α|0⟩ + β|1⟩ ...
   - **詳細ビュー**: 振幅棒グラフ(位相色)、測定ヒストグラム

4. **保存機能**
   - LocalStorage に回路と入力状態を保存

---

## サポートゲート

- **Single**: I, X, Y, Z, H, S, T
- **Rotation**: Rx, Ry, Rz (θパラメータ指定)
- **Multi**: CNOT, CZ, SWAP
- **Measure**: M

---

## デモ回路

ヘッダーボタンから即座にロード可能:
- **H → Measure**: 重ね合わせの基本
- **Bell State**: 量子もつれ (Entanglement)
- **GHZ State**: 3量子ビットのもつれ

---

## 🔧 Git 操作（Antigravity 上での手順）

Antigravity のターミナルから以下のコマンドで Git 操作が可能です。

```bash
# 初回：Git ユーザー設定（未設定の場合）
git config --global user.email "your@email.com"
git config --global user.name "Your Name"

# リモートの変更を取得する
git fetch --all

# 特定のブランチに切り替える
git checkout <branch-name>

# 最新の変更を取り込む
git pull origin main

# 変更をステージング・コミット・プッシュ
git add .
git commit -m "コミットメッセージ"
git push origin main
```

> **Antigravity での Git 操作**: Antigravity の AI に「このファイルをコミットして」と指示することでも操作できます。

---

## Windows の場合

Python のバージョンによってコマンドが異なります。

```bash
# Python 3
python -m http.server 8081
```

ブラウザで `http://localhost:8081` を開いてください。
