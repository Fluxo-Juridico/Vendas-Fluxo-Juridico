const browserGlobals={
  window:"readonly",document:"readonly",location:"readonly",history:"readonly",
  sessionStorage:"readonly",localStorage:"readonly",fetch:"readonly",FormData:"readonly",
  URL:"readonly",URLSearchParams:"readonly",Intl:"readonly",IntersectionObserver:"readonly",
  requestAnimationFrame:"readonly",cancelAnimationFrame:"readonly",addEventListener:"readonly",
  scrollY:"readonly",setTimeout:"readonly",clearTimeout:"readonly",console:"readonly"
};

const nodeGlobals={
  process:"readonly",Buffer:"readonly",console:"readonly",crypto:"readonly",fetch:"readonly",
  URL:"readonly",URLSearchParams:"readonly",TextEncoder:"readonly",TextDecoder:"readonly",
  AbortController:"readonly",AbortSignal:"readonly",setTimeout:"readonly",clearTimeout:"readonly",
  setInterval:"readonly",clearInterval:"readonly",structuredClone:"readonly"
};

const safetyRules={
  "constructor-super":"error",
  "for-direction":"error",
  "getter-return":"error",
  "no-async-promise-executor":"error",
  "no-class-assign":"error",
  "no-compare-neg-zero":"error",
  "no-constant-binary-expression":"error",
  "no-dupe-args":"error",
  "no-dupe-class-members":"error",
  "no-dupe-else-if":"error",
  "no-dupe-keys":"error",
  "no-func-assign":"error",
  "no-import-assign":"error",
  "no-new-native-nonconstructor":"error",
  "no-obj-calls":"error",
  "no-self-assign":"error",
  "no-setter-return":"error",
  "no-sparse-arrays":"error",
  "no-unreachable":"error",
  "no-unreachable-loop":"error",
  "no-unsafe-finally":"error",
  "no-unsafe-negation":"error",
  "use-isnan":"error",
  "valid-typeof":"error"
};

export default [
  {
    ignores:["api/**","public/**","node_modules/**"]
  },
  {
    files:["contracts/**/*.js","server/**/*.js","scripts/**/*.mjs","tests/**/*.mjs","eslint.config.js"],
    languageOptions:{ecmaVersion:"latest",sourceType:"module",globals:nodeGlobals},
    rules:{...safetyRules,"no-undef":"error"}
  },
  {
    files:["site.js"],
    languageOptions:{ecmaVersion:"latest",sourceType:"script",globals:browserGlobals},
    rules:{...safetyRules,"no-undef":"error"}
  }
];
