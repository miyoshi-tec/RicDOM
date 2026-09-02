// uiMdPre (設計書 §3.4、Phase 3a、v1 ui_md_pre の記法網羅移植)

import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetHljsWarningForTest } from '../../src/ui/internal/hljs.js';
import { uiMdPre } from '../../src/ui/mdPre.js';

interface Node {
  tag: string;
  class?: string;
  href?: string;
  src?: string;
  alt?: string;
  start?: number;
  children: (string | Node)[];
  [key: string]: unknown;
}

const render = (md: string, extra: Record<string, unknown> = {}): Node =>
  uiMdPre({ children: [md], ...extra }) as unknown as Node;

afterEach(() => {
  _resetHljsWarningForTest();
  delete (window as unknown as { hljs?: unknown }).hljs;
});

describe('uiMdPre: 基本構造', () => {
  it('data-ricdom-role="md-pre" が付いた div にブロックが並ぶ', () => {
    const node = render('text');
    expect(node.tag).toBe('div');
    expect(node.class).toBe('ric-md-pre');
    expect(node['data-ricdom-role']).toBe('md-pre');
  });

  it('children (複数文字列) は改行で連結してからパースされる', () => {
    const custom = uiMdPre({ children: ['# a', 'b'] }) as unknown as Node;
    expect(custom.children.length).toBe(2); // 見出し行 + 段落行 (改行で連結された結果)
    expect((custom.children[0] as Node).tag).toBe('h1');
    expect((custom.children[1] as Node).tag).toBe('p');
  });
});

describe('uiMdPre: 見出し', () => {
  it('# 〜 ###### が h1〜h6 になる', () => {
    for (let level = 1; level <= 6; level++) {
      const node = render('#'.repeat(level) + ' Title');
      const h = node.children[0] as Node;
      expect(h.tag).toBe(`h${level}`);
    }
  });

  it('h4〜h6 は h3 と同じクラスに統一される', () => {
    const node = render('###### deep');
    expect((node.children[0] as Node).class).toBe('ric-md-pre__h3');
  });
});

describe('uiMdPre: インライン記法', () => {
  it('**太字** は strong になる', () => {
    const node = render('**bold**');
    const p = node.children[0] as Node;
    expect((p.children[0] as Node).tag).toBe('strong');
  });

  it('*斜体* は em になる', () => {
    const node = render('*italic*');
    const p = node.children[0] as Node;
    expect((p.children[0] as Node).tag).toBe('em');
  });

  it('`code` はインラインコードになる', () => {
    const node = render('`x`');
    const p = node.children[0] as Node;
    const code = p.children[0] as Node;
    expect(code.tag).toBe('code');
    expect(code.class).toBe('ric-md-pre__code');
    expect(code.children).toEqual(['x']);
  });
});

describe('uiMdPre: リンク・href ガード', () => {
  it('[text](url) は安全な href を持つリンクになる', () => {
    const node = render('[click](https://example.com)');
    const p = node.children[0] as Node;
    const a = p.children[0] as Node;
    expect(a.tag).toBe('a');
    expect(a.href).toBe('https://example.com');
    expect(a.target).toBe('_blank');
    expect(a.rel).toBe('noopener');
  });

  it.each(['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'vbscript:msgbox(1)'])(
    '危険スキーム %s は href を出力しない',
    (scheme) => {
      const node = render(`[click](${scheme})`);
      const p = node.children[0] as Node;
      const a = p.children[0] as Node;
      expect(a.tag).toBe('a');
      expect('href' in a).toBe(false);
    },
  );

  it('制御文字を混入させた危険スキームもブロックする', () => {
    const node = render('[click](java\tscript:alert(1))');
    const p = node.children[0] as Node;
    const a = p.children[0] as Node;
    expect('href' in a).toBe(false);
  });
});

describe('uiMdPre: 画像', () => {
  it('![alt](src) は img になる', () => {
    const node = render('![猫](cat.png)');
    const p = node.children[0] as Node;
    const img = p.children[0] as Node;
    expect(img.tag).toBe('img');
    expect(img.src).toBe('cat.png');
    expect(img.alt).toBe('猫');
  });

  it('transformImageSrc で src を差し替えられる', () => {
    const node = render('![猫](cat.png)', { transformImageSrc: (src: string) => `app://assets/${src}` });
    const img = (node.children[0] as Node).children[0] as Node;
    expect(img.src).toBe('app://assets/cat.png');
  });

  it('transformImageSrc が string 以外を返すと元の src のまま (NOOP)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const node = render('![猫](cat.png)', { transformImageSrc: () => 123 as unknown as string });
    const img = (node.children[0] as Node).children[0] as Node;
    expect(img.src).toBe('cat.png');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('transformImageSrc が例外を投げても元の src のまま (throw しない)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const node = render('![猫](cat.png)', {
      transformImageSrc: () => {
        throw new Error('boom');
      },
    });
    const img = (node.children[0] as Node).children[0] as Node;
    expect(img.src).toBe('cat.png');
    errorSpy.mockRestore();
  });
});

describe('uiMdPre: transformText', () => {
  it('プロセ (通常テキスト) に適用され、戻り値の配列で置換される', () => {
    const node = render('see ast_123 now', {
      transformText: (str: string) => str.split(/(ast_[a-z0-9]+)/).map((part) => (part.startsWith('ast_') ? ({ tag: 'a', href: `/x/${part}`, children: [part] } as Node) : part)),
    });
    const p = node.children[0] as Node;
    expect(p.children.some((c) => typeof c === 'object' && (c as Node).tag === 'a')).toBe(true);
  });

  it('インラインコード (`code`) には適用されない', () => {
    const transformText = vi.fn((str: string) => str.toUpperCase());
    const node = render('`raw` text', { transformText });
    const p = node.children[0] as Node;
    const code = p.children[0] as Node;
    expect(code.children).toEqual(['raw']); // 大文字化されていない
  });

  it('フェンスコードブロックの中身には適用されない', () => {
    const transformText = vi.fn((str: string) => str.toUpperCase());
    const node = render('```\nraw code\n```', { transformText });
    const pre = node.children[0] as Node;
    const code = pre.children[0] as Node;
    expect(code.children).toEqual(['raw code']);
  });

  it('例外を投げた場合は console.error + 元のテキストのまま (NOOP)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const node = render('plain text', {
      transformText: () => {
        throw new Error('boom');
      },
    });
    const p = node.children[0] as Node;
    expect(p.children).toEqual(['plain text']);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('戻り値の vnode に対して再帰適用されない (1 パスのみ)', () => {
    let calls = 0;
    const node = render('X', {
      transformText: (str: string) => {
        calls++;
        return [{ tag: 'span', children: [str] } as Node];
      },
    });
    void node;
    expect(calls).toBe(1);
  });
});

describe('uiMdPre: リスト', () => {
  it('- item は ul/li になる', () => {
    const node = render('- a\n- b');
    const ul = node.children[0] as Node;
    expect(ul.tag).toBe('ul');
    expect(ul.children.length).toBe(2);
  });

  it('1. item は ol/li になり、start 属性が無指定なら付かない (1 始まり)', () => {
    const node = render('1. a\n2. b');
    const ol = node.children[0] as Node;
    expect(ol.tag).toBe('ol');
    expect('start' in ol).toBe(false);
  });

  it('3. から始まると start=3 になる (v0.4.1〜)', () => {
    const node = render('3. a\n4. b');
    const ol = node.children[0] as Node;
    expect(ol.start).toBe(3);
  });
});

describe('uiMdPre: 引用・水平線・テーブル', () => {
  it('> quote は blockquote になり、中身が再帰パースされる', () => {
    const node = render('> hello');
    const bq = node.children[0] as Node;
    expect(bq.tag).toBe('blockquote');
    expect(bq.class).toBe('ric-md-pre__quote');
  });

  it('--- は hr になる', () => {
    const node = render('---');
    expect((node.children[0] as Node).tag).toBe('hr');
  });

  it('テーブルはヘッダ+区切り+本体を thead/tbody に変換する', () => {
    const node = render('| a | b |\n|---|---|\n| 1 | 2 |');
    const table = node.children[0] as Node;
    expect(table.tag).toBe('table');
    const [thead, tbody] = table.children as [Node, Node];
    expect(thead.tag).toBe('thead');
    expect(tbody.tag).toBe('tbody');
    expect(tbody.children.length).toBe(1);
  });

  it('アライメント記法 (:---:/---:) が style.textAlign に反映される', () => {
    const node = render('| a | b | c |\n|:---:|---:|---|\n| 1 | 2 | 3 |');
    const table = node.children[0] as Node;
    const thead = table.children[0] as Node;
    const tr = thead.children[0] as Node;
    const ths = tr.children as [Node, Node, Node];
    expect((ths[0] as unknown as { style?: { textAlign?: string } }).style?.textAlign).toBe('center');
    expect((ths[1] as unknown as { style?: { textAlign?: string } }).style?.textAlign).toBe('right');
    expect('style' in ths[2]).toBe(false); // left は既定なので style 無し
  });
});

describe('uiMdPre: フェンスコードブロック', () => {
  it('``` と ~~~ の両方に対応する', () => {
    const backtick = render('```\ncode1\n```');
    const tilde = render('~~~\ncode2\n~~~');
    expect((backtick.children[0] as Node).tag).toBe('pre');
    expect((tilde.children[0] as Node).tag).toBe('pre');
  });

  it('lang 指定かつ hljs 未読込なら console.warn (初回のみ) してプレーン表示になる', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const node = render('```js\nconst x = 1;\n```');
    const pre = node.children[0] as Node;
    const code = pre.children[0] as Node;
    expect(code.children).toEqual(['const x = 1;']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    // 2 回目は warn しない (1 回だけ)
    render('```js\nmore\n```');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('hljs があればハイライトされた HTML を innerHTML として使う', () => {
    (window as unknown as { hljs: unknown }).hljs = {
      highlight: (raw: string) => ({ value: `<span>${raw}</span>` }),
    };
    const node = render('```js\nx\n```');
    const pre = node.children[0] as Node;
    const code = pre.children[0] as unknown as { class: string; innerHTML: string };
    expect(code.class).toBe('hljs');
    expect(code.innerHTML).toBe('<span>x</span>');
  });

  it('lang 未指定ならプレーンテキストになる (hljs を呼ばない)', () => {
    const node = render('```\nno lang\n```');
    const pre = node.children[0] as Node;
    const code = pre.children[0] as Node;
    expect(code.children).toEqual(['no lang']);
  });
});

describe('uiMdPre: 段落・空行・無限ループ対策', () => {
  it('空行で段落が区切られる', () => {
    const node = render('a\n\nb');
    expect(node.children.length).toBe(2);
    expect((node.children[0] as Node).tag).toBe('p');
    expect((node.children[1] as Node).tag).toBe('p');
  });

  it('大きめの複合 Markdown でも無限ループせず完了する (セーフティネット込み)', () => {
    const md = ['# h1', '', 'para one', '- item', '1. ol', '> quote', '```', 'code', '```', '---', '| a |', '|---|', '| 1 |'].join('\n');
    expect(() => render(md)).not.toThrow();
  });
});
