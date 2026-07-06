// .eslintrc.agentic.cjs — reglas de logging
module.exports = {
  rules: {
    // Prohibir console.* para errores — usar agenticLogger
    'no-console': ['warn', { allow: [] }],
    // Prohibir catch vacíos — todo error debe loggearse
    'no-empty': ['error', { allowEmptyCatch: false }],
  },
};
