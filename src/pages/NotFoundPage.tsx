import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { StatusScreen, STATUS_DESTINATIONS } from '../components/StatusScreen';

// The 404 is a fault surface, so it renders the SAME StatusScreen the
// ErrorBoundary renders. One error-page style in this app — not two.
export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="h-full min-h-[60vh]">
      <StatusScreen
        tone="warning"
        eyebrow="404 · Route not found"
        title="That page does not exist"
        description={`Nothing is registered at ${window.location.hash.replace('#', '') || 'this address'}. It may have been renamed, or the link that brought you here is out of date.`}
        actions={[
          {
            label: 'Go to dashboard',
            onClick: () => navigate('/'),
            icon: <Home className="h-3.5 w-3.5" />,
            primary: true,
          },
        ]}
        destinations={STATUS_DESTINATIONS}
        onNavigate={(path) => navigate(path)}
      />
    </div>
  );
}
