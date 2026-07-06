// .eslintrc.agentic.cjs — reglas de logging
module.exports = {
  rules: {
    // Prohibir console.* para errores — usar agenticLogger.
    // Sin opción `allow`: el default ya prohíbe todo console.* y el schema
    // de ESLint 8 rechaza `allow: []` (minItems: 1).
    'no-console': 'warn',
    // Prohibir catch vacíos — todo error debe loggearse
    'no-empty': ['error', { allowEmptyCatch: false }],
  },
};
