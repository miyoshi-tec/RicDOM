// RicDOM コア実装
// JSON 構文で DOM を宣言的に定義・差分更新する軽量ライブラリ
// ブラウザ / Electron の renderer プロセスで動作する（Node.js 単体では動かない）

'use strict';

// =====================================================================
// NOOP_PROXY
// render_fn が関数でない場合など、エラー時に返すダミー Proxy
// =====================================================================

// ターゲット関数にすることで apply トラップが使えるようになる
// （NOOP_PROXY() のような誤用でも壊れない）
const noop_function = () => NOOP_PROXY;

// モジュールスコープで単一インスタンスとして保持する
// get のたびに新しい Proxy を生成するとメモリリークするため、自分自身を返す設計にする
const NOOP_PROXY = new Proxy(noop_function, {
  get:            () => NOOP_PROXY, // 何にアクセスしても自分自身を返す
  set:            () => true,       // 代入は静かに受け付けて何もしない
  apply:          () => NOOP_PROXY, // 関数として呼ばれても自分自身を返す
  deleteProperty: () => true,       // delete も静かに無視する
});

// =====================================================================
// ユーティリティ：スタイル正規化
// =====================================================================

// ハイフンケース → キャメルケース変換
// 例: 'padding-top' → 'paddingTop'
const convert_style_key_to_camel = (key) =>
  key.replace(/-([a-z])/g, (_, char) => char.toUpperCase());

// style の正規化（3形式 + 配列マージ形式を受け付ける）
// 戻り値はキャメルケースオブジェクト、または文字列（cssText 用）
const normalize_style = (style) => {
  if (!style) return {};

  // 配列形式：後勝ちでマージして1つのキャメルケースオブジェクトにまとめる
  if (Array.isArray(style)) {
    return style.reduce((merged, item) => {
      if (item == null) return merged;             // null / undefined はスキップ
      const normalized = normalize_style(item);
      // 文字列形式はマージ対象外（個別プロパティとして扱えないため）
      if (typeof normalized === 'string') return merged;
      return { ...merged, ...normalized };
    }, {});
  }

  // 文字列形式：element.style.cssText に代入するためそのまま返す
  if (typeof style === 'string') return style;

  // オブジェクト形式：キーをキャメルケースに統一する
  return Object.fromEntries(
    Object.entries(style).map(([key, val]) => [
      convert_style_key_to_camel(key),
      val,
    ])
  );
};

// =====================================================================
// ユーティリティ：RicNode 正規化
// =====================================================================

// 非表示とみなす値か判定する
// null / undefined / false / 空配列 / 空オブジェクト は描画しない
const is_invisible_value = (val) => {
  if (val === null || val === undefined || val === false) return true;
  if (Array.isArray(val) && val.length === 0) return true;
  if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) return true;
  return false;
};

// JSON ノードを正規化された内部形式に変換する
// class/style の統一などを行う
// 戻り値: { tag, id, class: [...], style: {...} or string, ctx: [...], ref, ...その他属性 }
const normalize_ric_node = (raw_node) => {
  // テキストノードや数値はそのまま返す
  if (typeof raw_node === 'string' || typeof raw_node === 'number') {
    return { node_type: 'text', text: String(raw_node) };
  }

  // 非表示値はスキップ用のマーカーを返す
  if (is_invisible_value(raw_node)) {
    return { node_type: 'invisible' };
  }

  // タグ・ID・クラスを確定する
  const tag = raw_node.tag ?? 'div';
  const id  = raw_node.id  ?? null;
  let classes = [];

  // class プロパティ（文字列・配列を受け付ける）
  const class_prop = raw_node.class;
  if (typeof class_prop === 'string' && class_prop) {
    classes = class_prop.split(/\s+/).filter(Boolean);
  } else if (Array.isArray(class_prop)) {
    classes = class_prop.filter(Boolean);
  }

  // ctx を確定する
  const raw_ctx = raw_node.ctx ?? [];
  const ctx_array = Array.isArray(raw_ctx) ? raw_ctx : (raw_ctx != null ? [raw_ctx] : []);

  // style を正規化する
  const normalized_style = normalize_style(raw_node.style ?? {});

  // その他の属性を収集する（tag/id/class/style/ctx/ref を除く）
  const exclude_keys = new Set([
    'tag', 'id', 'class', 'style', 'ctx', 'ref',
  ]);
  const extra_attrs = {};
  for (const key of Object.keys(raw_node)) {
    if (!exclude_keys.has(key)) {
      extra_attrs[key] = raw_node[key];
    }
  }

  return {
    node_type: 'element',
    tag,
    id,
    class:  classes,
    style:  normalized_style,
    ctx:    ctx_array,
    ref:    raw_node.ref ?? null,
    ...extra_attrs,
  };
};

// =====================================================================
// JSON 比較（差分更新の変化判定）
// =====================================================================

// 2つのノードツリーが等しいか再帰的に判定する
// 関数は参照同一性で比較する（異なるクロージャ → false → ハンドラが正しく更新される）
const is_json_equal = (a, b) => {
  if (a === b) return true;  // 同じ参照（同一関数含む）→ true
  if (typeof a !== typeof b) return false;
  // typeof null === 'object' なので b === null も明示的にガードする
  // （a がオブジェクト、b が null の場合に Object.keys(b) がクラッシュするのを防ぐ）
  if (typeof a !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => is_json_equal(item, b[i]));
  }

  const keys_a = Object.keys(a);
  const keys_b = Object.keys(b);
  if (keys_a.length !== keys_b.length) return false;
  return keys_a.every(key => is_json_equal(a[key], b[key]));
};

// =====================================================================
// DOM 構築
// =====================================================================

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// DOM プロパティとして直接代入すべきキー（setAttribute ではなく代入する）
const DOM_PROPERTY_KEYS = new Set([
  'value', 'checked', 'selected', 'disabled',
  'innerHTML', 'textContent', 'innerText',
  'scrollTop', 'scrollLeft',
]);

// イベントハンドラのプレフィックス
const is_event_handler_key = (key) => /^on[a-z]/.test(key);

// VDOM ノードの「構造を表すキー」集合。
// これらは normalize 処理が個別に処理するため、属性・プロパティ・イベントの
// 一般ループでは無視する（apply / patch 両方のパスで共通利用）。
const STRUCTURAL_NODE_KEYS = new Set(['node_type','tag','id','class','style','ctx','ref']);

// ノードに属性・プロパティ・イベントハンドラを適用する
const apply_attributes_to_element = (el, normalized_node) => {
  // id
  if (normalized_node.id) {
    el.id = normalized_node.id;
  }

  // class
  if (normalized_node.class && normalized_node.class.length > 0) {
    el.className = normalized_node.class.join(' ');
  }

  // style
  const style = normalized_node.style;
  if (style) {
    if (typeof style === 'string') {
      el.style.cssText = style;
    } else {
      for (const [key, val] of Object.entries(style)) {
        el.style[key] = val;
      }
    }
  }

  // その他の属性（イベント・プロパティ・HTML属性）
  for (const [key, val] of Object.entries(normalized_node)) {
    // normalize 済みの構造キーはスキップ
    if (STRUCTURAL_NODE_KEYS.has(key)) continue;

    if (is_event_handler_key(key)) {
      // イベントハンドラ：null は未設定として扱う
      if (typeof val === 'function') {
        el[key] = val;
      } else if (val === null) {
        el[key] = null;
      }
    } else if (DOM_PROPERTY_KEYS.has(key)) {
      // DOM プロパティ：直接代入する
      el[key] = val;
    } else if (typeof val === 'boolean') {
      // boolean 属性（disabled, hidden など）
      if (val) {
        el.setAttribute(key, '');
      } else {
        el.removeAttribute(key);
      }
    } else if (val !== null && val !== undefined) {
      // それ以外は setAttribute（SVG の viewBox 等に対応）
      el.setAttribute(key, val);
    }
  }
};

// 正規化済み RicNode から DOM ノードを構築する（再帰）
// inherited_namespace：SVG コンテキストを子孫に引き継ぐため
const build_dom_node = (raw_node, inherited_namespace = null) => {
  const normalized = normalize_ric_node(raw_node);

  if (normalized.node_type === 'invisible') return null;

  if (normalized.node_type === 'text') {
    return document.createTextNode(normalized.text);
  }

  // svg タグを検出したらネームスペースを確定し、子孫全体に引き継ぐ
  const current_namespace = (normalized.tag === 'svg')
    ? SVG_NAMESPACE
    : inherited_namespace;

  const el = current_namespace
    ? document.createElementNS(current_namespace, normalized.tag)
    : document.createElement(normalized.tag);

  // 属性・プロパティ・イベントハンドラを適用する
  apply_attributes_to_element(el, normalized);

  // ref が指定されている場合、data-ric-ref 属性を設定する
  // DOM の id 属性とは異なり DOM には直接出力しない（RicDOM の内部管理用）
  // register_refs_from_element() が querySelectorAll('[data-ric-ref]') で収集するために必要
  if (normalized.ref) {
    el.dataset.ricRef = normalized.ref;
  }

  // 子要素を再帰的に構築する
  for (const child of normalized.ctx) {
    if (is_invisible_value(child)) continue;
    const child_el = build_dom_node(child, current_namespace);
    if (child_el) el.appendChild(child_el);
  }

  return el;
};

// =====================================================================
// 差分更新（reconciliation）
// =====================================================================

// prev・next 両方の子要素リストから重複タグ名を収集して Set で返す
// 例: prev に div が 1 個、next に div が 2 個 → {div}
// prev・next の union を取ることで「消えた」「現れた」どちらの側にも対応する
const collect_duplicate_tags = (prev_children, next_children) => {
  const count_tags = (children) => {
    const counts = {};
    for (const child of children) {
      if (typeof child === 'object' && child !== null && !Array.isArray(child)) {
        const normalized = normalize_ric_node(child);
        if (normalized.node_type === 'element') {
          counts[normalized.tag] = (counts[normalized.tag] ?? 0) + 1;
        }
      }
    }
    return counts;
  };
  const prev_counts = count_tags(prev_children);
  const next_counts = count_tags(next_children);
  const dup_tags = new Set();
  for (const [tag, n] of Object.entries(prev_counts)) { if (n > 1) dup_tags.add(tag); }
  for (const [tag, n] of Object.entries(next_counts)) { if (n > 1) dup_tags.add(tag); }
  return dup_tags;
};

// 子要素リストにシリアルキーを割り当てる
// dup_tags に含まれるタグは 'div@0', 'div@1' のようにシリアル番号付き
// それ以外はタグ名そのまま。テキストノードは 'text'
// 実際の DOM タグ名は変えない（このキーはマッチングにのみ使う）
const build_serial_key_list = (children, dup_tags) => {
  const counters = {};
  return children.map(child => {
    if (typeof child === 'string' || typeof child === 'number') return 'text';
    if (typeof child !== 'object' || child === null)            return 'invisible';
    const normalized = normalize_ric_node(child);
    if (normalized.node_type !== 'element') return 'text';
    const tag = normalized.tag;
    if (!dup_tags.has(tag)) return tag; // 重複なし → タグ名そのまま
    const n = counters[tag] ?? 0;
    counters[tag] = n + 1;
    return `${tag}@${n}`; // 重複あり → シリアル番号付き
  });
};

// 属性の差分を DOM に反映する
const patch_attributes = (prev_normalized, next_normalized, el) => {
  // id の差分
  const next_id = next_normalized.id ?? '';
  if ((prev_normalized.id ?? '') !== next_id) {
    el.id = next_id;
  }

  // ref の差分（data-ric-ref 属性を更新する）
  // ref は HTML の id 属性とは異なり DOM に直接出力しない（RicDOM の内部管理用）
  // register_refs_from_element() が querySelectorAll('[data-ric-ref]') で収集するために必要
  const prev_ref = prev_normalized.ref ?? '';
  const next_ref = next_normalized.ref ?? '';
  if (prev_ref !== next_ref) {
    if (next_ref) {
      el.dataset.ricRef = next_ref;
    } else {
      delete el.dataset.ricRef;
    }
  }

  // class の差分
  const prev_class = (prev_normalized.class ?? []).join(' ');
  const next_class = (next_normalized.class ?? []).join(' ');
  if (prev_class !== next_class) {
    el.className = next_class;
  }

  // style の差分
  const prev_style = prev_normalized.style ?? {};
  const next_style = next_normalized.style ?? {};

  if (typeof next_style === 'string') {
    if (el.style.cssText !== next_style) {
      el.style.cssText = next_style;
    }
  } else {
    // 次のスタイルを適用する
    for (const [key, val] of Object.entries(next_style)) {
      if (el.style[key] !== val) {
        el.style[key] = val;
      }
    }
    // 前にあったが次にないスタイルをリセットする
    if (typeof prev_style !== 'string') {
      for (const key of Object.keys(prev_style)) {
        if (!(key in next_style)) {
          el.style[key] = '';
        }
      }
    }
  }

  // その他の属性・プロパティ・イベントハンドラの差分
  const prev_extra = Object.fromEntries(Object.entries(prev_normalized).filter(([k]) => !STRUCTURAL_NODE_KEYS.has(k)));
  const next_extra = Object.fromEntries(Object.entries(next_normalized).filter(([k]) => !STRUCTURAL_NODE_KEYS.has(k)));

  // 次の値を適用する
  for (const [key, val] of Object.entries(next_extra)) {
    if (is_event_handler_key(key)) {
      // イベントハンドラは差分チェックを通さず常に最新ハンドラで上書きする。
      // render 関数の中で毎回 () => {...} を作るのが普通の使い方なので、
      // 参照は毎回新しい。同一参照が渡ってきた場合でも、最新クロージャに
      // 差し替わることを保証するため一律上書きする（性能影響は無視できる小ささ）。
      el[key] = (typeof val === 'function') ? val : null;
    } else if (!is_json_equal(prev_extra[key], val)) {
      if (DOM_PROPERTY_KEYS.has(key)) {
        el[key] = val;
      } else if (typeof val === 'boolean') {
        if (val) { el.setAttribute(key, ''); } else { el.removeAttribute(key); }
      } else if (val !== null && val !== undefined) {
        el.setAttribute(key, val);
      } else {
        el.removeAttribute(key);
      }
    }
  }

  // 前にあったが次にない属性を削除する。
  // DOM プロパティはデフォルト値に戻す術が型ごとに違うため、HTML 属性と同じく
  // removeAttribute で代用する（属性 → 対応プロパティの初期化はブラウザに任せる）。
  for (const key of Object.keys(prev_extra)) {
    if (!(key in next_extra)) {
      if (is_event_handler_key(key)) el[key] = null;
      else                            el.removeAttribute(key);
    }
  }
};

// raw な子ノードリストを正規化して invisible を除去する
const normalize_children = (raw_children) => {
  const result = [];
  for (const child of raw_children) {
    if (is_invisible_value(child)) continue;
    // 配列は展開する（ctx に配列を渡した場合）
    if (Array.isArray(child)) {
      for (const nested_child of child) {
        if (!is_invisible_value(nested_child)) result.push(nested_child);
      }
    } else {
      result.push(child);
    }
  }
  return result;
};

// 子要素リストの差分を DOM に反映する（前回・今回の正規化済み JSON を受け取る）
const patch_children = (prev_raw_children, next_raw_children, parent_el) => {
  const prev_children = normalize_children(prev_raw_children);
  const next_children = normalize_children(next_raw_children);

  // 変化がなければ何もしない
  if (is_json_equal(prev_children, next_children)) return;

  // prev・next 両方から重複タグを収集し、シリアルキーリストを生成する
  // 重複タグがある場合でも innerHTML リセットはせず、シリアルキーで位置マッチングする
  // 理由: innerHTML = '' は input のフォーカス・IME 変換状態・スクロール位置を破壊するため
  // シリアルキー例: [div(ラベル), input, div(挨拶)] → ['div@0', 'input', 'div@1']
  //                 prev に div が 1 個しかなくても同じルールで 'div@0' と割り当てるため
  //                 prev 側の div@0 ↔ next 側の div@0 が正しく対応付けられる
  const dup_tags         = collect_duplicate_tags(prev_children, next_children);
  const prev_serial_keys = build_serial_key_list(prev_children, dup_tags);
  const next_serial_keys = build_serial_key_list(next_children, dup_tags);

  patch_children_by_position(prev_children, next_children, parent_el, prev_serial_keys, next_serial_keys);
};

// 位置ベースの差分更新
// prev_serial_keys / next_serial_keys: build_serial_key_list() が返すキーリスト
// シリアルキーを「このポジションのノードが同一ノードか」の判定に使う
// キーが同じ → インプレース更新（DOM ノード再利用）
// キーが違う → 置き換え（前のノードとは別物とみなす）
const patch_children_by_position = (prev_children, next_children, parent_el, prev_serial_keys, next_serial_keys) => {
  const prev_len = prev_children.length;
  const next_len = next_children.length;
  const max_len  = Math.max(prev_len, next_len);

  for (let i = 0; i < max_len; i++) {
    const prev_node = prev_children[i];
    const next_node = next_children[i];
    // childNodes は live NodeList のため削除後にインデックスがずれる点に注意
    const dom_el = parent_el.childNodes[i];

    if (next_node === undefined) {
      // 余分なノードを削除する
      if (dom_el) {
        parent_el.removeChild(dom_el);
      }
    } else if (prev_node === undefined) {
      // 新規ノードを追加する
      // 親の namespaceURI を引き継ぐ（SVG サブツリーへの動的追加で
      // 子要素が HTML namespace で生成されないようにするため）
      const new_el = build_dom_node(next_node, parent_el.namespaceURI);
      if (new_el) parent_el.appendChild(new_el);
    } else {
      const prev_normalized = normalize_ric_node(prev_node);
      const next_normalized = normalize_ric_node(next_node);

      // テキストノードの差分（シリアルキーは関係ない）
      if (next_normalized.node_type === 'text') {
        if (prev_normalized.node_type === 'text') {
          if (dom_el && dom_el.nodeType === Node.TEXT_NODE && dom_el.textContent !== next_normalized.text) {
            dom_el.textContent = next_normalized.text;
          }
        } else {
          const new_el = document.createTextNode(next_normalized.text);
          if (dom_el) { parent_el.replaceChild(new_el, dom_el); }
          else         { parent_el.appendChild(new_el); }
        }
        continue;
      }

      // シリアルキーが違う場合は別ノードとみなして置き換える
      // 同じキー（例: 'div@0' ↔ 'div@0'）なら DOM ノードを再利用してインプレース更新する
      const prev_key = prev_serial_keys[i];
      const next_key = next_serial_keys[i];
      if (prev_key !== next_key) {
        // 親の namespaceURI を引き継ぐ（追加パスと同じ理由）
        const new_el = build_dom_node(next_node, parent_el.namespaceURI);
        if (new_el && dom_el) {
          parent_el.replaceChild(new_el, dom_el);
        } else if (new_el) {
          parent_el.appendChild(new_el);
        }
        continue;
      }

      // 同一ノード → 属性だけ更新して子要素を再帰処理する
      // DOM ノードを再利用するため input のフォーカス・IME 状態が保たれる
      if (dom_el) {
        patch_attributes(prev_normalized, next_normalized, dom_el);
        patch_children(
          prev_normalized.ctx ?? [],
          next_normalized.ctx ?? [],
          dom_el,
        );
      }
    }
  }

  // 超過した DOM ノードを後ろから削除する
  while (parent_el.childNodes.length > next_len) {
    parent_el.removeChild(parent_el.lastChild);
  }
};

// =====================================================================
// 描画スケジューラ（requestAnimationFrame ベース）
// =====================================================================

// インスタンスごとに rAF ベースの描画スケジューラを生成する
// 同一フレーム内の多重スケジュールを防ぎ、描画を1回にまとめる
const create_render_scheduler = (do_render) => {
  // let が必要な数少ないケース：rAF コールバック内でリセットするため
  let render_scheduled = false;

  const schedule_render = () => {
    // すでにスケジュール済みなら何もしない（同一フレーム内の重複登録を防ぐ）
    if (render_scheduled) return;
    render_scheduled = true;

    requestAnimationFrame(() => {
      render_scheduled = false; // フラグをリセットしてから描画する
      do_render();
    });
  };

  return { schedule_render };
};

// =====================================================================
// shared state 管理
// =====================================================================

// raw state オブジェクトに対して共有 Proxy とサブスクライバーリストを WeakMap で管理する
// WeakMap を使う理由：raw state が GC されたときに自動的にエントリが削除される（メモリリーク防止）
const state_subscribers_map = new WeakMap(); // raw state → Set<schedule_render>
const state_proxy_map       = new WeakMap(); // raw state → 共有Proxy

// =====================================================================
// target 探索
// =====================================================================

// target を文字列（CSS セレクタ）または HTMLElement として受け付ける
// 文字列の場合は document.querySelector で取得する
const resolve_target_element = (target) => {
  if (typeof target === 'string') {
    return document.querySelector(target);
  }
  if (target instanceof HTMLElement) {
    return target;
  }
  return null;
};

// =====================================================================
// create_RicDOM：メインのファクトリ関数
// =====================================================================

const create_RicDOM = (target, raw_state = {}) => {

  // ── 引数の正規化 ─────────────────────────────────────────
  // API: create_RicDOM(target, state_with_render)
  //   target: CSS セレクタ文字列 or DOM 要素
  //   state_with_render: 初期 state。render: (s) => VDOM を含めると描画関数として使われる
  //   render 後付け: handle.render = fn（per-instance）
  //
  // 第 1 引数が object だった過去の 3 引数 form（create_RicDOM(state, target, render)）
  // は v0.3.3 で削除した。複数 instance + 共有 state + 独立 render は、
  // 2 引数 form + handle.render = fn で同じことが書ける。
  if (typeof target !== 'string'
      && !(typeof HTMLElement !== 'undefined' && target instanceof HTMLElement)) {
    console.error(
      'RicDOM: 第 1 引数は CSS セレクタ文字列または DOM 要素です。\n' +
      '✅ 正しい例: create_RicDOM(\'#app\', { count: 0, render: s => ({ tag: \'div\', ctx: [s.count] }) })\n' +
      '⚠️ 旧 3 引数形式 create_RicDOM(state, target, render) は v0.3.3 で削除されました。',
    );
    return NOOP_PROXY;
  }

  const render_fn = raw_state.render;
  // render は state のプロパティだが、raw_state からは削除しない
  // （s.render の get/set trap で管理するため）

  // render_fn のバリデーション
  if (render_fn !== undefined && render_fn !== null && typeof render_fn !== 'function') {
    console.error(
      'RicDOM: render が関数ではありません。\n' +
      '✅ 正しい例: create_RicDOM(\'#app\', { count: 0, render: s => ({ tag: \'div\', ctx: [s.count] }) })\n' +
      '✅ 省略も可: create_RicDOM(\'#app\', { count: 0 }) → handle.render = fn で後設定',
    );
    return NOOP_PROXY;
  }

  // render_fn 省略時は null。handle.render = fn で設定するまで描画しない。
  let _render_fn = typeof render_fn === 'function' ? render_fn : null;
  const _render_fn_provided = _render_fn !== null;

  // state が null / undefined の場合もエラーを通知する
  if (raw_state === null || raw_state === undefined || typeof raw_state !== 'object') {
    console.error(
      'RicDOM: state がオブジェクトではありません。\n' +
      '✅ 正しい例: create_RicDOM(\'#app\', { count: 0 })',
    );
    return NOOP_PROXY;
  }

  // ---------------------------------------------------------------
  // インスタンス固有の変数
  // ---------------------------------------------------------------

  // 破棄フラグ：destroy() 後の描画・タイマーをスキップするために使う
  let is_destroyed = false;

  // target 探索リトライタイマーの ID（destroy() 時に停止するために保持する）
  let target_search_timer = null;

  // 前回描画時の JSON ツリー（差分更新の基準になる）
  let prev_tree = null;

  // DOM への ref 参照マップ（インスタンス固有。shared state には載せない）
  const refs_map = new Map();

  // マウント先の DOM 要素（解決後にセットする）
  let target_el = null;

  // ---------------------------------------------------------------
  // shared state のセットアップ
  // ---------------------------------------------------------------

  // このstateへの購読者リストを取得（なければ作成）
  if (!state_subscribers_map.has(raw_state)) {
    state_subscribers_map.set(raw_state, new Set());
  }
  const subscribers = state_subscribers_map.get(raw_state);

  // 初期 state 内のファクトリオブジェクトに __notify を注入する
  // （set trap を通らずに初期状態に入ったものへ対応。
  //   create_RicDOM('#app', { dlg: create_ui_dialog(), ... }) のような
  //   コンパクト記法で popup/dialog の内部イベントから再描画をトリガーできるようにする）
  // non-enumerable で定義することで Object.keys/entries/JSON.stringify 等で
  // ユーザーデータに混入しない（json_root のような「データそのもの」を state
  // に置くケースを壊さないため）。
  const _inject_notify = (value) => {
    if (value == null || (typeof value !== 'object' && typeof value !== 'function')) return;
    if (value.__notify) return;
    Object.defineProperty(value, '__notify', {
      value: () => subscribers.forEach(schedule => schedule()),
      enumerable: false, configurable: true, writable: true,
    });
  };
  for (const key of Object.keys(raw_state)) {
    if (key === 'ignore' || key === 'render') continue;
    _inject_notify(raw_state[key]);
  }

  // このstateの共有Proxyを取得（なければ作成）
  if (!state_proxy_map.has(raw_state)) {

    // 一段目のオブジェクト/関数に対する子 Proxy キャッシュ
    // s.dark.density = 'compact' のように、一段目のメンバへの代入でも
    // 再描画をトリガーする。ignore メンバへの代入はスキップする。
    // WeakMap を使うことで、オブジェクトが GC されればキャッシュも消える。
    const _child_proxies = new WeakMap();

    const _wrap_child = (val) => {
      if (!_child_proxies.has(val)) {
        _child_proxies.set(val, new Proxy(val, {
          set(target, prop, value) {
            target[prop] = value;
            // ignore への代入は再描画しない（トップレベルと同じルール）
            if (prop === 'ignore') return true;
            subscribers.forEach(schedule => schedule());
            return true;
          },
        }));
      }
      return _child_proxies.get(val);
    };

    const shared_proxy = new Proxy(raw_state, {
      get(obj, key) {
        // s.render → 現在の描画関数を返す（未設定時は undefined）
        if (key === 'render') return _render_fn ?? undefined;
        const val = obj[key];
        // ignore / null / プリミティブ / 配列はそのまま返す
        // 配列を Proxy ラップしない結果、 `s.list.push(x)` のような mutation では
        // 再描画はトリガされない。配列は置き換え（`s.list = [...s.list, x]`）で扱うこと。
        // この制限は SPEC.md「Proxy 監視深度」にも明記されている。
        if (key === 'ignore' || val == null
            || (typeof val !== 'object' && typeof val !== 'function')
            || Array.isArray(val)) {
          return val;
        }
        // 一段目のオブジェクト/関数を子 Proxy でラップして返す
        return _wrap_child(val);
      },
      set(obj, key, value) {
        // s.render = fn（render 関数内から shared_proxy 経由）で描画関数を差し替え。
        // s.page = ... 等の代入で既に rAF がスケジュール済みの場合、
        // rAF コールバックは同期コード完了後に走るため、
        // この時点で _render_fn を設定しておけば rAF 内の do_render で使われる。
        //
        // 注意: shared_proxy はキャッシュ（state_proxy_map）で複数 instance 間で共有されるが、
        // この `_render_fn` は **最初の create_RicDOM 呼び出しのクロージャ変数**。
        // そのため shared_proxy.render = fn は「最初の instance の render のみ」を変更する。
        // 複数 instance で異なる render を使いたい場合は `handle.render = fn` を使うこと
        // （instance_handle 側の set トラップで per-instance に処理される）。
        if (key === 'render' && typeof value === 'function') {
          _render_fn = value;
          // target 解決済みなら同期で初回描画（FOUC 防止）
          if (target_el) { do_render(); }
          else { subscribers.forEach(schedule => schedule()); }
          return true;
        }
        // ignore は監視対象外（代入しても再描画しない）
        if (key === 'ignore') { obj[key] = value; return true; }
        obj[key] = value;
        // ファクトリオブジェクトに再描画通知コールバックを注入する
        // create_ui_xxx() が返すオブジェクトが s.xxx に代入されたとき、
        // 内部のイベントハンドラから __notify() で再描画をトリガーできるようになる
        // non-enumerable で定義することで Object.keys/entries/JSON.stringify 等に
        // 拾われない（ユーザーデータへの混入を防ぐ）
        _inject_notify(value);
        // 登録済み全インスタンスの schedule_render を叩く
        subscribers.forEach(schedule => schedule());
        return true;
      },
      deleteProperty(obj, key) {
        // ignore の削除は再描画しない
        if (key === 'ignore') { delete obj[key]; return true; }
        delete obj[key];
        // 削除も変更として全インスタンスに通知する
        subscribers.forEach(schedule => schedule());
        return true;
      },
    });
    state_proxy_map.set(raw_state, shared_proxy);
  }
  const shared_proxy = state_proxy_map.get(raw_state);

  // ---------------------------------------------------------------
  // ref の処理（描画後に DOM ノードへの参照を登録する）
  // ---------------------------------------------------------------

  // 描画後に ref が付いたノードを refs_map に再登録する。
  // render ごとに全走査するのはコスト的に許容範囲（典型的には ref 数十個以下）。
  const register_refs_from_element = (target_element) => {
    refs_map.clear();

    const nodes_with_ref = target_element.querySelectorAll('[data-ric-ref]');
    for (const node of nodes_with_ref) {
      const ref_name = node.dataset.ricRef;
      if (ref_name) refs_map.set(ref_name, node);
    }
  };

  // ---------------------------------------------------------------
  // 描画処理
  // ---------------------------------------------------------------

  const do_render = () => {
    if (is_destroyed)  return;
    if (!target_el)    return;
    if (!_render_fn)   return; // render 未設定時はスキップ

    // render_fn を呼び出して JSON ツリーを取得する
    const next_raw_tree = _render_fn(shared_proxy);

    if (prev_tree === null) {
      // 初回描画：DOM を全量構築する
      target_el.innerHTML = '';
      const dom_el = build_dom_node(next_raw_tree);
      if (dom_el) target_el.appendChild(dom_el);
    } else {
      // 2回目以降：差分更新する
      // ルートノードを単一の子ノードとして扱う
      patch_children([prev_tree], [next_raw_tree], target_el);
    }

    // ref の再登録
    register_refs_from_element(target_el);

    prev_tree = next_raw_tree;
  };

  // ---------------------------------------------------------------
  // 描画スケジューラの設定
  // ---------------------------------------------------------------

  const { schedule_render } = create_render_scheduler(() => {
    if (!is_destroyed) do_render();
  });

  // 購読者リストにこのインスタンスの schedule_render を登録する
  subscribers.add(schedule_render);

  // ---------------------------------------------------------------
  // target 探索と初回描画
  // ---------------------------------------------------------------

  const start_target_search = () => {
    const el = resolve_target_element(target);
    if (el) {
      target_el = el;
      if (_render_fn_provided) do_render(); // render_fn 省略時は初回描画スキップ
      return;
    }

    // target が見つからない場合は 0.5秒間隔でリトライする
    let retry_count = 0;
    const max_retry = 40; // 0.5秒 × 40 = 20秒

    target_search_timer = setInterval(() => {
      if (is_destroyed) {
        clearInterval(target_search_timer);
        target_search_timer = null;
        return;
      }

      const found_el = resolve_target_element(target);
      if (found_el) {
        clearInterval(target_search_timer);
        target_search_timer = null;
        target_el = found_el;
        if (_render_fn_provided) do_render();
        return;
      }

      retry_count++;
      if (retry_count >= max_retry) {
        clearInterval(target_search_timer);
        target_search_timer = null;
        console.error(
          `RicDOM: target "${target}" が見つかりません。20秒待機しましたが検出できませんでした。`,
        );
      }
    }, 500);
  };

  start_target_search();

  // ---------------------------------------------------------------
  // インスタンス固有メソッド
  // ---------------------------------------------------------------

  const instance_destroy = () => {
    // shared state への変更通知を受け取らないよう購読を解除する
    // これをしないと destroy 後も schedule_render が呼ばれ続けメモリリークする
    subscribers.delete(schedule_render);

    // target 探索中のリトライタイマーを止める
    if (target_search_timer !== null) {
      clearInterval(target_search_timer);
      target_search_timer = null;
    }

    // 以降の再描画をすべて無視するフラグを立てる（残留rAFをスキップするため）
    is_destroyed = true;

    // ref の参照をクリアする
    refs_map.clear();
  };

  const instance_force_render = () => {
    // destroy() 後は何もしない（is_destroyed フラグで無視）
    if (is_destroyed) return;
    do_render();
  };

  // ---------------------------------------------------------------
  // インスタンスハンドルの生成
  // ---------------------------------------------------------------

  // state へのアクセスは共有Proxy を通しつつ、
  // refs はインスタンス固有にする
  // destroy / force_render は内部実装として存在するが、
  // 公開 API からは外す（必要なら _internal 経由でアクセス可能）
  const instance_handle = new Proxy(shared_proxy, {
    get(_, key) {
      if (key === 'refs')      return refs_map;
      if (key === '_internal') return { destroy: instance_destroy, force_render: instance_force_render };
      return shared_proxy[key]; // それ以外は共有Proxy に委譲
    },
    set(_, key, value) {
      // render の代入は per-instance で処理する。
      // shared_proxy.render = fn は最初の create_RicDOM のクロージャの _render_fn を
      // 書き換えるため、複数 instance が同じ raw_state を共有するときに
      // handle.render = fn_B が handle.render = fn_A を上書きしてしまう問題があった。
      // instance_handle で受け止めれば、自分の _render_fn クロージャに書ける。
      if (key === 'render' && typeof value === 'function') {
        _render_fn = value;
        if (target_el) do_render();   // 同期描画（shared_proxy.render = fn と同じ挙動）
        else schedule_render();       // target 解決前なら rAF に任せる
        return true;
      }
      shared_proxy[key] = value; // それ以外は共有Proxy 経由 → 全 instance 再描画
      return true;
    },
    deleteProperty(_, key) {
      delete shared_proxy[key]; // 共有Proxy の deleteProperty トラップを経由 → 全員再描画
      return true;
    },
  });

  return instance_handle;
};

// =====================================================================
// エクスポート
// =====================================================================

const version = require('./version');

// CommonJS 形式でエクスポートする（Node.js / Electron 対象）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { create_RicDOM, NOOP_PROXY, version };

  // テスト環境でのみ純粋関数を公開する（NODE_ENV=test のときだけ使える）
  // プロダクションコードからは直接参照しないこと
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    module.exports.__test_exports = {
      convert_style_key_to_camel,
      normalize_style,
      normalize_ric_node,
      is_json_equal,
      collect_duplicate_tags,
      build_serial_key_list,
    };
  }
}

// ブラウザ環境ではグローバルに公開する
if (typeof window !== 'undefined') {
  window.create_RicDOM = create_RicDOM;
  window.NOOP_PROXY    = NOOP_PROXY;
}
