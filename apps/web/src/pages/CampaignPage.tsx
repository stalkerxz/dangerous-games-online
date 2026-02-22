import { useContent } from '../contentContext';
import { ScenePlayer } from '../components/ScenePlayer';

export function CampaignPage() {
  const { campaign, loading, error, source } = useContent();

  if (loading) {
    return <section><h2>Campaign</h2><p>Syncing content packs…</p></section>;
  }

  if (error || !campaign) {
    return <section><h2>Campaign</h2><p>Campaign unavailable offline. Connect once to cache packs.</p></section>;
  }

  return (
    <section>
      <h2>{campaign.title}</h2>
      <p>Source: {source === 'network' ? 'Online sync' : 'Cached offline packs'}</p>
      <ScenePlayer title={campaign.title} scenes={campaign.scenes} />
    </section>
  );
}
