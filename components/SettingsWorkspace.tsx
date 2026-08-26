import React, { useEffect } from 'react';
import { BookOpen, Globe2, Scissors, Users } from 'lucide-react';
import { PageHeader, Surface } from './ui';
import type { ManagementSectionHash } from '../utils/ownerNavigation';

type SettingsWorkspaceProps = {
  publicPresence: React.ReactNode;
  readiness: React.ReactNode;
  team: React.ReactNode;
  catalog: React.ReactNode;
  activeSection: ManagementSectionHash;
  onNavigate: (section: ManagementSectionHash) => void;
};

const workspaceLinks = [
  { href: '#management-public-presence', label: 'Presença pública', icon: Globe2 },
  { href: '#management-readiness', label: 'Prontidão', icon: BookOpen },
  { href: '#management-team', label: 'Equipe', icon: Users },
  { href: '#management-catalog', label: 'Catálogo', icon: Scissors }
];

export const SettingsWorkspace: React.FC<SettingsWorkspaceProps> = ({
  publicPresence,
  readiness,
  team,
  catalog,
  activeSection,
  onNavigate
}) => {
  useEffect(() => {
    window.requestAnimationFrame(() => {
      document.getElementById(activeSection.slice(1))?.scrollIntoView({ block: 'start' });
    });
  }, [activeSection]);

  return (
    <div className="ui-settings-workspace">
    <Surface className="ui-settings-intro">
      <PageHeader
        title="Gestão da barbearia"
        description="Organize sua presença pública, equipe e catálogo sem interromper a agenda do dia."
        eyebrow="Área administrativa"
      />
      <nav className="ui-settings-navigation" aria-label="Grupos da gestão">
        {workspaceLinks.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            aria-current={activeSection === href ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(href as ManagementSectionHash);
            }}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </a>
        ))}
      </nav>
    </Surface>

    <div className="ui-settings-content">
      <div id="management-public-presence" className="ui-settings-group" tabIndex={-1}>{publicPresence}</div>
      <div id="management-readiness" className="ui-settings-group" tabIndex={-1}>{readiness}</div>
      <div id="management-team" className="ui-settings-group" tabIndex={-1}>{team}</div>
      <div id="management-catalog" className="ui-settings-group" tabIndex={-1}>{catalog}</div>
    </div>
    </div>
  );
};
