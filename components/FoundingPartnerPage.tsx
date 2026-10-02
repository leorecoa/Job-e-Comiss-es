const COMMERCIAL_CONTACT_URL = `https://wa.me/5581989064910?text=${encodeURIComponent('Olá! Vi a apresentação do Job & Comissões e quero conhecer a proposta de Parceiro Fundador.')}`;

const capabilities = [
  ['Agenda', 'Visualize os atendimentos e acompanhe a operação do dia.'],
  ['Agendamento online', 'Seu cliente escolhe serviço, profissional e horário disponível pelo link da barbearia.'],
  ['Equipe', 'Organize os profissionais e convide cada um para acessar a própria agenda.'],
  ['Serviços', 'Centralize serviços, duração, valores e configuração de comissão.'],
  ['Comissões', 'Mantenha o cálculo de comissão ligado aos atendimentos concluídos.'],
  ['Financeiro', 'Acompanhe os registros financeiros gerados pela conclusão dos atendimentos.']
];
const bookingSteps = ['Recebe o link', 'Escolhe o serviço', 'Escolhe o profissional', 'Escolhe um horário', 'Confirma a reserva'];

export function FoundingPartnerPage() {
  return (
    <div className="partner-page">
      <a className="partner-skip" href="#conteudo">Ir para o conteúdo</a>
      <header className="partner-header partner-container">
        <a href="#inicio" className="partner-brand" aria-label="Job & Comissões, início">
          <img src="/brand-mark.svg" width="38" height="38" alt="" />
          <span>Job <span className="partner-amp">&</span> Comissões</span>
        </a>
        <nav aria-label="Apresentação comercial">
          <a href="#produto">Produto</a><a href="#como-funciona">Como funciona</a><a href="#parceria">A parceria</a>
        </nav>
      </header>
      <main id="conteudo">
        <section id="inicio" className="partner-hero partner-container" aria-labelledby="partner-title">
          <div>
            <p className="partner-eyebrow"><span className="partner-dot" /> Convite — Parceiro Fundador</p>
            <h1 id="partner-title">Menos confusão na agenda.<br /><em>Mais controle</em> da sua barbearia.</h1>
            <p className="partner-lead">O Job & Comissões reúne agendamentos, equipe, serviços e comissões em uma gestão simples para o dia a dia da barbearia.</p>
            <div className="partner-actions">
              <a className="partner-button" href={COMMERCIAL_CONTACT_URL} target="_blank" rel="noopener noreferrer">Quero conhecer <span aria-hidden="true">↗</span></a>
              <a className="partner-text-link" href="#como-funciona">Ver como funciona <span aria-hidden="true">↓</span></a>
            </div>
            <p className="partner-note">Uma primeira operação real. Com acompanhamento próximo.</p>
          </div>
          <figure className="partner-preview">
            <div className="partner-preview-heading"><span>JOB & COMISSÕES</span><span>Agenda</span></div>
            <div className="partner-preview-body">
              <p className="partner-eyebrow">Uma visão da operação</p>
              <h2>Cada horário, no seu lugar.</h2>
              <div className="partner-appointment"><time>09:00</time><div><strong>Corte</strong><span>Serviço e profissional definidos</span></div><span className="partner-status">Agendado</span></div>
              <div className="partner-appointment"><time>09:45</time><div><strong>Barba</strong><span>Horário reservado pelo link</span></div><span className="partner-status">Agendado</span></div>
              <div className="partner-completion"><span aria-hidden="true">✓</span><div><strong>Atendimento concluído</strong><p>Comissão calculada e registro financeiro gerado.</p></div></div>
            </div>
            <figcaption>Composição ilustrativa do produto. Horários de exemplo, sem dados reais.</figcaption>
          </figure>
        </section>

        <section className="partner-problem" aria-labelledby="problem-title">
          <div className="partner-container partner-split">
            <div><p className="partner-eyebrow">A rotina que você conhece</p><h2 id="problem-title">Controlar tudo de cabeça tem um limite.</h2></div>
            <div className="partner-problems">
              <article><h3>Horários espalhados</h3><p>Quem está marcado, com qual profissional e em qual horário?</p></article>
              <article><h3>Comissão manual</h3><p>Fechar o dia fazendo conta aumenta o trabalho e a chance de erro.</p></article>
              <article><h3>Cada horário, uma conversa</h3><p>Consultar disponibilidade por mensagem toma tempo de quem atende.</p></article>
              <article><h3>Informação em vários lugares</h3><p>Equipe, serviços e atendimentos ficam difíceis de acompanhar.</p></article>
            </div>
          </div>
        </section>

        <section id="produto" className="partner-container partner-section" aria-labelledby="product-title">
          <p className="partner-eyebrow">O produto</p><h2 id="product-title">Uma operação mais organizada.<br />Em um só lugar.</h2>
          <div className="partner-capabilities">{capabilities.map(([name, description], index) => (
            <article key={name}><span className="partner-number" aria-hidden="true">0{index + 1}</span><h3>{name}</h3><p>{description}</p></article>
          ))}</div>
        </section>

        <section id="como-funciona" className="partner-container partner-section partner-booking" aria-labelledby="booking-title">
          <div><p className="partner-eyebrow">Do link à agenda</p><h2 id="booking-title">Seu cliente escolhe.<br />Você acompanha.</h2><p>Uma reserva online entra na agenda da barbearia. Sem precisar reconstruir a conversa para encontrar o horário.</p></div>
          <ol>{bookingSteps.map((step, index) => <li key={step}><span aria-hidden="true">{index + 1}</span>{step}</li>)}</ol>
        </section>

        <section id="parceria" className="partner-partnership" aria-labelledby="partnership-title">
          <div className="partner-container partner-split">
            <div><p className="partner-eyebrow">Parceiro Fundador</p><h2 id="partnership-title">Estamos selecionando as primeiras barbearias parceiras.</h2><p>Você cuida da barbearia. O Job & Comissões ajuda a organizar a operação.</p><p>O Parceiro Fundador utiliza o produto em uma operação real e participa diretamente desta fase.</p></div>
            <div><h3>Construir essa fase de perto</h3><ul>
              <li>Acompanhamento próximo na implantação</li><li>Ajuda na configuração inicial</li><li>Contato direto para feedback</li><li>Participação na evolução do produto</li><li>Acesso antecipado às melhorias desta fase</li>
            </ul></div>
          </div>
          <div className="partner-container partner-start"><h3>Como a parceria começa</h3><ol><li>Conhecemos sua operação.</li><li>Demonstramos o produto.</li><li>Configuramos juntos.</li><li>Começa o piloto acompanhado.</li></ol></div>
        </section>

        <section id="contato" className="partner-container partner-section partner-contact" aria-labelledby="contact-title">
          <p className="partner-eyebrow">Vamos conversar</p><h2 id="contact-title">Quer conhecer o Job & Comissões na prática?</h2><p>Estamos selecionando as primeiras barbearias para esta fase do produto.</p>
          <a className="partner-button" href={COMMERCIAL_CONTACT_URL} target="_blank" rel="noopener noreferrer">Quero ser Parceiro Fundador</a>
          <a className="partner-text-link" href="#como-funciona">Ver como funciona</a>
        </section>
      </main>
      <footer className="partner-container partner-footer"><strong>Job & Comissões</strong><p>Gestão para a rotina real da barbearia.</p><a href="#inicio">Voltar ao início ↑</a></footer>
    </div>
  );
}
