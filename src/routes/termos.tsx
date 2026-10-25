import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { LEGAL, legalContact } from "@/lib/legal";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — GBS" },
      { name: "description", content: "Termos de Uso do GBS — Guerra Business System." },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      intro={`Estes Termos regulam o uso do ${LEGAL.productName}, plataforma online de gestão de palestras, finanças, estoque e relacionamento oferecida por ${LEGAL.companyName}. Ao criar uma conta ou usar o sistema, você concorda com eles.`}
    >
      <section>
        <h2>1. O que é o GBS</h2>
        <p>
          O GBS é um software como serviço (SaaS) acessado pela internet. Ele organiza agenda,
          palestras, clientes, agendistas, lançamentos financeiros, estoque, documentos e relatórios
          da sua organização. O GBS é uma ferramenta de gestão: ele não presta serviços contábeis,
          jurídicos ou financeiros, e as decisões tomadas com base nas informações do sistema são de
          responsabilidade de quem o utiliza.
        </p>
      </section>

      <section>
        <h2>2. Conta e acesso</h2>
        <ul>
          <li>
            Para usar o GBS é preciso criar uma conta com dados verdadeiros e mantê-los atualizados.
          </li>
          <li>
            Você é responsável por manter sua senha em sigilo e por tudo o que for feito com seu
            acesso.
          </li>
          <li>
            O titular da organização define quem acessa a conta e com qual papel (por exemplo,
            administrador ou membro), e responde pelos usuários que convidar.
          </li>
          <li>
            Avise imediatamente pelo contato abaixo se suspeitar de uso indevido da sua conta.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Planos, teste e pagamento</h2>
        <ul>
          <li>
            O GBS é oferecido em planos com recursos e limites descritos na página de planos. Pode
            haver um período de teste gratuito, informado no momento do cadastro.
          </li>
          <li>
            Os valores, a periodicidade (mensal ou anual) e a forma de cobrança são os vigentes no
            momento da contratação. Reajustes serão comunicados com antecedência.
          </li>
          <li>
            Em caso de falta de pagamento, o acesso pode ser limitado até a regularização. Seus
            dados continuam guardados e podem ser consultados e exportados.
          </li>
          <li>
            Você pode cancelar a assinatura quando quiser; o acesso segue até o fim do período já
            pago, sem novas cobranças.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Seus dados são seus</h2>
        <p>
          Todo o conteúdo que você cadastra (clientes, palestras, lançamentos, estoque, arquivos)
          pertence à sua organização. Nós o tratamos apenas para prestar o serviço, conforme a{" "}
          <Link to="/privacidade" className="text-clay underline-offset-4 hover:underline">
            Política de Privacidade
          </Link>
          . Você pode exportar relatórios e planilhas a qualquer momento e, ao encerrar a conta,
          pedir a exclusão dos dados, respeitados os prazos legais de guarda.
        </p>
        <p>
          Quando você cadastra dados de outras pessoas (contratantes, agendistas, participantes),
          sua organização é a responsável por ter uma base legal para isso e por informar essas
          pessoas, nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
        </p>
      </section>

      <section>
        <h2>5. Uso permitido</h2>
        <p>Não é permitido usar o GBS para:</p>
        <ul>
          <li>atividades ilegais, fraudulentas ou que violem direitos de terceiros;</li>
          <li>
            tentar acessar dados de outras organizações ou burlar limites e controles de segurança;
          </li>
          <li>copiar, revender ou fazer engenharia reversa da plataforma;</li>
          <li>enviar arquivos com vírus ou conteúdo ofensivo.</li>
        </ul>
        <p>O descumprimento pode levar à suspensão da conta, com aviso sempre que possível.</p>
      </section>

      <section>
        <h2>6. Disponibilidade e suporte</h2>
        <p>
          Trabalhamos para manter o GBS disponível e seguro, com cópias de segurança feitas pelo
          provedor de infraestrutura. Podem ocorrer interrupções para manutenção ou por falhas de
          terceiros (internet, hospedagem); nesses casos agiremos para restabelecer o serviço o
          quanto antes. O suporte é prestado por {legalContact()}.
        </p>
      </section>

      <section>
        <h2>7. Responsabilidade</h2>
        <p>
          O GBS calcula comissões, saldos, estoques e relatórios a partir dos dados informados pelos
          usuários. Recomendamos conferir os valores antes de efetuar pagamentos ou emitir
          documentos. Na máxima extensão permitida pela lei, nossa responsabilidade por danos
          decorrentes do uso do sistema fica limitada ao valor pago pela organização nos 12 meses
          anteriores ao fato.
        </p>
      </section>

      <section>
        <h2>8. Propriedade intelectual</h2>
        <p>
          A marca, o software, o layout e a documentação do GBS pertencem a {LEGAL.companyName}. A
          assinatura dá direito de uso enquanto estiver ativa, sem transferência de propriedade.
        </p>
      </section>

      <section>
        <h2>9. Mudanças nestes Termos</h2>
        <p>
          Podemos atualizar estes Termos. Mudanças relevantes serão avisadas dentro do sistema ou
          por e-mail antes de entrar em vigor. Continuar usando o GBS depois disso significa
          concordar com a nova versão.
        </p>
      </section>

      <section>
        <h2>10. Contato e foro</h2>
        <p>
          Dúvidas: {legalContact()}.{LEGAL.address ? ` Endereço: ${LEGAL.address}.` : ""} Fica
          eleito o foro da comarca de {LEGAL.forumCity} para resolver questões relacionadas a estes
          Termos, sem prejuízo dos direitos do consumidor previstos em lei.
        </p>
      </section>
    </LegalPage>
  );
}
