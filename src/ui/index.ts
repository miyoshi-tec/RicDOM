// ricdom/ui — 公開エントリポイント (Phase 2: 部品契約 + portal + テーマ + CSS 配布)
//
// IIFE ビルド (dist/ricdom-ui.iife.min.js) はここから globalName `ricdomUI` として
// まとめてグローバルに公開される (tsup.config.ts 参照)。`ricdom` (コア) の後に
// 読み込む想定 (型のみの参照であり、バンドル上の実行時依存は無い — 詳細は最終報告)。

export { applyTheme, createTheme, exportTheme } from './theme.js';
export type { ThemeName, DensityName, FontSizeName, ThemeVars, ApplyThemeOptions } from './theme.js';

export { buildStylesheet } from './cssTemplates.js';
export { injectStyles } from './injectStyles.js';

export { uiButton } from './button.js';
export type { UiButtonProps, UiButtonVariant } from './button.js';

export { uiInput } from './input.js';
export type { UiInputProps } from './input.js';

export { createDialog } from './dialog.js';
export type { DialogProps, DialogInstance, DialogCloseReason } from './dialog.js';

export { createPopup } from './popup.js';
export type { PopupProps, PopupInstance, PopupPoint } from './popup.js';

export { createToast } from './toast.js';
export type { ToastInstance, ToastShowOptions, ToastType } from './toast.js';

export { createTooltip } from './tooltip.js';
export type { TooltipProps, TooltipInstance, TooltipDir } from './tooltip.js';

export type { Component, Host } from './internal/component.js';
