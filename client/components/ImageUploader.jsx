'use client';
import { useState } from 'react';
import { api, img } from '@/lib/api';
import { useStore } from './Providers';

const MAX_MB = 5;
const MAX_PHOTOS = 6;

// Photo picker for the product form. Files go from the browser to Cloudinary with a one-time signature from our API.
export default function ImageUploader({ images, onChange }) {
  const { token } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [link, setLink] = useState('');

  async function upload(files) {
    setErr('');
    setBusy(true);
    let list = images;
    try {
      for (const file of files) {
        if (list.length >= MAX_PHOTOS) throw new Error(`Up to ${MAX_PHOTOS} photos per product`);
        if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image`);
        if (file.size > MAX_MB * 1024 * 1024) throw new Error(`${file.name} is larger than ${MAX_MB} MB`);
        const s = await api('/admin/uploads/sign', { token });
        const form = new FormData();
        form.append('file', file);
        form.append('api_key', s.apiKey);
        form.append('timestamp', s.timestamp);
        form.append('folder', s.folder);
        form.append('signature', s.signature);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
        list = [...list, data.secure_url];
        onChange(list); // each photo appears as soon as it lands
      }
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  const makeCover = (i) => onChange([images[i], ...images.filter((_, n) => n !== i)]);
  const remove = (i) => onChange(images.filter((_, n) => n !== i));
  function addLink() {
    if (!link.startsWith('https://')) return setErr('Links must start with https://');
    onChange([...images, link]);
    setLink('');
    setErr('');
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {images.map((u, i) => (
          <div key={u} className="w-24 space-y-1 text-center text-xs">
            <img src={img(u, 200)} alt="" className="h-24 w-24 rounded-xl border-2 border-ink/20 object-cover" />
            {i === 0 ? <p className="font-bold">Cover photo</p> : <button type="button" onClick={() => makeCover(i)} className="underline">Make cover</button>}
            <button type="button" onClick={() => remove(i)} className="block w-full text-red-700 underline">Remove</button>
          </div>
        ))}
      </div>
      <label className={`btn btn-ghost ${busy ? 'pointer-events-none opacity-60' : ''}`}>
        {busy ? 'Uploading...' : 'Add photos'}
        <input type="file" accept="image/*" multiple hidden onChange={(e) => { const files = [...e.target.files]; e.target.value = ''; upload(files); }} />
      </label>
      <div className="flex gap-2">
        <input
          type="url" placeholder="Or paste an image link (https://...)" value={link} className="field w-full"
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
        />
        <button type="button" onClick={addLink} className="btn btn-ghost">Add link</button>
      </div>
      {err && <p className="text-red-700">{err}</p>}
    </div>
  );
}
