// ricdom/ui — Component<P> 契約の内部ヘルパー (設計書 §3.4/A)
//
// 状態を持つ部品 (dialog/popup/toast/tooltip) は `app.use(createXxx())` で登録して
// 初めて host ({ notify, portal, app }) を受け取る。use() を経由せず render 内で
// 直接呼ばれた場合は「初回だけ console.error し、何も描画しない (NOOP)」ことで
// 検知する — v1 の __notify 暗黙注入と違い、置き場所を間違えようがない構造にする
// (設計書 A)。4 部品共通のこの挙動を 1 箇所にまとめる。

// パッケージ内部では相対パスでコア (`ricdom`) を参照する (self-reference は npm link 等が
// 無いと解決できないため。公開後の consumer は `import type { Host } from 'ricdom'` を使う)。
import type { Host, RicNode } from '../../types.js';
import { warnIfStylesMissing } from '../injectStyles.js';

export type { Host };

/** `app.use(part)` に渡す部品の呼び出し可能インターフェース (設計書 A)。 */
export interface Component<P> {
  (props: P): RicNode;
  /** app.use() が登録時に呼ぶ。host を経由して初めて notify/portal が使えるようになる。 */
  attach(host: Host): void;
  /** app.unmount() 等で登録解除される際に呼ばれる。イベント解除・内部状態のリセットを行う。 */
  dispose(): void;
  /**
   * app の render サイクルごとに portal へ描画すべき内容を返す (コアの `UsePart.renderPortal`
   * のブリッジ、設計書 §3.5)。dialog/popup/toast/tooltip はこれを実装する。状態を持たず
   * portal も使わない部品 (uiButton 等) には無い。
   */
  renderPortal?(): RicNode;
}

export interface AttachGuard {
  readonly host: Host | null;
  attach: (host: Host) => void;
  dispose: () => void;
  /** host が無ければ (= use() されていなければ) 初回だけ console.error して null を返す */
  ensure: () => Host | null;
}

/**
 * 4 部品 (dialog/popup/toast/tooltip) で共有する「host 未接続検知」の実装。
 * `componentName` はエラーメッセージに使う (例: 'createDialog')。
 */
export const createAttachGuard = (componentName: string): AttachGuard => {
  let host: Host | null = null;
  let warned = false;

  return {
    get host() {
      return host;
    },
    attach: (h: Host) => {
      host = h;
      warned = false; // 再 attach (再 use()) されたら警告状態もリセットする
      if (typeof document !== 'undefined') warnIfStylesMissing(document);
    },
    dispose: () => {
      host = null;
    },
    ensure: () => {
      if (host) return host;
      if (!warned) {
        warned = true;
        console.error(
          `RicDOM UI: ${componentName}() は app.use() で登録されていません。\n` +
            `✅ 例: const part = app.use(${componentName}()); render 内で part({ ... }) を呼んでください。\n` +
            '   (use() を経由しない呼び出しは host が無いため、何も描画されません)',
        );
      }
      return null;
    },
  };
};
