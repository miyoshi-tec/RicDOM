// ricdom/ui — 公開エントリポイント
// Phase 2: 部品契約 + portal + テーマ + CSS 配布
// Phase 3a: 状態を持たない部品 (control/layout/text) + bind*
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

// ── Phase 3a: 状態を持たない部品 (control) ──
export { uiTextarea } from './textarea.js';
export type { UiTextareaProps, UiTextareaAutoResize } from './textarea.js';

export { uiCheckbox } from './checkbox.js';
export type { UiCheckboxProps } from './checkbox.js';

export { uiRadiobutton } from './radiobutton.js';
export type { UiRadiobuttonProps, UiRadiobuttonOption } from './radiobutton.js';

export { uiSelect } from './select.js';
export type { UiSelectProps, UiSelectOption } from './select.js';

export { uiRange } from './range.js';
export type { UiRangeProps } from './range.js';

export { uiColor } from './color.js';
export type { UiColorProps } from './color.js';

export { uiSeparator } from './separator.js';
export type { UiSeparatorProps } from './separator.js';

export { uiText } from './text.js';
export type { UiTextProps, UiTextVariant } from './text.js';

export { uiIcon } from './icon.js';
export type { UiIconDescriptor, UiIconOptions } from './icon.js';

export { bindInput, bindTextarea, bindCheckbox, bindSelect, bindRange } from './bind.js';

// ── Phase 3a: レイアウト ──
export { uiCol } from './col.js';
export type { UiColProps } from './col.js';

export { uiRow } from './row.js';
export type { UiRowProps } from './row.js';

export { uiGrid } from './grid.js';
export type { UiGridProps } from './grid.js';

export { uiPanel } from './panel.js';
export type { UiPanelProps, UiPanelLayout } from './panel.js';

// ── Phase 3a: テキスト ──
export { uiMdPre } from './mdPre.js';
export type { UiMdPreProps, MdTransformText, MdTransformImageSrc } from './mdPre.js';

export { uiCodePre } from './codePre.js';
export type { UiCodePreProps } from './codePre.js';

export { createDialog } from './dialog.js';
export type { DialogProps, DialogInstance, DialogCloseReason } from './dialog.js';

export { createPopup } from './popup.js';
export type { PopupProps, PopupInstance, PopupPoint } from './popup.js';

export { createToast } from './toast.js';
export type { ToastInstance, ToastShowOptions, ToastType } from './toast.js';

export { createTooltip } from './tooltip.js';
export type { TooltipProps, TooltipInstance, TooltipDir } from './tooltip.js';

// ── Phase 3b: 状態を持つ部品 ──
export { createSplitter } from './splitter.js';
export type { SplitterProps, SplitterInstance, CreateSplitterOptions, SplitterSide } from './splitter.js';

export { createScrollPane } from './scrollPane.js';
export type { ScrollPaneProps, ScrollPaneInstance, CreateScrollPaneOptions, ScrollPaneFollow } from './scrollPane.js';

export { createCollapseBox } from './collapseBox.js';
export type { CollapseBoxProps, CollapseBoxInstance, CreateCollapseBoxOptions, CollapseBoxDirection } from './collapseBox.js';

export { createAccordion } from './accordion.js';
export type { AccordionProps, AccordionInstance, CreateAccordionOptions, AccordionItem } from './accordion.js';

export { createTabs } from './tabs.js';
export type { TabsProps, TabsInstance, TabItem, TabsVariant } from './tabs.js';

export { createDropdown } from './dropdown.js';
export type { DropdownProps, DropdownInstance } from './dropdown.js';

export { uiInlineMenu } from './inlineMenu.js';
export type { UiInlineMenuProps, UiInlineMenuAnchor } from './inlineMenu.js';

export type { Component, Host } from './internal/component.js';
