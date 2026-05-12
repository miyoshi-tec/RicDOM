// RicUI — factory helpers (internal)
//
// create_ui_* ファクトリは内部 event listener / interval / animationend 等から
// 自分自身の再描画をトリガーする必要があるため、RicDOM が set trap 経由で
// `inst.__notify` をファクトリ instance に自動注入する。
//
// この注入は **「ファクトリを state のトップレベル (s.foo = create_ui_xxx(...))
// に置く」** ことで初めて発火する。state 外で生成して module level const として
// 持つと __notify は undefined のまま — 内部状態 (splitter._cl 等) は変化するが
// 全体再描画が呼ばれず、ユーザーから見ると「コンポーネントが固まった」状態になる。
//
// `safe_notify(inst, factory_name)` を経由することで:
//   - __notify があれば従来どおり再描画
//   - 無ければ factory_name ごとに **1 回だけ** console.warn を出して、
//     state 配置の誤りであることを 5 秒で気付かせる
//
// 既存の正しい使い方には何の影響もない (typeof check が増えるだけ)。
//
// 詳しくは SPEC.md "Controlled / Uncontrolled パターン" / TUTORIAL.md
// "ありがちな誤用" 参照。

'use strict';

// factory_name ごとに warn 済みかを記録する。spam 防止。
const _warned = new Set();

const safe_notify = (inst, factory_name) => {
  if (typeof inst.__notify === 'function') {
    inst.__notify();
    return;
  }
  if (_warned.has(factory_name)) return;
  _warned.add(factory_name);
  // 概念的には開発時のみ出したいが、RicDOM 自体に DEV フラグが無いので常時出す。
  // 正しく state に入れていれば __notify はあるため、正規 user は踏まない。
  console.warn(
    '[RicDOM] ' + factory_name + '() instance has no __notify — ' +
    'place the factory at the top level of state so RicDOM can wire it up:\n' +
    '  create_RicDOM(target, { my_widget: ' + factory_name + '({...}) })\n' +
    'Internal events (collapse / theme-change / etc.) will not trigger re-render ' +
    'until you do this. See SPEC.md "Controlled / Uncontrolled パターン".'
  );
};

// test 用: warning 履歴を全クリア。各テスト間で独立にしたいときに呼ぶ。
// production の user code から触る必要はない (公開はしない予定だが、
// ric_ui/index.js でも export しない方針なので別 module から require する形)。
const _reset_safe_notify_warnings = () => { _warned.clear(); };

module.exports = { safe_notify, _reset_safe_notify_warnings };
