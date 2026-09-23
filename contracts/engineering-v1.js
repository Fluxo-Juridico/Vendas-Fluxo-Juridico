export const ENGINEERING_STANDARD_VERSION="engineering-v1";

export const REQUIRED_ENGINEERING_SCRIPTS=Object.freeze([
  "test",
  "check",
  "lint",
  "format",
  "format:check",
  "check:static",
  "verify",
  "build",
  "predeploy"
]);

export const REPOSITORY_BOUNDARIES=Object.freeze({
  sales:Object.freeze({
    repository:"Vendas-Fluxo-Juridico",
    owns:Object.freeze(["landing","checkout","payment-webhook","billing-contracts","commercial-crm"])
  }),
  app:Object.freeze({
    repository:"Fluxo-Juridico",
    owns:Object.freeze(["auth","organizations","legal-operation","documents","storage","database-schema"])
  }),
  admin:Object.freeze({
    repository:"Administrativo-Fluxo-Juridico",
    owns:Object.freeze(["platform-administration","customer-access","billing-observability"])
  })
});

export const SHARED_CONTRACT_PACKAGE="@fluxo-juridico/contracts";
