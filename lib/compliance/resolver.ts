/**
 * Requirements resolver. Given what/where/where-to, returns the exact documents
 * a shipment needs, each with its issuer, plain explanation, and source. Pure —
 * document types are injected so this stays Node-testable.
 */
import type {
  DocContext,
  DocumentType,
  RequiredDocument,
  RequirementResult,
} from "./types";

export function resolveRequirements(
  ctx: DocContext,
  documentTypes: DocumentType[],
): RequirementResult {
  const documents: RequiredDocument[] = documentTypes
    .filter((d) => d.applies(ctx))
    .map((d) => ({
      documentTypeId: d.id,
      name: d.name,
      issuer: d.issuer,
      what: d.what,
      why: d.why,
      howToObtain: d.howToObtain,
      source: d.source,
      actionHref: d.actionHref,
      status: "not_started",
    }));

  return {
    context: {
      productId: ctx.product.id,
      originCountry: ctx.originCountry,
      destination: ctx.destination,
      organicClaim: ctx.organicClaim,
    },
    documents,
    summary: {
      total: documents.length,
      selfServe: documents.filter((d) => d.issuer !== "authority").length,
      authority: documents.filter((d) => d.issuer === "authority").length,
    },
  };
}
