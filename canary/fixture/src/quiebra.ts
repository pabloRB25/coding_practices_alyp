export function quiebra(): void {
  console.log('console desnudo — el lint agentic debe marcarme');
  try {
    JSON.parse('{roto');
  } catch {}
}
