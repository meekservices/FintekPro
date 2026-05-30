import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    files: ["server/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // ── Logging ────────────────────────────────────────────────────────────
      // Disallow bare console.* in production; warn in dev (use server/logger.ts instead)
      "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",

      // ── Type safety ────────────────────────────────────────────────────────
      // Warn on `: any` — prevents NEW type safety regressions without blocking CI
      // on the existing 6,192 legacy violations (upgrade to "error" progressively).
      "@typescript-eslint/no-explicit-any": "warn",

      // Flag unused variables (errors masked by : any are a common source of bugs)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // ── Correctness ────────────────────────────────────────────────────────
      // Require === instead of == (critical on a financial platform)
      "eqeqeq": ["error", "always", { null: "ignore" }],
    },
  },

  // ── Test files — relax strict rules ──────────────────────────────────────
  {
    files: ["tests/**/*.ts", "*.spec.ts", "*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
];
