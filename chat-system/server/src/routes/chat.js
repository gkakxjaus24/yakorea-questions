const { Router, raw } = require('express');
const supabase = require('../services/supabase');
const { roomLabelMap, guestNameMap, sourceMap } = require('../socket/guestHandler');

const router = Router();

router.get('/rooms', async (req, res) => {
  let query = supabase
    .from('chat_rooms')
    .select('*')
    .order('updated_at', { ascending: false });

  if (!req.query.include_closed) {
    query = query.neq('status', 'closed');
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  // roomLabel 인메모리 맵에서 병합
  const result = (data || []).map(r => ({
    ...r,
    room_label: roomLabelMap.get(r.id) || '',
    guest_name: guestNameMap.get(r.id) || '',
    source: sourceMap.get(r.id) || '',
  }));
  res.json(result);
});

router.post('/rooms', async (req, res) => {
  const { guest_id } = req.body;
  if (!guest_id) {
    return res.status(400).json({ error: 'guest_id is required' });
  }

  const { data, error } = await supabase
    .from('chat_rooms')
    .insert({ guest_id, status: 'auto' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.get('/rooms/:id/messages', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/chat/upload-image
// Headers: x-room-id, Content-Type (image/jpeg | image/png)
// Body: raw image binary
// Returns: { publicUrl }
// 위젯이 Railway로 직접 전송 → Railway가 서버 SDK로 Supabase Storage 업로드
router.post(
  '/upload-image',
  raw({ type: ['image/jpeg', 'image/png'], limit: '6mb' }),
  async (req, res) => {
    try {
      const roomId = req.get('x-room-id');
      const mimeType = req.get('content-type');

      if (!roomId) {
        return res.status(400).json({ error: 'x-room-id header required' });
      }
      if (!['image/jpeg', 'image/png'].includes(mimeType)) {
        return res.status(400).json({ error: 'Only image/jpeg and image/png are allowed' });
      }
      if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'Empty body' });
      }

      // 방이 존재하고 닫히지 않은 상태인지 확인
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('status')
        .eq('id', roomId)
        .maybeSingle();
      if (!room || room.status === 'closed') {
        return res.status(403).json({ error: 'Room not found or closed' });
      }

      const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      const path = `${roomId}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('chat-images')
        .upload(path, req.body, { contentType: mimeType });

      if (error) return res.status(500).json({ error: error.message });

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(path);

      res.json({ publicUrl });
    } catch (err) {
      console.error('[upload-image] error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
