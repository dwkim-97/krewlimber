export function environmentFile(environment: NodeJS.ProcessEnv): string {
  const phase = environment.PHASE ?? (environment.NODE_ENV === 'production' ? 'production' : 'local');
  return `deploy/.env.${phase}`;
}
