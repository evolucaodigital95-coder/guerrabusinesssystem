import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { LEGAL, legalContact } from "@/lib/legal";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — GBS" },
      {
        name: "description",
        content: "Como o GBS trata dados pessoais, de acordo com a LGPD.",
      },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      intro={`Esta Política explica quais dados pessoais o ${LEGAL.productName} trata, para quê, com quem compartilha e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).`}
    >
      <section>
        <h2>1. Quem é responsável</h2>
        <p>Há dois papéis, e eles são diferentes:</p>
        <ul>
          <li>
            <b>Dados da sua conta</b> (seu nome, e-mail, acesso, assinatura): {LEGAL.companyName}
            {LEGAL.cnpj ? `, CNPJ ${LEGAL.cnpj},` : ""} é o <b>controlador</b>.
          </li>
          <li>
            <b>Dados que sua organização cadastra</b> (contratantes, contatos, agendistas,
            participantes): a sua organização é a <b>controladora</b> e o GBS atua como{" "}
            <b>operador</b>, tratando esses dados somente para prestar o serviço, conforme suas
            instruções.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Quais dados tratamos</h2>
        <ul>
          <li>
            Cadastro: nome, e-mail, telefone e dados da organização (razão social, CNPJ, cidade).
          </li>
          <li>
            Acesso: data e hora de login, registros de alterações (auditoria) e informações técnicas
            do navegador.
          </li>
          <li>Assinatura: plano, status e histórico de cobrança.</li>
          <li>
            Conteúdo da organização: palestras, empresas e contatos, lançamentos financeiros,
            estoque, comprovantes e documentos enviados.
          </li>
          <li>Login com Google: nome, e-mail e foto do perfil, quando você escolhe essa opção.</li>
        </ul>
      </section>

      <section>
        <h2>3. Para que usamos</h2>
        <ul>
          <li>Criar e manter sua conta e prestar o serviço contratado (execução de contrato).</li>
          <li>
            Garantir segurança, prevenir fraudes e manter trilha de auditoria (legítimo interesse).
          </li>
          <li>Emitir cobranças e cumprir obrigações fiscais e legais (obrigação legal).</li>
          <li>Enviar avisos sobre a conta, a assinatura e mudanças relevantes no serviço.</li>
        </ul>
        <p>Não vendemos dados pessoais e não os usamos para publicidade de terceiros.</p>
      </section>

      <section>
        <h2>4. Com quem compartilhamos</h2>
        <p>Somente com fornecedores necessários para o GBS funcionar, sob contrato e sigilo:</p>
        <ul>
          <li>infraestrutura de banco de dados, autenticação e armazenamento de arquivos;</li>
          <li>hospedagem do site;</li>
          <li>Google, quando você usa o login com Google;</li>
          <li>meio de pagamento, quando houver cobrança da assinatura.</li>
        </ul>
        <p>
          Alguns desses fornecedores podem armazenar dados fora do Brasil, com as garantias
          previstas na LGPD. Também podemos compartilhar dados por ordem judicial ou exigência
          legal.
        </p>
      </section>

      <section>
        <h2>5. Por quanto tempo guardamos</h2>
        <p>
          Enquanto a conta estiver ativa. Após o encerramento, os dados podem ser excluídos a
          pedido, exceto o que precisarmos manter para cumprir obrigações legais (como registros
          fiscais e de acesso), pelo prazo exigido em lei.
        </p>
      </section>

      <section>
        <h2>6. Segurança</h2>
        <p>
          Os dados trafegam com criptografia (HTTPS). Cada organização só enxerga os próprios dados,
          por regras de isolamento aplicadas no banco. Alterações importantes ficam registradas em
          auditoria. Nenhum sistema é 100% imune a incidentes; se ocorrer um incidente relevante,
          avisaremos os afetados e a ANPD, conforme a lei.
        </p>
      </section>

      <section>
        <h2>7. Armazenamento no navegador</h2>
        <p>
          Usamos o armazenamento local do navegador apenas para funcionar e lembrar suas
          preferências (sessão de login, tema claro/escuro, rascunhos de inventário e preços da
          venda no evento). Não usamos cookies de publicidade.
        </p>
      </section>

      <section>
        <h2>8. Seus direitos</h2>
        <p>Pela LGPD, você pode a qualquer momento:</p>
        <ul>
          <li>confirmar se tratamos seus dados e acessá-los;</li>
          <li>corrigir dados incompletos ou desatualizados;</li>
          <li>pedir anonimização, bloqueio ou eliminação de dados desnecessários;</li>
          <li>pedir a portabilidade e informações sobre compartilhamento;</li>
          <li>revogar consentimentos, quando essa for a base do tratamento.</li>
        </ul>
        <p>
          Se você é contato, agendista ou participante cadastrado por uma organização cliente, faça
          o pedido diretamente a ela; ajudaremos a atendê-lo.
        </p>
      </section>

      <section>
        <h2>9. Contato do encarregado</h2>
        <p>
          Pedidos e dúvidas sobre dados pessoais: {legalContact()}
          {LEGAL.dpoName ? ` (encarregado: ${LEGAL.dpoName})` : ""}. Você também pode contatar a
          Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </section>

      <section>
        <h2>10. Mudanças</h2>
        <p>
          Esta Política pode ser atualizada. A versão vigente fica sempre nesta página, com a data
          no topo, e mudanças relevantes serão avisadas.
        </p>
      </section>
    </LegalPage>
  );
}
