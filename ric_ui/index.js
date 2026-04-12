// RicUI — 公開 API まとめ
// 各カテゴリのコンポーネントを一括 re-export する。
// この module.exports が RicUI.min.js バンドルの唯一の source of truth。
// src/ricui_globals.js は require('../ric_ui') をそのまま window.RicUI に割り当てる。
//
// 公開カテゴリ：
//   layout    : create_ui_page / ui_col / ui_row
//   surface   : ui_panel / create_ui_panel
//   control   : ui_button / ui_input / bind_input
//               ui_checkbox / bind_checkbox
//               ui_radiobutton / bind_radiobutton
//               ui_range / bind_range
//               ui_color / bind_color
//               ui_select / bind_select
//               ui_separator
//   text      : ui_text / ui_code_pre
//   popup     : create_ui_popup / create_ui_tooltip / create_ui_dialog / create_ui_toast
//   composite : create_ui_accordion / create_ui_splitter / ui_tabs / bind_tabs
//               create_ui_tweak_panel / ui_tweak_panel / ui_tweak_folder / ui_tweak_row
//               tweak_infer_type
//   theme util: create_theme / create_density / create_font_size
//               export_theme / export_settings

'use strict';

const { create_ui_page } = require('./layout/ui_page');
const { ui_col  } = require('./layout/ui_col');
const { ui_row  } = require('./layout/ui_row');

const { ui_panel, create_ui_panel } = require('./surface/ui_panel');

const { ui_button   } = require('./control/ui_button');
const { ui_input    } = require('./control/ui_input');
const { bind_input  } = require('./control/bind_input');
const { ui_checkbox  } = require('./control/ui_checkbox');
const { bind_checkbox } = require('./control/bind_checkbox');
const { ui_select        } = require('./control/ui_select');
const { bind_select      } = require('./control/bind_select');
const { ui_radiobutton   } = require('./control/ui_radiobutton');
const { bind_radiobutton } = require('./control/bind_radiobutton');
const { ui_range         } = require('./control/ui_range');
const { bind_range       } = require('./control/bind_range');
const { ui_color         } = require('./control/ui_color');
const { bind_color       } = require('./control/bind_color');
const { ui_separator     } = require('./control/ui_separator');

const { ui_text     } = require('./text/ui_text');
const { ui_code_pre } = require('./text/ui_code_pre');

const { create_ui_popup    } = require('./popup/create_ui_popup');
const { create_ui_tooltip  } = require('./popup/create_ui_tooltip');
const { create_ui_dialog   } = require('./popup/create_ui_dialog');
const { create_ui_toast    } = require('./popup/create_ui_toast');

const { create_ui_accordion } = require('./composite/create_ui_accordion');
const { create_ui_splitter  } = require('./composite/create_ui_splitter');
const { ui_tabs             } = require('./composite/ui_tabs');
const { bind_tabs           } = require('./composite/bind_tabs');
const { create_ui_tweak_panel, ui_tweak_panel, ui_tweak_folder, ui_tweak_row, infer_type: tweak_infer_type } = require('./composite/ui_tweak');

const { create_theme, create_density, create_font_size, export_theme, export_settings } = require('./context');

module.exports = {
  // テーマユーティリティ（上級者向け）
  create_theme,
  create_density,
  create_font_size,
  export_theme,
  export_settings,
  // layout
  create_ui_page,
  ui_col,
  ui_row,
  // surface
  ui_panel,
  create_ui_panel,
  // control
  ui_button,
  ui_input,
  bind_input,
  ui_checkbox,
  bind_checkbox,
  ui_radiobutton,
  bind_radiobutton,
  ui_range,
  bind_range,
  ui_color,
  bind_color,
  ui_separator,
  ui_select,
  bind_select,
  // text
  ui_text,
  ui_code_pre,
  // popup
  create_ui_popup,
  create_ui_tooltip,
  create_ui_dialog,
  create_ui_toast,
  // composite
  create_ui_accordion,
  create_ui_splitter,
  ui_tabs,
  bind_tabs,
  create_ui_tweak_panel,
  ui_tweak_panel,
  ui_tweak_folder,
  ui_tweak_row,
  tweak_infer_type,
};
