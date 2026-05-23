import importPlugin from "eslint-plugin-import";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/**", "node_modules/**"]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module"
    },
    plugins: {
      import: importPlugin
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json"
        }
      }
    },
    rules: {
      "import/no-cycle": "error",
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/core/model",
              from: "./src/core/temporal"
            },
            {
              target: "./src/core/model",
              from: "./src/core/engraving"
            },
            {
              target: "./src/core/model",
              from: "./src/core/rendering"
            },
            {
              target: "./src/core/model",
              from: "./src/core/editor"
            },
            {
              target: "./src/core/model",
              from: "./src/core/playback"
            },
            {
              target: "./src/core/model",
              from: "./src/core/serialization"
            },
            {
              target: "./src/core/model",
              from: "./src/core/fonts"
            },
            {
              target: "./src/core/temporal",
              from: "./src/core/engraving"
            },
            {
              target: "./src/core/temporal",
              from: "./src/core/rendering"
            },
            {
              target: "./src/core/temporal",
              from: "./src/core/editor"
            },
            {
              target: "./src/core/temporal",
              from: "./src/core/playback"
            },
            {
              target: "./src/core/temporal",
              from: "./src/core/serialization"
            },
            {
              target: "./src/core/temporal",
              from: "./src/core/fonts"
            },
            {
              target: "./src/core/engraving",
              from: "./src/core/rendering"
            },
            {
              target: "./src/core/engraving",
              from: "./src/core/playback"
            },
            {
              target: "./src/core/engraving",
              from: "./src/core/serialization"
            },
            {
              target: "./src/core/engraving",
              from: "./src/core/fonts"
            },
            {
              target: "./src/core/rendering",
              from: "./src/core/editor"
            },
            {
              target: "./src/core/rendering",
              from: "./src/core/playback"
            },
            {
              target: "./src/core/rendering",
              from: "./src/core/serialization"
            },
            {
              target: "./src/core/rendering",
              from: "./src/core/fonts"
            },
            {
              target: "./src/core/editor",
              from: "./src/core/playback"
            },
            {
              target: "./src/core/editor",
              from: "./src/core/serialization"
            },
            {
              target: "./src/core/editor",
              from: "./src/core/fonts"
            },
            {
              target: "./src/core/playback",
              from: "./src/core/serialization"
            },
            {
              target: "./src/core/playback",
              from: "./src/core/fonts"
            },
            {
              target: "./src/core/serialization",
              from: "./src/core/fonts"
            }
          ]
        }
      ]
    }
  }
];
