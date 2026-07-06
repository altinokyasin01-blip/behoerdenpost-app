import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Minimal setup: only correctness rules that catch "used a name that was
// never imported/declared" and "imported/declared a name that's never used".
// No style/formatting rules on purpose — see project instructions.
const noUnusedVarsOptions = {
  args: "after-used",
  argsIgnorePattern: "^_",
  varsIgnorePattern: "^_",
  caughtErrors: "none",
  ignoreRestSiblings: true,
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      "frontend/dist/**",
      "frontend/public/**",
    ],
  },
  {
    // Not policing eslint-disable comment hygiene — out of scope here.
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  {
    // Frontend: browser + JSX (React, automatic runtime — no need to import React)
    files: ["frontend/src/**/*.{js,jsx}"],
    // react-hooks is registered only so pre-existing
    // `eslint-disable-next-line react-hooks/exhaustive-deps` comments resolve —
    // the rule itself is intentionally not enabled (out of scope here).
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: globals.browser,
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", noUnusedVarsOptions],
      // Core no-undef doesn't traverse JSX identifiers (eslint-scope doesn't
      // create references for them) — this is the rule that actually catches
      // "<SomeComponent /> used but never imported".
      "react/jsx-no-undef": "error",
      // Companion rule: without it, an import used only inside JSX would be
      // wrongly flagged as unused by no-unused-vars, for the same reason.
      "react/jsx-uses-vars": "error",
    },
  },
  {
    // Frontend build config (Vite) — Node/ESM, no browser or JSX globals
    files: ["frontend/vite.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", noUnusedVarsOptions],
    },
  },
  {
    // Backend: Node/CommonJS
    files: ["backend/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", noUnusedVarsOptions],
    },
  },
];
