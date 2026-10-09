'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Plus } from 'lucide-react';
import type { getEventStats, getEventParticipants } from '@/app/actions/dashboard';
import ParticipantList from '@/components/admin/ParticipantList';
import DeleteEventButton from '@/components/admin/DeleteEventButton';

type EventRecord = { id: string; name: string; event_code: string; created_at: string };
type Stats = NonNullable<Awaited<ReturnType<typeof getEventStats>>>;

export default function Dashboard({ initialEvents, initialStats, initialParticipants, initialTemplate }: { initialEvents: EventRecord[]; initialStats: Stats | null; initialParticipants: Awaited<ReturnType<typeof getEventParticipants>>; initialTemplate: string }) {
  const router = useRouter();
  const query = useSearchParams();
  const view = query.get('view') || 'overview';
  const events = initialEvents;
  const [notice, setNotice] = useState('');
  const stats = initialStats;
  const eventId = events.some(e => e.id === query.get('event')) ? query.get('event')! : events[0]?.id || '';
  const event = events.find(e => e.id === eventId);
  const onDeleted = () => { setNotice('イベントを削除しました。'); router.refresh(); };
  const href = (nextView: string) => `/admin?view=${nextView}${eventId ? `&event=${encodeURIComponent(eventId)}` : ''}`;
  const title = view === 'participants' ? '参加者・チケット' : view === 'mail' ? 'メール配信' : view === 'history' ? '過去のイベント' : 'イベントの準備を、ひとつずつ。';
  const metric = stats?.eventId === eventId ? stats : null;
  return <>
    <div className="admin-heading"><div><div className="admin-eyebrow">EVENT MANAGEMENT</div><h1>{title}</h1><p>{view === 'overview' ? '参加者の登録からQRチケットの配信まで、この画面で。' : view === 'history' ? 'イベントごとの参加者・配信状況・入場記録を確認できます。' : '対象イベントを確認してから、操作を進めてください。'}</p></div><Link className="admin-button" href={view === 'participants' ? `/admin/tickets/import?event=${eventId}` : '/admin/settings#create-event-form'}><Plus size={14} />{view === 'participants' ? 'CSVで参加者を登録' : '新しいイベント'}</Link></div>
    {notice && <p role="status" className="admin-panel">{notice}</p>}
    {!events.length ? <div className="admin-panel"><h2>最初のイベントを準備しましょう</h2><p className="admin-note mt-2 mb-4">新しいイベントは参加者が空の状態で始まります。</p><Link className="admin-button primary" href="/admin/settings#create-event-form">イベントを作成する<ArrowRight size={14}/></Link></div> : view === 'history' ? <section className="admin-panel"><div className="admin-panel-head"><div><h2>保存されているイベント</h2><p className="admin-note">新しいイベントを作成しても、これまでのデータは残ります。</p></div></div>{events.map(item => <div key={item.id} className="admin-event-row"><div><h3>{item.name}</h3><p className="admin-note">イベントコード：{item.event_code}</p></div><div className="flex flex-wrap gap-2"><Link className="admin-button" href={`/admin?view=participants&event=${item.id}`}>参加者・記録を見る<ArrowRight size={14}/></Link><DeleteEventButton event={item} onDeleted={() => onDeleted()}/></div></div>)}</section> : <>
      <section className="admin-panel"><label className="admin-eyebrow" htmlFor="current-event">CURRENT EVENT</label><select id="current-event" className="admin-event-select" value={eventId} onChange={e => router.replace(`/admin?view=${view}&event=${encodeURIComponent(e.target.value)}`)}>{events.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="admin-note">イベントコード：{event?.event_code}</p><div className="flex flex-wrap items-center justify-between gap-3 mt-5"><p className="admin-note">まず設定を確認し、参加者の登録とチケットの配信を進めましょう。</p>{event && <DeleteEventButton event={event} onDeleted={() => onDeleted()}/>}</div></section>
      {view === 'overview' ? <>
        <div className="admin-metrics">{[{label:'登録チケット',value:metric?.total,note:'このイベントの参加チケットを集計'},{label:'メール送信済み',value:metric?.sent,note:'QRチケットを配信済み'},{label:'未送信チケット',value:metric?.unsent,note:'配信前に宛先を確認してください'}].map(item => <div key={item.label} className="admin-metric"><p className="admin-metric-label">{item.label}</p><p className="admin-metric-value">{item.value ?? '—'}<small>件</small></p><p className="admin-metric-note">{item.note}</p></div>)}</div>
        <section className="admin-panel"><div className="admin-panel-head"><div><h2>配信までの3ステップ</h2><p className="admin-note mt-1">準備の順番に沿って進められます。</p></div></div><div className="admin-steps">{[
          {title:'イベントを設定',text:<>イベント名・券種と<br/>券種ごとの受付時間を設定。</>,url:'/admin/settings',cta:'設定を確認'},
          {title:'参加者を登録',text:<>購入者のCSVを読み込み、<br/>照合結果を確認して取り込み。</>,url:`/admin/tickets/import?event=${eventId}`,cta:'参加者を登録'},
          {title:'QRチケット・メール配信',text:<>配信するチケットの<br/>本文と宛先を確認して送信。</>,url:href('mail'),cta:'配信の準備'},
        ].map((step,i) => <div className="admin-step" key={step.title}><span className="admin-step-number">{i+1}</span><h3>{step.title}</h3><p>{step.text}</p><Link href={step.url} className={`admin-button ${i === 2 ? 'primary' : ''}`}>{step.cta}<ArrowRight size={13}/></Link></div>)}</div></section>
        <div className="admin-split"><section className="admin-panel"><h3>データを残して、次のイベントへ</h3><p className="admin-note mt-3">新しいイベントを作ると、参加者が空の状態で始まります。前回の参加者・配信状況・入場記録はイベントごとに残ります。</p><Link className="admin-text-link mt-2" href={href('history')}>過去のイベントを見る<ArrowRight size={12}/></Link></section><section className="admin-panel"><h3>当日の受付</h3><div className="admin-info-row"><span>チェックイン済み</span><strong>{metric?.checkedIn ?? '—'} 件</strong></div><div className="admin-info-row"><span>未チェックイン</span><strong>{metric?.pending ?? '—'} 件</strong></div><Link className="admin-text-link" href="/admin/staff">スタッフ・受付端末を管理<ArrowRight size={12}/></Link></section></div>
      </> : <><div className="flex flex-wrap items-center justify-between gap-3 mb-4"><p className="admin-note">{view === 'mail' ? '未送信の参加者にQRチケットを配信します。' : '登録済みの参加者とチケットの状態を確認できます。'}</p><Link className="admin-text-link" href={view === 'mail' ? '/admin/settings/smtp' : href('mail')}>{view === 'mail' ? 'メール送信設定' : 'メール配信へ'}<ArrowRight size={12}/></Link></div><ParticipantList key={eventId + view} eventId={eventId} mode={view} initialParticipants={initialParticipants} initialTemplate={initialTemplate}/></>}
    </>}
  </>;
}
