import { getEvents, getEventStats, getEventParticipants } from '@/app/actions/dashboard';
import Dashboard from './Dashboard';

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ view?: string; event?: string }> }) {
  const [query, events] = await Promise.all([searchParams, getEvents()]);
  const event = events.find(item => item.id === query.event) || events[0];
  const view = query.view || 'overview';
  const showsParticipants = view !== 'overview' && view !== 'history';
  const [stats, participants] = await Promise.all([
    event && view === 'overview' ? getEventStats(event.id) : Promise.resolve(null),
    event && showsParticipants ? getEventParticipants(event.id) : Promise.resolve([]),
  ]);
  return <Dashboard key={`${event?.id || 'empty'}:${view}`} initialEvents={events} initialStats={stats} initialParticipants={participants} initialTemplate={view === 'mail' ? event?.email_template || '' : ''} />;
}
