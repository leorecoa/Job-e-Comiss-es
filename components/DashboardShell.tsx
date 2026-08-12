import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, Scissors, X } from 'lucide-react';
import { Badge, Button } from './ui';

export type DashboardNavigationItem = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
};

type DashboardShellProps = {
  barbershopName: string;
  userName: string;
  roleLabel: string;
  activeItemId: string;
  items: DashboardNavigationItem[];
  onNavigate: (itemId: string) => void;
  onLogout: () => void;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
};

const NavigationItems: React.FC<{
  activeItemId: string;
  items: DashboardNavigationItem[];
  onNavigate: (itemId: string) => void;
}> = ({ activeItemId, items, onNavigate }) => (
  <div className="ui-dashboard-nav-list">
    {items.map((item) => (
      <button
        key={item.id}
        type="button"
        className="ui-dashboard-nav-item"
        aria-current={activeItemId === item.id ? 'page' : undefined}
        onClick={() => onNavigate(item.id)}
      >
        <span className="ui-dashboard-nav-icon" aria-hidden="true">{item.icon}</span>
        <span>{item.label}</span>
      </button>
    ))}
  </div>
);

export const DashboardShell: React.FC<DashboardShellProps> = ({
  barbershopName,
  userName,
  roleLabel,
  activeItemId,
  items,
  onNavigate,
  onLogout,
  headerAction,
  children
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const activeItem = items.find((item) => item.id === activeItemId) || items[0];

  useEffect(() => {
    if (!mobileOpen) return undefined;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  const navigate = (itemId: string) => {
    onNavigate(itemId);
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  };

  const closeMobileNavigation = () => {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  };

  return (
    <div className="ui-dashboard-shell">
      <aside className="ui-dashboard-sidebar" aria-label="Navegacao principal do owner">
        <div className="ui-dashboard-brand">
          <span className="ui-dashboard-brand-mark"><Scissors size={20} aria-hidden="true" /></span>
          <div className="ui-dashboard-name-group">
            <strong title={barbershopName}>{barbershopName}</strong>
            <Badge>{roleLabel}</Badge>
          </div>
        </div>
        <nav aria-label="Secoes do painel">
          <NavigationItems activeItemId={activeItemId} items={items} onNavigate={navigate} />
        </nav>
        <div className="ui-dashboard-user">
          <div className="ui-dashboard-user-copy">
            <span>Conta ativa</span>
            <strong title={userName}>{userName}</strong>
          </div>
          <Button variant="ghost" type="button" onClick={onLogout}>
            <LogOut size={17} aria-hidden="true" /> Sair
          </Button>
        </div>
      </aside>

      <div className="ui-dashboard-workspace">
        <header className="ui-dashboard-header">
          <button
            ref={menuButtonRef}
            type="button"
            className="ui-dashboard-menu-button"
            aria-label="Abrir navegacao"
            aria-expanded={mobileOpen}
            aria-controls="owner-mobile-navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="ui-dashboard-section-heading">
            <span>{barbershopName}</span>
            <h1>{activeItem?.label}</h1>
            <p>{activeItem?.description}</p>
          </div>
          {headerAction && <div className="ui-dashboard-header-action">{headerAction}</div>}
        </header>

        <main className="ui-dashboard-main" id="owner-main-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      {mobileOpen && (
        <div className="ui-dashboard-mobile-layer">
          <button className="ui-dashboard-backdrop" type="button" aria-label="Fechar navegacao" onClick={closeMobileNavigation} />
          <aside id="owner-mobile-navigation" className="ui-dashboard-mobile-panel" aria-label="Navegacao mobile">
            <div className="ui-dashboard-mobile-heading">
              <strong title={barbershopName}>{barbershopName}</strong>
              <button ref={closeButtonRef} type="button" aria-label="Fechar navegacao" onClick={closeMobileNavigation}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Secoes do painel mobile">
              <NavigationItems activeItemId={activeItemId} items={items} onNavigate={navigate} />
            </nav>
            <Button variant="secondary" type="button" onClick={onLogout}>
              <LogOut size={17} aria-hidden="true" /> Sair
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
};
