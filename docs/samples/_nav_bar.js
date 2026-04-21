// _nav_bar.js — 統一ナビバー（全サンプル共通）
// 使い方：
//   <div id="nav_bar" data-sample="09"></div>
//   <script src="_nav_bar.js"></script>
//
// create_ui_page で包むことで RicUI の CSS が自動適用される。
// 設定メニューは create_ui_popup + create_ui_tweak_panel で構成。

'use strict';

// localStorage から保存済みテーマ設定を読み、サンプルコードから参照できるよう公開する。
// サンプルの create_ui_page() で初期テーマに使うことで、ページ遷移時のチラつきを防ぐ。
// 使い方: create_ui_page(window._ric_settings ?? { theme: 'light', font_size: 'lg' })
// さらに <body> の背景色を即座に設定して FOUC を防ぐ。
//
// 既知の制限: 07/08 等の独自レイアウトページでは、HTML パース中に
// <body> のデフォルト背景が 1 フレーム見えることがある（FOUC）。
// 完全解決には各ページの <head> にインライン <style> が必要だが、
// サンプルコードの簡潔さを優先して現状は許容している。
try {
  const _s = JSON.parse(localStorage.getItem('ric-settings') || 'null');
  if (_s) {
    window._ric_settings = _s;
    // テーマ名 → 背景色（FOUC 防止。RicUI 未ロードなので簡易マップ）
    const _bg = { light:'#f9fafb', dark:'#111827', teal:'#f0fdfa', cyber:'#0a1228', aqua:'#f0f9ff' };
    document.documentElement.style.background = _bg[_s.theme] ?? _bg.light;
  }
} catch {}

(function () {
  // ── サンプル一覧 ──
  const SAMPLES = [
    { no: '00', file: '00_hello.html',            title: 'Hello World' },
    { no: '01', file: '01_forms.html',            title: 'フォーム' },
    { no: '02', file: '02_controls.html',         title: 'コントロール' },
    { no: '03', file: '03_popup.html',            title: 'ポップアップ' },
    { no: '04', file: '04_accordion_dialog.html', title: 'ダイアログ & トースト' },
    { no: '05', file: '05_toast_accordion.html',  title: 'アコーディオン' },
    { no: '06', file: '06_splitter.html',         title: 'スプリッター' },
    { no: '07', file: '07_tweak_splitter.html',   title: 'Tweak Panel + Splitter' },
    { no: '08', file: '08_tweak_menu.html',       title: 'Tweak Panel + Menu' },
    { no: '09', file: '09_json_editor.html',      title: 'JSON エディタ' },
    { no: '10', file: '10_theme_studio.html',     title: 'Theme Studio' },
    { no: '11', file: '11_theme_override.html',   title: 'テーマ上書き' },
    { no: '12', file: '12_md_viewer.html',        title: 'Markdown ビューア' },
    { no: '13', file: '13_controlled_dialog_splitter.html', title: 'Controlled Mode' },
    { no: '14', file: '14_chat_ui.html',          title: 'Chat UI (textarea + scroll_pane)' },
    { no: '15', file: '15_ai_chat.html',           title: 'AI Chat (live, 4 providers)' },
  ];

  // ── 現在のページ検出 ──
  const nav_el = document.getElementById('nav_bar');
  if (!nav_el) return;
  if (typeof RicDOM === 'undefined') return;

  const { create_RicDOM } = RicDOM;
  const { create_ui_page, create_ui_popup, ui_button, create_theme,
          create_ui_tweak_panel, ui_tweak_folder, ui_tweak_row } = RicUI;

  const current_no = nav_el.dataset.sample
    || (location.pathname.match(/(\d{2})_/) || [])[1]
    || null;

  const current_idx = SAMPLES.findIndex(s => s.no === current_no);
  const current = current_idx >= 0 ? SAMPLES[current_idx] : null;
  const prev = current_idx > 0 ? SAMPLES[current_idx - 1] : null;
  const next = current_idx >= 0 && current_idx < SAMPLES.length - 1 ? SAMPLES[current_idx + 1] : null;

  // ── 設定の読み書き ──
  // nav_bar 自身の page がすべての create_ui_page と同様に
  // 'ric-theme-change' イベントで同期されるため、ここから読むだけで十分。
  const get_settings = (nav_page) => {
    const t = nav_page?.theme;
    return {
      theme:     t == null ? '—' : (typeof t === 'object' ? 'custom' : t),
      density:   nav_page?.density   ?? '—',
      font_size: nav_page?.font_size ?? '—',
    };
  };

  // ── localStorage 永続化 ──
  const _STORAGE_KEY = 'ric-custom-theme';
  const _SETTINGS_KEY = 'ric-settings';

  const _load_settings = () => {
    try {
      const saved = localStorage.getItem(_SETTINGS_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  };

  const _save_settings = (key, value) => {
    try {
      const cur = _load_settings() ?? {};
      cur[key] = (key === 'theme' && typeof value === 'object') ? 'custom' : value;
      localStorage.setItem(_SETTINGS_KEY, JSON.stringify(cur));
    } catch {}
  };

  const set_setting = (key, value) => {
    // イベント一本でサンプル本体と nav_bar 自身の両方を更新する。
    // create_ui_page が 'ric-theme-change' を listen しており、
    // inst.theme/density/font_size を更新して __notify を発火する。
    _save_settings(key, value);
    window.dispatchEvent(new CustomEvent('ric-theme-change', { detail: { key, value } }));
  };

  // ── カスタムテーマ ──
  const _load_custom = () => {
    try {
      const saved = localStorage.getItem(_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  };
  const _save_custom = () => {
    try { localStorage.setItem(_STORAGE_KEY, JSON.stringify(_custom)); } catch {}
  };

  const _defaults = { fg: '#1a1a2e', bg: '#eaeaea', accent: '#e94560' };
  const _saved = _load_custom();
  const _custom = _saved ?? { ..._defaults };
  let _is_custom = !!_saved;

  const _apply_custom_theme = () => {
    if (typeof create_theme === 'undefined') return;
    const theme_obj = create_theme({
      '--ric-color-fg':     _custom.fg,
      '--ric-color-bg':     _custom.bg,
      '--ric-color-accent': _custom.accent,
    });
    _is_custom = true;
    _save_custom();
    set_setting('theme', theme_obj);
  };

  // ── 設定用 tweak factory ──
  // s.tweak に代入することで RicDOM が __notify を注入され、
  // 行操作で nav_bar が自動再描画される。get は nav_bar 自身の page を参照する
  // （'ric-theme-change' で全 page 同期）。
  const _make_settings_tweak = (nav_page) => {
    if (typeof create_ui_tweak_panel === 'undefined') return null;
    return create_ui_tweak_panel({
      width: '100%',
      ctx: [
        ui_tweak_row({
          label: 'テーマ', type: 'radiobutton',
          options: ['light', 'dark', 'teal', 'cyber', 'aqua', 'custom'],
          get: () => _is_custom ? 'custom' : (typeof nav_page?.theme === 'string' ? nav_page.theme : 'light'),
          set: (v) => {
            if (v === 'custom') { _apply_custom_theme(); }
            else { _is_custom = false; try { localStorage.removeItem(_STORAGE_KEY); } catch {} set_setting('theme', v); }
          },
        }),
        ui_tweak_row({
          label: '密度', type: 'radiobutton',
          options: ['tight', 'compact', 'comfortable'],
          get: () => nav_page?.density ?? 'comfortable',
          set: (v) => set_setting('density', v),
        }),
        ui_tweak_row({
          label: 'フォントサイズ', type: 'radiobutton',
          options: ['sm', 'md', 'lg'],
          get: () => nav_page?.font_size ?? 'lg',
          set: (v) => set_setting('font_size', v),
        }),
        { tag: 'hr', class: 'ric-separator' },
        ui_tweak_folder({ label: 'カスタム編集', ctx: [
          ui_tweak_row({ label: 'fg', type: 'color',
            get: () => _custom.fg,
            set: (v) => { _custom.fg = v; _apply_custom_theme(); } }),
          ui_tweak_row({ label: 'bg', type: 'color',
            get: () => _custom.bg,
            set: (v) => { _custom.bg = v; _apply_custom_theme(); } }),
          ui_tweak_row({ label: 'accent', type: 'color',
            get: () => _custom.accent,
            set: (v) => { _custom.accent = v; _apply_custom_theme(); } }),
        ]}),
      ],
    });
  };

  // ── ナビバー描画 ──
  const nav_handle = create_RicDOM('#nav_bar', {
    render(s) {
      // create_ui_page で包む（RicUI CSS が自動適用される）
      s.page ??= create_ui_page(window._ric_settings ?? { theme: 'light', font_size: 'lg' });

      const cfg = get_settings(s.page);
      const theme_label = _is_custom ? 'custom' : (cfg.theme === '—' ? '...' : cfg.theme);
      const summary = cfg.theme === '—' ? '...' : `${theme_label} / ${cfg.font_size} / ${cfg.density}`;

      return s.page({
        style: 'padding:0;overflow:visible',
        ctx: [
          // ── ナビバー本体 ──
          { tag: 'div', style: 'display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid var(--ric-color-border);font-size:0.9em;flex-shrink:0;position:sticky;top:0;z-index:100;flex-wrap:wrap', ctx: [
            // ── 左: ← Top ──
            ui_button({ variant: 'ghost', ctx: ['← Top'], onclick: () => { location.href = '../index.html'; } }),
            { tag: 'span', style: 'color:var(--ric-color-border)', ctx: ['|'] },

            // ── 中央: prev / サンプル一覧（create_ui_popup） / next ──
            // data-sample がないページ（ドキュメント等）ではサンプルナビを省略し
            // タイトルのみ表示する。
            ...(current_no ? [
              prev
                ? ui_button({ variant: 'ghost', ctx: [`← ${prev.no}`], onclick: () => { location.href = prev.file; } })
                : ui_button({ variant: 'ghost', ctx: ['←'], disabled: true }),

              (() => {
                const samples_popup = s._samples_popup ??= create_ui_popup();
                return samples_popup({ label: `${current?.no ?? '?'} – ${current?.title ?? '?'}`, ctx:
                  SAMPLES.map(sample => {
                    const is_cur = sample.no === current_no;
                    return ui_button({
                      ctx: [`${sample.no} – ${sample.title}`],
                      variant: is_cur ? 'primary' : 'ghost',
                      onclick: () => { location.href = sample.file; },
                    });
                  }),
                });
              })(),

              next
                ? ui_button({ variant: 'ghost', ctx: [`${next.no} →`], onclick: () => { location.href = next.file; } })
                : ui_button({ variant: 'ghost', ctx: ['→'], disabled: true }),
            ] : [
              // ドキュメントページ: data-doc 属性からタイトルを表示
              { tag: 'span', style: 'font-weight:600', ctx: [nav_el.dataset.doc ?? ''] },
            ]),

            // ── スペーサー ──
            { tag: 'span', style: 'flex:1;min-width:8px' },

            // ── 右: 設定サマリー + ≡（create_ui_popup）──
            { tag: 'span', style: 'font-size:0.8em;color:var(--ric-color-fg-muted);white-space:nowrap', ctx: [summary] },
            (() => {
              const settings_popup = s._settings_popup ??= create_ui_popup();
              // s.tweak に代入することで __notify が注入され folder 開閉で再描画される
              if (!s.tweak) s.tweak = _make_settings_tweak(s.page);
              return settings_popup({ ctx: [
                { tag: 'div', onclick: (e) => e.stopPropagation(), ctx: [
                  s.tweak?.() ?? { tag: 'span', ctx: ['loading...'] },
                ]},
              ]});
            })(),
          ]},
        ],
      });
    },
  });

  // ── 初期設定復元（カスタムテーマのみ）──
  // 標準テーマ・密度・フォントサイズは window._ric_settings 経由で
  // 各 create_ui_page() の initial に渡されるため、ここでの上書きは不要。
  // カスタムテーマだけは CSS 変数の直接注入が必要なため、
  // 全 page の .ric-page が生成された後に適用する（イベント経由で同期される）。
  const saved = _load_settings();
  if (saved?.theme === 'custom' && _is_custom) {
    requestAnimationFrame(() => _apply_custom_theme());
  }
})();
