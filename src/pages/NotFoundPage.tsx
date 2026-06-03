import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';

export function NotFoundPage() {
  return (
    <div className="empty" style={{ paddingTop: 120 }}>
      <Icon name="alert" size={42} />
      <div className="empty-title">Página no encontrada</div>
      <p className="muted">La ruta que buscas no existe o aún no está disponible.</p>
      <Link to="/app/dashboard" className="btn btn-primary btn-sm" style={{ marginTop: 12, textDecoration: 'none' }}>
        Ir al dashboard
      </Link>
    </div>
  );
}
