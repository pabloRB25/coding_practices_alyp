// eslint.config.js o .eslintrc.cjs
module.exports = {
  rules: {
    // No deep imports entre features — solo por barrel (index.ts)
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['*/features/*/!(index)'],
          message: 'Importar desde el barrel del módulo: "@/features/<dominio>" no desde archivos internos.',
        },
      ],
    }],

    // Logging (del agentic-logging standard)
    'no-console': ['warn', { allow: [] }],
    'no-empty':   ['error', { allowEmptyCatch: false }],

    // Calidad de código
    'prefer-const':     'error',
    'no-var':           'error',
    '@typescript-eslint/no-explicit-any':     'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
  },
};
