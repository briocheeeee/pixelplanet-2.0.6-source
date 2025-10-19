import React, { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { requestUploadAvatar, requestMe } from '../store/actions/fetch.js';
import { loginUser } from '../store/actions/index.js';

const AvatarUpload = () => {
  const inputRef = useRef();
  const [status, setStatus] = useState(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const dispatch = useDispatch();
  const currentAvatar = useSelector((state) => state.user.avatar);

  const toWebp256 = (file) => new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const ir = img.width / img.height;
        const tr = 1;
        let sx = 0; let sy = 0; let sw = img.width; let sh = img.height;
        if (ir > tr) {
          sw = img.height * tr;
          sx = (img.width - sw) / 2;
        } else if (ir < tr) {
          sh = img.width / tr;
          sy = (img.height - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(new File([blob], `${Date.now()}.webp`, { type: 'image/webp' }));
          else resolve(file);
        }, 'image/webp', 0.85);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    } catch {
      resolve(file);
    }
  });

  const onSelect = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    // local preview rendering is handled globally in UserAreaContent
    const optimized = await toWebp256(file);
    const res = await requestUploadAvatar(optimized);
    setBusy(false);
    if (res.errors) {
      setStatus(res.errors[0] || t`Upload failed`);
      return;
    }
    if (res.avatar) {
      dispatch({ type: 's/SET_AVATAR', avatar: res.avatar });
    }
    try {
      const me = await requestMe();
      if (!me.errors) {
        dispatch(loginUser(me));
      }
    } catch {}
    if (res.version) setVersion(res.version);
    else setVersion(Date.now());
    setStatus(t`Avatar uploaded and saved to your profile`);
  };

  const hasPreview = false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onSelect}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current && inputRef.current.click()}
      >{busy ? t`Uploading...` : t`Upload Avatar`}</button>
      {status && (
        <div style={{ fontSize: 12, textAlign: 'center', maxWidth: '90%' }}>{status}</div>
      )}
    </div>
  );
};

export default React.memo(AvatarUpload);
