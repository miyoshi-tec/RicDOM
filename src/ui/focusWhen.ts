// ricdom/ui — createFocusWhen (v1 `focus_when` の後継、2.0.0-alpha.2)
//
// v1: 条件の立ち上がりエッジ (false→true) で ref 先の要素に focus する軽量ヘルパー
// (dialog を開いた瞬間・ストリーミング応答が完了した瞬間 等、4 箇所で使われていた)。
// dialog の標準の初期フォーカス (最初の focusable、createDialog 参照) では代替できない
// ケース — 「dialog 内の *特定の* 要素へ」「dialog 以外のタイミングでも」フォーカスしたい
// 場合向け。パイロット第 2 号 (Trend Guard) の報告を受けて移植する。
//
// 状態 (「前回の condition」) を持つため `app.use(createFocusWhen())` で登録する
// (設計書 §3.4)。他の状態を持つ部品 (dialog/popup/toast/tooltip) と違い portal も
// props オブジェクトも持たない — `fw(refName, condition)` という 2 引数の関数呼び出しが
// 契約そのものなので、`Component<P>` (`(props: P) => RicNode`) は流用せず専用の
// `FocusWhenInstance` インターフェースを定義する。戻り値は常に null (副作用のみ、
// render tree には何も残さない)。
//
// 使い方:
//   const fw = app.use(createFocusWhen());
//   render 内: fw('emailInput', s.dialogJustOpened)
//
// 「render 完了後にフォーカスする」の実装: `host.app.nextRender()` は「呼ばれた時点で
// 保留中の render が無ければ、次に完了する render を待つ」契約 (SPEC §5)。render 関数の
// 実行は `doRender()` の中で `nextRender()` の pendingResolve 解決チェックより前に起きる
// (src/app.ts の doRender 参照) ため、fw() を render 内 (= currentRenderFn の実行中) で
// 同期的に呼べば、`nextRender()` は「今まさに進行中のこの render」の完了を待つ Promise を
// 返す — 1 render 分待ってから ref を探すことで、#2 で修正した「portal 内 ref は
// registerRefs が portal パッチの後に呼ばれて初めて登録される」タイミングにも自然に乗る
// (dialog を開いた最初の render で fw() を呼んでも、portal 内の ref を正しく拾える)。

import { type AttachGuard, createAttachGuard, type Host } from './internal/component.js';
import { isDevMode } from './internal/pureHelpers.js';

export interface FocusWhenInstance {
  /**
   * `condition` が前回 false → 今回 true の立ち上がりのときだけ、この render の完了後に
   * `app.refs.get(refName)?.focus()` する。true が継続している間や false→false/true→false
   * では何もしない。戻り値は常に null (render tree に組み込む必要はない — 呼ぶだけでよい)。
   */
  (refName: string, condition: boolean): null;
  attach(host: Host): void;
  dispose(): void;
}

/**
 * 条件の立ち上がりエッジで ref 先の要素に focus するヘルパーを作る。
 * 状態 (ref ごとの直近の condition) を持つため `app.use(createFocusWhen())` で登録する。
 *   const fw = app.use(createFocusWhen());
 *   fw('emailInput', s.dialogJustOpened);
 */
export const createFocusWhen = (): FocusWhenInstance => {
  const guard: AttachGuard = createAttachGuard('createFocusWhen');
  // ref 名ごとに前回の condition を持つ (1 インスタンスで複数 ref を扱えるように、
  // ヘッダコメント参照)。
  const lastByRef = new Map<string, boolean>();

  const focusRef = (host: Host, refName: string): void => {
    const el = host.app.refs.get(refName);
    if (el && typeof (el as HTMLElement).focus === 'function') {
      (el as HTMLElement).focus();
      return;
    }
    if (isDevMode()) {
      console.warn(`RicDOM UI: createFocusWhen: ref "${refName}" が見つかりません (フォーカスできる要素が render 結果に無い、または ref 名の綴りが違う可能性があります)。`);
    }
  };

  const inst = ((refName: string, condition: boolean): null => {
    const host = guard.ensure();
    if (!host) return null;

    const wasTrue = lastByRef.get(refName) ?? false;
    lastByRef.set(refName, condition);

    if (condition && !wasTrue) {
      // 「render 中に呼べば当該 render の完了で resolve する」契約 (SPEC §5) を使い、
      // このメソッド呼び出しを含む render が実 DOM に反映されるのを待ってから focus する。
      // nextRender() 自体は throw しないので catch は不要 (App<S> の契約上、reject しない)。
      host.app.nextRender().then(() => focusRef(host, refName));
    }

    return null;
  }) as FocusWhenInstance;

  inst.attach = guard.attach;
  inst.dispose = (): void => {
    lastByRef.clear();
    guard.dispose();
  };

  return inst;
};
