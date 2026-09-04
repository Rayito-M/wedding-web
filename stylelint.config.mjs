// stylelint.config.mjs
//
// Hub ADR-0041 §7: stylelint added because guidance alone already failed
// once (`_primitives.scss` has existed since T247 and 54 of 71 files
// ignore it). This is a second, separate tool from `ng lint` (Angular's
// ESLint builder) — see `scripts/stylelint-check.mjs` and the `lint`
// script in `package.json`; stylelint is never wired in as an ESLint
// plugin.
//
// Rules on purpose, nothing else: this is not a general style-quality
// config (no `stylelint-config-standard` etc.) — it exists to hold exactly
// the three rules ADR-0041 §7 names. `src/**/*.scss` is linted through
// `postcss-scss` (the only added dependency besides stylelint itself) so
// SCSS-only syntax (`@use`, `%placeholder`, `@mixin`, `#{}` interpolation)
// parses; the rules below are plain property/value/at-rule checks that
// work the same over that syntax.
export default {
  customSyntax: 'postcss-scss',
  plugins: ['./stylelint-rules/no-unpaired-overflow-hidden.mjs'],
  rules: {
    // No raw px for spacing/font-size — tokens only (ADR-0041 §6/§7).
    // Scoped to the box-model/spacing and font-size axes named in the
    // task; border-width and shadow/radius are a different axis and carry
    // their own tokens, not this scale.
    'declaration-property-value-disallowed-list': {
      '/^(margin|padding|gap|row-gap|column-gap|font-size|width|height|min-width|max-width|min-height|max-height|top|right|bottom|left|inset)(-(top|right|bottom|left|inline|inline-start|inline-end|block|block-start|block-end))?$/':
        [/(?:^|\s)-?\d*\.?\d+px(?:\s|$)/],
    },
    // No bare `@media (min-width: …)` — use `respond-to()` (ADR-0041 §6).
    // `_layout.scss` is the one legitimate definition site (`respond-to()`
    // itself) and is exempted below, by file, not by weakening the rule.
    'media-feature-name-disallowed-list': ['min-width'],
    // No unpaired `overflow: hidden` — the positive definition of
    // ADR-0041 §4, encoded in stylelint-rules/no-unpaired-overflow-hidden.mjs.
    'wedding/no-unpaired-overflow-hidden': true,
  },
  overrides: [
    {
      // The literals this file exists to define — the type scale, the
      // spacing scale, `$bp-md: 640px` etc. — and the one legitimate
      // `@media (min-width: …)` definition site (`respond-to()` itself).
      // A rule that flags its own token/breakpoint source is misconfigured
      // (T342's own words).
      files: ['src/styles/_layout.scss', 'src/styles/_tokens.scss'],
      rules: {
        'declaration-property-value-disallowed-list': null,
      },
    },
    {
      files: ['src/styles/_layout.scss'],
      rules: {
        'media-feature-name-disallowed-list': null,
      },
    },
  ],
};
