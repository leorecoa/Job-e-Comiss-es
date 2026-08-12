import React, { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { AppRole } from '../services/authRepository';
import { AuthLayout, Button, FieldMessage, Input, Label, PageHeader, Surface } from './ui';

interface AuthScreenProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, displayName: string, role: AppRole) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSignIn, onSignUp, loading = false, error }) => {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<AppRole>('owner');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'signin') {
      await onSignIn(email.trim(), password);
      return;
    }

    await onSignUp(email.trim(), password, displayName.trim(), role);
  };

  return (
    <AuthLayout>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.22 }}
      >
        <div className="ui-auth-brand" aria-label="Job e Comissoes">
          <span className="ui-auth-mark"><Lock size={22} aria-hidden="true" /></span>
          <div>
            <strong className="block font-display text-lg">Job e Comissoes</strong>
            <span className="text-xs text-[var(--color-muted)]">Operacao de barbearia</span>
          </div>
        </div>

        <Surface>
          <PageHeader title="Painel interno" description="Entre com Supabase Auth para acessar a agenda." eyebrow="Acesso da equipe" />
          <form onSubmit={handleSubmit} className="ui-auth-form">
            <div className="ui-auth-tabs" aria-label="Tipo de acesso">
              <Button variant="ghost" type="button" aria-pressed={mode === 'signin'} onClick={() => setMode('signin')}>Entrar</Button>
              <Button variant="ghost" type="button" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>Criar acesso</Button>
            </div>

            {error && <FieldMessage id="auth-form-error" tone="error" aria-live="assertive">{error}</FieldMessage>}

            {mode === 'signup' && (
              <div className="ui-field">
                <Label htmlFor="auth-display-name">Nome</Label>
                <Input id="auth-display-name" autoComplete="name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
            )}

            <div className="ui-field">
              <Label htmlFor="auth-email">Email</Label>
              <Input id="auth-email" type="email" autoComplete="email" required aria-invalid={Boolean(error)} aria-describedby={error ? 'auth-form-error' : undefined} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="ui-field">
              <Label htmlFor="auth-password">Senha</Label>
              <Input id="auth-password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={6} aria-invalid={Boolean(error)} aria-describedby={error ? 'auth-form-error' : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {mode === 'signup' && (
              <div className="ui-field">
                <Label htmlFor="auth-role">Perfil</Label>
                <select id="auth-role" value={role} onChange={(e) => setRole(e.target.value as AppRole)} className="ui-input">
                  <option value="owner">Dono</option>
                  <option value="barber">Barbeiro</option>
                </select>
              </div>
            )}

            <Button loading={loading} type="submit" className="w-full">
              {loading ? 'Aguarde...' : mode === 'signin' ? 'Entrar' : 'Criar acesso'}
              <ArrowRight size={18} aria-hidden="true" />
            </Button>

            <div className="ui-auth-footer">
              <a href="/book" className="ui-auth-link">Abrir agendamento publico</a>
            </div>
          </form>
        </Surface>
      </motion.div>
    </AuthLayout>
  );
};
