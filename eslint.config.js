// Security lint for the browser code. no-unsanitized blocks HTML built from values that are not escaped,
// so a crafted CSV or stored value can never be turned into script on the page.
import nounsanitized from "eslint-plugin-no-unsanitized";

export default [
  {
    files: ["static/**/*.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "script" },
    plugins: { "no-unsanitized": nounsanitized },
    rules: {
      "no-unsanitized/method": "error",
      "no-unsanitized/property": ["error", { escape: { taggedTemplates: ["html", "TK.html"], methods: ["esc", "TK.esc"] } }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
    },
  },
];
