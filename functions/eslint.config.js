import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  // This provides the default recommended rules
  pluginJs.configs.recommended,

  // This is the custom configuration for your project
  {
    languageOptions: {
      globals: {
        ...globals.node,    // Enables Node.js global variables
        ...globals.es2021,
      },
      ecmaVersion: 2021,
      sourceType: "module",
    },
    rules: {
      "indent": ["error", 2],
      "quotes": ["error", "double"],
      "max-len": ["error", { "code": 120 }],
      "object-curly-spacing": ["error", "always"],
      // Disabling rules that are often not needed for Cloud Functions
      "require-jsdoc": "off",
      "valid-jsdoc": "off",
    },
  }
];