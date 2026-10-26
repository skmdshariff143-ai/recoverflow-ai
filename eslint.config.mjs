import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: 'apps/web/' } },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["apps/**/*", "packages/**/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/packages/**", "**/agents/**"],
              message:
                "Do not use relative paths reaching into another package. Import via workspace package names (e.g. '@recoverflow/core', '@recoverflow/agents').",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "apps/**/.next/**",
    "**/node_modules/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    "test-results/**",
    "playwright-report/**"
  ]),
]);

export default eslintConfig;
