/**
 * Dados do responsável pelo GBS usados nos Termos de Uso e na Política de
 * Privacidade. Preencha os campos marcados antes de vender o sistema e
 * revise os textos com um advogado.
 */
export const LEGAL = {
  /** Versão vigente — mude quando os textos mudarem (fica gravada no aceite). */
  version: "1.0",
  effectiveDate: "25/10/2026",
  productName: "GBS — Guerra Business System",
  companyName: "Grupo Guerra",
  /** Ex.: 00.000.000/0001-00 */
  cnpj: "",
  /** Endereço completo da sede. */
  address: "",
  /** E-mail para dúvidas, suporte e pedidos sobre dados pessoais. */
  contactEmail: "",
  /** Encarregado (DPO) pelo tratamento de dados — nome ou função. */
  dpoName: "",
  /** Comarca do foro. */
  forumCity: "Goiânia/GO",
};

export const LEGAL_PENDING = !LEGAL.cnpj || !LEGAL.address || !LEGAL.contactEmail;

export const legalContact = () =>
  LEGAL.contactEmail || "o canal de suporte informado na plataforma";
