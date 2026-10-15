'use client';
import { useEffect, useState } from 'react';
import { api, friendlyErrorMessage } from '@/lib/api';
import { useStore } from '@/components/Providers';

const MAX_AUDIO_MB = 20;

export default function BackgroundAudioSettings() {
  const { token, refreshConfig } = useStore();
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    api('/admin/settings', { token })
      .then((settings) => { if (active) setAudioUrl(settings.backgroundAudioUrl || ''); })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function uploadAudio(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    setError('');
    setNotice('');
    const hasAudioType = file.type.startsWith('audio/');
    const hasAudioExtension = /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(file.name);
    if (!hasAudioType && !hasAudioExtension) {
      setError('Choose an audio file.');
      return;
    }
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      setError(`Audio files must be ${MAX_AUDIO_MB} MB or smaller.`);
      return;
    }

    setBusy(true);
    try {
      const signature = await api('/admin/uploads/audio-sign', { token });
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', signature.apiKey);
      form.append('timestamp', String(signature.timestamp));
      form.append('folder', signature.folder);
      form.append('signature', signature.signature);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/${signature.resourceType}/upload`, {
        method: 'POST',
        body: form,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || 'The audio service could not accept this upload. Please try again.');
      if (!result?.secure_url) throw new Error('The audio service did not return a usable file link. Please try again.');

      await api('/admin/settings/audio', { token, method: 'PUT', body: { url: result.secure_url } });
      setAudioUrl(result.secure_url);
      await refreshConfig();
      setNotice('Background audio updated. It now loops for all visitors.');
    } catch (e) {
      setError(friendlyErrorMessage(e, 'Could not upload the audio. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function removeAudio() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await api('/admin/settings/audio', { token, method: 'DELETE' });
      setAudioUrl('');
      await refreshConfig();
      setNotice('Background audio has been removed from the site.');
    } catch (e) {
      setError(friendlyErrorMessage(e, 'Could not remove the background audio. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4" aria-labelledby="background-audio-title">
      <div>
        <p className="empty-cart-kicker">Store experience</p>
        <h1 id="background-audio-title" className="text-2xl font-bold">Background audio</h1>
      </div>
      <div className="card space-y-4">
        <p className="text-sm leading-6 text-stone-700">
          Upload one track for the whole shop. It repeats in the background for guests and signed-in customers.
          Visitors can mute or unmute it using the sound button on the page.
        </p>
        <p className="text-sm leading-6 text-stone-600">
          The site tries to start the track with sound. If a browser blocks audible autoplay, it starts muted and visitors can unmute it with one click.
        </p>
        {loading ? <p role="status">Loading audio settings…</p> : audioUrl ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink/15 bg-white/70 p-3">
            <span aria-hidden="true" className="text-2xl">♫</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">A background track is active</p>
              <p className="text-xs text-stone-500">Replace it by uploading another audio file.</p>
            </div>
            <button type="button" onClick={removeAudio} disabled={busy} className="btn btn-danger disabled:opacity-60">
              Remove audio
            </button>
          </div>
        ) : <p className="rounded-xl border border-dashed border-ink/25 p-4 text-sm text-stone-600">No background track is set yet.</p>}

        <label className={`btn btn-primary w-fit ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          {busy ? 'Uploading audio…' : audioUrl ? 'Replace audio' : 'Upload audio'}
          <input type="file" accept="audio/*" hidden disabled={busy || loading} onChange={uploadAudio} />
        </label>
        <p className="text-xs text-stone-500">Audio files up to {MAX_AUDIO_MB} MB are supported.</p>
        {error && <p className="text-sm font-semibold text-red-700" role="alert">{error}</p>}
        {notice && <p className="text-sm font-semibold text-green-800" role="status">{notice}</p>}
      </div>
    </section>
  );
}
