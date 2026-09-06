// 実ブラウザ回帰テスト: dialog/popup の z-index が createSplitter の divider を貫通しない
// ことの確認 (LCP #1、2.0.0-alpha.9)。
//
// CSS クラス化 (Phase 1) の際に v1 (ric_ui/popup/create_ui_dialog.js の zIndex: 500/501、
// _popup_utils.js の zIndex: 401) が inline style で持っていた z-index が CSS クラスへ
// 引き継がれずに落ちていた。結果 `.ric-splitter__divider { z-index: 1 }` が
// 修正前は「唯一 z-index を持つ要素」としてダイアログ/ポップアップより前面に描かれる
// 実機バグになっていた (LCP 報告 #1)。
//
// jsdom は elementFromPoint を実装していない (常に null を返す) ため、実ブラウザでのみ
// 検証できる。
//
// ⚠️ dialog テストの構成についての注記 (この観測手法特有の落とし穴):
// 素朴に「splitter の main にダイアログのトリガーを置き、開いた状態で divider との
// 交点を elementFromPoint する」という構成にすると、createDialog の setInert(true) が
// portal の兄弟要素 (= splitter 全体) を `inert` にする副作用により、divider が
// hit-test の対象から外れてしまい (`inert` は accessibility だけでなく
// `elementFromPoint` 等のヒットテストからも要素を除外する)、**修正前の CSS でも
// テストが green になってしまう** (実際に手を動かして確認した — z-index 未指定の
// cssTemplates.ts に戻した状態で一度 green になり、原因を切り分けた)。これは
// 「見た目の重なり順」ではなく「ポインタが inert な divider を素通りする」ことに
// よる偽陽性で、z-index の修正を検証したことにならない。
// 対策: `createApp` の `portalTo` を使い、ダイアログの portal を splitter の
// `.ric-splitter__main` 内の**専用の入れ子 div** に向ける。setInert が inert にするのは
// 「portal の兄弟要素」だけなので、この構成では main 内の他の子 (今回は無し) だけが
// 対象になり、main の外側にある divider は一切 inert 化されない — hit-test が
// 素通りしない、CSS の見た目どおりの検証になる。ダイアログは uncontrolled の
// `dlg.open()` で開く (トリガー要素を経由しないので、上記の入れ子構成と両立する)。
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createDialog } from '../../src/ui/dialog.js';
import { createPopup } from '../../src/ui/popup.js';
import { createSplitter } from '../../src/ui/splitter.js';
import { injectStyles } from '../../src/ui/injectStyles.js';
import { flush, setupApp } from '../_helpers/dom.js';

injectStyles(document);

// 2 つの rect の交差領域を返す (無ければ null)。テストの前提 (実際に重なっているか) を
// elementFromPoint を呼ぶ前に明示的に検証するために使う。
const intersect = (a: DOMRect, b: DOMRect): DOMRect | null => {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  if (right <= left || bottom <= top) return null;
  return new DOMRect(left, top, right - left, bottom - top);
};

describe('実ブラウザ: dialog/popup の z-index が createSplitter の divider を貫通しない (LCP #1)', () => {
  it('dialog を開くと、divider と重なる座標の elementFromPoint がダイアログ側になる', async () => {
    const app = setupApp();
    // 位置 fixed + inset:0 で app 自身を viewport 全域にする。
    app.style.position = 'fixed';
    app.style.inset = '0';

    // まず splitter だけを普通に描画する。main の中に「dialog の portal 先」専用の
    // 入れ子 div (#portal-host) を置く — ファイルヘッダの注記のとおり、これを
    // portalTo に使うことで setInert の巻き添えから divider を守る。
    let split: ReturnType<typeof createSplitter>;
    const splitterHandle = createApp('#app', {}, () =>
      split
        ? split({
            side: [{ tag: 'div', children: ['side'] }],
            main: [{ tag: 'div', id: 'portal-host' }],
          })
        : null,
    );
    // side 幅を viewport 幅の半分にする → divider は viewport 水平中央のすぐ近くに来る。
    // divider は .ric-splitter__main と同じ高さ (100%) を占めるため、垂直方向は
    // viewport 全域をカバーする (計算不要)。
    split = splitterHandle.use(createSplitter({ size: Math.round(window.innerWidth / 2) }));
    await flush();

    const portalHost = document.getElementById('portal-host')!;
    expect(portalHost).not.toBeNull();

    // dialog は別の createApp インスタンスとして portalTo: portalHost で登録する
    // (target 自体は使わない使い捨て要素 — トリガーを経由せず dlg.open() で開くため
    // 通常描画は不要)。これで dialog の portal は splitter の外の何かではなく
    // splitter の main の中に生える (見た目の座標としては同じ main 領域内)。
    const unusedTarget = document.createElement('div');
    let dlg: ReturnType<typeof createDialog>;
    const dialogHandle = createApp(unusedTarget, {}, () => (dlg ? dlg({ title: 't', children: ['本文'] }) : null), { portalTo: portalHost });
    dlg = dialogHandle.use(createDialog());
    await flush();

    dlg!.open();
    await new Promise((r) => setTimeout(r, 300)); // entrance animationend を待つ (他 dialog テストと同じ待ち方)

    const divider = app.querySelector('.ric-splitter__divider') as HTMLElement;
    const dialogEl = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(divider).not.toBeNull();
    expect(dialogEl).not.toBeNull();
    // 今回の構成では divider (splitter 全体) は inert 化されない対象であることの確認
    // (万一 inert が付いていたら、このテストは前のバグと同じ偽陽性を再現してしまう)。
    expect((app.querySelector('.ric-splitter') as HTMLElement).inert).toBe(false);

    // dialog は viewport 中央に固定表示されるので、viewport 中央の点は必ずダイアログの
    // 内側にある。divider も (side 幅を半分にしたことで) viewport 中央近くに来ているはず
    // ── その前提をまず明示的に確認する (前提が崩れていたらテスト自体が無意味なので)。
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dialogRect = dialogEl.getBoundingClientRect();
    const dividerRect = divider.getBoundingClientRect();
    expect(cx).toBeGreaterThanOrEqual(dialogRect.left);
    expect(cx).toBeLessThanOrEqual(dialogRect.right);
    expect(cy).toBeGreaterThanOrEqual(dialogRect.top);
    expect(cy).toBeLessThanOrEqual(dialogRect.bottom);
    expect(cx).toBeGreaterThanOrEqual(dividerRect.left);
    expect(cx).toBeLessThanOrEqual(dividerRect.right);

    // 修正前 (z-index 未指定): divider の z-index:1 だけが有効で、ダイアログ本体
    // (z-index 無し = auto) より前面に描かれ、ここで divider が返っていた
    // (ファイルヘッダの注記のとおり、素朴な構成だとこの巻き戻しでも green になって
    // しまう罠があったため、上記の portalTo 構成を採用している)。
    const hit = document.elementFromPoint(cx, cy);
    expect(divider.contains(hit)).toBe(false);
    expect(dialogEl === hit || dialogEl.contains(hit)).toBe(true);
  });

  it('popup を divider の実測 rect と重なる座標に開くと、その交差点の elementFromPoint がポップアップ側になる', async () => {
    // popup は dialog と違い背景を inert 化しない (createPopup に setInert 相当の処理が
    // 無い) ため、素朴な「splitter の main にトリガーを置く」構成のままで安全に検証できる。
    const app = setupApp();
    app.style.position = 'fixed';
    app.style.inset = '0';

    let split: ReturnType<typeof createSplitter>;
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () => {
      if (!split || !menu) return null;
      return split({
        side: [{ tag: 'div', children: ['side'] }],
        main: [menu({ trigger: ['⋯'], children: [{ tag: 'div', children: ['項目'] }] })],
      });
    });
    split = handle.use(createSplitter({ size: Math.round(window.innerWidth / 2) }));
    menu = handle.use(createPopup());
    await flush();

    const divider = app.querySelector('.ric-splitter__divider') as HTMLElement;
    expect(divider).not.toBeNull();
    const dividerRect = divider.getBoundingClientRect();

    // divider の実測 rect の左端付近の座標に openAt する → 本体の left は divider の
    // 左端とほぼ一致し、5px 幅の divider と本体の左端側で確実に重なる帯ができる。
    menu.openAt({ x: dividerRect.left, y: dividerRect.top + 20 });
    await new Promise((r) => setTimeout(r, 100)); // rAF 実測フェーズ + 再描画を待つ (他 popup テストと同じ)

    const body = app.querySelector('[role="menu"]') as HTMLElement;
    expect(body).not.toBeNull();
    const bodyRect = body.getBoundingClientRect();

    const overlap = intersect(dividerRect, bodyRect);
    expect(overlap).not.toBeNull(); // 前提: 実際に重なっている

    const px = overlap!.left + overlap!.width / 2;
    const py = overlap!.top + overlap!.height / 2;

    // 修正前 (z-index 未指定): divider の z-index:1 だけが有効で popup 本体
    // (z-index 無し = auto) より前面に描かれ、ここで divider が返っていた。
    const hit = document.elementFromPoint(px, py);
    expect(divider.contains(hit)).toBe(false);
    expect(body === hit || body.contains(hit)).toBe(true);
  });
});
