'use strict';

// VDOM ツリー走査ヘルパー（テスト専用）
//
// RicDOM の VDOM は JSON オブジェクトなので、ツリーを辿って
// 特定の tag / class を持つノードを集める小さな関数が頻出する。
// 各テストファイルでコピペを避けるため一箇所に集約する。

const collect_nodes = (node, out = []) => {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const c of node) collect_nodes(c, out);
    return out;
  }
  out.push(node);
  if (Array.isArray(node.ctx)) {
    for (const c of node.ctx) collect_nodes(c, out);
  }
  return out;
};

// 完全一致のクラストークン検索（'ric-foo' が class に含まれるか）
const find_by_class = (root, cls) =>
  collect_nodes(root).filter(
    (n) => typeof n.class === 'string' && n.class.split(' ').includes(cls),
  );

// タグ名一致検索
const find_by_tag = (root, tag) =>
  collect_nodes(root).filter((n) => n.tag === tag);

module.exports = { collect_nodes, find_by_class, find_by_tag };
