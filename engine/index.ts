// Публичный вход движка. Только чистый TypeScript, без UI и браузера.
export * from "./types.ts";
export * from "./ontology/index.ts";
export * from "./inference/types.ts";
export * from "./inference/model.ts";
export * from "./inference/search.ts";
export * from "./inference/session.ts";
export * from "./inference/items.ts";
export { logPrior, logLik, questionTruth } from "./inference/likelihood.ts";
export * from "./questions/index.ts";
export * from "./learning/index.ts";
export * from "./nlg/index.ts";
export * from "./compose/index.ts";
export * from "./flow/index.ts";
export * as ruMorph from "./ru-morph/index.ts";
export * as kkMorph from "./kk-morph/index.ts";
