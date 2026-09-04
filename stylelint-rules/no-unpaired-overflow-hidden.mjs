// stylelint-rules/no-unpaired-overflow-hidden.mjs
//
// Encodes hub ADR-0041 §4's *positive* definition: the rule governs boxes
// that establish a scrolling context a focus event could shift — a
// container whose content can exceed it and whose descendants can take
// focus or be a `scrollIntoView()` target. `overflow: hidden` there must be
// paired with a following `overflow: clip` (the fallback-then-override
// technique the ADR shows), because `clip` — unlike `hidden` — creates no
// scroll container, so focus/`scrollIntoView()` cannot shift the box.
//
// This is deliberately NOT an enumerated exemption list — ADR-0041 §4 was
// restated positively on 2026-09-04 specifically so this rule would not
// need one; a list grew once within two days of being written, and every
// growth invalidates a lint rule built from it. Instead, a declaration
// block is read for what it *is*: if it carries the declarations that
// reveal one of the shapes ADR-0041 §4 names as outside the rule's
// purpose — a single-line ellipsis truncation, or the visually-hidden-but-
// announced technique — `overflow: hidden` there is not scoped by the
// rule at all and needs no pairing:
//
//   - `text-overflow` and/or `white-space: nowrap` on the same box
//     (`%truncating-flex-child`, `_layout.scss`) — no focusable content, no
//     `scrollIntoView()` target, a few pixels of elided text as its entire
//     scrollable overflow.
//   - `clip-path` on the same box (`%sr-only`, `_primitives.scss`, and its
//     hand-duplicate `guest-manager.scss`'s `.partner-account-note`) —
//     `overflow: hidden` is load-bearing for the visually-hidden technique
//     itself, not for clipping layout overflow.
//
// A third shape the two bullets above cannot express is a hub question
// (ADR-0041 §4: "widen the positive definition … never append a third
// bullet") — this rule does not grow a third exemption locally.
//
// Scope: only `overflow` / `overflow-x` / `overflow-y` set to exactly
// `hidden`, read against the *other declarations in the same block* —
// never against the selector, the file, or a comment. A rule that can only
// reach the two shapes above through per-site ignore comments has not
// encoded §4 and must not ship (T342's own words).

import stylelint from 'stylelint';

const { createPlugin, utils } = stylelint;

const ruleName = 'wedding/no-unpaired-overflow-hidden';

const messages = utils.ruleMessages(ruleName, {
  rejected: (prop) =>
    `Unpaired "${prop}: hidden" establishes a scroll container a focus event ` +
    `or scrollIntoView() can shift (hub ADR-0041 §4). Pair it with a ` +
    `following "${prop}: clip", or — if this box truncates single-line text ` +
    `or is the visually-hidden-but-announced technique — carry the sibling ` +
    `declaration that says so (text-overflow / white-space: nowrap, or ` +
    `clip-path) so the rule can see it.`,
});

const OVERFLOW_PROP = /^overflow(-x|-y)?$/i;

/**
 * @param {import('postcss').Declaration} decl
 * @returns {import('postcss').Container | undefined}
 */
function siblingDecls(decl) {
  const parent = decl.parent;
  if (!parent) return [];
  return parent.nodes.filter((n) => n.type === 'decl');
}

const ruleFunction = (primary) => {
  return (root, result) => {
    const validOptions = utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true],
    });
    if (!validOptions) return;

    root.walkDecls((decl) => {
      if (!OVERFLOW_PROP.test(decl.prop)) return;
      if (decl.value.trim().toLowerCase() !== 'hidden') return;

      const siblings = siblingDecls(decl);

      const pairedWithClip = siblings.some(
        (sib) =>
          sib !== decl &&
          sib.prop.toLowerCase() === decl.prop.toLowerCase() &&
          sib.value.trim().toLowerCase() === 'clip',
      );
      if (pairedWithClip) return;

      const isTruncatingText = siblings.some(
        (sib) =>
          sib.prop.toLowerCase() === 'text-overflow' ||
          (sib.prop.toLowerCase() === 'white-space' &&
            /nowrap/i.test(sib.value)),
      );
      if (isTruncatingText) return;

      const isVisuallyHidden = siblings.some(
        (sib) => sib.prop.toLowerCase() === 'clip-path',
      );
      if (isVisuallyHidden) return;

      utils.report({
        message: messages.rejected(decl.prop),
        node: decl,
        result,
        ruleName,
      });
    });
  };
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;

export default createPlugin(ruleName, ruleFunction);
