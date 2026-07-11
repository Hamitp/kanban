import eslint from "@eslint/js";
import hooks from "eslint-plugin-react-hooks";
import refresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "desktop-dist/**",
      "dist/**",
      ".vinext/**",
      ".wrangler/**",
      "release/**",
      "src-tauri/target/**",
      "src-tauri/gen/**",
      "node_modules/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.nodeBuiltin },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.nodeBuiltin },
    },
    plugins: {
      "react-hooks": hooks,
      "react-refresh": refresh,
    },
    rules: {
      ...hooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
