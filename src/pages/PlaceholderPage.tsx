import { Icon } from '@/components/Icon';

export function PlaceholderPage({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="card">
        <div className="empty">
          <Icon name="warning" size={36} />
          <div className="empty-title">Módulo en construcción</div>
          <p className="muted">
            Esta sección se diseñará primero en el prototipo HTML y luego se migrará a producción.
          </p>
        </div>
      </div>
    </>
  );
}
