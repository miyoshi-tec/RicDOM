# TrendGuard 開発者へ — controlled input bug 修正 (v0.3.24)

ご報告ありがとうございました。**ご指摘の通り bug でした。**
v0.3.24 で修正済みです。

## 原因 — 報告の通り

`patch_attributes` の prop 差分ロジックで:

```js
} else if (!is_json_equal(prev_extra[key], val)) {
  if (DOM_PROPERTY_KEYS.has(key)) {
    el[key] = val;
  }
  ...
}
```

VDOM の prev=next が equal だと `el[key] = val` が呼ばれず、user 操作で drift した
DOM 状態が残り続けていました。

さらに上流の `patch_children` にも tree-level 短絡 (`is_json_equal(prev_children,
next_children) → return`) があり、これも user drift 解消を阻んでいました
(= 報告のスニペット `s.tick++` のように render 出力が完全に同じになる更新では
そもそも `patch_attributes` に到達すらしない)。

## 修正方針 — 提案 1 を採用

ユーザー操作で drift しうる prop を `FORCE_REAPPLY_DOM_KEYS` セットに分離し、
**VDOM の equality に関係なく毎 render で DOM に直接代入** します。React / Preact と
同じ canon です。

```js
const FORCE_REAPPLY_DOM_KEYS = new Set([
  'value', 'checked', 'selected',
  'scrollTop', 'scrollLeft',
]);
```

`disabled` / `innerHTML` / `textContent` / `innerText` は対象外:

- `disabled` は user 操作で drift しない (JS 必須)
- `innerHTML` 等を毎 render で再代入すると child DOM が全破棄再生成されて
  **性能 disaster** になる (escape hatch なので頻度は低いはず)

## tree-level 短絡の扱い

短絡 path 自体は `<div ref="mount"></div>` のような外部 mount パターン (= 親が
空 `ctx` を返し、子 instance が外部から DOM を mount する) を守るために残しています。
ただし短絡時も **FORCE_REAPPLY 対象 prop だけは subtree を walk して再適用**
する別 path を追加しました。

`<div ref="mount">` への外部 mount は従来通り破壊されません (regression test 込み)。

## 再現スニペットを回帰 test に

報告いただいた snippet をそのまま `tests/force_reapply_dom_keys.test.js` に追加:

- `checkbox`: user が `cb.checked = false` した後、state.checked=true で再 render →
  DOM が true に戻る
- `text input`: 同パターン (value)
- `select`: 同パターン (selected option)
- `scrollTop`: 同パターン (スクロール drift 解消)
- `disabled`: drift しない prop は equality skip のままで OK (性能劣化なし)

## 同じ pattern が入る可能性のあった他箇所

調査して列挙したものは以下の通り。**今回の修正で全部カバーしています**:

| prop | 状況 |
|---|---|
| `value` / `checked` / `selected` | ✅ FORCE_REAPPLY に追加 |
| `scrollTop` / `scrollLeft` | ✅ 同上 (controlled scroll でも同じ bug) |
| `innerHTML` / `textContent` / `innerText` | ⚠️ contenteditable で類似問題はあるが性能上対象外。SPEC.md に WARNING 追加 |
| `disabled` | drift しない |
| 媒体要素 (`currentTime` / `volume` 等) | 別 issue (DOM_PROPERTY_KEYS 未登録、別途検討) |

## 取り込み方法

最新の `docs/RicDOM.min.js` / `docs/RicUI.min.js` を取り込んでください。
SHA は push 後にお知らせします。

- `docs/RicDOM.min.js`     9KB (= 8.7KB → 9KB、+349B for FORCE_REAPPLY 経路)
- `docs/RicDOM.lz.min.js`  6KB

## 回避策の話

> ダミーの prop (例: `data-v=${Date.now()}`) を毎回入れて diff を強制発火させる

これはもう不要になります。普通に書いていただいて、user 操作で DOM が drift しても
state が真実の source として勝つようになりました。

引き続きよろしくお願いします。

— RicDOM maintainer
